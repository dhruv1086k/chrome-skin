/* Tab groups card.
   Chrome only lets extensions see OPEN groups, so NEXUS remembers every group it sees
   (name, colour, tab URLs) in chrome.storage.local and shows closed ones as "saved".
   Click an open group -> jump to it. Click a saved group -> reopen all its tabs as a group. */
let settings,page=0,timer,token=0,pages=1,snaps={},loaded=false,busy=false;
const shrinkSeen={};
const SNAP='groupSnapshots',PER=15;
const $=s=>document.querySelector(s);
const COLORS={grey:'#9aa0a6',blue:'#5b9cff',red:'#ff6b6b',yellow:'#fdd663',green:'#5bd68a',pink:'#ff7eb6',purple:'#b57bff',cyan:'#4dd0e1',orange:'#ffa24d'};
const keyOf=g=>`${g.color}|${(g.title||'').trim()}`;
const urlOf=t=>t.url||t.pendingUrl||'';
const keepUrl=u=>u&&!/^(chrome:\/\/newtab|chrome-search:|about:blank|edge:\/\/newtab)/i.test(u);

export function initGroups(s){
  settings=s;
  $('#gp-next').onclick=()=>{if(pages>1){page=(page+1)%pages;render({keepPage:true})}};
  const later=snapshot=>()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!document.hidden)render({keepPage:true,snapshot})},300)};
  try{
    for(const ev of ['onCreated','onUpdated','onMoved'])chrome.tabGroups?.[ev]?.addListener(later(true));
    chrome.tabGroups?.onRemoved?.addListener(later(false));
    for(const ev of ['onCreated','onUpdated','onMoved','onAttached'])chrome.tabs[ev]?.addListener(later(true));
    for(const ev of ['onRemoved','onDetached'])chrome.tabs[ev]?.addListener(later(false));
  }catch{}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGroups()});
  refreshGroups();setTimeout(()=>{if(!document.hidden)render({keepPage:true,snapshot:true})},4000);
}
export function refreshGroups(){if(settings.showGroups!==false)render({keepPage:true,snapshot:true})}

async function loadSnaps(){if(loaded)return;try{snaps=(await chrome.storage.local.get(SNAP))[SNAP]||{}}catch{snaps={}}loaded=true}
async function saveSnaps(){try{await chrome.storage.local.set({[SNAP]:snaps})}catch{}}

function record(live,byGroup){
  let changed=false;
  for(const g of live){
    const tabs=(byGroup.get(g.id)||[]).sort((a,b)=>a.index-b.index).filter(t=>keepUrl(urlOf(t))).map(t=>({url:urlOf(t),title:t.title||''}));
    if(!tabs.length)continue;
    const key=keyOf(g),old=snaps[key];
    // Don't let a half-restored browser shrink a saved group: accept a smaller tab list only once it is seen twice.
    if(old&&tabs.length<old.tabs.length){if(shrinkSeen[key]!==tabs.length){shrinkSeen[key]=tabs.length;continue}}
    delete shrinkSeen[key];
    const next={key,title:(g.title||'').trim(),color:g.color,tabs,seen:Date.now()};
    if(!old||JSON.stringify(old.tabs)!==JSON.stringify(tabs)){snaps[key]=next;changed=true}
    else if(Date.now()-old.seen>60000){snaps[key]={...old,seen:Date.now()};changed=true}
  }
  return changed;
}

