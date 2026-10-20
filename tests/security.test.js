const test=require('node:test');
const assert=require('node:assert/strict');
const collect=require('../api/collect');
const history=require('../api/history');
const {safeUrl,isPublicIPv4,extractImage,safeLookup,fetchHtml}=require('../lib/image-enrichment');
const {checkRateLimit}=require('../lib/rate-limit');
const dns=require('node:dns'),http=require('node:http');
const {EventEmitter}=require('node:events');

function response(){
  return {
    statusCode:200,headers:{},body:null,
    setHeader(key,value){this.headers[key]=value;return this},
    status(code){this.statusCode=code;return this},
    json(body){this.body=body;return this}
  };
}
test('collector refuses requests when CRON_SECRET is missing',async()=>{
  const original=process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try{
    const res=response();
    await collect({method:'GET',headers:{}},res);
    assert.equal(res.statusCode,503);
    assert.equal(res.body.ok,false);
  }finally{
    if(original===undefined)delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET=original;
  }
});
test('collector rejects invalid credentials and unsafe methods',async()=>{
  const original=process.env.CRON_SECRET;
  process.env.CRON_SECRET='a-test-only-secret';
  try{
    let res=response();
    await collect({method:'GET',headers:{authorization:'Bearer wrong'}},res);
    assert.equal(res.statusCode,401);
    res=response();
    await collect({method:'POST',headers:{authorization:'Bearer a-test-only-secret'}},res);
    assert.equal(res.statusCode,405);
  }finally{
    if(original===undefined)delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET=original;
  }
});
test('outbound enrichment blocks private addresses and unsafe URLs',()=>{
  for(const url of ['http://127.0.0.1','http://127.1','http://169.254.169.254/latest','http://[::1]/','http://localhost','http://host.internal','http://example.com:8080','file:///etc/passwd','https://user:pass@example.com/']){
    assert.equal(safeUrl(url),null,url);
  }
  assert.equal(isPublicIPv4('8.8.8.8'),true);
  for(const ip of ['10.1.2.3','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','198.18.1.1']){
    assert.equal(isPublicIPv4(ip),false,ip);
  }
  assert.ok(safeUrl('https://example.com/story'));
  assert.equal(extractImage('<meta property="og:image" content="http://127.0.0.1/img">','https://example.com/'),null);
});
test('history rejects cross-site writes and invalid entry payloads',async()=>{
  let res=response();
  await history({method:'POST',headers:{origin:'https://evil.example',host:'app.xanderit.com','content-type':'application/json'},body:{entry:{id:'c_valid'}}},res);
  assert.equal(res.statusCode,403);
  res=response();
  await history({method:'POST',headers:{host:'app.xanderit.com','content-type':'application/json'},body:{entry:{id:'c_valid',nav:{x:999,y:0}}}},res);
  assert.equal(res.statusCode,400);
  res=response();
  await history({method:'POST',headers:{host:'app.xanderit.com','content-type':'text/plain'},body:{entry:{id:'c_valid'}}},res);
  assert.equal(res.statusCode,415);
});

