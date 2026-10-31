const $=id=>document.getElementById(id);
const tg=window.Telegram?.WebApp;
try{tg?.ready();tg?.expand();tg?.setHeaderColor?.('#21141a');tg?.setBackgroundColor?.('#160f17');}catch{}
let token='',me=null,scene3d=null,streamController=null,lastActivity=[],cooldownEnd={},toastTimer=null;
let music=null,soundOn=false;
const ICON={lotus:'🪷',incense:'🕯️',breathe:'🧘'};
const DESCR={lotus:'dâng một đóa sen',incense:'thắp một nén hương',breathe:'thiền an nhiên'};
const timezone='Asia/Ho_Chi_Minh';
function safeName(n){return String(n||'Bạn an lành').slice(0,42);}
function fmt(n){return Number(n||0).toLocaleString('vi-VN');}
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2700);}
async function request(endpoint,body=null){
 const options={headers:{'Accept':'application/json'}};
 if(token)options.headers.Authorization=`Bearer ${token}`;
 if(body!==null){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
 const res=await fetch(endpoint,options);let data;try{data=await res.json();}catch{throw Error('Không nhận được phản hồi từ máy chủ');}
 if(!res.ok) {const e=Error(data.error||'Không thể kết nối');e.retryMs=data.retryMs;throw e;}
 return data;
}
function setOverlay(title,description,demo=false,retry=false){$('loginOverlay').hidden=false;$('loginTitle').textContent=title;$('loginDescription').textContent=description;$('demoForm').hidden=!demo;$('loginRetry').hidden=!retry;}
function hideOverlay(){$('loginOverlay').hidden=true;}
async function login(nameOverride=null){
 setOverlay('Đang mở cánh cửa chánh điện','Đang kiểm tra thông tin đăng nhập…');
 const info=await request('/api/health');
 const initData=tg?.initData||'';
 if(!initData&&!info.mode.includes('demo')){setOverlay('Mở bằng Telegram','Ứng dụng đã bảo vệ tài khoản. Hãy vào bot Telegram và nhấn nút “Vườn Sen” để đăng nhập. Không thể chơi bằng trình duyệt thông thường.',false,true);return;}
 const body=initData?{initData}:(()=>{let demoId=localStorage.getItem('sen-demo-id');if(!demoId){demoId=crypto.randomUUID();localStorage.setItem('sen-demo-id',demoId);}return {demoId,name:nameOverride||$('demoName').value||'Khách an lành'};})();
 if(!initData&&nameOverride===null&&new URLSearchParams(location.search).has('demo'))return login('Khách thử chùa');
 if(!initData&&nameOverride===null){setOverlay('Bản thử trên trình duyệt','Bạn đang chạy ở chế độ demo nội bộ. Mở trong Telegram để dùng tài khoản thật.',true,false);return;}
 const response=await request('/api/login',body);
 token=response.token;me=response.user;hideOverlay();
 $('greeting').textContent=`Chào ${safeName(me.name)}, một ngày an yên nhé ✨`;
 const data=await request('/api/state');renderState(data);startRealtime();
 loadTemple();
 if(response.demo) toast('Bạn đang dùng chế độ thử nghiệm trên máy tính');
}
async function loadTemple(){
 try{const module=await import('./temple.js');scene3d=module.createTemple($('temple3d'));$('sceneFallback').style.display='none';
  if(window.currentOnline)scene3d.setPlayers(window.currentOnline);
 }catch(err){console.error('Không tải được 3D:',err);$('sceneFallback').querySelector('p').textContent='Chế độ 3D cần Internet để tải thư viện đồ họa. Bạn vẫn có thể chơi và tích điểm.';toast('Không tải được đồ họa 3D; phần trò chơi vẫn hoạt động');}
}
function renderMe(user){if(!user)return;const p=user;$('points').textContent=fmt(p.points);$('dailyLabel').textContent=`${Math.min(10,p.lotuses)}/10`;$('dailyProgress').style.width=`${Math.min(100,p.lotuses*10)}%`;}
function renderLeaders(leaders){
 const box=$('leaderboard');box.replaceChildren();
 if(!leaders?.length){const li=document.createElement('li');li.textContent='Chưa có người tham gia';li.className='empty';box.append(li);return;}
 for(const [index,p] of leaders.slice(0,8).entries()){
  const li=document.createElement('li');if(p.id===me?.id)li.classList.add('self');
  const rank=document.createElement('span');rank.className='position';rank.textContent=['🥇','🥈','🥉'][index]||String(index+1);
  const name=document.createElement('span');name.className='name';name.textContent=safeName(p.name)+(p.id===me?.id?' (bạn)':'');
  const score=document.createElement('span');score.className='score';score.textContent=`${fmt(p.points)} ✨`;
  li.append(rank,name,score);box.append(li);
 }
}
function relativeTime(t){const age=Math.max(0,Date.now()-t);if(age<60000)return 'Vừa xong';if(age<3600000)return `${Math.floor(age/60000)} phút`;return new Intl.DateTimeFormat('vi-VN',{timeZone:timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(t));}
function renderActivities(activity){lastActivity=activity||[];const box=$('activity');box.replaceChildren();if(!lastActivity.length){const li=document.createElement('li');li.className='empty';li.textContent='Chưa có hoạt động nào';box.append(li);return;}
 for(const e of lastActivity.slice(0,6)){
  const li=document.createElement('li');const ico=document.createElement('span');ico.className='act-symbol';ico.textContent=ICON[e.action]||'✨';
  const ln=document.createElement('span');ln.className='act-line';const b=document.createElement('b');b.textContent=safeName(e.name);ln.append(b,document.createTextNode(` ${DESCR[e.action]||'gửi lời chúc'} · +${e.points} điểm`));
  const ts=document.createElement('span');ts.className='act-time';ts.textContent=relativeTime(e.created_at||e.timestamp||Date.now());li.append(ico,ln,ts);box.append(li);
 }
}
function renderPresence(e){window.currentOnline=e.online||[];$('onlineCount').textContent=fmt(e.onlineCount);scene3d?.setPlayers(window.currentOnline);}
function renderState(data){renderMe(data.me);$('rank').textContent=data.rank?`#${fmt(data.rank)}`:'—';$('totalPlayers').textContent=fmt(data.totalPlayers);renderLeaders(data.leaders);renderActivities(data.activity);renderPresence(data);if(data.cooldowns){for(const [action,ms] of Object.entries(data.cooldowns)){cooldownEnd[action]=Math.max(cooldownEnd[action]||0,Date.now()+ms);}}}
function sparkle(type){const marks={lotus:'🪷',incense:'✨',breathe:'🌟'};const emoji=marks[type];const layer=$('flyingFx');for(let i=0;i<11;i++){const el=document.createElement('span');el.className='fx-item';el.textContent=emoji;el.style.setProperty('--x',`${35+Math.random()*30}%`);el.style.setProperty('--dx',`${(Math.random()-.5)*200}px`);el.style.animationDelay=`${Math.random()*.45}s`;layer.append(el);setTimeout(()=>el.remove(),2600);}scene3d?.animateAction(type);}
function updateButtons(){for(const btn of document.querySelectorAll('[data-action]')){const key=btn.dataset.action;const sec=Math.max(0,Math.ceil(((cooldownEnd[key]||0)-Date.now())/1000));btn.disabled=!!sec||!token;const cd=btn.querySelector('.cooldown');cd.textContent=sec?`Chờ ${sec}s`:'';}}
setInterval(updateButtons,250);
async function doAction(action){if(!token)return;const btn=document.querySelector(`[data-action="${action}"]`);if(btn?.disabled)return;btn.disabled=true;try{const data=await request('/api/action',{action});cooldownEnd[action]=Date.now()+data.cooldownMs;renderMe(data.me);sparkle(action);$('sceneStatus').textContent=`${ICON[action]} ${DESCR[action]} thành công!`;toast(`+${data.activity.points} điểm sen · ${DESCR[action]}`);try{tg?.HapticFeedback?.notificationOccurred('success');}catch{}const state=await request('/api/state');renderState(state);}catch(err){if(err.retryMs)cooldownEnd[action]=Date.now()+err.retryMs;toast(err.message);}finally{updateButtons();}}
for(const btn of document.querySelectorAll('[data-action]'))btn.addEventListener('click',()=>doAction(btn.dataset.action));
async function startRealtime(){
 streamController?.abort();const controller=new AbortController();streamController=controller;
 const tokenAtStart=token;
 while(!controller.signal.aborted){
  try{
   const res=await fetch('/api/events',{headers:{Authorization:`Bearer ${tokenAtStart}`},signal:controller.signal,cache:'no-store'});
   if(!res.ok)throw Error('Mất kết nối phòng trực tuyến');
   $('connection').textContent='● Đang trực tuyến';const reader=res.body.getReader();const decoder=new TextDecoder();let buffer='';
   for(;;){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const message=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);let event='',raw='';for(const line of message.split('\n')){if(line.startsWith('event: '))event=line.slice(7);if(line.startsWith('data: '))raw+=line.slice(6);}if(!raw)continue;try{handleRealtime(event,JSON.parse(raw));}catch(err){console.warn('Event parse:',err);}}}
  }catch(err){if(controller.signal.aborted)break;console.warn('Live SSE:',err);}
  $('connection').textContent='○ Đang kết nối lại…';await new Promise(resolve=>setTimeout(resolve,2400));
 }
}
function handleRealtime(type,data){if(type==='hello'){renderState(data);}
 else if(type==='presence')renderPresence(data);
 else if(type==='rankings')renderLeaders(data.leaders);
 else if(type==='activity'){lastActivity.unshift({...data,created_at:data.timestamp});renderActivities(lastActivity.slice(0,12));if(data.id!==me?.id){sparkle(data.action);$('sceneStatus').textContent=`${safeName(data.name)} vừa ${DESCR[data.action]}`;}}
}
function createMusic(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast('Thiết bị không hỗ trợ âm thanh');return null;}
 const ctx=new AC();const gain=ctx.createGain();gain.gain.value=.0001;gain.connect(ctx.destination);const notes=[196,293.66,392];const oscillators=[];
 notes.forEach((f,i)=>{const osc=ctx.createOscillator();osc.type=i?'sine':'triangle';osc.frequency.value=f;const amp=ctx.createGain();amp.gain.value=i===0?.06:.025;osc.connect(amp).connect(gain);osc.start();oscillators.push(osc);});
 return {ctx,gain,oscillators};}
$('musicBtn').addEventListener('click',async()=>{if(!music)music=createMusic();if(!music)return;await music.ctx.resume();soundOn=!soundOn;music.gain.gain.setTargetAtTime(soundOn?.37:.0001,music.ctx.currentTime,.3);$('musicBtn').textContent=soundOn?'♫':'♪';$('musicBtn').style.background=soundOn?'#986949':'#3d2c33';toast(soundOn?'Đã bật âm thanh thiền nhẹ':'Đã tắt âm thanh');});
$('demoJoin').addEventListener('click',()=>login($('demoName').value).catch(err=>setOverlay('Không thể đăng nhập',err.message,true,true)));
$('loginRetry').addEventListener('click',()=>login().catch(err=>setOverlay('Lỗi kết nối',err.message,false,true)));
setOverlay('Vườn Sen An Lành','Đang tải trò chơi…');
login().catch(err=>{console.error(err);setOverlay('Không kết nối được',err.message,false,true);});
