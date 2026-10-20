// Bounded fixed-window limit per warm Node.js instance. Not a global limit.
const buckets=new Map(),MAX_BUCKETS=2048;
function checkRateLimit(scope,identity,max,windowMs,now=Date.now()){
  if(!Number.isFinite(max)||max<1||!Number.isFinite(windowMs)||windowMs<1)throw new RangeError('invalid rate limit');
  const key=String(scope).slice(0,48)+':'+String(identity).slice(0,160);
  let current=buckets.get(key);
  if(!current||now>=current.resetAt){
    if(!current&&buckets.size>=MAX_BUCKETS){
      for(const [k,state] of buckets)if(now>=state.resetAt)buckets.delete(k);
      if(buckets.size>=MAX_BUCKETS)return {allowed:false,retryAfter:Math.ceil(windowMs/1000)};
    }
    current={count:0,resetAt:now+windowMs};
    buckets.set(key,current);
  }
  current.count++;
  return {allowed:current.count<=max,retryAfter:Math.max(1,Math.ceil((current.resetAt-now)/1000))};
}
function clientKey(req){
  // Vercel documents that it overwrites X-Forwarded-For at ingress.
  // Outside Vercel, forwarded headers are untrusted: use the socket peer.
  const {isIP}=require('node:net');
  const candidate=process.env.VERCEL==='1'
    ?req?.headers?.['x-forwarded-for']
    :req?.socket?.remoteAddress;
  if(typeof candidate!=='string'||candidate!==candidate.trim()||
    candidate.includes(',')||candidate.length>64||isIP(candidate)===0){
    // Shared, bounded fallback bucket. Never let an attacker invent identities.
    return 'unidentified';
  }
  return 'ip:'+candidate.toLowerCase();
}
module.exports={checkRateLimit,clientKey};
