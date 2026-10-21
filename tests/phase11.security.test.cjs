'use strict';
// Phase 1.1 proposal tests: use local-only data, no real Vercel or Neon access.
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const Module=require('node:module');
const {createHmac}=require('node:crypto');
const source=path.resolve(__dirname,'..');
const security=require('../lib/history-security');
const {clientKey,checkRateLimit}=require('../lib/rate-limit');
const fixtures={enabled:true,failRead:false,dbWrites:0,reads:0,store:new Map()};
const fakeNeon={
  enabled(){return fixtures.enabled},
  async saveNavigationHistory(id,entry){fixtures.dbWrites++;const current=fixtures.store.get(id)||[];current.push(entry);fixtures.store.set(id,current)},
  async loadNavigationHistory(id,n){fixtures.reads++;if(fixtures.failRead)throw Error('mock unavailable');return (fixtures.store.get(id)||[]).slice(-n)}
};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='../lib/neon-store'&&parent?.filename===path.join(source,'api/history.js'))return fakeNeon;
  return originalLoad.apply(this,arguments);
};
let history;
try{history=require('../api/history')}finally{Module._load=originalLoad}
const previous={...process.env};
process.env.SAPIO_ALLOWED_ORIGINS='https://app.xanderit.com,https://app2.xanderit.com';
process.env.HISTORY_SIGNING_SECRET='test-signing-key-is-not-a-real-production-secret-xyz';
after(()=>{
  for(const key of ['SAPIO_ALLOWED_ORIGINS','HISTORY_SIGNING_SECRET','VERCEL']){
    if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
  }
});
function response(){return {
  code:200,headers:{},data:null,
  setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},
  status(v){this.code=v;return this},
  json(v){this.data=v;return this}
}}
const cookieOf=r=>r.headers['set-cookie']?.split(';')[0]||'';
const origin='https://app.xanderit.com';
function request(method='GET',extra={}){
  return {method,headers:{host:'app.xanderit.com',origin,'content-type':'application/json',...extra},
    socket:{remoteAddress:'198.51.100.20'},body:{entry:{id:'story_123',title:'Test article',dir:'NE',nav:{x:0.2,y:0.4}}}}
}
async function call(req){const res=response();await history(req,res);return res}
async function issuedSession(ip='198.51.100.20'){
  const get=await call(request('GET'));
  assert.equal(get.code,200);
  assert.equal(typeof get.data.csrfToken,'string');
  return {cookie:cookieOf(get),csrf:get.data.csrfToken};
}

