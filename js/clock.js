let format='12';
export function setClockFormat(value){format=value;tick()}
function tick(){const d=new Date(),h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0'),t=document.querySelector('#clock'),amp=document.querySelector('#meridiem');if(format==='24'){t.textContent=`${String(h).padStart(2,'0')}:${m}`;amp.hidden=true}else{t.textContent=`${h%12||12}:${m}`;amp.hidden=false;amp.textContent=h>=12?'PM':'AM'}document.querySelector('#date').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(d)}
export function startClock(value='12'){format=value;tick();setInterval(tick,1000)}
