/** Compose ordered original model matching with copied catalog inputs only.
 * Selection and display UTC remain owned by the catalog controllers. */
export function createSatelliteModelSelection({api,globe,timeline,validateManifest,createResolver}) {
  let dead=false,revision=0,abort=null,resolver=null,current=null,signature=null;
  const source={timeSource:()=>timeline.currentUtc(),sampleAt:utc=>timeline.sampleAt(utc),advanceUtc:(utc,seconds)=>timeline.advanceUtc(utc,seconds)};
  function sameEpoch(a,b){
    if(a===b)return true;
    // OMM EPOCH is UTC even when its source text omits Z. Normalize that
    // declared GP metadata with the existing leap codec, never Date rounding.
    const canonical=value=>{
      if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z?$/.test(value))return null;
      return timeline.advanceUtc(value.endsWith('Z')?value:value+'Z',0);
    };
    const first=canonical(a),second=canonical(b);return first!==null&&first===second;
  }
  function apply(){
    if(dead)return;
    if(!current){signature=null;globe.clearSatelliteModel();return;}
    if(!resolver)return;
    const {item,profile,geometry}=current;
    const catalog=profile?.catalog?.NORAD_CAT_ID===item.NORAD_CAT_ID&&
      (!profile.gp||profile.gp.NORAD_CAT_ID===item.NORAD_CAT_ID&&
        (!profile.gp.EPOCH||!item.EPOCH||sameEpoch(profile.gp.EPOCH,item.EPOCH)))?profile.catalog:null;
    const match=resolver(item,catalog??{});
    const description={...match,satelliteId:geometry.catalog_number,normalized_gp_sha256:geometry.normalized_gp_sha256,catalogName:item.OBJECT_NAME,catalogOrbitRegime:item.ORBIT_REGIME};
    const next=JSON.stringify(description);
    if(next===signature)return;
    signature=next;globe.setSatelliteModel(description,source);
  }
  return {
    select(item,profile,geometry){
      if(dead)return;
      current=item&&geometry?.frame==='ITRF'&&item.NORAD_CAT_ID===geometry.catalog_number&&
        /^[a-f0-9]{64}$/.test(geometry.normalized_gp_sha256??'')?
        structuredClone({item,profile,geometry}):null;
      apply();
    },
    async load(){
      if(dead)return;
      const ticket=++revision;abort?.abort();abort=new AbortController();
      globe.modelManifestStatus({phase:'loading',error:null});
      try{
        const raw=await api.satelliteModelManifest({signal:abort.signal});
        if(dead||ticket!==revision)return;
        const manifest=validateManifest(raw);
        resolver=createResolver(manifest,'/static/satellite_display/');
        globe.modelManifestStatus({phase:'ready',error:null});apply();
      }catch(error){
        if(!dead&&ticket===revision)globe.modelManifestStatus({phase:'error',error:String(error?.message||error)});
      }
    },
    destroy(){if(dead)return;dead=true;++revision;abort?.abort();current=null;resolver=null;signature=null;},
  };
}
