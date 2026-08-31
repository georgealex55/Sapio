const CHANNELS=['ALL','SOMA','ARCANA','APPETITE','SIGNAL LAB','VISUAL CORTEX','THE PULSE','TERRA','VERDANT','IGNITION','OBJECTS OF DESIRE','EROS INDEX'];
const MAX_AGE_HOURS=24;
const REFRESH_MS=5*60*1000;
const STEP=520;
const MAX_TRAVEL=5200;

const DIRECTIONS={
  N:{x:0,y:-1,label:'FUTURE / SIGNAL',cats:['SIGNAL LAB','IGNITION']},
  NE:{x:.707,y:-.707,label:'DESIGN / STYLE',cats:['VISUAL CORTEX','APPETITE']},
  E:{x:1,y:0,label:'DESIRE / PRODUCTS',cats:['OBJECTS OF DESIRE','APPETITE']},
  SE:{x:.707,y:.707,label:'EROS / NIGHTLIFE',cats:['EROS INDEX','APPETITE']},
  S:{x:0,y:1,label:'BODY / SOMA',cats:['SOMA','EROS INDEX']},
  SW:{x:-.707,y:.707,label:'ARCANA / INNER WORLD',cats:['ARCANA','SOMA']},
  W:{x:-1,y:0,label:'WORLD / PULSE',cats:['THE PULSE','IGNITION']},
  NW:{x:-.707,y:-.707,label:'EARTH / NATURE',cats:['TERRA','VERDANT']}
};
const CATEGORY_VECTORS={
  'SIGNAL LAB':{x:0,y:-1},'IGNITION':{x:-.35,y:-.94},'VISUAL CORTEX':{x:.707,y:-.707},
  'OBJECTS OF DESIRE':{x:1,y:0},'APPETITE':{x:.92,y:.38},'EROS INDEX':{x:.707,y:.707},
  'SOMA':{x:0,y:1},'ARCANA':{x:-.707,y:.707},'THE PULSE':{x:-1,y:0},
  'TERRA':{x:-.707,y:-.707},'VERDANT':{x:-.82,y:-.57}
};
const state={
  items:[],active:'ALL',eros:false,modeOverride:null,demo:false,loading:false,view:'map',
  focusItem:null,previewItem:null,nav:{x:0,y:0},positions:new Map(),drag:null,dragMovedUntil:0,
  memories:JSON.parse(localStorage.getItem('sapio:memory')||'[]'),
  likes:JSON.parse(localStorage.getItem('sapio:likes')||'[]'),
  hidden:new Set(JSON.parse(localStorage.getItem('sapio:hidden')||'[]'))
};
const $=s=>document.querySelector(s);

