const { OPEN_SOURCES } = require('./source-registry');

const UA = 'SAPIO-Cultural-Intelligence/0.1 (+https://sapio.invalid; research-feed)';
const BLOCKED_DOMAINS = ['pornhub.com','xvideos.com','xnxx.com','redtube.com','youporn.com'];

function cleanText(s='') {
  return String(s).replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
function safeUrl(url='') {
  try {
    const u = new URL(url);
    if (!['http:','https:'].includes(u.protocol)) return null;
    if (BLOCKED_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.'+d))) return null;
    return u.toString();
  } catch { return null; }
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
  const url = safeUrl(item.url || item.sourceUrl);
  return {
    id: `${source.id}:${item.id || Buffer.from((item.title||'').slice(0,80)).toString('base64url')}`,
    sourceId: source.id,
    source: source.name,
    role: source.role,
    sourceEdge: source.sourceEdge,
    categories: item.categories || source.categories,
    title: cleanText(item.title).slice(0,240),
    summary: cleanText(item.summary || '').slice(0,520),
    sourceUrl: url,
    publishedAt: item.publishedAt || new Date().toISOString(),
    engagement: Number(item.engagement || 0),
    textOnly: Boolean(source.textOnly || item.textOnly),
    rawType: item.rawType || source.kind
  };
}

async function collectHackerNews(source) {
  const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0,14);
  const items = await Promise.all(ids.map(id => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(()=>null)));
  return items.filter(Boolean).map(x => obs(source, { id:x.id, title:x.title, url:x.url || `https://news.ycombinator.com/item?id=${x.id}`, publishedAt:new Date(x.time*1000).toISOString(), engagement:(x.score||0)+(x.descendants||0), summary:`${x.score||0} points · ${x.descendants||0} comments` }));
}

async function collectReddit(source) {
  const data = await fetchJson(`https://www.reddit.com/r/${encodeURIComponent(source.subreddit)}/hot.json?limit=10&raw_json=1`, {headers:{accept:'application/json'}});
  return (data?.data?.children || []).map(({data:x}) => obs(source, { id:x.id, title:x.title, url:`https://www.reddit.com${x.permalink}`, publishedAt:new Date(x.created_utc*1000).toISOString(), engagement:(x.score||0)+(x.num_comments||0)*2, summary:`${x.score||0} score · ${x.num_comments||0} comments`, textOnly:true }));
}

async function collectPubMed(source) {
  const q = encodeURIComponent(`${source.query} AND ("last 30 days"[PDat])`);
  const search = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=8&term=${q}`);
  const ids = search?.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summary = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  return ids.map(id => summary?.result?.[id]).filter(Boolean).map(x => obs(source, { id:x.uid, title:x.title, url:`https://pubmed.ncbi.nlm.nih.gov/${x.uid}/`, publishedAt:x.pubdate ? new Date(x.pubdate).toISOString() : new Date().toISOString(), summary:(x.fulljournalname||'PubMed') + (x.sortfirstauthor ? ` · ${x.sortfirstauthor}`:'') }));
}

async function collectUSGS(source) {
  const data = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
  return (data.features||[]).slice(0,12).map(x => obs(source, { id:x.id, title:`M${x.properties.mag} earthquake — ${x.properties.place}`, url:x.properties.url, publishedAt:new Date(x.properties.time).toISOString(), engagement:Math.round((x.properties.mag||0)*10), summary:`Depth ${x.geometry?.coordinates?.[2] ?? '?'} km · USGS reviewed event` }));
}

function rssEntries(xml) {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map(m=>m[0]);
  const tag = (b,n) => cleanText((b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`,'i'))||[])[1]||'');
  const link = b => {
    const href = (b.match(/<link[^>]+href=["']([^"']+)/i)||[])[1];
    return href || tag(b,'link');
  };
  return blocks.map((b,i)=>({id:i,title:tag(b,'title'),url:link(b),summary:tag(b,'description')||tag(b,'summary'),publishedAt:tag(b,'pubDate')||tag(b,'published')||tag(b,'updated')}));
}
async function collectRSS(source) {
  const xml = await fetchText(source.url);
  return rssEntries(xml).slice(0,10).map(x => obs(source,{...x,publishedAt:x.publishedAt ? new Date(x.publishedAt).toISOString():new Date().toISOString()}));
}
async function collectGoogleNews(source) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(source.query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  return rssEntries(xml).slice(0,10).map(x => obs(source,{...x,publishedAt:x.publishedAt ? new Date(x.publishedAt).toISOString():new Date().toISOString()}));
}
async function collectArxiv(source) {
  const url = 'https://export.arxiv.org/api/query?search_query=cat%3Acs.AI%20OR%20cat%3Acs.HC%20OR%20cat%3Acs.CY&sortBy=submittedDate&sortOrder=descending&max_results=10';
  const xml = await fetchText(url);
  return rssEntries(xml).slice(0,10).map(x => obs(source,{...x,publishedAt:x.publishedAt ? new Date(x.publishedAt).toISOString():new Date().toISOString()}));
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
  const ageH=Math.max(0,(Date.now()-new Date(date).getTime())/36e5);
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
  const sorted=[...observations].filter(x=>x.title).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
  const clusters=[];
  for(const o of sorted){
    let c=clusters.find(c=>similarity(c.title,o.title)>=0.46);
    if(!c){ c={id:`c_${clusters.length+1}`,title:o.title,summary:o.summary,categories:[...o.categories],observations:[],firstSeen:o.publishedAt,lastSeen:o.publishedAt}; clusters.push(c); }
    c.observations.push(o);
    c.firstSeen = new Date(c.firstSeen)<new Date(o.publishedAt)?c.firstSeen:o.publishedAt;
    c.lastSeen = new Date(c.lastSeen)>new Date(o.publishedAt)?c.lastSeen:o.publishedAt;
    c.categories=[...new Set([...c.categories,...o.categories])];
  }
  return clusters.map(c=>{
    const uniqueSources=[...new Set(c.observations.map(o=>o.source))];
    const avgEdge=c.observations.reduce((s,o)=>s+o.sourceEdge,0)/c.observations.length;
    const recency=Math.max(...c.observations.map(o=>recencyScore(o.publishedAt)));
    const breadth=Math.min(100,35+uniqueSources.length*16);
    const engagement=Math.min(100,Math.log10(1+c.observations.reduce((s,o)=>s+o.engagement,0))*24);
    const evidence=Math.min(100, avgEdge + (c.observations.some(o=>o.role==='EVIDENCE')?8:0));
    const velocity=Math.min(100,recency*.7+Math.min(35,c.observations.length*8));
    const novelty=Math.max(45, Math.min(96, 88-c.observations.length*2));
    const culturalReach=Math.min(100,breadth*.65+engagement*.35);
    const score=Math.round(velocity*.24+novelty*.13+avgEdge*.18+breadth*.17+evidence*.16+culturalReach*.12);
    const best=[...c.observations].sort((a,b)=>(b.sourceEdge+b.engagement/10)-(a.sourceEdge+a.engagement/10))[0];
    return {id:c.id,title:c.title,summary:best.summary||c.summary,categories:c.categories,primaryCategory:c.categories[0],score,stage:stage(score,uniqueSources.length),velocity:Math.round(velocity),novelty:Math.round(novelty),sourceEdge:Math.round(avgEdge),breadth:Math.round(breadth),evidenceQuality:Math.round(evidence),culturalReach:Math.round(culturalReach),sources:uniqueSources.length,sourceNames:uniqueSources.slice(0,8),publishedAt:c.lastSeen,firstSeen:c.firstSeen,url:best.sourceUrl,textOnly:c.observations.every(o=>o.textOnly)};
  }).sort((a,b)=>b.score-a.score).slice(0,50);
}

async function collectAll() {
  const startedAt=new Date().toISOString();
  const results=await Promise.all(OPEN_SOURCES.map(collectSource));
  const observations=results.flatMap(r=>r.items);
  const clusters=clusterObservations(observations);
  return {live:true,generatedAt:new Date().toISOString(),startedAt,run:{sourcesAttempted:results.length,sourcesOk:results.filter(r=>r.ok).length,observations:observations.length,clusters:clusters.length,errors:results.filter(r=>!r.ok).map(r=>({source:r.source,error:r.error}))},items:clusters};
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
