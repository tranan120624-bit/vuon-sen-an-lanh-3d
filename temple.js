import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const gold = new THREE.MeshStandardMaterial({color:0xeac477,metalness:.78,roughness:.26});
const paleGold = new THREE.MeshStandardMaterial({color:0xffe1a1,metalness:.65,roughness:.27});
const bronze = new THREE.MeshStandardMaterial({color:0xb7783a,metalness:.62,roughness:.38});
const wood = new THREE.MeshStandardMaterial({color:0x5b3025,roughness:.76});
const red = new THREE.MeshStandardMaterial({color:0x8e3032,roughness:.62});
const floorMat = new THREE.MeshStandardMaterial({color:0x7b4c36,metalness:.15,roughness:.47});
const stone = new THREE.MeshStandardMaterial({color:0x995c40,roughness:.8});
const silk = new THREE.MeshStandardMaterial({color:0x8e786f,roughness:.9});
const skin = new THREE.MeshStandardMaterial({color:0xe8bc91,roughness:.86});
const black = new THREE.MeshStandardMaterial({color:0x31232a,roughness:.75});
const glow = new THREE.MeshBasicMaterial({color:0xffe7a3,transparent:true,opacity:.6,depthWrite:false});
const boxG = new THREE.BoxGeometry(1,1,1);
const sphG = new THREE.SphereGeometry(1,16,12);
const cylG = new THREE.CylinderGeometry(1,1,1,12);
const ringG = new THREE.TorusGeometry(1,.025,7,56);

