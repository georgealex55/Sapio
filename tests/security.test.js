const test=require('node:test');
const assert=require('node:assert/strict');
const collect=require('../api/collect');
const history=require('../api/history');
const {safeUrl,isPublicIPv4,extractImage}=require('../lib/image-enrichment');

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
