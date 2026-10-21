const {timingSafeEqual}=require('node:crypto');
const {checkRateLimit}=require('../lib/rate-limit');
const {collectAll,saveLatest}=require('../lib/collector');
const {enrichFeedImages}=require('../lib/image-enrichment');
const {enabled:neonEnabled,saveSnapshot}=require('../lib/neon-store');

function authorized(header, secret) {
  if(typeof header!=='string'||!header.startsWith('Bearer '))return false;
  const supplied=Buffer.from(header.slice(7));
  const expected=Buffer.from(secret);
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false,error:'method not allowed'});
  }
  const secret=process.env.CRON_SECRET;
  // A missing credential must never make the collection endpoint public.
  if(!secret)return res.status(503).json({ok:false,error:'collection not configured'});
  if(!authorized(req.headers?.authorization,secret)){
    return res.status(401).json({ok:false,error:'unauthorized'});
  }
  // Warm-instance quota only. Pair with distributed / edge throttling in production.
  const limited=checkRateLimit('collector','authenticated',4,15*60_000);
  if(!limited.allowed){
    res.setHeader('Retry-After',String(limited.retryAfter));
    return res.status(429).json({ok:false,error:'rate limit exceeded'});
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
    return res.status(200).json({ok:true,...payload});
  }catch(e){
    console.error('SAPIO collection failed',e);
    return res.status(500).json({ok:false,error:'collection failed'});
  }
};
