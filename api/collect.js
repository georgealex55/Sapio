const {collectAll,saveLatest}=require('../lib/collector');
const {enrichFeedImages}=require('../lib/image-enrichment');
const {enabled:neonEnabled,saveSnapshot}=require('../lib/neon-store');

module.exports=async function handler(req,res){
  const secret=process.env.CRON_SECRET;
  if(secret&&req.headers.authorization!==`Bearer ${secret}`){
    return res.status(401).json({ok:false,error:'unauthorized'});
  }
  try{
    const payload=await collectAll();
    await enrichFeedImages(payload,{limit:16,concurrency:4,timeoutMs:1800});
    payload.persistence={neon:false,kv:false};
    try{
      if(neonEnabled()){await saveSnapshot(payload,{trigger:'scheduled-collector'});payload.persistence.neon=true}
    }catch(e){payload.neonError=String(e.message||e)}
    try{
      if(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN){await saveLatest(payload);payload.persistence.kv=true}
    }catch(e){payload.kvError=String(e.message||e)}
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,...payload});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e.message||e)});
  }
};
