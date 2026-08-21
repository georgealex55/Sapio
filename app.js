const CHANNELS=['ALL','SOMA','ARCANA','APPETITE','SIGNAL LAB','VISUAL CORTEX','THE PULSE','TERRA','VERDANT','IGNITION','OBJECTS OF DESIRE','EROS INDEX'];
const state={items:[],active:'ALL',eros:false,modeOverride:null,memories:JSON.parse(localStorage.getItem('sapio:memory')||'[]'),hidden:new Set(JSON.parse(localStorage.getItem('sapio:hidden')||'[]'))};
const $=s=>document.querySelector(s);

function chicagoHour(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',hour12:false}).formatToParts(new Date());
  return Number(parts.find(x=>x.type==='hour')?.value||0);
}
function autoNocturne(){ return chicagoHour()>=19 || chicagoHour()<5; }
function isNocturne(){ return state.modeOverride===null ? autoNocturne() : state.modeOverride; }
function applyMode(){
  const n=isNocturne(); document.documentElement.classList.toggle('nocturne',n);
  $('#modeToggle').setAttribute('aria-pressed',n?'true':'false');
  $('#modeToggle').textContent=state.modeOverride===null?`NOCTURNE ${n?'ON':'AUTO'}`:`NOCTURNE ${n?'ON':'OFF'}`;
  $('#modeLabel').textContent=n?'SAPIO // NOCTURNE':'DAY / CULTURAL INTELLIGENCE';
  $('#heroTitle').textContent=n?'Curiosity changes after dark.':'Your signal, before consensus.';
}
function ageHours(date){return Math.max(0,(Date.now()-new Date(date).getTime())/36e5)}
function density(item){const h=ageHours(item.publishedAt); if(h<=6)return'full';if(h<=24)return'medium';if(h<=72)return'compact';return'minimal'}
function affinity(cat){
  const count=state.memories.filter(m=>m.category===cat).length;
  return Math.min(100,50+count*10);
}
function rank(item){return (item.score||50)*.75+affinity(item.primaryCategory)*.25}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function channelVisible(item){if(!state.eros&&(item.eros||item.primaryCategory==='EROS INDEX'||item.categories?.includes('EROS INDEX')))return false;return state.active==='ALL'||item.categories?.includes(state.active)||item.primaryCategory===state.active}
function isSaved(id){return state.memories.some(m=>m.id===id)}

function renderChannels(){
  $('#categoryRail').innerHTML=CHANNELS.filter(c=>state.eros||c!=='EROS INDEX').map(c=>`<button class="chip ${state.active===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{state.active=b.dataset.cat;renderChannels();renderFeed()});
}
function renderFeed(){
  const items=state.items.filter(x=>!state.hidden.has(x.id)&&channelVisible(x)).sort((a,b)=>rank(b)-rank(a));
  $('#feed').innerHTML=items.map(item=>{
    const d=density(item), saved=isSaved(item.id), img=item.image||`assets/${(item.primaryCategory||'IGNITION').toLowerCase().replace(/\s+/g,'-')}.svg`;
    return `<article class="card ${d}" data-id="${esc(item.id)}">
      <div class="media"><img loading="lazy" decoding="async" src="${esc(img)}" alt=""/><div class="score-badge">SAPIO ${Math.round(item.score||0)}</div></div>
      <div class="body">
        <div class="meta"><span>${esc(item.primaryCategory||'SIGNAL')}</span><span class="stage">${esc(item.stage||'WHISPER')} ↑</span><span>${item.sources||1} SOURCES</span><span>${Math.round(ageHours(item.publishedAt))}H</span></div>
        <h2>${esc(item.title)}</h2>
        <p class="summary">${esc(item.summary||'')}</p>
        <div class="metrics"><div class="metric"><b>${item.velocity??'—'}</b><span>VELOCITY</span></div><div class="metric"><b>${item.sourceEdge??'—'}</b><span>SOURCE EDGE</span></div><div class="metric"><b>${item.evidenceQuality??'—'}</b><span>EVIDENCE</span></div></div>
        <div class="actions"><div class="action-left"><button class="ghost save ${saved?'saved':''}">${saved?'♥ SAVED':'♡ MEMORY'}</button><button class="ghost hide">HIDE</button></div>${item.url?`<a class="source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>`:''}</div>
      </div></article>`
  }).join('') || `<div class="feed-end">NO CURRENT ITEMS IN THIS VIEW</div>`;
  document.querySelectorAll('.card').forEach(card=>{
    const id=card.dataset.id,item=state.items.find(x=>x.id===id);
    card.querySelector('.save').onclick=()=>toggleSave(item);
    card.querySelector('.hide').onclick=()=>hideItem(id);
  });
}
function toggleSave(item){
  const i=state.memories.findIndex(m=>m.id===item.id);
  if(i>=0)state.memories.splice(i,1); else state.memories.unshift({id:item.id,title:item.title,url:item.url||'',category:item.primaryCategory,source:item.sourceNames?.[0]||'SAPIO cluster',savedAt:new Date().toISOString()});
  localStorage.setItem('sapio:memory',JSON.stringify(state.memories));renderMemory();renderFeed();
}
function hideItem(id){state.hidden.add(id);localStorage.setItem('sapio:hidden',JSON.stringify([...state.hidden]));renderFeed()}
function renderMemory(){
  $('#memoryCount').textContent=state.memories.length;
  $('#memoryList').innerHTML=state.memories.length?state.memories.map(m=>`<div class="memory-item"><a ${m.url?`href="${esc(m.url)}" target="_blank" rel="noopener noreferrer"`:''}>${esc(m.title)}</a><small>${esc(m.category)} · ${new Date(m.savedAt).toLocaleDateString()}</small></div>`).join(''):'<div class="feed-end">NOTHING SAVED YET</div>';
}
function openMemory(open){$('#memoryDrawer').classList.toggle('open',open);$('#memoryDrawer').setAttribute('aria-hidden',open?'false':'true');$('#drawerScrim').hidden=!open}
async function loadFeed(){
  let data=null;
  try{const r=await fetch('/api/feed',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}
  if(!data){try{data=await (await fetch('data/sample.json')).json()}catch{data={demo:true,items:[]}}}
  state.items=data.items||[];
  $('#liveDot').classList.toggle('live',Boolean(data.live));
  $('#runText').textContent=data.live?`LIVE · ${state.items.length} CLUSTERS`:`DEMO FEED · ${state.items.length} CARDS`;
  renderFeed();
}
function setup(){
  const ageOk=localStorage.getItem('sapio:21plus')==='yes';$('#ageGate').hidden=ageOk;
  $('#enterBtn').onclick=()=>{localStorage.setItem('sapio:21plus','yes');$('#ageGate').hidden=true};
  $('#erosToggle').onclick=()=>{state.eros=!state.eros;$('#erosToggle').setAttribute('aria-pressed',state.eros?'true':'false');$('#erosToggle').textContent=state.eros?'EROS ON':'EROS OFF';if(!state.eros&&state.active==='EROS INDEX')state.active='ALL';renderChannels();renderFeed()};
  $('#modeToggle').onclick=()=>{const current=isNocturne();state.modeOverride=state.modeOverride===null?!current:state.modeOverride?false:null;applyMode()};
  $('#memoryBtn').onclick=()=>openMemory(true);$('#closeMemory').onclick=()=>openMemory(false);$('#drawerScrim').onclick=()=>openMemory(false);
  applyMode();renderChannels();renderMemory();loadFeed();setInterval(()=>{if(state.modeOverride===null)applyMode()},60000);
}
setup();