test('DNS resolver returns the correct Node all:true or single-address signature',async()=>{
  const original=dns.lookup;
  dns.lookup=(host,opts,cb)=>cb(null,[{address:'8.8.8.8',family:4},{address:'1.1.1.1',family:4}]);
  try{
    const all=await new Promise((resolve,reject)=>safeLookup('example.com',{all:true},(e,a)=>e?reject(e):resolve(a)));
    assert.deepEqual(all,[{address:'8.8.8.8',family:4},{address:'1.1.1.1',family:4}]);
    const single=await new Promise((resolve,reject)=>safeLookup('example.com',{all:false},(e,a,f)=>e?reject(e):resolve([a,f])));
    assert.deepEqual(single,['8.8.8.8',4]);
  }finally{dns.lookup=original}
});
test('DNS rejects results containing even one private address',async()=>{
  const original=dns.lookup;
  dns.lookup=(host,opts,cb)=>cb(null,[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]);
  try{
    await assert.rejects(new Promise((resolve,reject)=>safeLookup('example.com',{all:true},(e,a)=>e?reject(e):resolve(a))),/non-public/);
  }finally{dns.lookup=original}
});
test('signed history cookies are secure, expire, and resist tampering',()=>{
  const key='test-signing-key-longer-than-thirty-two-chars';
  const now=1790000000000;
  let res=response();
  const id=history._internals.sessionId({headers:{}},res,key,now);
  const cookie=res.headers['Set-Cookie'];
  assert.match(cookie,/^__Host-sapio_history=/);
  for(const f of ['Secure','HttpOnly','SameSite=Lax','Path=/','Max-Age=2592000'])assert.ok(cookie.includes(f),f);
  res=response();
  assert.equal(history._internals.sessionId({headers:{cookie:cookie.split(';')[0]}},res,key,now+1000),id);
  assert.equal(res.headers['Set-Cookie'],undefined);
  res=response();
  assert.notEqual(history._internals.sessionId({headers:{cookie:cookie.split(';')[0]}},res,key,now+2592001000),id);
  res=response();
  const token=cookie.split(';')[0];
  const forged=token.slice(0,-1)+(token.slice(-1)==='A'?'B':'A');
  assert.notEqual(history._internals.sessionId({headers:{cookie:forged}},res,key,now+1000),id);
});
test('local limiter allows a quota and rejects overflow, then resets',()=>{
  const k='unit-'+Date.now();
  assert.equal(checkRateLimit('unit',k,2,1000,1000).allowed,true);
  assert.equal(checkRateLimit('unit',k,2,1000,1001).allowed,true);
  assert.equal(checkRateLimit('unit',k,2,1000,1002).allowed,false);
  assert.equal(checkRateLimit('unit',k,2,1000,2000).allowed,true);
});
test('history writes return 429 after a single-client quota is exhausted',async()=>{
  const ip='unit-client-'+Date.now();
  let last;
  for(let i=0;i<61;i++){
    last=response();
    await history({method:'POST',headers:{'x-forwarded-for':ip,host:'app.xanderit.com','content-type':'application/json'},body:{entry:{id:'c_valid'}}},last);
  }
  assert.equal(last.statusCode,429);
  assert.ok(Number(last.headers['Retry-After'])>=1);
});
test('HTTP error responses are destroyed without consuming the body',async()=>{
  const original=http.get;
  let destroyed=false;
  http.get=(url,options,cb)=>{
    const req=new EventEmitter();
    req.destroy=()=>req.emit('error',new Error('closed'));
    queueMicrotask(()=>{
      const res=new EventEmitter();
      res.statusCode=404;res.headers={};
      res.destroy=()=>{destroyed=true;res.emit('close')};
      cb(res);
    });
    return req;
  };
  try{
    assert.equal(await fetchHtml('http://example.com/story',1000),null);
    assert.equal(destroyed,true);
  }finally{http.get=original}
});
test('redirects to forbidden addresses are destroyed and never followed',async()=>{
  const original=http.get;
  let destroyed=false,calls=0;
  http.get=(url,options,cb)=>{
    calls++;
    const req=new EventEmitter();
    req.destroy=()=>req.emit('error',new Error('closed'));
    queueMicrotask(()=>{
      const res=new EventEmitter();
      res.statusCode=302;res.headers={location:'http://127.0.0.1/latest'};
      res.destroy=()=>{destroyed=true;res.emit('close')};
      cb(res);
    });
    return req;
  };
  try{
    assert.equal(await fetchHtml('http://example.com/story',1000),null);
    assert.equal(calls,1);assert.equal(destroyed,true);
  }finally{http.get=original}
});

test('safe redirects remain functional even if closing the old response emits an error',async()=>{
  const original=http.get;
  let calls=0,destroyed=0;
  http.get=(url,options,cb)=>{
    calls++;
    const req=new EventEmitter();
    req.destroy=()=>req.emit('error',new Error('closed'));
    queueMicrotask(()=>{
      const res=new EventEmitter();
      const first=calls===1;
      res.statusCode=first?302:200;
      res.headers=first?{location:'/next'}:{'content-type':'text/html'};
      res.destroy=()=>{destroyed++;res.emit('error',new Error('old response closed'))};
      cb(res);
      if(!first)queueMicrotask(()=>{
        res.emit('data',Buffer.from('<meta property="og:image" content="https://images.example.org/p.png">'));
        res.emit('end');
      });
    });
    return req;
  };
  try{
    const page=await fetchHtml('http://example.com/start',1000);
    assert.equal(calls,2);
    assert.equal(destroyed,1);
    assert.equal(page.finalUrl,'http://example.com/next');
    assert.match(page.html,/og:image/);
  }finally{http.get=original}
});
test('HTML enrichment rejects oversized declared content before reading it',async()=>{
  const original=http.get;
  let destroyed=false;
  http.get=(url,options,cb)=>{
    const req=new EventEmitter();
    req.destroy=()=>req.emit('error',new Error('closed'));
    queueMicrotask(()=>{
      const res=new EventEmitter();
      res.statusCode=200;
      res.headers={'content-type':'text/html','content-length':'10000000'};
      res.destroy=()=>{destroyed=true;res.emit('close')};
      cb(res);
    });
    return req;
  };
  try{
    assert.equal(await fetchHtml('http://example.com/large',1000),null);
    assert.equal(destroyed,true);
  }finally{http.get=original}
});