function chicagoHour(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',hour12:false}).formatToParts(new Date());
  return Number(parts.find(x=>x.type==='hour')?.value||0);
}
function autoNocturne(){return chicagoHour()>=19||chicagoHour()<5}
function isNocturne(){return state.modeOverride===null?autoNocturne():state.modeOverride}
function erosVisible(){return state.eros||isNocturne()}
function applyMode(){
  const n=isNocturne();
  document.documentElement.classList.toggle('nocturne',n);
  $('#modeToggle').setAttribute('aria-pressed',n?'true':'false');
  $('#modeToggle').textContent=state.modeOverride===null?`NOCTURNE ${n?'ON':'AUTO'}`:`NOCTURNE ${n?'ON':'OFF'}`;
  $('#modeLabel').textContent=n?'SAPIO // NOCTURNE':'DAY / CULTURAL INTELLIGENCE';
  const eros=erosVisible();
  $('#erosToggle').setAttribute('aria-pressed',eros?'true':'false');
  $('#erosToggle').textContent=!state.eros&&n?'EROS AUTO':eros?'EROS ON':'EROS OFF';
}
function ageHours(date){
  const t=new Date(date).getTime();
  return Number.isFinite(t)?Math.max(0,(Date.now()-t)/36e5):0;
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function xmlEsc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function normalize(v){const m=Math.hypot(v.x,v.y)||1;return{x:v.x/m,y:v.y/m}}
function isSaved(id){return state.memories.some(m=>m.id===id)}
function isLiked(id){return state.likes.some(m=>m.id===id)}
function retainedSnapshot(item){
  return {
    id:item.id,title:item.title,summary:item.summary||'',url:item.url||'',categories:item.categories||[],
    primaryCategory:item.primaryCategory||'IGNITION',score:item.score||50,stage:item.stage||'WHISPER',
    velocity:item.velocity,sourceEdge:item.sourceEdge,evidenceQuality:item.evidenceQuality,sources:item.sources||1,
    sourceNames:item.sourceNames||[],publisher:item.publisher||'',publishedAt:item.publishedAt,firstSeen:item.firstSeen,
    sourceImage:item.sourceImage||null,image:item.image||null,eros:item.eros||item.primaryCategory==='EROS INDEX'
  };
}
function retainedItems(){return [...state.memories,...state.likes].map(x=>x.item).filter(Boolean)}
function activeItems(){
  const live=state.items.filter(item=>state.demo||ageHours(item.publishedAt)<MAX_AGE_HOURS||isSaved(item.id)||isLiked(item.id));
  const byId=new Map();
  [...live,...retainedItems()].forEach(item=>{if(item?.id&&!byId.has(item.id))byId.set(item.id,item)});
  return [...byId.values()];
}
function baseVisible(item){return erosVisible()||!(item.eros||item.primaryCategory==='EROS INDEX')}
function channelVisible(item){
  if(!baseVisible(item))return false;
  return state.active==='ALL'||item.categories?.includes(state.active)||item.primaryCategory===state.active;
}
function affinity(cat){
  const count=state.memories.filter(m=>m.category===cat).length+state.likes.filter(m=>m.category===cat).length*.5;
  return Math.min(100,50+count*8);
}
function rank(item){return(item.score||50)*.75+affinity(item.primaryCategory)*.25}
function hashString(value=''){
  let h=0;
  for(let i=0;i<value.length;i++)h=((h<<5)-h)+value.charCodeAt(i),h|=0;
  return Math.abs(h);
}
function hueFrom(value,offset=0){return(hashString(value)+offset)%360}
function uniqueImage(item){
  const key=`${item.id||''}|${item.title||''}|${item.primaryCategory||''}`;
  const a=hueFrom(key),b=hueFrom(key,75),c=hueFrom(key,145);
  const title=xmlEsc((item.title||'SAPIO SIGNAL').slice(0,54));
  const category=xmlEsc((item.primaryCategory||'SIGNAL').slice(0,26));
  const source=xmlEsc((item.sourceNames?.[0]||item.publisher||'SAPIO').slice(0,26));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${a} 70% 56%)"/><stop offset="55%" stop-color="hsl(${b} 74% 42%)"/><stop offset="100%" stop-color="hsl(${c} 80% 28%)"/></linearGradient></defs><rect width="1200" height="750" fill="url(#g)"/><circle cx="930" cy="140" r="230" fill="rgba(255,255,255,.15)"/><path d="M0 610 C205 460 390 700 590 600 C775 510 910 305 1200 362 L1200 750 L0 750 Z" fill="rgba(7,7,12,.2)"/><g transform="translate(72 84)"><text x="0" y="35" fill="white" font-family="Arial" font-size="18" font-weight="800" letter-spacing="2">${category}</text><text x="0" y="188" fill="white" font-family="Georgia" font-size="48" font-weight="700">${title}</text><text x="0" y="238" fill="rgba(255,255,255,.82)" font-family="Arial" font-size="20">${source} • SAPIO</text></g></svg>`;
  return`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function cardImage(item){
  const external=item.sourceImage||(item.image&&!String(item.image).startsWith('assets/')?item.image:null);
  return external||uniqueImage(item);
}

function itemVector(item){
  const cats=[...(item.categories||[]),item.primaryCategory].filter(Boolean);
  let x=0,y=0,n=0;
  cats.forEach(cat=>{const v=CATEGORY_VECTORS[cat];if(v){x+=v.x;y+=v.y;n++}});
  if(!n){
    const angle=(hashString(item.id||item.title)%360)*Math.PI/180;
    return{x:Math.cos(angle),y:Math.sin(angle)};
  }
  return normalize({x,y});
}
function nearestDirection(vec){
  let best='N',dot=-Infinity;
  Object.entries(DIRECTIONS).forEach(([k,d])=>{
    const v=vec.x*d.x+vec.y*d.y;
    if(v>dot){dot=v;best=k}
  });
  return best;
}
function buildPositions(){
  const items=activeItems().filter(x=>!state.hidden.has(x.id)&&baseVisible(x)).sort((a,b)=>rank(b)-rank(a));
  const laneCounts={};
  state.positions.clear();
  items.forEach(item=>{
    const vec=itemVector(item),lane=nearestDirection(vec),idx=laneCounts[lane]||0;
    laneCounts[lane]=idx+1;
    const ring=Math.floor(idx/3);
    const slot=idx%3;
    const radius=420+ring*360+slot*110+(hashString(item.id)%55);
    const jitter=((hashString(`${item.id}:j`)%361)-180);
    const perp={x:-vec.y,y:vec.x};
    state.positions.set(item.id,{x:vec.x*radius+perp.x*jitter,y:vec.y*radius+perp.y*jitter,lane,index:idx});
  });
}
function directionState(){
  const dist=Math.hypot(state.nav.x,state.nav.y);
  if(dist<90)return{key:null,label:'CENTER / BALANCED',strength:0,dist};
  const v=normalize(state.nav),key=nearestDirection(v);
  return{key,label:DIRECTIONS[key].label,strength:clamp(dist/3200,0,1),dist};
}
function updateCamera(){
  const x=-state.nav.x,y=-state.nav.y;
  $('#spatialWorld').style.transform=`translate3d(${x}px,${y}px,0)`;
  $('#laneLabels').style.transform=`translate3d(${x}px,${y}px,0)`;
  const d=directionState();
  $('#vectorLabel').textContent=d.label;
  $('#vectorDepth').textContent=`${Math.round(d.strength*100)}% DIRECTIONAL`;
  document.querySelectorAll('.compass-btn').forEach(b=>b.classList.toggle('active',b.dataset.dir===d.key));
  document.querySelectorAll('.spatial-card').forEach(card=>{
    const pos=state.positions.get(card.dataset.id);
    if(!pos)return;
    const dist=Math.hypot(pos.x-state.nav.x,pos.y-state.nav.y);
    card.classList.toggle('far',dist>1500);
    card.classList.toggle('near',dist<520);
    card.style.zIndex=String(Math.max(1,110-Math.round(dist/18)));
  });
}
function moveCamera(dx,dy){
  state.nav.x=clamp(state.nav.x+dx,-MAX_TRAVEL,MAX_TRAVEL);
  state.nav.y=clamp(state.nav.y+dy,-MAX_TRAVEL,MAX_TRAVEL);
  updateCamera();
}
function moveDirection(key,mult=1){
  const d=DIRECTIONS[key];
  if(d)moveCamera(d.x*STEP*mult,d.y*STEP*mult);
}
function recenter(){state.nav={x:0,y:0};updateCamera()}

function categoryCounts(){
  const items=activeItems().filter(x=>!state.hidden.has(x.id)&&baseVisible(x));
  const counts={ALL:items.length};
  CHANNELS.slice(1).forEach(cat=>counts[cat]=items.filter(x=>x.categories?.includes(cat)||x.primaryCategory===cat).length);
  return counts;
}
function renderChannels(){
  const counts=categoryCounts();
  $('#categoryRail').innerHTML=CHANNELS.filter(c=>erosVisible()||c!=='EROS INDEX')
    .map(c=>`<button class="chip ${state.active===c?'active':''}" data-cat="${esc(c)}">${esc(c)} <span>${counts[c]||0}</span></button>`).join('');
  document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{
    state.active=b.dataset.cat;
    buildPositions();
    renderMap();
    renderTimeline();
  });
}
function renderLaneLabels(){
  $('#laneLabels').innerHTML=Object.entries(DIRECTIONS).map(([key,d])=>
    `<div class="lane-label" style="left:calc(50% + ${Math.round(d.x*1050)}px);top:calc(50% + ${Math.round(d.y*1050)}px)"><b>${key}</b><span>${esc(d.label)}</span></div>`
  ).join('');
}
function renderMap(){
  const items=activeItems().filter(x=>!state.hidden.has(x.id)&&channelVisible(x)).sort((a,b)=>rank(b)-rank(a));
  $('#spatialWorld').innerHTML=items.map(item=>{
    const p=state.positions.get(item.id)||{x:0,y:0,lane:'N'};
    const saved=isSaved(item.id),liked=isLiked(item.id);
    return`<article class="spatial-card" data-id="${esc(item.id)}" style="left:calc(50% + ${Math.round(p.x)}px);top:calc(50% + ${Math.round(p.y)}px)" tabindex="0">
      <div class="spatial-image"><img loading="lazy" decoding="async" src="${esc(cardImage(item))}" alt="${esc(item.title)}"><span>${esc(item.stage||'SIGNAL')}</span></div>
      <div class="spatial-body">
        <div class="spatial-meta">${esc(item.primaryCategory||'SIGNAL')} · ${Math.round(ageHours(item.publishedAt))}H</div>
        <h3>${esc(item.title)}</h3>
        <div class="spatial-foot"><span>${item.sources||1} sources</span><span>${saved?'♥':liked?'♡':''}</span></div>
      </div>
    </article>`;
  }).join('')||`<div class="map-empty">NO FRESH SIGNALS IN THIS CHANNEL</div>`;
  document.querySelectorAll('.spatial-card').forEach(card=>{
    const item=activeItems().find(x=>x.id===card.dataset.id);
    card.addEventListener('click',()=>{if(Date.now()<state.dragMovedUntil)return;openPreview(item)});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPreview(item)}});
  });
  updateCamera();
}

const STOP=new Set('the a an and or but for with from into over under about this that these those of to in on at by is are was were be been being as it its their our your new how why what who when where more most after before'.split(' '));
function tokens(s=''){
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)));
}
function textSimilarity(a,b){
  const A=tokens(a),B=tokens(b);
  if(!A.size||!B.size)return 0;
  let n=0;A.forEach(x=>{if(B.has(x))n++});
  return n/new Set([...A,...B]).size;
}
function focusScore(item,focus){
  if(!focus)return rank(item);
  const catsA=new Set(item.categories||[]),catsB=new Set(focus.categories||[]);
  let overlap=0;catsA.forEach(c=>{if(catsB.has(c))overlap++});
  const catScore=overlap/Math.max(1,new Set([...catsA,...catsB]).size);
  const sim=textSimilarity(`${item.title} ${item.summary||''}`,`${focus.title} ${focus.summary||''}`);
  return rank(item)*.35+catScore*45+sim*35+Math.max(0,20-ageHours(item.publishedAt)*.6);
}
function renderTimeline(){
  if(state.view!=='timeline')return;
  const focus=state.focusItem;
  const items=activeItems()
    .filter(x=>!state.hidden.has(x.id)&&channelVisible(x)&&(!focus||x.id!==focus.id))
    .sort((a,b)=>focusScore(b,focus)-focusScore(a,focus)).slice(0,48);
  $('#timelineTitle').textContent=focus?focus.title:'All signals';
  $('#timelineCopy').textContent=focus
    ?`Signals are ranked by shared categories, language and cultural relevance to this card.`
    :'Standard vertical reading mode ranked by cultural importance and affinity.';
  $('#feed').innerHTML=items.map(item=>{
    const saved=isSaved(item.id),liked=isLiked(item.id),retained=ageHours(item.publishedAt)>=MAX_AGE_HOURS;
    return`<article class="timeline-card" data-id="${esc(item.id)}">
      <div class="timeline-media"><img loading="lazy" src="${esc(cardImage(item))}" alt="${esc(item.title)}"></div>
      <div class="timeline-body">
        <div class="meta"><span>${esc(item.primaryCategory||'SIGNAL')}</span><span class="stage">${esc(item.stage||'WHISPER')}</span><span>${Math.round(ageHours(item.publishedAt))}H</span>${retained?'<span>RETAINED</span>':''}</div>
        <h2>${esc(item.title)}</h2><p>${esc(item.summary||'')}</p>
        <div class="metrics"><div class="metric"><b>${item.velocity??'—'}</b><span>VELOCITY</span></div><div class="metric"><b>${item.sourceEdge??'—'}</b><span>SOURCE EDGE</span></div><div class="metric"><b>${item.evidenceQuality??'—'}</b><span>EVIDENCE</span></div></div>
        <div class="actions"><button class="ghost preview">PREVIEW</button><button class="ghost save ${saved?'saved':''}">${saved?'♥ SAVED':'♡ MEMORY'}</button><button class="ghost like ${liked?'saved':''}">${liked?'♥ LIKED':'♡ LIKE'}</button>${item.url?`<a class="source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>`:''}</div>
      </div>
    </article>`;
  }).join('')||`<div class="feed-end">NO RELATED FRESH SIGNALS YET</div>`;
  document.querySelectorAll('.timeline-card').forEach(card=>{
    const item=activeItems().find(x=>x.id===card.dataset.id);
    card.querySelector('.preview').onclick=()=>openPreview(item);
    card.querySelector('.save').onclick=()=>toggleSave(item);
    card.querySelector('.like').onclick=()=>toggleLike(item);
  });
}

function openPreview(item){
  if(!item)return;
  state.previewItem=item;
  $('#previewPanel').classList.add('open');
  $('#previewPanel').setAttribute('aria-hidden','false');
  $('#previewScrim').hidden=false;
  $('#previewMedia').innerHTML=`<img src="${esc(cardImage(item))}" alt="${esc(item.title)}">`;
  $('#previewMeta').innerHTML=`<span>${esc(item.primaryCategory||'SIGNAL')}</span><span class="stage">${esc(item.stage||'WHISPER')}</span><span>${item.sources||1} SOURCES</span><span>${Math.round(ageHours(item.publishedAt))}H</span>`;
  $('#previewTitle').textContent=item.title;
  $('#previewSummary').textContent=item.summary||'No summary available.';
  $('#previewMetrics').innerHTML=`<div class="metric"><b>${item.velocity??'—'}</b><span>VELOCITY</span></div><div class="metric"><b>${item.sourceEdge??'—'}</b><span>SOURCE EDGE</span></div><div class="metric"><b>${item.evidenceQuality??'—'}</b><span>EVIDENCE</span></div>`;
  $('#previewSave').textContent=isSaved(item.id)?'♥ SAVED':'♡ MEMORY';
  $('#previewLike').textContent=isLiked(item.id)?'♥ LIKED':'♡ LIKE';
  const source=$('#previewSource');
  if(item.url){source.hidden=false;source.href=item.url}else{source.hidden=true;source.removeAttribute('href')}
}
function closePreview(){
  state.previewItem=null;
  $('#previewPanel').classList.remove('open');
  $('#previewPanel').setAttribute('aria-hidden','true');
  $('#previewScrim').hidden=true;
}
function enterTimeline(item=null){
  state.focusItem=item||state.focusItem;
  state.view='timeline';
  document.body.classList.remove('map-mode');
  document.body.classList.add('timeline-mode');
  $('#mapView').hidden=true;
  $('#timelineView').hidden=false;
  $('#mapBtn').classList.remove('active');$('#mapBtn').setAttribute('aria-pressed','false');
  $('#timelineBtn').classList.add('active');$('#timelineBtn').setAttribute('aria-pressed','true');
  $('#heroTitle').textContent=state.focusItem?'Follow the thread.':'Read the signal.';
  $('#heroCopy').textContent=state.focusItem?'This timeline gets progressively more relevant to the selected card.':'Standard vertical reading mode.';
  closePreview();
  renderTimeline();
  window.scrollTo({top:0,behavior:'smooth'});
}
function enterMap(){
  state.view='map';
  document.body.classList.add('map-mode');
  document.body.classList.remove('timeline-mode');
  $('#mapView').hidden=false;
  $('#timelineView').hidden=true;
  $('#mapBtn').classList.add('active');$('#mapBtn').setAttribute('aria-pressed','true');
  $('#timelineBtn').classList.remove('active');$('#timelineBtn').setAttribute('aria-pressed','false');
  $('#heroTitle').textContent='Move through culture.';
  $('#heroCopy').textContent='Drag, swipe, scroll or use the compass. The farther you move, the more SAPIO leans into that direction.';
  renderMap();
}
function toggleSave(item){
  const i=state.memories.findIndex(m=>m.id===item.id);
  if(i>=0)state.memories.splice(i,1);
  else state.memories.unshift({id:item.id,title:item.title,url:item.url||'',category:item.primaryCategory,source:item.sourceNames?.[0]||item.publisher||'SAPIO cluster',savedAt:new Date().toISOString(),item:retainedSnapshot(item)});
  localStorage.setItem('sapio:memory',JSON.stringify(state.memories));
  renderMemory();renderChannels();buildPositions();renderMap();renderTimeline();
  if(state.previewItem?.id===item.id)openPreview(item);
}
function toggleLike(item){
  const i=state.likes.findIndex(m=>m.id===item.id);
  if(i>=0)state.likes.splice(i,1);
  else state.likes.unshift({id:item.id,category:item.primaryCategory,likedAt:new Date().toISOString(),item:retainedSnapshot(item)});
  localStorage.setItem('sapio:likes',JSON.stringify(state.likes));
  renderChannels();buildPositions();renderMap();renderTimeline();
  if(state.previewItem?.id===item.id)openPreview(item);
}
function renderMemory(){
  $('#memoryCount').textContent=state.memories.length;
  $('#memoryList').innerHTML=state.memories.length
    ?state.memories.map(m=>`<div class="memory-item"><a ${m.url?`href="${esc(m.url)}" target="_blank" rel="noopener noreferrer"`:''}>${esc(m.title)}</a><small>${esc(m.category)} · ${new Date(m.savedAt).toLocaleDateString()}</small></div>`).join('')
    :'<div class="feed-end">NOTHING SAVED YET</div>';
}
function openMemory(open){
  $('#memoryDrawer').classList.toggle('open',open);
  $('#memoryDrawer').setAttribute('aria-hidden',open?'false':'true');
  $('#drawerScrim').hidden=!open;
}
async function loadFeed(){
  if(state.loading)return;
  state.loading=true;
  let data=null;
  try{const r=await fetch('/api/feed',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}
  if(!data){try{const r=await fetch('data/live.json',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}}
  if(!data){try{data=await(await fetch('data/sample.json')).json()}catch{data={demo:true,items:[]}}}
  state.demo=Boolean(data.demo);
  state.items=data.items||[];
  let upgraded=false;
  state.memories.forEach(m=>{if(!m.item){const live=state.items.find(x=>x.id===m.id);if(live){m.item=retainedSnapshot(live);upgraded=true}}});
  if(upgraded)localStorage.setItem('sapio:memory',JSON.stringify(state.memories));
  $('#liveDot').classList.toggle('live',Boolean(data.live));
  const fresh=state.items.filter(x=>state.demo||ageHours(x.publishedAt)<MAX_AGE_HOURS).length;
  const db=data.persistence?.neon?' · NEON':'';
  $('#runText').textContent=data.live?`LIVE · ${fresh} FRESH${db}`:`DEMO FEED · ${state.items.length} CARDS`;
  state.loading=false;
  buildPositions();renderChannels();renderMap();renderTimeline();
}

function setupSpatialControls(){
  const vp=$('#spatialViewport');
  vp.addEventListener('wheel',e=>{
    if(state.view!=='map')return;
    e.preventDefault();
    moveCamera(e.deltaX*1.25,e.deltaY*1.25);
  },{passive:false});
  vp.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    state.drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,startX:state.nav.x,startY:state.nav.y,moved:false};
    vp.setPointerCapture?.(e.pointerId);
    vp.classList.add('dragging');
  });
  vp.addEventListener('pointermove',e=>{
    if(!state.drag||state.drag.pointerId!==e.pointerId)return;
    const dx=e.clientX-state.drag.x,dy=e.clientY-state.drag.y;
    if(Math.hypot(dx,dy)>6)state.drag.moved=true;
    state.nav.x=clamp(state.drag.startX-dx,-MAX_TRAVEL,MAX_TRAVEL);
    state.nav.y=clamp(state.drag.startY-dy,-MAX_TRAVEL,MAX_TRAVEL);
    updateCamera();
  });
  const finishDrag=e=>{
    if(!state.drag)return;
    if(state.drag.moved)state.dragMovedUntil=Date.now()+180;
    state.drag=null;vp.classList.remove('dragging');
    try{vp.releasePointerCapture?.(e.pointerId)}catch{}
  };
  vp.addEventListener('pointerup',finishDrag);
  vp.addEventListener('pointercancel',finishDrag);
  vp.addEventListener('keydown',e=>{
    if(e.target.closest('button,a,input,textarea,select'))return;
    const keyMap={ArrowUp:'N',ArrowDown:'S',ArrowLeft:'W',ArrowRight:'E',q:'NW',e:'NE',z:'SW',c:'SE',Q:'NW',E:'NE',Z:'SW',C:'SE'};
    if(keyMap[e.key]){e.preventDefault();moveDirection(keyMap[e.key],.55)}
    if(e.key==='0'){e.preventDefault();recenter()}
  });
  document.querySelectorAll('.compass-btn').forEach(b=>b.onclick=()=>moveDirection(b.dataset.dir));
  $('#compassCenter').onclick=recenter;
  $('#recenterBtn').onclick=recenter;
}

function setup(){
  const ageOk=localStorage.getItem('sapio:21plus')==='yes';
  $('#ageGate').hidden=ageOk;
  $('#enterBtn').onclick=()=>{localStorage.setItem('sapio:21plus','yes');$('#ageGate').hidden=true};
  $('#erosToggle').onclick=()=>{
    state.eros=!state.eros;
    if(!erosVisible()&&state.active==='EROS INDEX')state.active='ALL';
    applyMode();buildPositions();renderChannels();renderMap();renderTimeline();
  };
  $('#modeToggle').onclick=()=>{
    const current=isNocturne();
    state.modeOverride=state.modeOverride===null?!current:state.modeOverride?false:null;
    applyMode();buildPositions();renderChannels();renderMap();renderTimeline();
  };
  $('#memoryBtn').onclick=()=>openMemory(true);
  $('#closeMemory').onclick=()=>openMemory(false);
  $('#drawerScrim').onclick=()=>openMemory(false);
  $('#mapBtn').onclick=enterMap;
  $('#timelineBtn').onclick=()=>enterTimeline(null);
  $('#backToMap').onclick=enterMap;
  $('#closePreview').onclick=closePreview;
  $('#previewScrim').onclick=closePreview;
  $('#previewTimeline').onclick=()=>enterTimeline(state.previewItem);
  $('#previewSave').onclick=()=>state.previewItem&&toggleSave(state.previewItem);
  $('#previewLike').onclick=()=>state.previewItem&&toggleLike(state.previewItem);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePreview();openMemory(false)}});
  renderLaneLabels();setupSpatialControls();applyMode();renderChannels();renderMemory();loadFeed();
  setInterval(()=>{if(state.modeOverride===null)applyMode()},60000);
  setInterval(loadFeed,REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadFeed()});
}
setup();