test('01 configured canonical HTTPS origins accepted only exactly',()=>{
  assert.deepEqual([...security.parseAllowedOrigins('https://app.xanderit.com,http://bad.test,https://*.invalid.test,https://other.test/path')],['https://app.xanderit.com']);
  assert.equal(security.allowsHistoryWrite(request('POST')),true);
  assert.equal(security.allowsHistoryWrite(request('POST',{origin:'https://app2.xanderit.com'})),false);
});
test('02 HTTP downgrade with same hostname rejected',()=>{
  assert.equal(security.allowsHistoryWrite(request('POST',{origin:'http://app.xanderit.com'})),false);
});
test('03 missing, null and non-canonical Origin rejected',()=>{
  for(const value of [undefined,'','null','https://app.xanderit.com/','https://app.xanderit.com/path']){
    const q=request('POST');if(value===undefined)delete q.headers.origin;else q.headers.origin=value;
    assert.equal(security.allowsHistoryWrite(q),false,String(value));
  }
});
test('04 forged Host and unlisted origins rejected',()=>{
  assert.equal(security.allowsHistoryWrite(request('POST',{host:'evil.example'})),false);
  assert.equal(security.allowsHistoryWrite(request('POST',{origin:'https://evil.example',host:'evil.example'})),false);
  assert.equal(security.allowsHistoryWrite(request('POST',{host:'app.xanderit.com:443'})),false);
});
test('05 Fetch Metadata same-site/cross-site/none rejected',()=>{
  for(const value of ['same-site','cross-site','none']){
    assert.equal(security.allowsHistoryWrite(request('POST',{'sec-fetch-site':value})),false);
  }
  assert.equal(security.allowsHistoryWrite(request('POST',{'sec-fetch-site':'same-origin'})),true);
});
test('06 allowlist absent fails closed',async()=>{
  const old=process.env.SAPIO_ALLOWED_ORIGINS;delete process.env.SAPIO_ALLOWED_ORIGINS;
  try{const r=await call(request('POST'));assert.equal(r.code,403)}finally{process.env.SAPIO_ALLOWED_ORIGINS=old}
});
test('07 direct-mode forwarding spoof cannot alter client identity',()=>{
  delete process.env.VERCEL;
  const a=request('POST',{'x-forwarded-for':'10.0.0.1'});
  const b=request('POST',{'x-forwarded-for':'10.0.0.2','x-vercel-forwarded-for':'8.8.8.8','x-real-ip':'9.9.9.9'});
  assert.equal(clientKey(a),'ip:198.51.100.20');
  assert.equal(clientKey(b),clientKey(a));
});
test('08 direct-mode spoofing cannot bypass local quota',()=>{
  delete process.env.VERCEL;
  for(let i=0;i<5;i++){
    const q=request('POST',{'x-forwarded-for':`1.2.3.${i}`});
    const limited=checkRateLimit('phase11-ip-spoof-test',clientKey(q),4,60_000);
    assert.equal(limited.allowed,i<4);
  }
});
test('09 Vercel-mode accepts only validated edge-overwritten X-Forwarded-For',()=>{
  process.env.VERCEL='1';
  try{
    assert.equal(clientKey(request('GET',{'x-forwarded-for':'203.0.113.1'})),'ip:203.0.113.1');
    assert.equal(clientKey(request('GET',{'x-forwarded-for':'203.0.113.1, 1.2.3.4'})),'unidentified');
    assert.equal(clientKey(request('GET',{'x-forwarded-for':'malformed'})),'unidentified');
    assert.equal(clientKey(request('GET',{'x-vercel-forwarded-for':'8.8.8.8'})),'unidentified');
  }finally{delete process.env.VERCEL}
});
test('10 GET issues HttpOnly Secure cookie and CSRF token',async()=>{
  const r=await call(request('GET'));
  assert.equal(r.code,200);
  assert.match(r.headers['set-cookie'],/; HttpOnly; Secure; SameSite=Lax; Path=\//);
  assert.match(r.data.csrfToken,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(r.headers['cache-control'],'no-store');
});
test('11 missing CSRF returns 403 without writing to DB',async()=>{
  const session=await issuedSession();const before=fixtures.dbWrites;
  const r=await call(request('POST',{cookie:session.cookie}));
  assert.equal(r.code,403);assert.equal(fixtures.dbWrites,before);
});
test('12 malformed or forged CSRF returns 403',async()=>{
  const session=await issuedSession();
  for(const val of ['bad','A'.repeat(43)]){
    const r=await call(request('POST',{cookie:session.cookie,'x-sapio-csrf':val}));
    assert.equal(r.code,403);
  }
});
test('13 valid CSRF and cookie permit storing and reading own history',async()=>{
  const session=await issuedSession();
  const before=fixtures.dbWrites;
  const saved=await call(request('POST',{cookie:session.cookie,'x-sapio-csrf':session.csrf,'sec-fetch-site':'same-origin'}));
  assert.equal(saved.code,200);assert.equal(saved.data.persisted,'neon');assert.equal(fixtures.dbWrites,before+1);
  const loaded=await call(request('GET',{cookie:session.cookie}));
  assert.deepEqual(loaded.data.entries.map(x=>x.id),['story_123']);
});
test('14 tokens and database entries are isolated by session',async()=>{
  const a=await issuedSession(),b=await issuedSession();
  assert.notEqual(a.cookie,b.cookie);
  const deny=await call(request('POST',{cookie:b.cookie,'x-sapio-csrf':a.csrf}));
  assert.equal(deny.code,403);
  const readB=await call(request('GET',{cookie:b.cookie}));
  assert.deepEqual(readB.data.entries,[]);
});
test('15 expired signed session cannot reuse its CSRF',async()=>{
  const key=process.env.HISTORY_SIGNING_SECRET;
  const id='12345678-1234-4123-8123-123456789abc';
  const issued=1700000000,expires=issued+2592000;
  const payload=id+'.'+issued+'.'+expires;
  const mac=createHmac('sha256',key).update(payload).digest('base64url');
  const expired='__Host-sapio_history='+payload+'.'+mac;
  const oldCsrf=security.csrfForSession(id,key);
  const r=await call(request('POST',{cookie:expired,'x-sapio-csrf':oldCsrf}));
  assert.equal(r.code,403);
});
test('16 read failure still gives CSRF for recovery',async()=>{
  fixtures.failRead=true;
  try{const x=await call(request('GET'));assert.equal(x.code,200);assert.equal(x.data.persisted,'local');assert.equal(typeof x.data.csrfToken,'string')}
  finally{fixtures.failRead=false}
});
test('17 cross-scheme and cross-site POST denied before database write',async()=>{
  const session=await issuedSession();const writes=fixtures.dbWrites;
  for(const spoof of ['http://app.xanderit.com','https://evil.example']){
    const r=await call(request('POST',{origin:spoof,cookie:session.cookie,'x-sapio-csrf':session.csrf}));
    assert.equal(r.code,403);
  }
  assert.equal(fixtures.dbWrites,writes);
});
test('18 local fallback creates no CSRF token and writes nothing',async()=>{
  fixtures.enabled=false;
  try{
    const g=await call(request('GET'));
    assert.equal(g.code,200);assert.equal(g.data.csrfToken,undefined);
    const writes=fixtures.dbWrites;
    const p=await call(request('POST'));
    assert.equal(p.code,200);assert.equal(p.data.persisted,'local');assert.equal(fixtures.dbWrites,writes);
  }finally{fixtures.enabled=true}
});
