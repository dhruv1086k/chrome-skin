const N=26,HOST='com.nexus.stats',$=s=>document.querySelector(s);
const hist={cpu:[],gpu:[],ram:[],net:[]};
let settings,timer,started=false,prevCpu=null,cpuName='',ramTotal=0;
let port=null,helperOn=false,helperName='',lastErr='',bound=false;

export function helperInfo(){return{id:chrome.runtime.id,connected:helperOn,error:lastErr}}
export function initStats(s){settings=s;refreshStats();document.addEventListener('visibilitychange',()=>{if(!started)return;if(document.hidden)disconnect();else{connect();tick()}})}
export function refreshStats(){
  clearInterval(timer);
  if(settings.showStats===false){started=false;disconnect();return}
  started=true;setGpuLabel();connect();tick();
  timer=setInterval(()=>{if(!document.hidden)tick()},2000);
  if(navigator.connection&&!bound){bound=true;navigator.connection.addEventListener('change',()=>tick())}
}

/* ---------- optional native helper (real GPU load + upload/download) ---------- */
function connect(){
  if(port||document.hidden)return;
  try{port=chrome.runtime.connectNative(HOST)}catch(e){port=null;lastErr=String(e);return}
  const mine=port;
  mine.onMessage.addListener(m=>{if(m?.type==='stats'){helperOn=true;applyHelper(m)}});
  mine.onDisconnect.addListener(()=>{
    lastErr=chrome.runtime.lastError?.message||'';
    if(port===mine){port=null;helperOn=false;helperName='';setGpuLabel();tick()}
  });
}
function disconnect(){if(port){const p=port;port=null;try{p.disconnect()}catch{}}helperOn=false}

function applyHelper(m){
  const g=m.gpu;
  if(g&&g.util!=null){
    helperName=cleanGpu(g.name);setGpuLabel();
    const sub=$('#stat-gpu .stat-sub');sub.title=`${g.name}${g.memTotal?` · ${Math.round(g.memUsed)}/${Math.round(g.memTotal)} MB VRAM`:''}${g.temp!=null?` · ${g.temp}°C`:''}`;
    const v=Math.max(0,Math.min(100,Math.round(g.util)));push('gpu',v);paint('gpu',v+'%');
  }else gpuFallback();
  if(m.net){
    netMode(true);$('#net-down').textContent=fmt(m.net.down)+' Mbps';$('#net-up').textContent=fmt(m.net.up)+' Mbps';
    push('net',m.net.down);draw('net');
  }else netFallback();
}

/* ---------- CPU: chrome.system.cpu (needs "system.cpu") ---------- */
async function cpu(){
  const el=$('#stat-cpu');
  try{
    const i=await chrome.system.cpu.getInfo();
    if(!cpuName){cpuName=cleanCpu(i.modelName);el.querySelector('.stat-sub').textContent=cpuName;el.querySelector('.stat-sub').title=i.modelName}
    const t=i.processors.reduce((a,p)=>({idle:a.idle+p.usage.idle,total:a.total+p.usage.total}),{idle:0,total:0});
    if(prevCpu&&t.total>prevCpu.total){
      const v=Math.max(0,Math.min(100,Math.round((1-(t.idle-prevCpu.idle)/(t.total-prevCpu.total))*100)));
      push('cpu',v);paint('cpu',v+'%')
    }
    prevCpu=t;
  }catch{el.querySelector('.stat-sub').textContent='Unavailable';paint('cpu','—')}
}
function cleanCpu(n=''){
  return n.replace(/\((R|TM)\)/gi,'').replace(/\d+(st|nd|rd|th) Gen /i,'').replace(/\s*@.*$/,'').replace(/\s+CPU\b/i,'').replace(/\s+\d+-Core Processor/i,'').replace(/\s+/g,' ').trim()||'Processor';
}

