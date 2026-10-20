const {createHmac,randomUUID,timingSafeEqual}=require('node:crypto');
const {enabled,saveNavigationHistory,loadNavigationHistory}=require('../lib/neon-store');

const COOKIE='sapio_history';
const BODY_LIMIT=4096;
const MAX_AGE_SECONDS=30*24*60*60;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTRY_ID=/^[A-Za-z0-9:_-]{1,128}$/;
const DIRECTIONS=new Set(['CENTER','N','NE','E','SE','S','SW','W','NW']);
function record(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
function parseBody(req){
  const contentLength=Number(req.headers?.['content-length']||0);
  if(contentLength>BODY_LIMIT)return null;
  let value=req.body;
  if(typeof value==='string'){try{value=JSON.parse(value)}catch{return null}}
  if(!record(value))return null;
  try{if(Buffer.byteLength(JSON.stringify(value),'utf8')>BODY_LIMIT)return null}catch{return null}
  return value;
}
function validateEntry(input){
  if(!record(input)||typeof input.id!=='string'||!ENTRY_ID.test(input.id))return null;
  if(input.title!==undefined&&(typeof input.title!=='string'||input.title.length>240))return null;
  if(input.dir!==undefined&&!DIRECTIONS.has(input.dir))return null;
  let nav={x:0,y:0};
  if(input.nav!==undefined){
    if(!record(input.nav)||typeof input.nav.x!=='number'||typeof input.nav.y!=='number')return null;
    if(!Number.isFinite(input.nav.x)||!Number.isFinite(input.nav.y))return null;
    if(Math.abs(input.nav.x)>10||Math.abs(input.nav.y)>10)return null;
    nav={x:input.nav.x,y:input.nav.y};
  }
  let viewedAt=new Date().toISOString();
  if(input.viewedAt!==undefined){
    if(typeof input.viewedAt!=='string'||input.viewedAt.length>40)return null;
    const date=Date.parse(input.viewedAt),now=Date.now();
    if(!Number.isFinite(date)||date<now-MAX_AGE_SECONDS*1000||date>now+5*60*1000)return null;
    viewedAt=new Date(date).toISOString();
  }
  return {id:input.id,title:input.title||'',dir:input.dir||'CENTER',nav,viewedAt};
}
function sign(id,key){return createHmac('sha256',key).update(id).digest('base64url')}
function sessionId(req,res,key){
  const cookie=String(req.headers?.cookie||'').split(';').map(s=>s.trim())
    .find(s=>s.startsWith(COOKIE+'='));
  const token=cookie?.slice(COOKIE.length+1)||'';
  const dot=token.indexOf('.');
  if(dot>0){
    const id=token.slice(0,dot),provided=token.slice(dot+1);
    if(UUID.test(id)&&provided.length===43){
      const a=Buffer.from(provided),b=Buffer.from(sign(id,key));
      if(a.length===b.length&&timingSafeEqual(a,b))return id;
    }
  }
  const id=randomUUID();
  const secure=String(req.headers?.['x-forwarded-proto']||'').toLowerCase()==='https';
  res.setHeader('Set-Cookie',COOKIE+'='+id+'.'+sign(id,key)+
    '; HttpOnly; SameSite=Lax; Path=/; Max-Age='+MAX_AGE_SECONDS+(secure?'; Secure':''));
  return id;
}
function sameOrigin(req){
  const origin=req.headers?.origin;
  if(!origin)return true;
  try{
    const from=new URL(origin);
    const host=String(req.headers?.host||'').toLowerCase();
    return (from.protocol==='https:'||from.protocol==='http:')&&from.host.toLowerCase()===host;
  }catch{return false}
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ok:false,error:'method not allowed'});
  }
  let entry=null;
  if(req.method==='POST'){
    if(!sameOrigin(req))return res.status(403).json({ok:false,error:'cross-origin write denied'});
    if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers?.['content-type']||''))){
      return res.status(415).json({ok:false,error:'JSON required'});
    }
    const body=parseBody(req);
    entry=body&&validateEntry(body.entry);
    if(!entry)return res.status(400).json({ok:false,error:'invalid history payload'});
  }
  // Without a stable signing key, no server-side history is read or written.
  // The client already maintains a local fallback.
  const key=process.env.HISTORY_SIGNING_SECRET;
  if(!enabled()||!key||key.length<32){
    return res.status(200).json(req.method==='GET'
      ?{ok:true,persisted:'local',entries:[]}
      :{ok:true,persisted:'local'});
  }
  const id=sessionId(req,res,key);
  if(req.method==='GET'){
    try{return res.status(200).json({ok:true,persisted:'neon',entries:await loadNavigationHistory(id,30)})}
    catch(error){
      console.error('SAPIO history read failed',error);
      return res.status(200).json({ok:true,persisted:'local',entries:[]});
    }
  }
  try{
    await saveNavigationHistory(id,entry);
    return res.status(200).json({ok:true,persisted:'neon'});
  }catch(error){
    console.error('SAPIO history write failed',error);
    return res.status(200).json({ok:true,persisted:'local'});
  }
};
