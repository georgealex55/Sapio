const CHANNELS=['ALL','SOMA','ARCANA','APPETITE','SIGNAL LAB','VISUAL CORTEX','THE PULSE','TERRA','VERDANT','IGNITION','OBJECTS OF DESIRE','EROS INDEX'];
const ASSET_MAP={
  'SOMA':'assets/soma.svg',
  'ARCANA':'assets/arcana.svg',
  'APPETITE':'assets/appetite.svg',
  'SIGNAL LAB':'assets/signal-lab.svg',
  'VISUAL CORTEX':'assets/visual-cortex.svg',
  'THE PULSE':'assets/the-pulse.svg',
  'TERRA':'assets/terra.svg',
  'VERDANT':'assets/verdant.svg',
  'IGNITION':'assets/ignition.svg',
  'OBJECTS OF DESIRE':'assets/objects.svg',
  'EROS INDEX':'assets/eros.svg'
};
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
function assetForCategory(category='IGNITION'){return ASSET_MAP[category]||'assets/ignition.svg'}
function hashString(value=''){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h)+value.charCodeAt(i),h|=0;return Math.abs(h)}
function hueFrom(value,offset=0){return (hashString(value)+offset)%360}
function xmlEsc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function uniqueImage(item){
  const key=`${item.id||''}|${item.title||''}|${item.primaryCategory||''}`;
  const hueA=hueFrom(key,0), hueB=hueFrom(key,75), hueC=hueFrom(key,145);
  const title=xmlEsc((item.title||'SAPIO SIGNAL').slice(0,68));
  const category=xmlEsc((item.primaryCategory||'SIGNAL').slice(0,28));
  const source=xmlEsc((item.sourceNames?.[0]||'SAPIO').slice(0,28));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA} 72% 56%)"/>
      <stop offset="55%" stop-color="hsl(${hueB} 76% 42%)"/>
      <stop offset="100%" stop-color="hsl(${hueC} 82% 28%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="25%" cy="20%" r="80%">
      <stop offset="0%" stop-color="rgba(255,255,255,.88)"/>
      <stop offset="30%" stop-color="rgba(255,255,255,.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="750" fill="url(#g)"/>
  <circle cx="920" cy="168" r="220" fill="url(#glow)" opacity=".65"/>
  <circle cx="188" cy="612" r="300" fill="rgba(255,255,255,.10)"/>
  <path d="M0 610 C205 460 390 700 590 600 C775 510 910 305 1200 362 L1200 750 L0 750 Z" fill="rgba(7,7,12,.18)"/>
  <path d="M0 518 C188 442 320 542 475 490 C655 430 804 292 1200 276 L1200 0 L0 0 Z" fill="rgba(255,255,255,.08)"/>
  <g transform="translate(72 84)">
    <rect x="0" y="0" rx="999" ry="999" width="238" height="46" fill="rgba(12,12,16,.28)" stroke="rgba(255,255,255,.25)"/>
    <text x="24" y="30" fill="white" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="800" letter-spacing="2">${category}</text>
    <text x="0" y="188" fill="white" font-family="Georgia,serif" font-size="56" font-weight="700">${title}</text>
    <text x="0" y="238" fill="rgba(255,255,255,.84)" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="600" letter-spacing="1.2">${source}  •  ORIGINAL SAPIO VISUAL</text>
  </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function cardImage(item){
  const externalImage=item.sourceImage || (item.image && !String(item.image).startsWith('assets/') ? item.image : null);
  return externalImage || uniqueImage(item);
}
function openSource(url){ if(url) window.open(url,'_blank','noopener,noreferrer'); }

function renderChannels(){
  $('#categoryRail').innerHTML=CHANNELS.filter(c=>state.eros||c!=='EROS INDEX').map(c=>`<button class="chip ${state.active===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{state.active=b.dataset.cat;renderChannels();renderFeed()});
}
function renderFeed(){
  const items=state.items.filter(x=>!state.hidden.has(x.id)&&channelVisible(x)).sort((a,b)=>rank(b)-rank(a));
  $('#feed').innerHTML=items.map(item=>{
    const d=density(item), saved=isSaved(item.id), img=cardImage(item), hasLink=Boolean(item.url);
    return `<article class="card ${d} ${hasLink?'clickable':''}" data-id="${esc(item.id)}" ${hasLink?`data-url="${esc(item.url)}" tabindex="0" role="link" aria-label="Open source for ${esc(item.title)}"`:''}>
      <div class="media"><img loading="lazy" decoding="async" src="${esc(img)}" alt="${esc(item.title)}"/><div class="score-badge">SAPIO ${Math.round(item.score||0)}</div></div>
      <div class="body">
        <div class="meta"><span>${esc(item.primaryCategory||'SIGNAL')}</span><span class="stage">${esc(item.stage||'WHISPER')} ↑</span><span>${item.sources||1} SOURCES</span><span>${Math.round(ageHours(item.publishedAt))}H</span></div>
        <h2>${esc(item.title)}</h2>
        <p class="summary">${esc(item.summary||'')}</p>
        <div class="metrics"><div class="metric"><b>${item.velocity??'—'}</b><span>VELOCITY</span></div><div class="metric"><b>${item.sourceEdge??'—'}</b><span>SOURCE EDGE</span></div><div class="metric"><b>${item.evidenceQuality??'—'}</b><span>EVIDENCE</span></div></div>
        <div class="actions"><div class="action-left"><button class="ghost save ${saved?'saved':''}" type="button">${saved?'♥ SAVED':'♡ MEMORY'}</button><button class="ghost hide" type="button">HIDE</button></div>${item.url?`<a class="source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>`:'<span class="source-link muted">NO SOURCE LINK</span>'}</div>
      </div></article>`
  }).join('') || `<div class="feed-end">NO CURRENT ITEMS IN THIS VIEW</div>`;
  document.querySelectorAll('.card').forEach(card=>{
    const id=card.dataset.id,item=state.items.find(x=>x.id===id);
    const saveBtn=card.querySelector('.save');
    const hideBtn=card.querySelector('.hide');
    if(item?.url){
      card.addEventListener('click',e=>{ if(e.target.closest('button,a')) return; openSource(item.url); });
      card.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ') && !e.target.closest('button,a')){ e.preventDefault(); openSource(item.url); } });
    }
    saveBtn.onclick=e=>{ e.stopPropagation(); toggleSave(item); };
    hideBtn.onclick=e=>{ e.stopPropagation(); hideItem(id); };
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
