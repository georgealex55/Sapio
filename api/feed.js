const fs=require('fs');
const path=require('path');
const {loadLatest,collectAll,saveLatest}=require('../lib/collector');
const {enrichFeedImages}=require('../lib/image-enrichment');

const MAX_SNAPSHOT_AGE_MS=15*60*1000;
let memoryLatest=null;

function snapshotFresh(payload){
  const t=new Date(payload?.generatedAt||0).getTime();
  return Number.isFinite(t)&&Date.now()-t<MAX_SNAPSHOT_AGE_MS&&Array.isArray(payload?.items)&&payload.items.length>0;
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=300');
  let fallback=null;
  try{
    const stored=await loadLatest();
    fallback=stored||memoryLatest;
    if(snapshotFresh(fallback)) return res.status(200).json(fallback);

    const live=await collectAll();
    await enrichFeedImages(live,{limit:16,concurrency:4,timeoutMs:1800});
    if(live.items?.length){
      memoryLatest=live;
      try{if(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN)await saveLatest(live)}catch(e){live.persistenceError=String(e.message||e)}
      return res.status(200).json(live);
    }
  }catch(e){
    if(fallback?.items?.length) return res.status(200).json({...fallback,stale:true,refreshError:String(e.message||e)});
  }
  const sample=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','sample.json'),'utf8'));
  return res.status(200).json(sample);
};
