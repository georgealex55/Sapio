const { createHash } = require('crypto');
const { OPEN_SOURCES } = require('./source-registry');

const UA = 'SAPIO-Cultural-Intelligence/0.2 (+research-feed)';
const BLOCKED_DOMAINS = ['pornhub.com','xvideos.com','xnxx.com','redtube.com','youporn.com'];
const EXPLICIT_RELEASE = /\b(gangbang|creampie|blowjob|double penetration|hardcore scene|porn scene|sex scene|new clip|drops new clip|stars in latest|showcase series|porno|new porn site|adult film release)\b/i;

function cleanText(s='') {
  return String(s).replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
function safeUrl(url='') {
  try {
    const u = new URL(String(url).trim());
    if (!['http:','https:'].includes(u.protocol)) return null;
    if (BLOCKED_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.'+d))) return null;
    return u.toString();
  } catch { return null; }
}
function stableHash(value='') {
  return createHash('sha256').update(String(value)).digest('hex');
}
function canonicalUrl(url='') {
  const safe=safeUrl(url); if(!safe) return null;
  try {
    const u=new URL(safe);
    u.hash='';
    const remove=[];
    for(const key of u.searchParams.keys()) if(/^utm_/i.test(key)||['gclid','fbclid','mc_cid','mc_eid','ref','ref_src','igshid'].includes(key.toLowerCase())) remove.push(key);
    remove.forEach(key=>u.searchParams.delete(key));
    u.searchParams.sort();
    if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';
    if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');
    return u.toString();
  } catch { return safe; }
}
function toIso(value, fallback=new Date().toISOString()) {
  const t=new Date(value).getTime();
  return Number.isFinite(t)?new Date(t).toISOString():fallback;
}
function safeImageUrl(url='') {
  const clean = String(url||'').replace(/&amp;/g,'&').trim();
  return safeUrl(clean);
}
function sourceAllows(source,item){
  if(!source.safeAdultOnly) return true;
  const text=`${item.title||''} ${item.summary||''}`;
  return !EXPLICIT_RELEASE.test(text);
}
function firstImageFromHtml(html='') {
  return safeImageUrl((html.match(/<img[^>]+src=["']([^"']+)/i)||[])[1] || '');
}
function mediaImage(block='') {
  return safeImageUrl(
    (block.match(/<media:content[^>]+url=["']([^"']+)/i)||[])[1] ||
    (block.match(/<media:thumbnail[^>]+url=["']([^"']+)/i)||[])[1] ||
    (block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i)||[])[1] ||
    firstImageFromHtml(block)
  );
}
async function fetchWithTimeout(url, options={}, ms=6500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal, headers: { 'user-agent': UA, 'accept': '*/*', ...(options.headers||{}) } });
  } finally { clearTimeout(timer); }
}
async function fetchJson(url, options) {
  const r = await fetchWithTimeout(url, options);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function fetchText(url, options) {
  const r = await fetchWithTimeout(url, options);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
function obs(source, item) {
  if(!sourceAllows(source,item)) return null;
  const url = canonicalUrl(item.url || item.sourceUrl);
  const nativeId=String(item.id||'').trim();
  return {
    id: `o_${stableHash(`${source.id}|${nativeId||url||cleanText(item.title).toLowerCase()}`).slice(0,24)}`,
    nativeId: nativeId||null,
    sourceId: source.id,
    source: source.name,
    publisher: cleanText(item.publisher || '').slice(0,100),
    role: source.role,
    sourceEdge: source.sourceEdge,
    categories: item.categories || source.categories,
    title: cleanText(item.title).slice(0,240),
    summary: cleanText(item.summary || '').slice(0,520),
    sourceUrl: url,
    image: source.textOnly ? null : safeImageUrl(item.image || item.thumbnail),
    publishedAt: toIso(item.publishedAt),
    publishedAtInferred: !Number.isFinite(new Date(item.publishedAt).getTime()),
    engagement: Number(item.engagement || 0),
    textOnly: Boolean(source.textOnly || item.textOnly),
    rawType: item.rawType || source.kind
  };
}
function compact(items){return items.filter(Boolean);}

async function collectHackerNews(source) {
  const limit=source.limit||18;
  const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0,limit);
  const items = await Promise.all(ids.map(id => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(()=>null)));
  return compact(items.filter(Boolean).map(x => obs(source, { id:x.id, title:x.title, url:x.url || `https://news.ycombinator.com/item?id=${x.id}`, publishedAt:new Date(x.time*1000).toISOString(), engagement:(x.score||0)+(x.descendants||0), summary:`${x.score||0} points · ${x.descendants||0} comments` })));
}

async function collectReddit(source) {
  const limit=source.limit||12;
  try {
    const data = await fetchJson(`https://www.reddit.com/r/${encodeURIComponent(source.subreddit)}/hot.json?limit=${limit}&raw_json=1`, {headers:{accept:'application/json'}});
    return compact((data?.data?.children || []).map(({data:x}) => {
      const preview = x.preview?.images?.[0]?.source?.url || x.preview?.images?.[0]?.resolutions?.slice(-1)[0]?.url || '';
      const thumb = /^https?:/i.test(x.thumbnail||'') ? x.thumbnail : '';
      return obs(source, {
        id:x.id,
        title:x.title,
        url:`https://www.reddit.com${x.permalink}`,
        image:preview || thumb,
        publishedAt:new Date(x.created_utc*1000).toISOString(),
        engagement:(x.score||0)+(x.num_comments||0)*2,
        summary:`${x.score||0} score · ${x.num_comments||0} comments`,
        textOnly:source.textOnly
      });
    }));
  } catch {
    // Best-effort public fallback. OAuth remains the production path when approved.
    return collectRSS({...source,url:`https://www.reddit.com/r/${encodeURIComponent(source.subreddit)}/hot/.rss`});
  }
}

async function collectPubMed(source) {
  const limit=source.limit||10;
  const q = encodeURIComponent(`${source.query} AND ("last 30 days"[PDat])`);
  const search = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=${limit}&term=${q}`);
  const ids = search?.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summary = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  return compact(ids.map(id => summary?.result?.[id]).filter(Boolean).map(x => obs(source, { id:x.uid, title:x.title, url:`https://pubmed.ncbi.nlm.nih.gov/${x.uid}/`, publishedAt:x.pubdate ? new Date(x.pubdate).toISOString() : new Date().toISOString(), summary:(x.fulljournalname||'PubMed') + (x.sortfirstauthor ? ` · ${x.sortfirstauthor}`:'') })));
}

async function collectUSGS(source) {
  const data = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
  return compact((data.features||[]).slice(0,source.limit||14).map(x => obs(source, { id:x.id, title:`M${x.properties.mag} earthquake — ${x.properties.place}`, url:x.properties.url, publishedAt:new Date(x.properties.time).toISOString(), engagement:Math.round((x.properties.mag||0)*10), summary:`Depth ${x.geometry?.coordinates?.[2] ?? '?'} km · USGS reviewed event` })));
}

function rssEntries(xml) {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map(m=>m[0]);
  const tag = (b,n) => cleanText((b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`,'i'))||[])[1]||'');
  const link = b => {
    const href = (b.match(/<link[^>]+href=["']([^"']+)/i)||[])[1];
    return href || tag(b,'link');
  };
  return blocks.map((b,i)=>({
    id:tag(b,'guid')||tag(b,'id')||link(b)||i,
    title:tag(b,'title'),
    url:link(b),
    publisher:tag(b,'source'),
    summary:tag(b,'description')||tag(b,'summary')||tag(b,'content'),
    publishedAt:tag(b,'pubDate')||tag(b,'published')||tag(b,'updated'),
    image:mediaImage(b)
  }));
}
async function collectRSS(source) {
  const xml = await fetchText(source.url);
  return compact(rssEntries(xml).slice(0,source.limit||12).map(x => obs(source,{...x,publishedAt:toIso(x.publishedAt)})));
}
async function collectGoogleNews(source) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(source.query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  return compact(rssEntries(xml).slice(0,source.limit||10).map(x => obs(source,{...x,textOnly:source.textOnly,publishedAt:x.publishedAt ? new Date(x.publishedAt).toISOString():new Date().toISOString()})));
}
async function collectArxiv(source) {
  const limit=source.limit||12;
  const url = `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI%20OR%20cat%3Acs.HC%20OR%20cat%3Acs.CY&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
  const xml = await fetchText(url);
  return compact(rssEntries(xml).slice(0,limit).map(x => obs(source,{...x,publishedAt:x.publishedAt ? new Date(x.publishedAt).toISOString():new Date().toISOString()})));
}

async function collectSource(source) {
  try {
    let items=[];
    if (source.adapter==='hackernews') items=await collectHackerNews(source);
    else if (source.adapter==='reddit') items=await collectReddit(source);
    else if (source.adapter==='pubmed') items=await collectPubMed(source);
    else if (source.adapter==='usgs') items=await collectUSGS(source);
    else if (source.adapter==='rss') items=await collectRSS(source);
    else if (source.adapter==='gnews') items=await collectGoogleNews(source);
    else if (source.adapter==='arxiv') items=await collectArxiv(source);
    return {source:source.name, ok:true, items};
  } catch (error) {
    return {source:source.name, ok:false, error:String(error.message||error), items:[]};
  }
}

const STOP = new Set('the a an and or but for with from into over under about this that these those of to in on at by is are was were be been being as it its their our your new how why what who when where more most after before'.split(' '));
function tokens(s='') { return new Set(cleanText(s).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x))); }
function similarity(a,b) {
  const A=tokens(a), B=tokens(b); if(!A.size||!B.size) return 0;
  let inter=0; A.forEach(x=>{if(B.has(x)) inter++});
  const union=new Set([...A,...B]).size;
  return inter/union;
}
function recencyScore(date) {
  const t=new Date(date).getTime();
  if(!Number.isFinite(t)) return 55;
  const ageH=Math.max(0,(Date.now()-t)/36e5);
  return Math.max(0,100-ageH*2.4);
}
function stage(score, sources) {
  if(score>=88&&sources>=4) return 'VIRAL';
  if(score>=80&&sources>=3) return 'BREAKING';
  if(score>=70) return 'EMERGING';
  if(score>=58) return 'STIRRING';
  return 'WHISPER';
}
function clusterObservations(observations) {
  const exact=new Map();
  for(const o of observations.filter(x=>x?.title)){
    const key=o.sourceUrl?`url:${o.sourceUrl}`:`id:${o.id}`;
    if(!exact.has(key))exact.set(key,o);
  }
  const sorted=[...exact.values()].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
  const clusters=[];
  for(const o of sorted){
    let c=clusters.find(c=>{
      const rep=c.observations[0];
      if(o.sourceId==='usgs'||rep.sourceId==='usgs')return false;
      const shared=(o.categories||[]).some(cat=>(rep.categories||[]).includes(cat));
      if(!shared)return false;
      const research=['EVIDENCE','PREPRINT'].includes(o.role)||['EVIDENCE','PREPRINT'].includes(rep.role);
      const windowMs=(research?30:3)*864e5;
      if(Math.abs(new Date(o.publishedAt)-new Date(rep.publishedAt))>windowMs)return false;
      return similarity(c.title,o.title)>=0.62;
    });
    if(!c){
      const fingerprint=[...tokens(o.title)].sort().join(' ');
      c={id:`c_${stableHash(fingerprint||o.title).slice(0,16)}`,title:o.title,summary:o.summary,categories:[...o.categories],observations:[],firstSeen:o.publishedAt,lastSeen:o.publishedAt};
      clusters.push(c);
    }
    c.observations.push(o);
    c.firstSeen = new Date(c.firstSeen)<new Date(o.publishedAt)?c.firstSeen:o.publishedAt;
    c.lastSeen = new Date(c.lastSeen)>new Date(o.publishedAt)?c.lastSeen:o.publishedAt;
    c.categories=[...new Set([...c.categories,...o.categories])];
  }
  return clusters.map(c=>{
    const sourceGroup=o=>o.publisher||(()=>{try{return new URL(o.sourceUrl).hostname.replace(/^www\./,'')}catch{return o.source}})();
    const uniqueSources=[...new Set(c.observations.map(sourceGroup))];
    const avgEdge=c.observations.reduce((s,o)=>s+o.sourceEdge,0)/c.observations.length;
    const recency=Math.max(...c.observations.map(o=>recencyScore(o.publishedAt)));
    const breadth=Math.min(100,35+uniqueSources.length*16);
    const engagement=Math.min(100,Math.log10(1+c.observations.reduce((s,o)=>s+o.engagement,0))*24);
    const evidence=Math.min(100, avgEdge + (c.observations.some(o=>o.role==='EVIDENCE')?8:0));
    const velocity=Math.min(100,recency*.7+Math.min(35,c.observations.length*8));
    const novelty=Math.max(45, Math.min(96, 90-c.observations.length*1.5));
    const culturalReach=Math.min(100,breadth*.65+engagement*.35);
    const score=Math.round(velocity*.24+novelty*.13+avgEdge*.18+breadth*.17+evidence*.16+culturalReach*.12);
    const best=[...c.observations].sort((a,b)=>(b.sourceEdge+b.engagement/10)-(a.sourceEdge+a.engagement/10))[0];
    const bestImage = best.image || c.observations.find(o=>o.image)?.image || null;
    return {
      id:c.id,
      title:c.title,
      summary:best.summary||c.summary,
      categories:c.categories,
      primaryCategory:best.categories?.[0]||c.categories[0],
      score,
      stage:stage(score,uniqueSources.length),
      velocity:Math.round(velocity),
      novelty:Math.round(novelty),
      sourceEdge:Math.round(avgEdge),
      breadth:Math.round(breadth),
      evidenceQuality:Math.round(evidence),
      culturalReach:Math.round(culturalReach),
      sources:uniqueSources.length,
      sourceNames:uniqueSources.slice(0,10),
      publisher:best.publisher||'',
      publishedAt:c.lastSeen,
      firstSeen:c.firstSeen,
      url:best.sourceUrl,
      sourceImage:best.textOnly?null:bestImage,
      textOnly:c.observations.every(o=>o.textOnly)
    };
  }).sort((a,b)=>b.score-a.score).slice(0,120);
}

function categoryCoverage(items){
  const categories=['SOMA','ARCANA','APPETITE','SIGNAL LAB','VISUAL CORTEX','THE PULSE','TERRA','VERDANT','IGNITION','OBJECTS OF DESIRE','EROS INDEX'];
  return Object.fromEntries(categories.map(cat=>[cat,items.filter(x=>x.categories?.includes(cat)).length]));
}

async function collectAll() {
  const startedAt=new Date().toISOString();
  const results=[];
  const concurrency=Math.max(1,Math.min(12,Number(process.env.COLLECTOR_MAX_CONCURRENCY||8)));
  for(let i=0;i<OPEN_SOURCES.length;i+=concurrency){
    results.push(...await Promise.all(OPEN_SOURCES.slice(i,i+concurrency).map(collectSource)));
  }
  const observations=results.flatMap(r=>r.items);
  const clusters=clusterObservations(observations);
  return {
    live:true,
    generatedAt:new Date().toISOString(),
    startedAt,
    run:{
      sourcesAttempted:results.length,
      sourcesOk:results.filter(r=>r.ok).length,
      observations:observations.length,
      clusters:clusters.length,
      coverage:categoryCoverage(clusters),
      errors:results.filter(r=>!r.ok).map(r=>({source:r.source,error:r.error}))
    },
    items:clusters
  };
}

async function kvCommand(command) {
  const url=process.env.KV_REST_API_URL, token=process.env.KV_REST_API_TOKEN;
  if(!url||!token) return null;
  const r=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(command)});
  if(!r.ok) throw new Error(`KV ${r.status}`);
  return r.json();
}
async function saveLatest(payload) { return kvCommand(['SET','sapio:feed:latest',JSON.stringify(payload),'EX','21600']); }
async function loadLatest() {
  const x=await kvCommand(['GET','sapio:feed:latest']);
  if(!x?.result) return null;
  try{return JSON.parse(x.result)}catch{return null}
}

module.exports={collectAll,saveLatest,loadLatest};