/* ---------- RAM: chrome.system.memory (needs "system.memory") ---------- */
async function ram(){
  const el=$('#stat-ram');
  try{
    const m=await chrome.system.memory.getInfo();
    if(m.capacity!==ramTotal){ramTotal=m.capacity;el.querySelector('.stat-sub').textContent=Math.round(m.capacity/1024**3)+' GB'}
    const v=Math.max(0,Math.min(100,Math.round((1-m.availableCapacity/m.capacity)*100)));
    push('ram',v);paint('ram',v+'%');
  }catch{el.querySelector('.stat-sub').textContent='Unavailable';paint('ram','—')}
}

/* ---------- GPU: name from WebGL unless the helper provides load ---------- */
function setGpuLabel(){
  const sub=$('#stat-gpu .stat-sub');
  sub.textContent=settings.gpuName?.trim()||helperName||webglGpu();
  if(!helperOn)sub.title='GPU load needs the optional NEXUS helper (see helper/README)';
}
function cleanGpu(r=''){return r.replace(/^ANGLE \(/,'').replace(/GeForce\s+/i,'').replace(/\s+(Laptop|Max-Q|Mobile)?\s*GPU$/i,'').replace(/\(R\)|\(TM\)/g,'').trim()}
function webglGpu(){
  try{
    const g=document.createElement('canvas').getContext('webgl');
    const e=g.getExtension('WEBGL_debug_renderer_info');
    let r=String(g.getParameter(e?e.UNMASKED_RENDERER_WEBGL:g.RENDERER)).replace(/^ANGLE \(/,'');
    const parts=r.split(', ');
    r=(parts.length>1?parts[1]:parts[0]).replace(/\s*\(0x[0-9a-f]+\).*$/i,'').replace(/\s*Direct3D.*$/i,'').replace(/\)$/,'');
    r=cleanGpu(r);
    if(/^(NVIDIA|AMD|Intel)\b/i.test(r))return r;
    const vendor=(parts[0]||'').trim();return /nvidia|amd|intel/i.test(vendor)&&!r.toLowerCase().includes(vendor.toLowerCase())?`${vendor} ${r}`:r;
  }catch{return 'Graphics'}
}
function gpuFallback(){const p=$('#stat-gpu .spark path');p.setAttribute('d','M0 15H100');p.classList.add('flat');paint('gpu','—',true)}

/* ---------- Network: Network Information API unless the helper provides speeds ---------- */
function netMode(helper){$('.net-u').hidden=!helper;$('.net-p').hidden=helper}
function netFallback(){
  netMode(false);
  const c=navigator.connection,d=$('#net-down'),r=$('#net-rtt');
  if(!navigator.onLine){d.textContent='Offline';r.textContent='—';return}
  if(!c||c.downlink==null){d.textContent='Online';r.textContent='—';return}
  d.textContent=fmt(c.downlink)+' Mbps';r.textContent=c.rtt?c.rtt+' ms':'—';
  push('net',c.downlink);draw('net');
}
const fmt=n=>n>=100?Math.round(n):n>=10?Number(n.toFixed(1)):Number(n.toFixed(2));

async function tick(){
  await Promise.allSettled([cpu(),ram()]);
  if(!helperOn&&!port){gpuFallback();netFallback()}
}

/* ---------- drawing ---------- */
function push(k,v){const a=hist[k];if(!a.length)while(a.length<N-1)a.push(v);a.push(v);if(a.length>N)a.shift()}
function paint(k,text,quiet){const v=$(`#stat-${k} .stat-val`);if(v)v.textContent=text;if(!quiet)draw(k)}
function draw(k){
  const a=hist[k],p=$(`#stat-${k} .spark path`);if(!a.length||!p)return;
  p.classList.remove('flat');
  let lo=Math.min(...a),hi=Math.max(...a);const minRange=k==='net'?2:12;
  if(hi-lo<minRange){const m=(hi+lo)/2;lo=m-minRange/2;hi=m+minRange/2}
  const pts=a.map((v,i)=>[i*100/(a.length-1),27-(v-lo)/(hi-lo)*24]);
  let d=`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for(let i=1;i<pts.length;i++){const[x0,y0]=pts[i-1],[x1,y1]=pts[i],mx=(x0+x1)/2;d+=` C${mx.toFixed(2)} ${y0.toFixed(2)} ${mx.toFixed(2)} ${y1.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`}
  p.setAttribute('d',d);
}