function mesh(g,m,parent, pos, scale){const o=new THREE.Mesh(g,m);o.position.set(...pos);if(scale)o.scale.set(...scale);parent.add(o);return o;}
function box(parent,m,p,s){return mesh(boxG,m,parent,p,s)}
function sph(parent,m,p,s){return mesh(sphG,m,parent,p,s)}
function cyl(parent,m,p,s){return mesh(cylG,m,parent,p,s)}
function line(parent, pts, m, radius=.02){const crv=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const tube=new THREE.TubeGeometry(crv,24,radius,6,false);return mesh(tube,m,parent,[0,0,0]);}
function material(color,metalness=0,roughness=.65){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
function lantern(parent,x,y,z,seed=0){
 const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);
 cyl(group,bronze,[0,.58,0],[.11,.1,.11]);
 cyl(group,bronze,[0,.22,0],[.34,.08,.34]);
 cyl(group,bronze,[0,-.22,0],[.33,.08,.33]);
 cyl(group,new THREE.MeshStandardMaterial({color:0xffca78,emissive:0xe89638,emissiveIntensity:.8,transparent:true,opacity:.82}),[0,0,0],[.26,.4,.26]);
 const pt=new THREE.PointLight(0xffc96b,.62,5,2);pt.position.y=0;group.add(pt);
 group.userData.seed=seed;return group;
}
function createBuddha(parent){
 const p=new THREE.Group();parent.add(p);p.position.set(0,1.5,-7.55);
 // Gold stepped lotus base
 for(let i=0;i<4;i++)cyl(p,i%2?bronze:gold,[0,i*.15,0],[2.06-i*.11,.14,1.47-i*.07]);
 for(let a=0;a<12;a++){const ang=(a/12)*Math.PI*2;const petal=sph(p,gold,[Math.sin(ang)*1.32,.58,Math.cos(ang)*.72],[.39,.3,.62]);petal.rotation.y=ang;petal.rotation.x=-.25;}
 sph(p,gold,[0,1.17,0],[1.23,.42,.88]); // legs
 sph(p,gold,[-.68,1.14,.17],[.76,.43,.67]);sph(p,gold,[.68,1.14,.17],[.76,.43,.67]);
 const torso=sph(p,gold,[0,2.15,0],[.85,1.15,.5]);torso.rotation.z=.05;
 sph(p,paleGold,[0,3.42,0],[.54,.68,.48]);
 sph(p,gold,[0,4.02,-.025],[.52,.25,.43]);
 sph(p,gold,[-.62,2.24,.23],[.33,.88,.32]);
 sph(p,gold,[.62,2.24,.23],[.33,.88,.32]);
 sph(p,paleGold,[-.23,1.68,.52],[.27,.17,.18]);sph(p,paleGold,[.23,1.68,.52],[.27,.17,.18]);
 // Halo, floral filigree
 const halo=mesh(ringG,gold,p,[0,3.3,-.5],[2.52,2.52,1]);halo.rotation.y=0;
 const halo2=mesh(ringG,paleGold,p,[0,3.3,-.54],[2.21,2.21,1]);
 for(let a=0;a<24;a++){const t=a*Math.PI*2/24;sph(p,bronze,[Math.sin(t)*2.36,3.3+Math.cos(t)*2.36,-.53],[.065,.065,.045]);}
 // face tiny brows and eyes
 for(const x of [-.22,.22]){sph(p,bronze,[x,3.52,.449],[.095,.022,.01]);sph(p,bronze,[x,3.35,.465],[.085,.012,.012]);}
 const aura=new THREE.PointLight(0xffd17d,3.2,14);aura.position.set(0,3,-.6);p.add(aura);
 return p;
}
function makeMonk(parent,x,z,color=0xbdb3a9,live=false,name=''){
 const group=new THREE.Group();group.position.set(x,0,z);parent.add(group);
 const robe=material(color,.05,.84);
 // seated monks facing altar, visible from behind/front angle
 mesh(new THREE.ConeGeometry(.39,.85,9),robe,group,[0,.68,0],[1,1,1]);
 sph(group,skin,[0,1.28,0],[.235,.26,.225]);
 sph(group,black,[0,1.52,-.01],[.23,.08,.22]);
 sph(group,robe,[-.4,.77,.03],[.17,.42,.18]);sph(group,robe,[.4,.77,.03],[.17,.42,.18]);
 if(live){
  const ring=mesh(new THREE.RingGeometry(.48,.55,28),new THREE.MeshBasicMaterial({color:0xf6d28b,side:THREE.DoubleSide,transparent:true,opacity:.8}),group,[0,.052,0]);ring.rotation.x=-Math.PI/2;
  const halo=sph(group,new THREE.MeshBasicMaterial({color:0xffd58a,transparent:true,opacity:.12,depthWrite:false}),[0,1,0],[.7,1,.7]);
  // avoid labels for all online users, screen clutter; names on only first 6
  if(name){const cn=document.createElement('canvas');cn.width=256;cn.height=64;const ctx=cn.getContext('2d');ctx.fillStyle='#3b2226c9';ctx.roundRect(8,10,240,46,18);ctx.fill();ctx.font='bold 19px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff1c4';ctx.fillText(name.slice(0,15),128,40,222);const tex=new THREE.CanvasTexture(cn);const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));spr.position.set(0,2.04,0);spr.scale.set(1.7,.42,1);group.add(spr);}
 }
 group.userData.baseY=0;group.userData.offset=Math.random()*Math.PI*2;return group;
}
export function createTemple(el){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x2d1c1d);scene.fog=new THREE.FogExp2(0x442921,.022);
 const camera=new THREE.PerspectiveCamera(45,1,.1,150);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;el.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffd5a2,0x4a1c22,2.05));
 const mainLight=new THREE.SpotLight(0xffcd87,130,30,.75,.68,1);mainLight.position.set(-3,12,7);scene.add(mainLight);
 const fill=new THREE.PointLight(0xff8868,32,16);fill.position.set(6,5,3);scene.add(fill);
 const world=new THREE.Group();scene.add(world);
 // foundation floor, red carpet, golden side rails
 box(world,floorMat,[0,-.2,1],[17,.4,30]);
 box(world,red,[0,.019,3],[2.13,.035,21]);
 for(let i=0;i<10;i++){const z=-2+i*2;box(world,gold,[-1.09,.045,z],[.04,.014,1.95]);box(world,gold,[1.09,.045,z],[.04,.014,1.95]);}
 // temple rear structure
 box(world,wood,[0,5.1,-10.4],[16,10,.5]);
 box(world,material(0x9e622e),[0,6.9,-10.02],[12.5,5.3,.4]);
 for(let j=0;j<7;j++){box(world,bronze,[-6.3+j*2.1,7.5,-9.79],[.06,4.7,.07]);}
 for(let i=0;i<2;i++){
  const x=i===0?-7.2:7.2;
  cyl(world,wood,[x,4.4,-7.8],[.64,8.8,.64]);
  cyl(world,gold,[x,8.7,-7.8],[.85,.3,.85]);cyl(world,gold,[x,.3,-7.8],[.85,.27,.85]);
  for(let h=1;h<8;h++)cyl(world,bronze,[x,h+.2,-7.8],[.665,.07,.665]);
  lantern(world,x*.79,5.4,-6.8,i);
 }
 // gold roof layers
 for(let i=0;i<3;i++){const y=9.0+i*.34;box(world,i%2?bronze:gold,[0,y,-9.1],[17-i*1.0,.24,3-i*.35]);}
 // temple side architecture and pillars
 for(const x of [-8,8]){box(world,stone,[x,4.2,-1.5],[.4,8.4,20]);for(const z of [-4,2,7]){cyl(world,wood,[x*.91,3.45,z],[.29,7,.29]);cyl(world,gold,[x*.91,6.9,z],[.4,.22,.4]);}}
 // geometric roof ornaments / wall circular carvings
 for(const x of [-5,5]){const o=mesh(ringG,gold,world,[x,5.6,-9.75],[1.5,1.5,1]);o.rotation.x=0;for(let a=0;a<14;a++){const t=a*Math.PI/7;sph(world,bronze,[x+Math.cos(t)*1.25,5.6+Math.sin(t)*1.25,-9.66],[.09,.09,.03]);}}
 // altar stage
 box(world,stone,[0,.48,-7.35],[11,.98,5.5]);
 for(let a=0;a<5;a++){box(world,a%2?wood:bronze,[0,.1+a*.17,-4.0-a*.43],[4.8, .16,.45]);}
 box(world,wood,[0,1.05,-7.4],[8.8,.4,3.4]);
 createBuddha(world);
 // incense stand and smoke
 const bowl=cyl(world,bronze,[0,1.14,-3.22],[.67,.42,.56]);
 for(let i=0;i<7;i++){const x=(i-3)*.12;const stick=cyl(world,wood,[x,1.75,-3.22],[.018,.78,.018]);}
 const smoke=[];
 const smokeMat=new THREE.MeshBasicMaterial({color:0xf2dcbb,transparent:true,opacity:.18,depthWrite:false});
 for(let i=0;i<16;i++){let puff=sph(world,smokeMat,[(Math.random()-.5)*.35,2.0+Math.random()*3,-3.2],[.08,.18,.08]);puff.userData.offset=Math.random()*Math.PI*2;smoke.push(puff);}
 for(const x of [-4.6,4.6]){
  box(world,wood,[x,1.05,-6.1],[1.9,.15,1.25]);
  for(let j=0;j<3;j++){cyl(world,bronze,[x-0.55+j*.55,1.25,-6.1],[.16,.26,.16]);const flame=sph(world,glow,[x-.55+j*.55,1.52,-6.1],[.075,.19,.07]);flame.userData.flicker=Math.random()*6;smoke.push(flame);}
  sph(world,material(0xda7299),[x,1.35,-6.55],[.4,.19,.3]);
 }
 // lotus-shaped seating decoration near front
 for(const x of [-4.9,4.9]){
  cyl(world,bronze,[x,.36,-2.2],[.75,.7,.65]);
  const base=cyl(world,gold,[x,.78,-2.2],[.6,.14,.6]);
  for(let a=0;a<8;a++){const t=a*Math.PI/4;const petal=sph(world,material(0xd37d98),[x+Math.sin(t)*.38,.98,-2.2+Math.cos(t)*.38],[.22,.31,.22]);petal.rotation.z=t;}
 }
 // distant decorative monks + live avatars among crowd
 const avatars=new THREE.Group();world.add(avatars);
 const npc=new THREE.Group();world.add(npc);
 for(let row=0;row<8;row++)for(let col=0;col<11;col++){
  if(Math.abs(col-5)<1 && row<4)continue;
  const x=(col-5)*1.12+(row%2)*.16;
  const z=.1+row*1.52;
  const palette=[0xb8a5a3,0xc2b7ac,0x998b97,0xc2a287,0xa2adb6];
  makeMonk(npc,x,z,palette[(row+col*3)%palette.length]);
 }
 // top lights
 const lanterns=[];
 for(let i=0;i<6;i++){lanterns.push(lantern(world,(i-2.5)*2.25,7.6,-3.8+i%2*.6,i));}
 const particles=[];
 const particleGeo=new THREE.SphereGeometry(.035,6,5);
 const particleMat=new THREE.MeshBasicMaterial({color:0xffe9b7,transparent:true,opacity:.65});
 for(let i=0;i<45;i++){const p=mesh(particleGeo,particleMat,world,[(Math.random()-.5)*14,1.3+Math.random()*7,-11+Math.random()*22],[1,1,1]);p.userData={v:.1+Math.random()*.27,t:Math.random()*6};particles.push(p);}
 // user camera interaction, subtle yaw change only
 let yaw=0,mouseX=null;
 const down=e=>{mouseX=e.clientX};
 const move=e=>{if(mouseX===null)return;const dx=e.clientX-mouseX;mouseX=e.clientX;yaw=Math.max(-.23,Math.min(.23,yaw+dx*.002));};
 const up=()=>{mouseX=null};
 el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);
 const resize=()=>{const w=el.clientWidth||420,h=el.clientHeight||620;camera.aspect=w/h;camera.fov=w>650?43:53;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
 const observer=new ResizeObserver(resize);observer.observe(el);resize();
 let raf=0,disposed=false,liveList=[];
 const clock=new THREE.Clock();
 function tick(){if(disposed)return;const t=clock.getElapsedTime();camera.position.set(Math.sin(yaw)*4.1,7.0,18.8);camera.lookAt(0,3.65,-5.0);for(const o of smoke){if(o.userData.offset!==undefined){o.position.y=2.2+(t*.35+o.userData.offset)%3;o.position.x=Math.sin(t*.7+o.userData.offset)*.18;}}
 for(const [i,l] of lanterns.entries())l.rotation.z=Math.sin(t*.6+i)*.035;
 for(let i=0;i<particles.length;i++){const p=particles[i];p.position.y+=p.userData.v*.01;p.position.x+=Math.sin(t*.5+p.userData.t)*.001;if(p.position.y>9)p.position.y=1.3;}
 for(const [i,m] of avatars.children.entries()){m.position.y=m.userData.baseY+Math.sin(t*1.4+m.userData.offset)*.035;}
 renderer.render(scene,camera);raf=requestAnimationFrame(tick);}
 tick();
 function setPlayers(players){
  const next=Array.isArray(players)?players.slice(0,65):[];
  const current=avatars.children.slice();
  current.forEach(o=>{avatars.remove(o);o.traverse(c=>{if(c.material&&c.material.map){c.material.map.dispose();c.material.dispose();} });});
  liveList=next;
  next.forEach((u,i)=>{const row=Math.floor(i/9),col=i%9;const x=(col-4)*1.17+row%2*.15,z=1.35+row*1.55;
   const colors=[0xf0cb87,0xd7adbe,0xb1badd,0xe3b18c,0xdccda6];
   makeMonk(avatars,x,z,colors[(i*3)%colors.length],true,i<5?u.name:'');
  });
 }
 function animateAction(type){
  const current=clock.getElapsedTime();
  if(type==='incense'){for(let i=0;i<6;i++){const p=sph(world,glow,[(Math.random()-.5)*.5,1.8,-3.1],[.09,.1,.09]);setTimeout(()=>world.remove(p),1100);}}
  else if(type==='lotus'){const t=mesh(new THREE.TorusGeometry(.6,.08,8,32),paleGold,world,[0,.3,-2.6]);t.rotation.x=Math.PI/2;setTimeout(()=>world.remove(t),850);}
 }
 function destroy(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderer.dispose();el.replaceChildren();}
 return {setPlayers,animateAction,destroy};
}
