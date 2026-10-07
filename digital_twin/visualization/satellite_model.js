import { CameraRangeMotion, cameraNow, cameraEase, cameraDirection, cameraBasis, cameraAttitude } from './camera_motion.js';

// One glTF model for the selected satellite plus an optional follow camera. The caller supplies
// the model description and a native ITRF or explicitly tagged source-node sampler; this layer never reads application state,
// transport, or the catalog. Orientation is a display approximation: the body x-axis follows
// a buffered forward difference and the z-axis points away from Earth. It is not an attitude estimate.
// Scale is metres per native model unit so the body appears at its approximate real size.
const AMBIENT_IRRADIANCE = 0.62;
const DEFAULT_MINIMUM_PIXEL_SIZE = 12;
const DEFAULT_RANGE_FACTOR = 3.0;
const MINIMUM_RANGE_METERS = 20;
const POINT_ONLY_RANGE_METERS = 3000;
const MAXIMUM_RANGE_METERS = 2_000_000;
// Zooming out past this distance hands the wheel back to the Earth-centred camera.
const RELEASE_RANGE_METERS = 1_500_000;
// The flat map stays north-up. Only an explicit 3D focus levels the camera;
// wheel input preserves the user's orbital viewing angle.
const MAP_FOCUS_WIDTH_METERS = 500_000;
const MAP_MINIMUM_WIDTH_METERS = 1_000;
const MAP_MAXIMUM_WIDTH_METERS = 40_000_000;
const MAP_RELEASE_WIDTH_METERS = 20_000_000;
const NODE_POSE_METADATA = Object.freeze({model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'});
function definitionSignature(value) {
  const ordered = item => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map(ordered);
    if (item && Object.getPrototypeOf(item) === Object.prototype) return Object.fromEntries(Object.keys(item).sort().map(key => [key, ordered(item[key])]));
    throw new TypeError('finite JSON node definition required');
  };
  return JSON.stringify(ordered(value));
}
function nodePoseIdentity(description) {
  const source = description?.pose_source, node = source?.node_definition;
  if (source?.kind !== 'source_node' || node?.schema !== 1 || typeof node.id !== 'string' || !node.id.trim() || typeof source.definition_hash !== 'string' || !/^[a-f0-9]{64}$/.test(source.definition_hash)) return null;
  try { return `source_node|${source.definition_hash}|${definitionSignature(node)}`; } catch { return null; }
}

export class SatelliteModelLayer {
  constructor(options = {}) {
    this.viewerProvider = options.viewer || null;
    this.cesiumProvider = options.cesium || (() => globalThis.window?.Cesium);
    this.timeSource = typeof options.timeSource === 'function' ? options.timeSource : null;
    this.advanceUtc = options.advanceUtc;
    this.sampleAt = null;
    this.onStatus = options.onStatus || (() => {});
    this.phase = null;
    this.errorKind = null;
    this.error = null;
    this.modelRemovers = [];
    this.disposed = false;
    this.description = null;
    this.onFrame = typeof options.onFrame === 'function' ? options.onFrame : null;
    this.isTransitioning = typeof options.isTransitioning === 'function' ? options.isTransitioning : () => false;
    this.rangeFactor = Number(options.rangeFactor) || DEFAULT_RANGE_FACTOR;
    this.onTrackingChange = typeof options.onTrackingChange === 'function' ? options.onTrackingChange : () => {};
    this.model = null;
    this.current = null;
    this.positionAt = null;
    this.targetId = null;
    this.loadToken = 0;
    this.tracking = false;
    this.pendingFocus = false;
    this.pendingFocusOptions = null;
    this.frameRemover = null;
    this.motionNow = options.motionNow || cameraNow;
    this.rangeMotion = new CameraRangeMotion({ now: this.motionNow });
    this.onCameraInput = options.onCameraInput || (() => {});
    this.focusPose = null;
    this.mapOffset = null;
    this.focusFlight = false;
    this.focusRevision = 0;
    this.motionStamp = this.motionNow();
  }

  get viewer() {
    return typeof this.viewerProvider === 'function' ? this.viewerProvider() : this.viewerProvider;
  }

  get cesium() {
    return typeof this.cesiumProvider === 'function' ? this.cesiumProvider() : this.cesiumProvider;
  }

  setTimeSource(timeSource) {
    this.timeSource = typeof timeSource === 'function' ? timeSource : null;
  }

  // description may be null for objects without a model; the follow camera still works on the point.
  async show(description, sampleAt, date = this.timeSource?.()) {
    if (this.disposed) return null;
    const Cesium = this.cesium;
    const viewer = this.viewer;
    const targetId = description?.pose_source ? nodePoseIdentity(description) : description?.satelliteId == null ? null : `gp|${description.satelliteId}|${description.normalized_gp_sha256 || ''}`;
    if (this.targetId !== null && targetId !== this.targetId) {
      // Selecting another body only selects it: never teleport a follow camera onto it.
      this.pendingFocus = false;
      this.untrack();
    }
    this.targetId = targetId;
    this.sampleAt = typeof sampleAt === 'function' ? sampleAt : null;
    this.positionAt = time => this.geographicAt(time);
    this.description = description ? structuredClone(description) : null;
    if (!description?.url || !Cesium?.Model?.fromGltfAsync || !viewer?.scene?.primitives) {
      this.removeModel();
      this.current = description?.url ? null : { key: null, sizeMeters: Number(description?.sizeMeters) || null, satelliteId: description?.satelliteId ?? null };
      this.status(description?.url ? 'error' : 'unassigned', description?.url ? 'renderer' : null, description?.url ? 'renderer_unavailable' : null);
      if (this.tracking) this.update(date);
      return null;
    }
    const scale = Number(description.scale) > 0 ? Number(description.scale) : 1;
    const key = `${targetId}|${description.url}|${scale}`;
    if (this.current?.key === key && this.phase === 'error') return null;
    if (this.current?.key === key && !this.model) return null;
    if (this.model && this.current?.key === key) {
      this.update(date);
      return this.model;
    }
    this.removeModel();
    const token = ++this.loadToken;
    this.current = {
      key,
      satelliteId: String(description.satelliteId),
      orientation: this.description.orientation || {},
      minimumPixelSize: Number(description.minimumPixelSize) || DEFAULT_MINIMUM_PIXEL_SIZE,
      sizeMeters: Number(description.sizeMeters) || null,
      scale,
    };
    this.status('loading');
    let model;
    try {
      model = await Cesium.Model.fromGltfAsync({
        url: description.url,
        id: this.description.pose_source ? {node_id:this.description.pose_source.node_definition?.id} : { satelliteId: this.current.satelliteId },
        scale,
        minimumPixelSize: this.current.minimumPixelSize,
        allowPicking: true,
        show: false,
        imageBasedLighting: this.ambientLighting(Cesium),
      });
    } catch (error) {
      if (token === this.loadToken) { this.untrack(); this.status('error', 'load', String(error?.message || error)); }
      return null;
    }
    if (token !== this.loadToken) {
      model.destroy?.();
      return null;
    }
    this.model = viewer.scene.primitives.add(model);
    const ready = () => {
      if (token !== this.loadToken || this.disposed || this.phase === 'error') return;
      this.status(this.cartesianAt(this.timeSource?.()) ? 'ready' : 'hidden_no_geometry');
      this.update(this.timeSource?.());
      if (this.pendingFocus && this.phase === 'ready') this.focus(undefined, this.pendingFocusOptions || {});
    };
    if (model.readyEvent?.addEventListener) this.modelRemovers.push(model.readyEvent.addEventListener(ready));
    if (model.errorEvent?.addEventListener) this.modelRemovers.push(model.errorEvent.addEventListener(error => {
      if (token !== this.loadToken) return;
      model.show = false; this.untrack(); this.status('error', 'render', String(error?.message || error));
    }));
    this.update(this.timeSource?.() ?? date);
    this.startFrameLoop();
    viewer.scene.requestRender?.();
    if (model.ready === true) ready();
    return this.model;
  }

  ambientLighting(Cesium) {
    try {
      if (!Cesium.ImageBasedLighting || !Cesium.Cartesian3) return undefined;
      // A constant L0,0 term keeps the night side of the body readable without changing the sun.
      const coefficients = Array.from({ length: 9 }, (_, index) => index === 0
        ? new Cesium.Cartesian3(AMBIENT_IRRADIANCE, AMBIENT_IRRADIANCE, AMBIENT_IRRADIANCE * 1.05)
        : new Cesium.Cartesian3(0, 0, 0));
      return new Cesium.ImageBasedLighting({ sphericalHarmonicCoefficients: coefficients });
    } catch {
      return undefined;
    }
  }

  nativeAt(date) {
    if (typeof date !== 'string' || !date.endsWith('Z')) return null;
    const sample = this.sampleAt?.(date);
    if (this.description?.pose_source) {
      try {
        const source = this.description.pose_source, row = sample?.row;
        if (!nodePoseIdentity(this.description) || this.advanceUtc?.(date,0) !== date || !sample || Object.entries(NODE_POSE_METADATA).some(([key,value]) => sample[key] !== value) || sample.node_id !== source.node_definition.id || sample.definition_hash !== source.definition_hash || definitionSignature(sample.node_definition) !== definitionSignature(source.node_definition) || row?.utc !== date || row.status !== 'valid' || row.error_code !== null || !Array.isArray(row.position_m) || row.position_m.length !== 3 || !row.position_m.every(Number.isFinite)) return null;
        return {...NODE_POSE_METADATA,node_id:sample.node_id,definition_hash:sample.definition_hash,utc:date,position_m:[...row.position_m]};
      } catch { return null; }
    }
    if (!sample || sample.frame !== 'ITRF' || sample.utc !== date || !Array.isArray(sample.position_m) || sample.position_m.length !== 3 || !sample.position_m.every(Number.isFinite)) return null;
    if (this.description?.satelliteId != null && String(sample.catalog_number) !== String(this.description.satelliteId)) return null;
    if (this.description?.normalized_gp_sha256 && sample.normalized_gp_sha256 !== this.description.normalized_gp_sha256) return null;
    return sample;
  }

  geographicAt(date) {
    const here = this.cartesianAt(date), C = this.cesium;
    if (!here || !C?.Cartographic?.fromCartesian) return null;
    const p = C.Cartographic.fromCartesian(here, C.Ellipsoid.WGS84);
    if (!p || ![p.longitude, p.latitude, p.height].every(Number.isFinite)) return null;
    return {longitude:p.longitude * 180 / Math.PI, latitude:p.latitude * 180 / Math.PI, altitude:p.height / 1000};
  }

  status(phase, errorKind = null, error = null) {
    if (this.phase === phase && this.errorKind === errorKind && this.error === error) return;
    this.phase = phase; this.errorKind = errorKind; this.error = error;
    this.onStatus({phase, errorKind, error, ...(this.description?.pose_source ? {node_id:this.description.pose_source.node_definition?.id ?? null,definition_hash:this.description.pose_source.definition_hash,...NODE_POSE_METADATA} : {satelliteId:this.description?.satelliteId ?? null}), orientation:'display_approximation'});
  }

  setRenderVisible(visible){if(this.disposed)return false;this.renderVisible=visible!==false;if(this.model&&!this.renderVisible)this.model.show=false;return this.renderVisible;}

  async retry() {
    if (this.disposed || this.phase !== 'error') return null;
    const description = this.description, sampler = this.sampleAt;
    this.removeModel();
    return this.show(description, sampler, this.timeSource?.());
  }

  cartesianAt(date) {
    const Cesium = this.cesium;
    const position = this.nativeAt(date);
    if (!position || !Cesium?.Cartesian3) return null;
    return new Cesium.Cartesian3(...position.position_m);
  }

  update(date = this.timeSource?.()) {
    const Cesium = this.cesium;
    if (!Cesium || !this.positionAt) return;
    const canvas = this.viewer?.scene?.canvas;
    if (canvas && (!canvas.clientWidth || !canvas.clientHeight)) { this.untrack(); return; }
    if (this.isTransitioning() || (Cesium.SceneMode && this.viewer?.scene?.mode === Cesium.SceneMode.MORPHING)) {
      this.untrack();
      return;
    }
    const here = this.cartesianAt(date);
    if (this.phase === 'error') { if (this.model) this.model.show = false; return; }
    if (!here) { this.untrack(); if (this.model) this.status('hidden_no_geometry'); }
    else if (this.model && this.phase === 'hidden_no_geometry') this.status(this.model.ready ? 'ready' : 'loading');
    if (this.model && this.current?.key) {
      if (!here) {
        this.model.show = false;
      } else {
        this.model.modelMatrix = this.bodyMatrix(Cesium, here, date);
        this.model.show = this.renderVisible!==false;
      }
    }
    if (this.tracking && here) {
      const now = this.motionNow();
      const dt = Math.max(0, Math.min(50, now - this.motionStamp));
      this.motionStamp = now;
      const outward = this.rangeMotion.direction < 0;
      const moving = this.rangeMotion.active;
      const range = this.rangeMotion.advance(this.zoomDistance());
      if (Cesium.SceneMode && this.viewer?.scene?.mode === Cesium.SceneMode.SCENE2D) {
        if (this.mapOffset) this.mapOffset.elapsed += dt;
        this.mapView(date, range);
        if (outward && range >= MAP_RELEASE_WIDTH_METERS) this.untrack();
      } else {
        this.followCamera(Cesium, here);
        this.advanceCamera(Cesium, range, dt, moving);
        if (outward && range >= RELEASE_RANGE_METERS) this.untrack({ aimAtEarth: true });
      }
    } else if (!here) this.cancelMotion();
  }

  // In Cesium 2D, map scale is the orthographic frustum width, not camera.position.
  // Stay in the world/map frame: reusing the body's ENU frame rotates the flat map.
  mapView(date, width) {
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    const position = this.positionAt?.(date);
    if (!camera || !position || !Number.isFinite(width) || width <= 0) return false;
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    // Infinite-scroll 2D ignores setView's orientation argument; set its planar axes explicitly.
    camera.direction = new Cesium.Cartesian3(0, 0, -1);
    camera.up = new Cesium.Cartesian3(0, 1, 0);
    camera.right = new Cesium.Cartesian3(1, 0, 0);
    let longitude = position.longitude, latitude = position.latitude;
    if (this.mapOffset) {
      const progress = Math.min(1, this.mapOffset.elapsed / 650);
      const remaining = 1 - cameraEase(progress);
      longitude += this.mapOffset.longitude * remaining;
      latitude += this.mapOffset.latitude * remaining;
      if (progress === 1) this.mapOffset = null;
    }
    camera.setView({ destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, width) });
    return true;
  }

  bodyMatrix(Cesium, here, date) {
    const ahead = this.advanceUtc ? this.cartesianAt(this.advanceUtc(date, 1)) : null;
    let rotation = null;
    if (ahead) {
      const velocity = Cesium.Cartesian3.subtract(ahead, here, new Cesium.Cartesian3());
      if (Cesium.Cartesian3.magnitude(velocity) > 1) {
        Cesium.Cartesian3.normalize(velocity, velocity);
        rotation = Cesium.Transforms.rotationMatrixFromPositionVelocity(here, velocity, Cesium.Ellipsoid.WGS84, new Cesium.Matrix3());
      }
    }
    if (!rotation) return Cesium.Transforms.eastNorthUpToFixedFrame(here);
    const { heading = 0, pitch = 0, roll = 0 } = this.current?.orientation || {};
    if (heading || pitch || roll) {
      const trim = Cesium.Matrix3.fromHeadingPitchRoll(
        new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(heading), Cesium.Math.toRadians(pitch), Cesium.Math.toRadians(roll)),
        new Cesium.Matrix3(),
      );
      Cesium.Matrix3.multiply(rotation, trim, rotation);
    }
    return Cesium.Matrix4.fromRotationTranslation(rotation, here, new Cesium.Matrix4());
  }

  // Keep the camera's offset in the satellite's local frame while the frame moves with the body.
  followCamera(Cesium, here) {
    const camera = this.viewer?.camera;
    if (!camera) return;
    const position = Cesium.Cartesian3.clone(camera.position, new Cesium.Cartesian3());
    const direction = Cesium.Cartesian3.clone(camera.direction, new Cesium.Cartesian3());
    const up = Cesium.Cartesian3.clone(camera.up, new Cesium.Cartesian3());
    camera.lookAtTransform(Cesium.Transforms.eastNorthUpToFixedFrame(here));
    camera.position = position;
    camera.direction = direction;
    camera.up = up;
    camera.right = Cesium.Cartesian3.cross(direction, up, new Cesium.Cartesian3());
  }

  focusRange() {
    const size = Number(this.current?.sizeMeters) || 0;
    if (!this.model || !size) return POINT_ONLY_RANGE_METERS;
    return Math.max(this.minimumRange() * 1.5, size * this.rangeFactor);
  }

  beginTracking() {
    const changed = !this.tracking;
    this.tracking = true;
    this.pendingFocus = false;
    this.pendingFocusOptions = null;
    this.motionStamp = this.motionNow();
    this.startFrameLoop();
    if (changed) this.onTrackingChange(true);
  }

  // Distance from the camera to the body right now, whether or not it is already followed.
  currentRange(here) {
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    const distance = this.tracking
      ? Cesium.Cartesian3.magnitude(camera.position)
      : Cesium.Cartesian3.distance(camera.positionWC, here);
    return Number.isFinite(distance) && distance > 0 ? Math.max(this.minimumRange(), distance) : this.focusRange();
  }

  // Centre the selected body under a top-down camera and start following it. keepRange keeps the
  // current viewing distance (a plain selection); otherwise the body is framed at its real size.
  // Returns false when there is nothing to follow yet; the request is retried once the model loads.
  focus(date = this.timeSource?.(), { keepRange = false } = {}) {
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    if (this.disposed || this.phase === 'error' || !this.cartesianAt(date)) return false;
    if (this.current?.key && this.phase !== 'ready') { this.pendingFocus = true; this.pendingFocusOptions = {keepRange}; return false; }
    if (this.isTransitioning() || (Cesium?.SceneMode && this.viewer?.scene?.mode === Cesium.SceneMode.MORPHING)) return false;
    if (Cesium?.SceneMode && this.viewer?.scene?.mode === Cesium.SceneMode.SCENE2D) {
      if (!camera || !this.positionAt?.(date)) return false;
      this.onCameraInput();
      this.cancelMotion();
      camera?.cancelFlight?.();
      const width = keepRange && camera?.frustum ? camera.frustum.right - camera.frustum.left : MAP_FOCUS_WIDTH_METERS;
      this.startMapOffset(date);
      this.rangeMotion.moveTo(this.zoomDistance(), width);
      this.beginTracking();
      return true;
    }
    if (!Cesium?.HeadingPitchRange || !camera || !this.positionAt) return false;
    if (this.current?.key && !this.model) {
      this.cancelMotion();
      return false;
    }
    const here = this.cartesianAt(date);
    if (!here) {
      this.pendingFocus = true;
      this.pendingFocusOptions = { keepRange };
      return false;
    }
    const range = keepRange ? this.currentRange(here) : this.focusRange();
    this.onCameraInput();
    this.cancelMotion();
    camera.cancelFlight?.();
    // For a target behind Earth use Cesium's globe-safe flight first. The final
    // moving-body approach starts from the arriving pose, not a stale endpoint.
    if (!this.tracking && !this.targetVisible(here) && camera.flyTo) {
      const position = this.positionAt(date);
      const revision = this.focusRevision;
      this.focusFlight = true;
      camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude * 1000 + Math.max(10_000_000, range)),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration: 1.4, easingFunction: cameraEase,
        complete: () => {
          if (revision !== this.focusRevision || this.isTransitioning()) return;
          this.focusFlight = false;
          const arrival = this.timeSource?.() || date, target = this.cartesianAt(arrival);
          if (target && this.targetVisible(target)) this.focus(arrival, { keepRange });
        },
        cancel: () => { if (revision === this.focusRevision) this.focusFlight = false; },
      });
      return true;
    }
    if (!this.tracking) camera.lookAtTransform(Cesium.Transforms.eastNorthUpToFixedFrame(here));
    this.beginTracking();
    this.focusPose = {
      position: { ...camera.position }, direction: { ...camera.direction }, up: { ...camera.up }, elapsed: 0,
    };
    this.rangeMotion.moveTo(this.zoomDistance(), range);
    return true;
  }

  startMapOffset(date) {
    const position = this.positionAt?.(date);
    const cartographic = this.viewer?.camera?.positionCartographic;
    if (!position || !cartographic) return;
    const longitude = cartographic.longitude * 180 / Math.PI - position.longitude;
    this.mapOffset = { longitude: ((longitude + 540) % 360) - 180, latitude: cartographic.latitude * 180 / Math.PI - position.latitude, elapsed: 0 };
  }

  // Input interruption preserves the current pose; no completed-flight callbacks
  // or old wheel goals may re-acquire a target after the user has moved on.
  cancelMotion() {
    this.pendingFocus = false;
    this.pendingFocusOptions = null;
    this.rangeMotion.cancel();
    this.focusPose = null;
    this.mapOffset = null;
    this.focusRevision += 1;
    if (this.focusFlight) {
      this.focusFlight = false;
      this.viewer?.camera?.cancelFlight?.();
    }
  }

  interruptCamera() {
    // A 3D drag can orbit inside the follow frame. A 2D drag pans the map itself
    // and must release its centre owner, not snap to the pending target centre.
    if (this.cesium?.SceneMode && this.viewer?.scene?.mode === this.cesium.SceneMode.SCENE2D) this.untrack();
    else this.cancelMotion();
  }

  zoomDistance() {
    const camera = this.viewer?.camera, Cesium = this.cesium;
    if (!camera || !Cesium) return NaN;
    return Cesium.SceneMode && this.viewer.scene.mode === Cesium.SceneMode.SCENE2D
      ? camera.frustum.right - camera.frustum.left : Cesium.Cartesian3.magnitude(camera.position);
  }

  setZoomDistance(distance) {
    if (!this.tracking || this.isTransitioning() || !Number.isFinite(distance)) return false;
    const map = this.cesium.SceneMode && this.viewer.scene.mode === this.cesium.SceneMode.SCENE2D;
    if (this.cesium.SceneMode && this.viewer.scene.mode === this.cesium.SceneMode.MORPHING) return false;
    this.focusPose = null;
    const maximum = map ? MAP_MAXIMUM_WIDTH_METERS : Math.max(MAXIMUM_RANGE_METERS, this.zoomDistance() * 8);
    return this.rangeMotion.moveTo(this.zoomDistance(), Math.max(map ? MAP_MINIMUM_WIDTH_METERS : this.minimumRange(), Math.min(maximum, distance)));
  }

  minimumRange() {
    return Math.max(1, Math.min(MINIMUM_RANGE_METERS, (Number(this.current?.sizeMeters) || MINIMUM_RANGE_METERS) * .6));
  }

  advanceCamera(Cesium, range, dt, moving) {
    const camera = this.viewer.camera;
    let offset = camera.position, direction = camera.direction, up = camera.up;
    if (this.focusPose) {
      const pose = this.focusPose;
      pose.elapsed += dt;
      const progress = Math.min(1, pose.elapsed / 700), eased = cameraEase(progress);
      offset = cameraDirection(pose.position, { x: 0, y: 0, z: 1 }, eased);
      const attitude = cameraAttitude(pose.direction, pose.up, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 }, eased);
      direction = attitude.direction;
      up = attitude.up;
      if (progress === 1) this.focusPose = null;
    } else if (moving) {
      direction = cameraDirection(direction, { x: -offset.x, y: -offset.y, z: -offset.z }, -Math.expm1(-dt / 120));
    } else return;
    const length = Math.hypot(offset.x, offset.y, offset.z);
    if (!(length > 0) || !(range > 0)) return;
    camera.position = new Cesium.Cartesian3(offset.x * range / length, offset.y * range / length, offset.z * range / length);
    const basis = cameraBasis(direction, up);
    for (const key of ['direction', 'up', 'right']) camera[key] = new Cesium.Cartesian3(basis[key].x, basis[key].y, basis[key].z);
  }

  // True when the body is ahead of the camera and not hidden behind the globe. A body that has
  // drifted out of frame still counts: the wheel is expected to zoom toward the selected object.
  targetVisible(here) {
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    if (!Cesium || !camera?.positionWC || !camera.directionWC) return false;
    const toTarget = Cesium.Cartesian3.subtract(here, camera.positionWC, new Cesium.Cartesian3());
    const distance = Cesium.Cartesian3.magnitude(toTarget);
    if (!(distance > 0)) return false;
    Cesium.Cartesian3.normalize(toTarget, toTarget);
    if (Cesium.Cartesian3.dot(camera.directionWC, toTarget) <= 0) return false;
    if (Cesium.EllipsoidalOccluder && Cesium.Ellipsoid?.WGS84) {
      const occluder = new Cesium.EllipsoidalOccluder(Cesium.Ellipsoid.WGS84, camera.positionWC);
      if (!occluder.isPointVisible(here)) return false;
    }
    return true;
  }

  // Start following from the current viewpoint: the body becomes the zoom anchor without any
  // camera rotation, so the first wheel step continues the motion the user already sees.
  engageFromCamera(date = this.timeSource?.()) {
    if (this.phase === 'error' || !this.cartesianAt(date)) return false;
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    if (!Cesium?.Transforms?.eastNorthUpToFixedFrame || !camera || !this.positionAt) return false;
    const here = this.cartesianAt(date);
    if (!here || !this.targetVisible(here)) return false;
    this.onCameraInput();
    camera.cancelFlight?.();
    camera.lookAtTransform(Cesium.Transforms.eastNorthUpToFixedFrame(here));
    if (Cesium.Cartesian3.magnitude(camera.position) < 1) return this.focus(date);
    this.beginTracking();
    return true;
  }

  // Release the follow frame. With aimAtEarth the view eases toward Earth's centre so the
  // Earth-centred zoom that takes over afterwards does not snap the camera around.
  untrack({ aimAtEarth = false } = {}) {
    this.pendingFocus = false;
    this.pendingFocusOptions = null;
    this.cancelMotion();
    if (!this.tracking) return;
    this.tracking = false;
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    const mode = this.viewer?.scene?.mode;
    if (camera && Cesium?.Matrix4?.IDENTITY && !this.isTransitioning() && !(Cesium.SceneMode && mode === Cesium.SceneMode.MORPHING)) {
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      if (aimAtEarth && !(Cesium.SceneMode && mode === Cesium.SceneMode.SCENE2D)) this.easeTowardEarth(Cesium, camera);
    }
    if (!this.model) this.stopFrameLoop();
    this.onTrackingChange(false);
  }

  easeTowardEarth(Cesium, camera) {
    if (typeof camera.flyTo !== 'function' || !camera.positionWC || !camera.upWC) return;
    const position = Cesium.Cartesian3.clone(camera.positionWC, new Cesium.Cartesian3());
    const distance = Cesium.Cartesian3.magnitude(position);
    if (!(distance > 0)) return;
    const direction = Cesium.Cartesian3.multiplyByScalar(position, -1 / distance, new Cesium.Cartesian3());
    const lean = Cesium.Cartesian3.dot(camera.upWC, direction);
    const up = Cesium.Cartesian3.subtract(camera.upWC, Cesium.Cartesian3.multiplyByScalar(direction, lean, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    if (Cesium.Cartesian3.magnitude(up) < 1e-6) return;
    Cesium.Cartesian3.normalize(up, up);
    camera.flyTo({ destination: position, orientation: { direction, up }, duration: 0.8, easingFunction: cameraEase });
  }

  // Wheel input: zooming in on a visible selected body starts following it and shortens the
  // distance; zooming out lengthens it and releases the camera past RELEASE_RANGE_METERS.
  // Returns false when the caller should apply its own Earth-centred zoom instead.
  zoomBy(wheelDelta) {
    const Cesium = this.cesium;
    const camera = this.viewer?.camera;
    const delta = Number(wheelDelta);
    if (!camera || !Cesium || !Number.isFinite(delta) || !delta) return this.tracking;
    if (this.isTransitioning() || (Cesium.SceneMode && this.viewer?.scene?.mode === Cesium.SceneMode.MORPHING)) return true;
    if (Cesium.SceneMode && this.viewer?.scene?.mode === Cesium.SceneMode.SCENE2D) {
      if (!this.tracking && delta <= 0) return false;
      const date = this.timeSource?.();
      if (!this.positionAt?.(date)) return false;
      camera.cancelFlight?.();
      if (!this.tracking) { this.startMapOffset(date); this.beginTracking(); }
      this.rangeMotion.wheel(this.zoomDistance(), delta, { minimum: MAP_MINIMUM_WIDTH_METERS, maximum: MAP_MAXIMUM_WIDTH_METERS });
      return true;
    }
    if (!this.tracking && (delta <= 0 || !this.engageFromCamera())) return false;
    const distance = Cesium.Cartesian3.magnitude(camera.position);
    if (!Number.isFinite(distance) || distance <= 0) return true;
    this.focusPose = null;
    this.rangeMotion.wheel(distance, delta, {
      minimum: this.minimumRange(), maximum: Math.max(MAXIMUM_RANGE_METERS, distance * 8),
      focusRange: this.model ? this.focusRange() : 0,
    });
    return true;
  }

  startFrameLoop() {
    const scene = this.viewer?.scene;
    if (this.frameRemover || !scene?.preUpdate?.addEventListener) return;
    this.frameRemover = scene.preUpdate.addEventListener(() => {
      const date = this.timeSource?.();
      this.update(date);
      this.onFrame?.(date);
    });
  }

  stopFrameLoop() {
    if (this.frameRemover) {
      try { this.frameRemover(); } catch { /* listener already gone */ }
      this.frameRemover = null;
    }
  }

  removeModel() {
    this.loadToken += 1;
    for (const remove of this.modelRemovers.splice(0)) remove?.();
    if (this.model) {
      const model = this.model;
      try { this.viewer?.scene?.primitives?.remove(model); } catch { /* primitive already gone */ }
      if (!model.isDestroyed?.()) model.destroy?.();
    }
    this.model = null;
    this.current = null;
  }

  clear() {
    this.untrack();
    this.removeModel();
    this.positionAt = null;
    this.sampleAt = null;
    this.description = null;
    this.targetId = null;
    this.stopFrameLoop();
    this.status('unassigned');
  }

  dispose() { if (this.disposed) return; this.clear(); this.disposed = true; }
}
