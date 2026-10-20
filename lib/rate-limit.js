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
  // Only trust proxy-supplied forwarding headers after ingress normalizes them.
  // Do not use this value for authentication, authorization or ownership.
  const h=req?.headers||{};
  const value=h['x-vercel-forwarded-for']||h['x-forwarded-for']||
    h['x-real-ip']||req?.socket?.remoteAddress||'unknown';
  const ip=String(Array.isArray(value)?value[0]:value).split(',')[0].trim();
  return ip.slice(0,128)||'unknown';
}
module.exports={checkRateLimit,clientKey};
