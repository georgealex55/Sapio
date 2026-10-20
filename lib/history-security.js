'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');

function parseAllowedOrigins(value=process.env.SAPIO_ALLOWED_ORIGINS){
  const result=new Set();
  if(typeof value!=='string')return result;
  for(const raw of value.split(',')){
    const origin=raw.trim();
    try{
      const parsed=new URL(origin);
      // Exact, canonical, HTTPS origins only; never wildcard subdomains.
      if(parsed.protocol==='https:'&&parsed.origin===origin&&
          parsed.username===''&&parsed.password===''&&!origin.includes('*')&&parsed.pathname==='/'&&
          parsed.search===''&&parsed.hash==='')result.add(origin);
    }catch{}
  }
  return result;
}
function allowsHistoryWrite(req,configured=process.env.SAPIO_ALLOWED_ORIGINS){
  const h=req?.headers||{};
  const origin=h.origin,host=h.host,fetchSite=h['sec-fetch-site'];
  if(typeof origin!=='string'||typeof host!=='string'||!origin||!host)return false;
  const allowed=parseAllowedOrigins(configured);
  if(!allowed.has(origin)||origin!=='https://'+host)return false;
  // Fetch Metadata is an extra signal, not a substitute for an Origin check.
  if(fetchSite!==undefined&&fetchSite!=='same-origin')return false;
  return true;
}
function csrfForSession(id,key){
  return createHmac('sha256',key).update('sapio-history-csrf-v1:'+id).digest('base64url');
}
function validCsrf(req,id,key){
  const token=req?.headers?.['x-sapio-csrf'];
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;
  const expected=csrfForSession(id,key);
  const a=Buffer.from(token),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}
module.exports={parseAllowedOrigins,allowsHistoryWrite,csrfForSession,validCsrf};
