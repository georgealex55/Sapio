const fs=require('fs');
const path=require('path');
const {loadLatest,collectAll,saveLatest}=require('../lib/collector');
const {enrichFeedImages}=require('../lib/image-enrichment');
const {enabled:neonEnabled,loadLatestSnapshot,saveSnapshot}=require('../lib/neon-store');

const MAX_SNAPSHOT_AGE_MS=15*60*1000;
let memoryLatest=null;
let renewing=null;

function snapshotFresh(payload){
  const t=new Date(payload?.generatedAt||0).getTime();
  return Number.isFinite(t)&&Date.now()-t<MAX_SNAPSHOT_AGE_MS&&Array.isArray(payload?.items)&&payload.items.length>0;
}
async function renew(trigger){
  if(renewing)return renewing;
  renewing=(async()=>{
    try{
      const live=await collectAll();
      await enrichFeedImages(live,{limit:16,concurrency:4,timeoutMs:1800});
      live.persistence={...(live.persistence||{}),neon:false,kv:false};
      try{
        if(neonEnabled()){await saveSnapshot(live,{trigger});live.persistence.neon=true}
      }catch(e){live.neonError=String(e.message||e)}
      try{
        if(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN){await saveLatest(live);live.persistence.kv=true}
      }catch(e){live.kvError=String(e.message||e)}
      memoryLatest=live;
      return live;
    }finally{renewing=null}
  })();
  return renewing;
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');
  let fallback=null;
  try{
    if(neonEnabled())fallback=await loadLatestSnapshot();
    if(!fallback)fallback=await loadLatest();
    fallback=fallback||memoryLatest;
    if(snapshotFresh(fallback))return res.status(200).json(fallback);
    const live=await renew('feed-stale');
    if(live?.items?.length)return res.status(200).json(live);
    if(fallback?.items?.length)return res.status(200).json({...fallback,stale:true});
  }catch(e){
    if(fallback?.items?.length)return res.status(200).json({...fallback,stale:true,refreshError:String(e.message||e)});
  }
  const livePath=path.join(process.cwd(),'data','live.json');
  if(fs.existsSync(livePath)){
    try{const live=JSON.parse(fs.readFileSync(livePath,'utf8'));if(live?.items?.length)return res.status(200).json(live)}catch{}
  }
  const sample=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','sample.json'),'utf8'));
  return res.status(200).json(sample);
};
