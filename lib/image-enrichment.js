const dns=require('node:dns');
const http=require('node:http');
const https=require('node:https');
const net=require('node:net');

const BLOCKED_DOMAINS=['pornhub.com','xvideos.com','xnxx.com','redtube.com','youporn.com'];
const SKIP_HOSTS=new Set(['news.google.com','www.reddit.com','reddit.com','news.ycombinator.com','pubmed.ncbi.nlm.nih.gov','export.arxiv.org','arxiv.org','www.arxiv.org']);
const UA='SAPIO-Cultural-Intelligence/0.2 (+source-image-enrichment)';
const MAX_HTML_BYTES=250000;
const MAX_REDIRECTS=3;
const BLOCKED_IPV4=[
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],
  ['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],
  ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
  ['224.0.0.0',4],['240.0.0.0',4]
];
function ipv4Number(address){
  if(net.isIP(address)!==4)return null;
  return address.split('.').reduce((n,part)=>((n*256)+Number(part))>>>0,0);
}
function isPublicIPv4(address){
  const ip=ipv4Number(address);
  if(ip===null)return false;
  return !BLOCKED_IPV4.some(([base,bits])=>{
    const n=ipv4Number(base);
    return (ip >>> (32-bits))===(n >>> (32-bits));
  });
}
function forbiddenHost(hostname){
  const host=hostname.toLowerCase().replace(/\.$/,'');
  // Hostname lookups are pinned to vetted IPv4 addresses; literal IPs and IPv6
  // are deliberately excluded from optional metadata enrichment.
  if(net.isIP(host.replace(/^\[|\]$/g,''))!==0)return true;
  if(!host.includes('.')||host==='localhost')return true;
  if(['.local','.localhost','.internal','.test','.invalid','.onion','.home.arpa'].some(s=>host.endsWith(s)))return true;
  return BLOCKED_DOMAINS.some(d=>host===d||host.endsWith('.'+d));
}
function safeUrl(raw=''){
  try{
    const url=new URL(String(raw).replace(/&amp;/g,'&').trim());
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
    if(url.port&&url.port!==(url.protocol==='https:'?'443':'80'))return null;
    if(forbiddenHost(url.hostname))return null;
    return url.toString();
  }catch{return null}
}
function resolveUrl(raw='',base=''){
  if(!raw)return null;
  try{return safeUrl(new URL(String(raw).replace(/&amp;/g,'&').trim(),base).toString())}
  catch{return null}
}
function metaValue(tag,key){
  return (tag.match(new RegExp('\\b'+key+'=["\u0027]([^"\u0027]+)["\u0027]','i'))||[])[1]||'';
}
function extractImage(html='',baseUrl=''){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  const wanted=['og:image','og:image:url','twitter:image','twitter:image:src'];
  for(const target of wanted){
    for(const tag of tags){
      const key=(metaValue(tag,'property')||metaValue(tag,'name')).toLowerCase();
      if(key!==target)continue;
      const image=resolveUrl(metaValue(tag,'content'),baseUrl);
      if(image)return image;
    }
  }
  const links=html.match(/<link\b[^>]*>/gi)||[];
  for(const tag of links){
    if(!metaValue(tag,'rel').toLowerCase().split(/\s+/).includes('image_src'))continue;
    const image=resolveUrl(metaValue(tag,'href'),baseUrl);
    if(image)return image;
  }
  return null;
}
// The address approved by DNS validation is used by the HTTP socket itself.
// This avoids a DNS-rebinding gap between a separate preflight and connection.
function safeLookup(hostname,options,callback){
  dns.lookup(hostname,{family:4,all:true},(error,records)=>{
    if(error)return callback(error);
    if(!records?.length||records.some(r=>!isPublicIPv4(r.address))){
      return callback(new Error('non-public outbound address'));
    }
    callback(null,records[0].address,4);
  });
}
function fetchHtml(rawUrl,timeoutMs=1800){
  const initial=safeUrl(rawUrl);
  if(!initial)return Promise.resolve(null);
  const deadline=Date.now()+Math.max(100,timeoutMs);
  function requestPage(url,redirects){
    const remaining=deadline-Date.now();
    if(remaining<=0||redirects>MAX_REDIRECTS)return Promise.resolve(null);
    const target=safeUrl(url);
    if(!target)return Promise.resolve(null);
    return new Promise(resolve=>{
      let finished=false;
      let timer;
      const finish=value=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        resolve(value);
      };
      const transport=target.startsWith('https:')?https:http;
      const request=transport.get(target,{
        agent:false,lookup:safeLookup,
        headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml;q=0.9'}
      },response=>{
        const status=response.statusCode||0;
        if([301,302,303,307,308].includes(status)){
          response.resume();
          if(!response.headers.location||redirects>=MAX_REDIRECTS)return finish(null);
          let next;
          try{next=new URL(response.headers.location,target).toString()}catch{return finish(null)}
          if(target.startsWith('https:')&&next.startsWith('http:'))return finish(null);
          return finish(requestPage(next,redirects+1));
        }
        if(status<200||status>=300){response.resume();return finish(null)}
        const type=String(response.headers['content-type']||'').toLowerCase();
        if(type&&!type.includes('text/html')&&!type.includes('application/xhtml+xml')){
          response.resume();return finish(null);
        }
        const length=Number(response.headers['content-length']||0);
        if(length>MAX_HTML_BYTES){response.resume();return finish(null)}
        const chunks=[];
        let bytes=0;
        response.on('data',chunk=>{
          bytes+=chunk.length;
          if(bytes>MAX_HTML_BYTES){response.destroy();return finish(null)}
          chunks.push(chunk);
        });
        response.on('end',()=>finish({html:Buffer.concat(chunks).toString('utf8'),finalUrl:target}));
        response.on('error',()=>finish(null));
      });
      timer=setTimeout(()=>request.destroy(new Error('outbound timeout')),remaining);
      request.on('error',()=>finish(null));
    });
  }
  return requestPage(initial,0);
}
async function fetchSourceImage(url,timeoutMs=1800){
  const target=safeUrl(url);
  if(!target)return null;
  if(SKIP_HOSTS.has(new URL(target).hostname.toLowerCase()))return null;
  const page=await fetchHtml(target,timeoutMs);
  return page?extractImage(page.html,page.finalUrl):null;
}
async function enrichFeedImages(payload,{limit=16,concurrency=4,timeoutMs=1800}={}){
  const items=Array.isArray(payload?.items)?payload.items:[];
  const targets=items.filter(item=>!item.textOnly&&!item.sourceImage&&item.url).slice(0,limit);
  let enriched=0;
  const width=Math.max(1,Math.min(8,Math.trunc(Number(concurrency))||4));
  for(let i=0;i<targets.length;i+=width){
    await Promise.all(targets.slice(i,i+width).map(async item=>{
      const image=await fetchSourceImage(item.url,timeoutMs);
      if(image){item.sourceImage=image;enriched++}
    }));
  }
  payload.run=payload.run||{};
  payload.run.imageEnrichmentAttempted=targets.length;
  payload.run.imageEnriched=enriched;
  return payload;
}
module.exports={enrichFeedImages,fetchSourceImage,extractImage,safeUrl,isPublicIPv4};
