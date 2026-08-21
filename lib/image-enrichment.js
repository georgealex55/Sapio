const BLOCKED_DOMAINS=['pornhub.com','xvideos.com','xnxx.com','redtube.com','youporn.com'];
const SKIP_HOSTS=new Set([
  'news.google.com','www.reddit.com','reddit.com','news.ycombinator.com',
  'pubmed.ncbi.nlm.nih.gov','export.arxiv.org','arxiv.org','www.arxiv.org'
]);
const UA='SAPIO-Cultural-Intelligence/0.1 (+source-image-enrichment)';

function safeUrl(url=''){
  try{
    const u=new URL(String(url).replace(/&amp;/g,'&').trim());
    if(!['http:','https:'].includes(u.protocol)) return null;
    if(BLOCKED_DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))) return null;
    return u.toString();
  }catch{return null;}
}
function resolveUrl(raw='',base=''){
  if(!raw) return null;
  try{return safeUrl(new URL(String(raw).replace(/&amp;/g,'&').trim(),base).toString());}
  catch{return null;}
}
function metaValue(tag,key){
  return (tag.match(new RegExp(`\\b${key}=["']([^"']+)["']`,'i'))||[])[1]||'';
}
function extractImage(html='',baseUrl=''){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  const wanted=['og:image','og:image:url','twitter:image','twitter:image:src'];
  for(const target of wanted){
    for(const tag of tags){
      const key=(metaValue(tag,'property')||metaValue(tag,'name')).toLowerCase();
      if(key!==target) continue;
      const image=resolveUrl(metaValue(tag,'content'),baseUrl);
      if(image) return image;
    }
  }
  const linkTags=html.match(/<link\b[^>]*>/gi)||[];
  for(const tag of linkTags){
    const rel=metaValue(tag,'rel').toLowerCase();
    if(!rel.split(/\s+/).includes('image_src')) continue;
    const image=resolveUrl(metaValue(tag,'href'),baseUrl);
    if(image) return image;
  }
  return null;
}
async function fetchHtml(url,timeoutMs){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{
      signal:ctrl.signal,
      redirect:'follow',
      headers:{
        'user-agent':UA,
        'accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.4'
      }
    });
    if(!r.ok) return null;
    const type=(r.headers.get('content-type')||'').toLowerCase();
    if(type&&!type.includes('text/html')&&!type.includes('application/xhtml+xml')) return null;
    return {html:(await r.text()).slice(0,250000),finalUrl:r.url||url};
  }catch{return null;}
  finally{clearTimeout(timer);}
}
async function fetchSourceImage(url,timeoutMs=1800){
  const target=safeUrl(url);
  if(!target) return null;
  try{if(SKIP_HOSTS.has(new URL(target).hostname.toLowerCase())) return null;}catch{return null;}
  const page=await fetchHtml(target,timeoutMs);
  return page?extractImage(page.html,page.finalUrl):null;
}
async function enrichFeedImages(payload,{limit=8,concurrency=4,timeoutMs=1800}={}){
  const items=Array.isArray(payload?.items)?payload.items:[];
  const targets=items.filter(item=>!item.sourceImage&&item.url).slice(0,limit);
  let enriched=0;
  for(let i=0;i<targets.length;i+=concurrency){
    await Promise.all(targets.slice(i,i+concurrency).map(async item=>{
      const image=await fetchSourceImage(item.url,timeoutMs);
      if(image){item.sourceImage=image;enriched++;}
    }));
  }
  payload.run=payload.run||{};
  payload.run.imageEnrichmentAttempted=targets.length;
  payload.run.imageEnriched=enriched;
  return payload;
}

module.exports={enrichFeedImages,fetchSourceImage,extractImage};