async function render({keepPage=true,snapshot=false}={}){
  const my=++token,grid=$('#gp-grid');
  let groups,tabs,win;
  try{
    [groups,tabs,win]=await Promise.all([chrome.tabGroups.query({}),chrome.tabs.query({}),chrome.windows.getCurrent().catch(()=>null),loadSnaps()]);
  }catch{
    if(my===token){grid.innerHTML='<div class="gp-empty">Tab groups are unavailable. Check the tabGroups permission.</div>';setPaging(1)}
    return;
  }
  if(my!==token)return;
  const byGroup=new Map();
  for(const t of tabs)if(t.groupId>=0){if(!byGroup.has(t.groupId))byGroup.set(t.groupId,[]);byGroup.get(t.groupId).push(t)}
  const first=g=>Math.min(...(byGroup.get(g.id)||[{index:0}]).map(t=>t.index));
  groups.sort((a,b)=>(b.windowId===win?.id)-(a.windowId===win?.id)||a.windowId-b.windowId||first(a)-first(b));
  if(snapshot&&record(groups,byGroup))await saveSnaps();
  const liveKeys=new Set(groups.map(keyOf));
  const list=[
    ...groups.map(g=>({kind:'live',g,key:keyOf(g),tabs:(byGroup.get(g.id)||[]).sort((a,b)=>a.index-b.index)})),
    ...Object.values(snaps).filter(s=>!liveKeys.has(s.key)).sort((a,b)=>b.seen-a.seen).map(s=>({kind:'saved',s,key:s.key}))
  ];
  pages=Math.max(1,Math.ceil(list.length/PER));
  if(!keepPage||page>=pages)page=Math.min(page,pages-1);
  grid.replaceChildren();
  if(!list.length){
    grid.innerHTML='<div class="gp-empty">No tab groups yet. Open a group from Chrome’s Tab groups menu once and NEXUS will remember it here.</div>';setPaging(1);return;
  }
  for(const it of list.slice(page*PER,page*PER+PER)){
    const live=it.kind==='live',src=live?it.g:it.s;
    const label=(src.title||'').trim()||'Unnamed group',n=live?it.tabs.length:it.s.tabs.length;
    const cell=document.createElement('div');cell.className='gp-cell';
    const chip=document.createElement('button');chip.className='gp-chip'+(live?'':' saved')+(live&&it.g.collapsed?' collapsed':'');
    chip.style.setProperty('--c',COLORS[src.color]||COLORS.grey);
    const dot=document.createElement('i');dot.className='gp-dot';dot.textContent=n;
    const span=document.createElement('span');span.textContent=label;if(label.length>11)span.className='l2';else if(label.length>7)span.className='l1';
    chip.append(dot,span);
    const names=(live?it.tabs.map(t=>t.title||urlOf(t)):it.s.tabs.map(t=>t.title||t.url)).slice(0,8);
    chip.title=`${label} · ${n} tab${n===1?'':'s'} · ${live?'open':'saved — click to reopen'}\n${names.join('\n')}${n>8?`\n+${n-8} more`:''}`;
    chip.onclick=()=>openGroup(it,chip);
    cell.append(chip);
    if(!live){
      const x=document.createElement('button');x.className='gp-x';x.textContent='×';x.title='Forget this saved group';x.setAttribute('aria-label','Forget this saved group');
      x.onclick=async e=>{e.stopPropagation();if(confirm(`Forget saved group “${label}”?`)){delete snaps[it.key];await saveSnaps();render({keepPage:true})}};
      cell.append(x);
    }
    grid.append(cell);
  }
  setPaging(pages);
}

async function openGroup(it,chip){
  if(busy)return;busy=true;chip.classList.add('loading');
  try{
    if(it.kind==='live'){
      if(it.g.collapsed)await chrome.tabGroups.update(it.g.id,{collapsed:false});
      const t=it.tabs[0];if(t){await chrome.tabs.update(t.id,{active:true});await chrome.windows.update(t.windowId,{focused:true})}
    }else{
      const win=await chrome.windows.getCurrent(),ids=[];
      for(const t of it.s.tabs){const nt=await chrome.tabs.create({url:t.url,active:false,windowId:win.id});ids.push(nt.id)}
      if(ids.length){
        const gid=await chrome.tabs.group({tabIds:ids,createProperties:{windowId:win.id}});
        await chrome.tabGroups.update(gid,{title:it.s.title,color:it.s.color});
        await chrome.tabs.update(ids[0],{active:true});
      }
    }
  }catch{}
  busy=false;chip.classList.remove('loading');
}
function setPaging(n){const b=$('#gp-next');b.disabled=n<=1;b.title=n>1?`Next page (${page+1}/${n})`:'All groups shown'}
