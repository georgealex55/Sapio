const STOP=new Set('the a an and or but for with from into over under about this that these those of to in on at by is are was were be been being as it its their our your new how why what who when where more most after before'.split(' '));

function tokens(value=''){
  return new Set(String(value).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)));
}
function similarity(a,b){
  const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
  let intersection=0;for(const token of A)if(B.has(token))intersection++;
  return intersection/new Set([...A,...B]).size;
}
function categoryOverlap(a,b){
  return (a?.categories||[]).some(category=>(b?.categories||[]).includes(category));
}
function historyEntry(item,at){
  return {at,score:item.score||0,sources:item.sources||0,stage:item.stage||'WHISPER',lifecycle:item.lifecycle||'NEW'};
}
function nextLifecycle(current,previous){
  if(!previous)return 'NEW';
  if(previous.active===false)return 'BUILDING';
  const scoreDelta=(current.score||0)-(previous.score||0);
  const sourceDelta=(current.sources||0)-(previous.sources||0);
  if(current.score>=88&&current.sources>=4)return 'DOMINANT';
  if(current.score>=80&&current.sources>=4)return 'ESTABLISHED';
  if(scoreDelta<=-6&&sourceDelta<=0)return 'WEAKENING';
  if(scoreDelta>0||sourceDelta>0)return 'BUILDING';
  return previous.lifecycle==='NEW'?'BUILDING':previous.lifecycle||'BUILDING';
}
function chapterFor(lifecycle,previous){
  if(previous?.active===false)return 'REVIVAL';
  return ({NEW:'ORIGIN',BUILDING:'EMERGENCE',ESTABLISHED:'CONFIRMATION',DOMINANT:'MAINSTREAM_ADOPTION',WEAKENING:'DECLINE',CLOSED:'DECLINE'})[lifecycle]||'EMERGENCE';
}
function mergeSourceHealth(previous={},runs=[],at){
  const next={...previous};
  for(const run of runs){
    const old=next[run.source]||{runs:0,successes:0,failures:0,items:0};
    next[run.source]={
      runs:old.runs+1,
      successes:old.successes+(run.ok?1:0),
      failures:old.failures+(run.ok?0:1),
      items:old.items+(run.items||0),
      lastRunAt:at,
      lastSuccessAt:run.ok?at:old.lastSuccessAt||null,
      lastError:run.ok?null:run.error||'unknown',
      successRate:Math.round(((old.successes+(run.ok?1:0))/(old.runs+1))*100)
    };
  }
  return next;
}
function persistClusters(payload,previous=null,{maxHistory=500,retentionDays=90}={}){
  const at=payload.generatedAt||new Date().toISOString();
  const oldItems=Array.isArray(previous?.items)?previous.items:[];
  const oldById=new Map(oldItems.map(item=>[item.id,item]));
  const used=new Set();
  const active=(payload.items||[]).map(current=>{
    let old=oldById.get(current.id);
    if(!old){
      old=oldItems.find(candidate=>!used.has(candidate.id)&&categoryOverlap(current,candidate)&&similarity(current.title,candidate.title)>=0.72);
    }
    if(old)used.add(old.id);
    const lifecycle=nextLifecycle(current,old);
    const chapter=chapterFor(lifecycle,old);
    const chapters=Array.isArray(old?.chapters)?[...old.chapters]:[];
    if(!chapters.length||chapters[chapters.length-1].chapter!==chapter){
      chapters.push({chapter,startedAt:at,score:current.score||0});
    }
    const scoreHistory=[...(old?.scoreHistory||[]),historyEntry({...current,lifecycle},at)].slice(-192);
    return {
      ...current,
      id:old?.id||current.id,
      firstSeen:old?.firstSeen||current.firstSeen||current.publishedAt||at,
      lastSeen:current.publishedAt||at,
      active:true,
      iterations:(old?.iterations||0)+1,
      lifecycle,
      chapters:chapters.slice(-24),
      scoreHistory,
      reactivations:(old?.reactivations||0)+(old?.active===false?1:0),
      peakScore:Math.max(old?.peakScore||0,current.score||0),
      peakSources:Math.max(old?.peakSources||0,current.sources||0)
    };
  });
  const activeIds=new Set(active.map(item=>item.id));
  const cutoff=Date.now()-retentionDays*864e5;
  const retired=oldItems.filter(item=>!activeIds.has(item.id)&&!used.has(item.id)).map(item=>{
    const last=new Date(item.lastSeen||item.publishedAt||0).getTime();
    const closed=Number.isFinite(last)&&Date.now()-last>48*36e5;
    return {...item,active:false,lifecycle:closed?'CLOSED':'WEAKENING'};
  }).filter(item=>new Date(item.lastSeen||item.publishedAt||0).getTime()>=cutoff)
    .sort((a,b)=>new Date(b.lastSeen||b.publishedAt)-new Date(a.lastSeen||a.publishedAt))
    .slice(0,Math.max(0,maxHistory-active.length));
  const items=[...active,...retired];
  const counts={};
  for(const item of items)counts[item.lifecycle]=(counts[item.lifecycle]||0)+1;
  return {
    ...payload,
    persistence:{
      enabled:true,
      version:1,
      previousGeneratedAt:previous?.generatedAt||null,
      activeClusters:active.length,
      retainedClusters:retired.length,
      lifecycleCounts:counts
    },
    sourceHealth:mergeSourceHealth(previous?.sourceHealth,payload.run?.sourceRuns||[],at),
    items
  };
}
module.exports={persistClusters,similarity};
