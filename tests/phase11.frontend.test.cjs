'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const source=readFileSync(path.join(__dirname,'../snap-app.js'),'utf8');
const start=source.indexOf('let csrfPromise=null,historyCsrf=null;');
const end=source.indexOf('function snapshot(',start);
if(start<0||end<=start)throw new Error('history frontend bridge missing');
const snippet=source.slice(start,end);
function boot(fetch){
  let local=0;
  const sandbox={fetch,persistLocal(){local++},Promise};
  vm.createContext(sandbox);
  vm.runInContext(snippet,sandbox);
  return {persist:sandbox.persist,localCount:()=>local};
}
test('19 client adds CSRF header and same-origin credentials to POST',async()=>{
  const seen=[];
  const client=boot(async (path,opts)=>{
    seen.push({path,opts});
    if(!opts||opts.method!=='POST')return {ok:true,json:async()=>({csrfToken:'test-csrf'})};
    return {status:200};
  });
  await client.persist({id:'a'});
  assert.equal(client.localCount(),1);
  assert.equal(seen.length,2);
  assert.equal(seen[0].opts.credentials,'same-origin');
  assert.equal(seen[1].opts.headers['X-SAPIO-CSRF'],'test-csrf');
  assert.equal(seen[1].opts.credentials,'same-origin');
});
test('20 client refreshes expired token and retries only once',async()=>{
  const req=[];let gets=0,posts=0;
  const client=boot(async (path,opts)=>{
    req.push({path,opts});
    if(!opts||opts.method!=='POST'){gets++;return {ok:true,json:async()=>({csrfToken:'tok-'+gets})}}
    posts++;return {status:posts===1?403:200};
  });
  await client.persist({id:'b'});
  assert.equal(gets,2);assert.equal(posts,2);
  assert.equal(req[1].opts.headers['X-SAPIO-CSRF'],'tok-1');
  assert.equal(req[3].opts.headers['X-SAPIO-CSRF'],'tok-2');
});
test('21 local fallback needs no POST when CSRF bootstrap unavailable',async()=>{
  let posts=0;
  const client=boot(async (path,opts)=>{
    if(opts?.method==='POST'){posts++;return {status:200}}
    return {ok:true,json:async()=>({persisted:'local',entries:[]})};
  });
  await client.persist({id:'c'});
  assert.equal(client.localCount(),1);assert.equal(posts,0);
});
