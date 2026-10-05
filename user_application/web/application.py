"""Composition root: owns application instances, lifespan and web deployment."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from communication.external.celestrak import CelesTrakSource
from communication.http import system, catalog, runtime, rf_network, missions, hil, reports, telemetry
from communication.http import catalog_geometry as catalog_geometry_http
from communication.http import solar_geometry as solar_geometry_http
from communication.http import orbit as orbit_http
from data.catalog.access import Catalog
from data.catalog.cache import CatalogCache
from data.catalog.contracts import CatalogReader
from digital_twin.contracts.queries import TwinQueries
from digital_twin.model_library.network import communication
from digital_twin.model_library.rf_receive_profile import load_iss_receive_profile
from digital_twin.simulation.rf_network import calculate_link_budget, calculate_route, contact_plan
from digital_twin.verification.kpis import evaluate
from user_application.bootstrap import create_runtime
from user_application.configs.paths import APP_NAME, APP_VERSION, WEB_DIR, VISUALIZATION_DIR, CLIENT_DIR, CATALOG_CACHE_DIR


def create_app(*, catalog_reader: CatalogReader | None = None, orbit_inputs=(), eop_provider=None, orbit_calculator=None, orbit_manifest_path=None,catalog_geometry_query=None,catalog_geometry_manifest_path=None,solar_geometry_query=None) -> FastAPI:
    from communication.native.orbit_execution import BoundedOrbitExecutor
    from digital_twin.runtime.orbit import OrbitRuntime
    from digital_twin.contracts.orbit import GroundPoint
    from user_application.configs import orbit as orbit_config
    from user_application.orbit_calculation import create_orbit_calculation
    from user_application.solar_geometry import SolarGeometryQuery
    records={record.input_id:record for record in orbit_inputs}
    if len(records)!=len(orbit_inputs):raise ValueError('duplicate orbit inputs')
    executor=BoundedOrbitExecutor(workers=orbit_config.CALCULATION_WORKERS,waiting_requests=orbit_config.CALCULATION_WAITING_REQUESTS)
    calculation=orbit_calculator if orbit_calculator is not None else (create_orbit_calculation(eop_provider) if eop_provider is not None else None)
    orbit=OrbitRuntime(lookup_input=records.get,calculate=calculation,execute=executor.run,ground_point=GroundPoint(orbit_config.JEJU_LATITUDE_DEG,orbit_config.JEJU_LONGITUDE_DEG,orbit_config.JEJU_ELLIPSOID_HEIGHT_M),minimum_elevation_deg=orbit_config.MINIMUM_ELEVATION_DEG,max_samples=orbit_config.MAX_POSITION_SAMPLES)
    state = create_runtime(orbit=orbit)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await state.start()
        try:
            if orbit_manifest_path is not None:
                import asyncio
                from data.orbit_catalog import load_stored_orbit
                try:
                    bundle=await asyncio.to_thread(load_stored_orbit,orbit_manifest_path)
                except (OSError,ValueError,KeyError,TypeError):
                    app.state.orbit_load_error='stored_snapshot_invalid'
                else:
                    records.clear();records.update((item.input_id,item) for item in bundle.inputs)
                    state.orbit=OrbitRuntime(lookup_input=records.get,calculate=create_orbit_calculation(bundle.eop),execute=executor.run,ground_point=GroundPoint(orbit_config.JEJU_LATITUDE_DEG,orbit_config.JEJU_LONGITUDE_DEG,orbit_config.JEJU_ELLIPSOID_HEIGHT_M),minimum_elevation_deg=orbit_config.MINIMUM_ELEVATION_DEG,max_samples=orbit_config.MAX_POSITION_SAMPLES)
                    app.state.orbit_inputs=bundle.inputs
                    app.state.orbit_provenance={'eop_sha256':bundle.eop.eop_sha256,'leap_sha256':bundle.eop.leap_sha256}
            if catalog_geometry_manifest_path is not None:
                import asyncio
                from data.catalog.geometry_snapshot import load_geometry_snapshot
                from user_application.catalog_geometry import CatalogGeometryQuery
                try:
                    catalog_eop=await asyncio.to_thread(load_geometry_snapshot,catalog_geometry_manifest_path)
                    app.state.catalog_geometry_query=CatalogGeometryQuery(app.state.catalog,catalog_eop,create_orbit_calculation(catalog_eop),executor.run)
                    if solar_geometry_query is None:
                        app.state.solar_geometry_query=SolarGeometryQuery(catalog_eop,executor.run)
                except (OSError,ValueError,KeyError,TypeError):
                    app.state.catalog_geometry_error='snapshot_invalid'
            yield
        finally:
            try:
                await state.shutdown()
            finally:
                await executor.close()

    app = FastAPI(title=APP_NAME, version=APP_VERSION, lifespan=lifespan)
    app.state.catalog_geometry_query=catalog_geometry_query
    app.state.catalog_geometry_error=None
    app.include_router(catalog_geometry_http.router)
    app.state.solar_geometry_query=solar_geometry_query if solar_geometry_query is not None else (SolarGeometryQuery(eop_provider,executor.run) if eop_provider is not None else None)
    app.include_router(solar_geometry_http.router)
    app.state.runtime = state
    app.state.orbit_executor = executor
    app.state.orbit_inputs = tuple(records.values())
    app.state.orbit_load_error = None
    app.state.orbit_provenance = {"eop_sha256":getattr(eop_provider,"eop_sha256",None),"leap_sha256":getattr(eop_provider,"leap_sha256",None)}
    app.state.catalog = catalog_reader if catalog_reader is not None else Catalog(CelesTrakSource(), CatalogCache(CATALOG_CACHE_DIR))
    app.state.queries = TwinQueries(communication, calculate_link_budget, calculate_route, contact_plan, evaluate, load_iss_receive_profile)
    app.add_middleware(GZipMiddleware, minimum_size=1_000, compresslevel=5)

    @app.exception_handler(ValueError)
    async def value_error_handler(_, exc: ValueError):
        return JSONResponse(status_code=400, content={'detail': str(exc)})

    from fastapi.exceptions import RequestValidationError
    from fastapi.exception_handlers import request_validation_exception_handler
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request,exc):
        if request.url.path.startswith(('/api/orbit/','/api/solar/')):
            # NaN/Inf in the original request cannot be echoed into strict JSON.
            return JSONResponse(status_code=422,content={'detail':[{'type':error['type'],'loc':error['loc'],'msg':error['msg']} for error in exc.errors()]})
        return await request_validation_exception_handler(request,exc)

    for module in (system, catalog, runtime, rf_network, missions, hil, reports, telemetry, orbit_http):
        app.include_router(module.router)

    # Only browser assets are published, never Python modules, workspace or reference files.
    for url, path in (
        ('/static/styles', WEB_DIR / 'styles'),
        ('/static/scripts', WEB_DIR / 'scripts'),
        ('/static/assets', WEB_DIR / 'assets'),
        ('/static/visualization', VISUALIZATION_DIR),
        ('/static/model_library', VISUALIZATION_DIR.parent / 'model_library' / 'browser'),
        ('/static/satellite_display', VISUALIZATION_DIR.parent / 'model_library' / 'packages' / 'satellite_display' / 'v1'),
        ('/static/simulation', VISUALIZATION_DIR.parent / 'simulation' / 'browser'),
        ('/static/communication', CLIENT_DIR),
    ):
        app.mount(url, StaticFiles(directory=path), name=url.rsplit('/', 1)[-1])

    @app.get('/favicon.ico', include_in_schema=False)
    async def favicon():
        return Response(status_code=204)

    @app.get('/legacy', include_in_schema=False)
    async def legacy_frontend():
        return FileResponse(WEB_DIR / 'legacy.html')

    @app.get('/{full_path:path}', include_in_schema=False)
    async def frontend(full_path: str):
        return FileResponse(WEB_DIR / 'index.html')

    return app


def create_stored_orbit_app() -> FastAPI:
    """Explicit local orbit profile; IO happens in lifespan, never at import."""
    from user_application.configs.orbit import ORBIT_MANIFEST_PATH
    from user_application.configs.catalog_geometry import CATALOG_GEOMETRY_MANIFEST
    return create_app(orbit_manifest_path=ORBIT_MANIFEST_PATH,catalog_geometry_manifest_path=CATALOG_GEOMETRY_MANIFEST)
