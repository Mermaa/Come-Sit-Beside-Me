'use strict';
const source=[
['06',"Look! My tooth came out.\nDo you think the fairy knows we moved?"],
['11',"We said best friends forever.\nI wrote it on my hand so I wouldn't forget."],
['17',"I played that song all the way home.\nI think she likes me. I think."],
['24',"Two suitcases. A key of my own.\nI called Mum as soon as I got there."],
['36',"He's finally asleep.\nHis whole hand fits around my finger."],
['52',"Dad still asks if I've eaten.\nThese days, I ask him first."],
['68',"We have time for the long way home now.\nShe still reaches for my hand."],
['83',"You're here.\nCome sit beside me. The tea is still warm."]];
const $=s=>document.querySelector(s),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,touchDevice=matchMedia('(pointer: coarse)').matches,debugEnabled=new URLSearchParams(location.search).has('debug');
let w=innerWidth,h=innerHeight,started=false,time=0,drift=0,last=performance.now(),active=null,foreground=null,paused=reduced,menu=false,keyboard=false,nextLucid=22,clarityMix=0,previousClarity=false,blinkStart=-100,tiltX=0,tiltY=0,confusion=0,confusionManual=false,forcedError='auto',audio,gain,sound=false;
const pointer={x:w/2,y:h/2},light={...pointer};
let saved=[];try{const value=JSON.parse(localStorage.getItem('afterglow-memories-en')||'[]');if(Array.isArray(value))saved=value.filter(v=>typeof v==='string').slice(-12)}catch{}
// One clock; clarity only covers its expression, never rewinds it.
const ERROR_THRESHOLDS={language:.2,dissolve:.3,era:.45,mismatch:.55,morph:.7};
const ERROR_NAMES={language:'话说不完整',dissolve:'物件不完整',era:'年代错位',mismatch:'认错东西',morph:'物件变成另一样'};
function errorChance(kind,level=confusion){const threshold=ERROR_THRESHOLDS[kind];return level<=threshold?0:Math.pow((level-threshold)/(1-threshold),.75);}
function errorProfile(f){const result={};if(f.opening||(f.age==='36'&&!visitor.shown))return Object.fromEntries(Object.keys(ERROR_THRESHOLDS).map(k=>[k,false]));for(const kind of Object.keys(ERROR_THRESHOLDS))result[kind]=forcedError==='auto'?(kind==='language'?Math.min(f.errorRolls[kind],f.typoRoll):f.errorRolls[kind])<errorChance(kind):forcedError===kind;return result;}
function resetErrors(f){f.errorRolls=Object.fromEntries(Object.keys(ERROR_THRESHOLDS).map(k=>[k,Math.random()]));f.languageRolls=[Math.random(),Math.random(),Math.random()];f.typoRoll=Math.random();f.morphProgress=0;f.dissolve=0;f.typographySeed=Math.random();f.typoCache=new Map();const candidates=source.slice(0,-1).filter(([age])=>age!==f.age);f.errorTarget=candidates[Math.floor(Math.random()*candidates.length)];f.errors=errorProfile(f);}
function desiredWords(f){
 if(f.lucid||clarityMix>.25||(f.age==='36'&&!visitor.shown))return f.text;
 const profile=f.errors||{},target=f.errorTarget;
 let words=profile.morph&&f.morphProgress>=.5?target[1]:profile.mismatch?target[1]:f.text;
 // A transforming object is recognised as its new object; do not immediately misname it again.
 if(profile.language&&!profile.morph){const level=forcedError==='language'?1:errorChance('language');if(f.languageRolls[0]<.4+.6*level)words=words.replace(/Mum|Dad|she|She/,'that person…');if(f.languageRolls[1]<level)words=words.split('\n')[0]+'\n'+target[1].split('\n').at(-1);if(f.languageRolls[2]<level||words===f.text)words+='\nWhat day is it? What day is it?';}
 return words;
}
function resetSpeech(f,words){if(f.version===words)return;f.version=words;f.chars=0;f.textExposure=0;f.clock=0;f.speechPhase='waiting';prepareWords(f);}
function updateErrors(f,dt){
 if(!f?.errorRolls)return;f.errors=errorProfile(f);
 const dissolveLevel=forcedError==='dissolve'?Math.max(.65,confusion):confusion;
 const desired=f.errors.dissolve?.18+.45*clamp((dissolveLevel-.3)/.7,0,1):0;
 f.dissolve+=(desired-f.dissolve)*(reduced?1:1-Math.exp(-dt*2));
 if(f.errors.morph&&!f.lucid&&f.lift>.83){f.morphProgress=Math.min(1,f.morphProgress+dt/2);}else if(!f.errors.morph){f.morphProgress=0;}
 resetSpeech(f,desiredWords(f));
}
function effectFor(f){if(!f?.errors||endingStage!=='explore'||(f.age==='36'&&!visitor.shown))return null;return{strength:1-clarityMix,dissolve:f.dissolve,morphTarget:f.errors.morph?f.errorTarget[0]:null,morphProgress:f.morphProgress,eraTarget:f.errors.era?f.errorTarget[0]:null};}
const darkness=document.createElement('div');darkness.id='object-darkness';darkness.setAttribute('aria-hidden','true');$('#space').append(darkness);
const warmth=document.createElement('div');warmth.id='warmth';warmth.setAttribute('aria-hidden','true');$('#space').append(warmth);
const speech=$('#speech');
const visitor={shown:false,appearAt:0,clockStart:0,clockBase:0,x:0,y:0,opacity:0,hover:false,wasHover:false,lastSpoken:-Infinity,stage:'尚未出现',lucid:false,lucidUntil:0,age:'visitor',surface:$('#visitor-speech'),text:'',version:'',lift:1,looked:false,chars:0,clock:0,speechPhase:'done',rect:null};
let darknessTime=0,cameraFeed=null;
addEventListener('pagehide',()=>cameraFeed?.getTracks().forEach(track=>track.stop()));
const positions=[];
function position(){let best,bestGap=-1;for(let i=0;i<40;i++){const p={x:.12+Math.random()*.76,y:.18+Math.random()*.52},gap=positions.length?Math.min(...positions.map(q=>Math.hypot((p.x-q.x)*w/h,p.y-q.y))):1;if(gap>bestGap){best=p;bestGap=gap}}positions.push(best);return best;}
function memory([age,text]){return{age,text,version:text,...position(),baseZ:-360-Math.random()*240,z:-500,lift:0,seen:0,phase:Math.random()*10,rate:.012+Math.random()*.012,speechPhase:'waiting',chars:0,textExposure:0,looked:false,since:0,clock:0,lucid:false,lucidUntil:0,rect:null,frame:null};}
const memories=source.slice(0,-1).map(memory),lastMemory=memory(source[7]);
let openingMemoryShown=false;
const openingMemory=memories.find(f=>f.age==='24');
let openingApproach=null;
let endingStage='explore',endingClock=0,endingPending=false,dwell=null,dwellSince=0;
let gyroAsked=false,gyroEnabled=false,gyroX=0,gyroY=0,gyroOrigin=null;
async function requestGyro(){if(gyroAsked||reduced||!touchDevice)return;gyroAsked=true;try{if(typeof DeviceOrientationEvent==='undefined')return;if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')return;addEventListener('deviceorientation',e=>{if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;if(!gyroOrigin)gyroOrigin={beta:e.beta,gamma:e.gamma};gyroX=clamp((e.beta-gyroOrigin.beta)*.16,-5,5);gyroY=clamp((e.gamma-gyroOrigin.gamma)*.16,-5,5);gyroEnabled=true})}catch{gyroEnabled=false}}
$('#space').addEventListener('pointerdown',requestGyro,{once:true});
function announce(text){$('#announcement').textContent=text}
function begin(){if(!entered||started)return;started=true;document.body.classList.add('started');$('#hint').classList.remove('visible');$('#hint').classList.add('dispersed')}
function move(x,y){if(!entered||performance.now()<explorationReadyAt)return;begin();pointer.x=x;pointer.y=y}
$('#space').addEventListener('pointermove',e=>move(e.clientX,e.clientY));$('#space').addEventListener('pointerdown',e=>move(e.clientX,e.clientY));
addEventListener('resize',()=>{w=innerWidth;h=innerHeight;pointer.x=clamp(pointer.x,0,w);pointer.y=clamp(pointer.y,0,h)});
// The doorway owns entry; exploration and its timers start only after it fades.
let entered=false,entryChosen=false,cameraStatus='not-requested',cameraRequest=0,explorationReadyAt=Infinity;
const doorway=$('#doorway');
const entrySurfaces=[$('#space'),$('#menu'),$('#tools')];
entrySurfaces.forEach(el=>el.inert=true);
function enterExperience(){
 if(entryChosen)return;entryChosen=true;cameraRequest++;
 document.body.dataset.camera=cameraStatus;
 doorway.classList.add('departing');doorway.inert=true;
 setTimeout(()=>{
  doorway.hidden=true;entered=true;confusion=0;darknessTime=0;if(cameraFeed){window.VisitorSilhouette?.attach(cameraFeed);cameraFeed=null;}window.MemoryObject3D?.preload(openingMemory.age);explorationReadyAt=performance.now()+500;
  entrySurfaces.forEach(el=>el.inert=false);
  $('#space').setAttribute('tabindex','-1');$('#space').focus({preventScroll:true});
  setTimeout(()=>{if(!started)$('#hint').classList.add('visible');document.body.classList.add('can-control');if(debugEnabled&&endingStage==='explore')$('#skip-to-tea').hidden=false},500);
  setTimeout(()=>$('#hint').classList.remove('visible'),10000);
 },reduced?0:800);
}
$('#enter-without-camera').onclick=()=>{cameraStatus='skipped';enterExperience()};
$('#enter-camera').onclick=async()=>{
 if(entryChosen||cameraStatus==='requesting')return;
 const request=++cameraRequest;cameraStatus='requesting';$('#enter-camera').disabled=true;
 try{
  if(!navigator.mediaDevices?.getUserMedia){cameraStatus='unsupported';}
  else {
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:320},height:{ideal:240},frameRate:{ideal:15,max:15}},audio:false});
   // Keep the approved feed locally for mask-only segmentation after entry.
   if(request!==cameraRequest){stream.getTracks().forEach(track=>track.stop());return;}
   cameraFeed=stream;
   cameraStatus='granted';
  }
 }catch(error){if(request!==cameraRequest)return;cameraStatus=error.name==='NotAllowedError'?'denied':'unavailable';}
 if(request===cameraRequest)enterExperience();
};

$('#menu').onclick=()=>{menu=!menu;$('#menu').setAttribute('aria-expanded',menu);document.body.classList.toggle('menu-open',menu)};
addEventListener('keydown',e=>{if(!entered)return;if(e.key==='Tab'){keyboard=true;document.body.classList.add('keyboard')}if(document.querySelector('dialog[open]')||e.target.matches('textarea,input,select,button,a'))return;const d={ArrowLeft:[-30,0],ArrowRight:[30,0],ArrowUp:[0,-30],ArrowDown:[0,30]}[e.key];if(d){e.preventDefault();move(clamp(pointer.x+d[0],0,w),clamp(pointer.y+d[1],0,h))}if(e.code==='Space'){e.preventDefault();paused=!paused;announce(paused?'Drifting paused.':'Drifting resumed.')}});
$('#about').onclick=()=>$('#info').showModal();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#ending-leave').onclick=()=>$('#write').showModal();
$('#ending-stay').onclick=()=>{
 $('#ending-invite').hidden=true;
 endingPhase('stay');
 $('#space').focus();
};
$('#ending-restart').onclick=()=>location.reload();
$('#memory-form').onsubmit=e=>{e.preventDefault();const text=$('#memory').value.trim();if(!text)return;const next=[...saved,text].slice(-12);let stored=true;try{localStorage.setItem('afterglow-memories-en',JSON.stringify(next));saved=next}catch{stored=false}$('#memory').value='';$('#write').close();announce(stored?'Your memory is saved on this device.':'Device storage is unavailable.');};
function letterMistake(token){const letters=(token.match(/[a-zA-Z]+/g)||[]).sort((a,b)=>b.length-a.length)[0]||'word',at=Math.floor(Math.random()*Math.max(1,letters.length-1)),kind=Math.floor(Math.random()*3);let result=kind===0?letters.slice(0,at)+letters[at+1]+letters[at]+letters.slice(at+2):kind===1?letters.slice(0,at)+letters.slice(at+1):letters.slice(0,at)+letters[at]+letters.slice(at);return result===letters?letters.slice(0,at)+letters.slice(at+1):result;}
function prepareWords(f){
 f.mistakes=new Map();f.typoCache||=new Map();const eligible=(f.version.match(/\S+/g)||[]).map((word,i)=>({word,i})).filter(v=>/[A-Za-z]{4,}/.test(v.word));
 for(let n=0;n<2&&eligible.length;n++){const pick=eligible.splice(Math.floor((f.typographySeed??.5)*eligible.length),1)[0],key=pick.i+'|'+pick.word;if(!f.typoCache.has(key))f.typoCache.set(key,letterMistake(pick.word));f.mistakes.set(pick.i,f.typoCache.get(key));}f.wordFades=[];f.renderKey=null;
}
function select(f){if(active&&active!==f)releaseMemory();active=foreground=f;f.seen++;f.since=drift;f.focus={x:light.x,y:light.y};f.speechPhase='waiting';f.chars=0;f.textExposure=0;f.clock=0;f.looked=true;f.lucid=time>=nextLucid;f.lucidUntil=time+8;if(f.lucid)nextLucid=time+35;resetErrors(f);f.version=desiredWords(f);prepareWords(f);speech.hidden=true;}
function disperse(f){if(f?.age==='36'&&f.chars>=f.text.length&&f.version===f.text)showVisitor(f.frame);if(!f||['done','dispersing','waiting'].includes(f.speechPhase))return;f.speechPhase='dispersing';f.clock=0;}
function releaseMemory(){if(!active)return;disperse(active);active.looked=false;active.lucid=false;if(active.opening)openingApproach=null;active.opening=false;active.rest={x:active.frame?.x||active.x*w,y:active.frame?.y||active.y*h};active.releaseAt=drift;active.x=clamp(active.x+(Math.random()-.5)*.15,.12,.88);active.y=clamp(active.y+(Math.random()-.5)*.12,.18,.70);active.baseZ=-360-Math.random()*240;active=null;}
function showWords(f){const surface=f?.surface||speech;const typo=!f.opening&&f.age!=='visitor'&&!(f.age==='36'&&!visitor.shown)&&!f.lucid&&clarityMix<.35&&(forcedError==='language'||(forcedError==='auto'&&f.errors?.language&&(f.typoRoll??1)<errorChance('language'))),count=Math.floor(f.chars),key=[f.version,count,typo].join('|');if(key===f.renderKey)return;f.renderKey=key;surface.textContent='';let i=0;for(const token of f.version.slice(0,count).match(/\S+|\s+/g)||[]){const span=document.createElement('span');span.textContent=token;if(/\S/.test(token)){if(f.wordFades[i]===undefined)f.wordFades[i]=.55+Math.random()*.45;span.style.setProperty('--word-fade',f.wordFades[i]);if(typo&&f.mistakes.has(i)&&/[A-Za-z]{4,}/.test(token)){span.textContent='';const original=document.createElement('s');original.textContent=token;const mistake=document.createElement('span');mistake.className='word-error';mistake.textContent=' '+f.mistakes.get(i);span.append(original,mistake)}i++;}surface.append(span);}}
function speechPosition(f){const surface=f?.surface||speech;const r=f.rect;if(!r)return;const mobile=w<=700,width=Math.min(32*10.8,w-40),height=surface.offsetHeight||150;let x,y;if(mobile){x=clamp(r.left+r.width/2-width/2,20,Math.max(20,w-width-20));y=r.bottom+24;}else if(r.right+30+width<w-24){x=r.right+30;y=r.top+r.height*.25;}else if(r.left-30-width>24){x=r.left-30-width;y=r.top+r.height*.25;}else{x=clamp(r.left+r.width/2-width/2,20,w-width-20);y=r.bottom+24;}if(y+height>h-30)y=Math.max(30,r.top-height-24);surface.style.left=x+'px';surface.style.top=clamp(y,30,Math.max(30,h-height-30))+'px';}
function updateSpeech(f,dt,ending=false){const surface=f?.surface||speech;if(!f){surface.hidden=true;return;}if(f.speechPhase==='waiting'&&f.lift>.83&&f.looked&&!(f.errors?.morph&&!f.lucid&&clarityMix<.25&&f.morphProgress<.5)){f.speechPhase='revealing';announce(f.version);}if(f.speechPhase==='revealing'){f.chars=Math.min(f.version.length,f.chars+dt*(ending?17:22));if(f.chars>=f.version.length){f.speechPhase='hold';f.clock=0;}}else if(f.speechPhase==='hold'&&!ending){f.clock+=dt;if(f.clock>=4)disperse(f);}else if(f.speechPhase==='dispersing'){f.clock+=dt;if(f.clock>=(reduced?.6:2.6))f.speechPhase='done';}f.textExposure=f.chars/f.version.length;surface.hidden=['waiting','done'].includes(f.speechPhase);surface.classList.toggle('dispersing',f.speechPhase==='dispersing');surface.classList.toggle('lucid',!!f.lucid||clarityMix>.5);surface.style.setProperty('--speech-disorder',f.opening?0:confusion*(1-clarityMix));showWords(f);if(f.speechPhase!=='dispersing')speechPosition(f);}
function showVisitor(origin){
 if(visitor.shown)return;visitor.shown=true;visitor.appearAt=darknessTime;visitor.clockStart=darknessTime;visitor.clockBase=confusion;visitor.firstAddress=true;nextLucid=Math.max(nextLucid,time+15);
 visitor.x=clamp((origin?.x??w*.4)+(w<=700?90:200),w*.25,w*.78);visitor.y=clamp(origin?.y??h*.43,h*.3,h*.6);visitor.stage='刚出现 · my little one';
}
function visitorLine(){if(visitor.lucid||active?.lucid||clarityMix>.5)return 'There you are.';return confusion>=.85?'':visitor.firstAddress?'There you are, my little one.':confusion>=.65?'Who… that person…':confusion>=.4?'Mum? Is that you?':'There you are, my little one.';}
function updateVisitor(dt,ending=false){
 const shown=visitor.shown&&!['black','invitation','stay'].includes(endingStage),goal=shown?1:0;visitor.opacity+=(goal-visitor.opacity)*(reduced?1:1-Math.exp(-dt*(shown?.45:.8)));
 const width=Math.min(220,w*.40),height=width*1.55,x=clamp(visitor.x||w*.65,width/2+20,w-width/2-20),y=clamp(visitor.y||h*.4,height/2+65,h-height/2-50);
 visitor.rect={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2,width,height};
 visitor.wasHover=visitor.hover;visitor.hover=shown&&visitor.opacity>.3&&light.x>visitor.rect.left&&light.x<visitor.rect.right&&light.y>visitor.rect.top&&light.y<visitor.rect.bottom&&(window.VisitorSilhouette?.hit((light.x-visitor.rect.left)/width,(light.y-visitor.rect.top)/height)??true);
 window.VisitorSilhouette?.update({visible:visitor.opacity>.005,opacity:visitor.opacity*(1-clarityMix*.2),width,height,x,y,viewportWidth:w,viewportHeight:h,tiltX,tiltY,time:drift,reduced});
 if(ending){visitor.surface.hidden=true;return;}
 const words=visitorLine();visitor.stage=!visitor.shown?'尚未出现':!words?'沉默':words==='There you are.'?'清醒 · There you are.':words==='Who… that person…'?'陌生 · that person':words==='Mum? Is that you?'?'认错 · Mum':'亲近 · my little one';
 const busy=foreground&&['waiting','revealing','hold','dispersing'].includes(foreground.speechPhase);
 if(visitor.hover&&!busy&&words==='There you are.'&&visitor.version!==words&&['revealing','hold'].includes(visitor.speechPhase)){visitor.text=visitor.version=words;visitor.chars=0;visitor.clock=0;visitor.speechPhase='waiting';visitor.renderKey=null;}
 if((!visitor.hover||busy||!words)&&['revealing','hold'].includes(visitor.speechPhase))disperse(visitor);
 if(shown&&visitor.hover&&!visitor.wasHover&&!busy&&words&&darknessTime-visitor.lastSpoken>=20&&['done','waiting'].includes(visitor.speechPhase)){
  visitor.text=visitor.version=words;visitor.chars=0;visitor.clock=0;visitor.looked=true;visitor.speechPhase='waiting';visitor.mistakes=new Map();visitor.wordFades=[];visitor.renderKey=null;
 }
 if(visitor.speechPhase==='dispersing'&&visitor.clock===0){visitor.lastSpoken=darknessTime;visitor.firstAddress=false;}
 if(!shown){visitor.surface.hidden=true;return;}updateSpeech(visitor,dt);visitor.surface.classList.toggle('lucid',visitor.lucid||clarityMix>.5);
}
function frameObject(f,selected,dt){const moving=!reduced&&!paused;const sway=moving?Math.sin(drift*f.rate+f.phase)*(.025+.035*confusion*(1-clarityMix)):0;const base={x:(f.x+sway)*w,y:(f.y+(moving?Math.cos(drift*f.rate*.7+f.phase)*.035:0))*h};if(f.age==='36'&&!visitor.shown&&darknessTime>=90&&!selected){f.approachX??=base.x;f.approachY??=base.y;const a=reduced?1:1-Math.exp(-dt*.55);f.approachX+=(light.x-f.approachX)*a;f.approachY+=(light.y-f.approachY)*a;base.x=f.approachX;base.y=f.approachY;}if(f===openingMemory&&openingApproach&&(!selected||f.opening)){base.x=openingApproach.x;base.y=openingApproach.y;}const target=selected?1:0;f.lift=reduced?target:f.lift+(target-f.lift)*(1-Math.exp(-dt*(selected?1.8:1.4)));f.z=f.baseZ*(1-f.lift);const frontReference=Math.min(300,w*.64),reference=frontReference*(.34+.66*f.lift)*(1100/(1100-f.z)),shape=window.MemoryObject3D?.measure(f.errors?.morph&&f.morphProgress>=.5&&!f.lucid&&clarityMix<.5?f.errorTarget[0]:f.age,reference)||{width:0,height:0};let focus=f.focus||base;if(selected){focus={x:clamp(f.focus.x,shape.width/2+28,w-shape.width/2-28),y:clamp(f.focus.y,shape.height/2+80,Math.max(shape.height/2+80,h-(w<=700?220:100)-shape.height/2))};}const rest=!selected&&f.rest?{x:f.rest.x+(base.x-f.rest.x)*clamp((drift-f.releaseAt)/5,0,1),y:f.rest.y+(base.y-f.rest.y)*clamp((drift-f.releaseAt)/5,0,1)}:base;const x=rest.x*(1-f.lift)+focus.x*f.lift+(moving?tiltY*(1-f.lift)*.7:0),y=rest.y*(1-f.lift)+focus.y*f.lift+(moving?-tiltX*(1-f.lift)*.7:0);f.rect={left:x-shape.width/2,right:x+shape.width/2,top:y-shape.height/2,bottom:y+shape.height/2,width:shape.width,height:shape.height};f.frame={id:f.age,age:f.age,x,y,z:f.z,reference,foreground:f===foreground&&f.lift>.02,since:f.since,phase:f.phase,effect:effectFor(f)};return f.frame;}
function near(f,padding=18){const r=f.rect;return r?.width>0&&light.x>=r.left-padding&&light.x<=r.right+padding&&light.y>=r.top-padding&&light.y<=r.bottom+padding;}
function lightVeil(radius,x,y,clarity,blink=0,black=false){darkness.style.background=black?'#000':`radial-gradient(circle ${radius}px at ${x}px ${y}px,rgba(0,0,0,${.15-.11*clarity}) 0%,rgba(0,0,0,${.28-.12*clarity}) 25%,rgba(0,0,0,${.65-.12*clarity}) 58%,rgba(0,0,0,${1-.15*clarity}) 100%)`;if(blink>0)darkness.style.background=`linear-gradient(rgba(0,0,0,${blink}),rgba(0,0,0,${blink})),${darkness.style.background}`;warmth.style.background=clarity?`radial-gradient(circle ${radius*.735}px at ${x}px ${y}px,rgba(255,205,140,${.10*clarity}),transparent 70%)`:'none';warmth.style.opacity=clarity;const glow=$('#light');glow.style.left=x+'px';glow.style.top=y+'px';glow.style.width=radius*2+'px';glow.style.height=radius*2+'px';glow.style.opacity=started&&!black?.22:0;document.body.style.setProperty('--light-rgb',clarity>.5?'241,232,214':'180,187,193');}
function draw(items,backgroundExposure=1,exposure=1){window.MemoryObject3D?.update({show:entered&&started,width:w,height:h,items,light,clarity:clarityMix,tiltX,tiltY,motionTime:drift,reduced,ending:endingStage!=='explore',backgroundExposure,exposure,focus:foreground?.lift??1});}
function frame(now){const dt=document.hidden?0:Math.min(.05,(now-last)/1000);last=now;const modal=!!document.querySelector('dialog[open]');if(!entered){updateDebugPanel();requestAnimationFrame(frame);return;}if(!modal){darknessTime+=dt;if(darknessTime>=90&&!visitor.shown&&!started)begin();if(!confusionManual)confusion=clamp(confusion+dt*(visitor.shown?(1-visitor.clockBase)/180:1/240),0,1);}if(started&&!modal)time+=dt;if(started&&!paused&&!modal)drift+=dt;light.x+=(pointer.x-light.x)*(reduced?1:1-Math.exp(-dt*15));light.y+=(pointer.y-light.y)*(reduced?1:1-Math.exp(-dt*15));const tick=modal?0:dt;advanceEnding(tick,modal);if(!['explore','gather'].includes(endingStage)){updateVisitor(tick,true);renderEnding(tick);updateSoundscape();updateDebugPanel();requestAnimationFrame(frame);return;}
if(active?.lucid&&time>=active.lucidUntil){active.lucid=false;previousClarity=false;}if(active&&!active.opening&&!active.lucid&&time>=nextLucid){active.lucid=true;active.lucidUntil=time+8;active.version=active.text;active.chars=0;active.speechPhase='waiting';prepareWords(active);nextLucid=time+40;}
if(visitor.lucid&&time>=visitor.lucidUntil)visitor.lucid=false;if(visitor.hover&&!active&&time>=nextLucid){visitor.lucid=true;visitor.lucidUntil=time+8;nextLucid=time+40;}const clear=!!active?.lucid||visitor.lucid;if(clear&&!previousClarity)blinkStart=time;previousClarity=clear;const blinkTime=time-blinkStart,blink=clear&&!reduced?(blinkTime<.25?blinkTime/.25:blinkTime<.55?1:clamp(1-(blinkTime-.55)/.8,0,1)):0;clarityMix=clear?(reduced?1:clamp((blinkTime-.55)/.8,0,1)):clamp(clarityMix-tick/3,0,1);
const wantedX=reduced||paused?0:touchDevice?(gyroEnabled?gyroX:0):clamp((.5-pointer.y/h)*10,-5,5),wantedY=reduced||paused?0:touchDevice?(gyroEnabled?gyroY:0):clamp((pointer.x/w-.5)*10,-5,5);tiltX+=(wantedX*(1-clarityMix)-tiltX)*(1-Math.exp(-tick*3));tiltY+=(wantedY*(1-clarityMix)-tiltY)*(1-Math.exp(-tick*3));
if (!openingMemoryShown && !modal && endingStage === 'explore' && now >= explorationReadyAt &&
    window.MemoryObject3D?.isReady(openingMemory.age)) {
  begin();
  openingApproach ??= {x:openingMemory.x*w,y:openingMemory.y*h};
  const approach = reduced ? 1 : 1-Math.exp(-tick*1.25);
  openingApproach.x += (light.x-openingApproach.x)*approach;
  openingApproach.y += (light.y-openingApproach.y)*approach;
  if (Math.hypot(light.x-openingApproach.x,light.y-openingApproach.y)<42) {
    openingMemoryShown=true;
    openingMemory.opening=true;
    select(openingMemory);
  }
}
if (!openingMemoryShown && window.MemoryObject3D?.status().failed.includes(openingMemory.age)) openingMemoryShown=true;
const start=Math.floor(time/40)%memories.length,visible=Array.from({length:4},(_,i)=>memories[(start+i)%memories.length]);if(active&&!visible.includes(active))visible[3]=active;if(foreground&&!visible.includes(foreground))visible[3]=foreground;
if(active)updateErrors(active,tick);
document.body.style.setProperty('--grain-opacity',.025+.055*confusion);
if(!visitor.shown&&darknessTime>=90&&!visible.some(f=>f.age==='36'))visible[2]=memories.find(f=>f.age==='36');
if (active===openingMemory && openingMemory.opening) {
  if (['dispersing','done'].includes(openingMemory.speechPhase)) releaseMemory();
  else openingMemory.focus={x:light.x,y:light.y};
}
if (openingApproach&&!openingMemoryShown&&!visible.includes(openingMemory)) visible[3]=openingMemory;
const items=visible.map(f=>frameObject(f,f===active,tick));if(!visitor.shown&&darknessTime>=90&&active&&active.age!=='36'&&['done','dispersing'].includes(active.speechPhase))releaseMemory();if(active){const arrival=active.lift<.9&&Math.hypot(pointer.x-active.focus.x,pointer.y-active.focus.y)<85;active.looked=active.opening||near(active,22)||arrival;if(!active.looked){releaseMemory();dwell=null;}}if(!active&&openingMemoryShown&&endingStage==='explore'&&started&&!modal){const candidate=visible.filter(f=>near(f,w<=700?38:52)&&f!==foreground&&window.MemoryObject3D?.isReady(f.age)).sort((a,b)=>b.z-a.z)[0];if(candidate&&dwell===candidate){if(time-dwellSince>=.5&&(!foreground||foreground.lift<.08))select(candidate);}else{dwell=candidate||null;dwellSince=time;}}if(foreground&&foreground!==active&&foreground.lift<.02){foreground=null;speech.hidden=true;}updateSpeech(foreground,tick);if(visitor.shown&&active?.age==='36'&&active.speechPhase==='dispersing')releaseMemory();updateVisitor(tick);document.body.classList.toggle('clarity',clear);document.body.classList.toggle('confused',!clear);document.body.classList.toggle('edge',started&&(pointer.y<75||pointer.y>h-100));
const gather=endingStage==='gather'?clamp(endingClock/25,0,1):0,radius=((240-85*confusion)*(1-clarityMix)+Math.min(450,w*.95)*clarityMix)*(1-.4*gather);lightVeil(radius,light.x,light.y,clarityMix,blink,!started);draw(items.slice(0,Math.max(0,4-Math.floor(gather*4))),1-gather);updateSoundscape();updateDebugPanel();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
// Procedural soundscape: created only after the visitor enables Sound.
let roomGain,noiseBuffer,roomSource,audioQuiet=null,lastTypingAt=0,audioMemory=null,audioChars=0;
function initSoundscape(){
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)throw new Error('Audio unavailable');
 audio=new Context();gain=audio.createGain();gain.gain.value=0;gain.connect(audio.destination);
 noiseBuffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate);
 const data=noiseBuffer.getChannelData(0);let brown=0;
 for(let i=0;i<data.length;i++){brown=(brown+(.02*(Math.random()*2-1)))/1.02;data[i]=brown*3.5;}
 roomSource=audio.createBufferSource();roomSource.buffer=noiseBuffer;roomSource.loop=true;
 const low=audio.createBiquadFilter();low.type='lowpass';low.frequency.value=650;low.Q.value=.25;
 const high=audio.createBiquadFilter();high.type='highpass';high.frequency.value=65;
 roomGain=audio.createGain();roomGain.gain.value=0;
 roomSource.connect(high);high.connect(low);low.connect(roomGain);roomGain.connect(gain);roomSource.start();
}
function soundAllowed(){return sound&&audio?.state==='running'&&!document.hidden&&!active?.lucid&&!visitor.lucid&&!document.querySelector('dialog[open]')}
function typeSound(){
 if(!soundAllowed()||audio.currentTime-lastTypingAt<.16)return;lastTypingAt=audio.currentTime;
 const t=audio.currentTime,src=audio.createBufferSource(),filter=audio.createBiquadFilter(),envelope=audio.createGain();
 src.buffer=noiseBuffer;src.playbackRate.value=2.8;
 filter.type='highpass';filter.frequency.value=1200+Math.random()*800;
 envelope.gain.setValueAtTime(.055,t);envelope.gain.exponentialRampToValueAtTime(.0001,t+.024);
 src.connect(filter);filter.connect(envelope);envelope.connect(gain);src.start(t,Math.random());src.stop(t+.03);
 src.onended=()=>{src.disconnect();filter.disconnect();envelope.disconnect()};
 const key=audio.createOscillator(),body=audio.createGain();key.type='sine';key.frequency.setValueAtTime(190+Math.random()*80,t);key.frequency.exponentialRampToValueAtTime(95,t+.025);body.gain.setValueAtTime(.007,t);body.gain.exponentialRampToValueAtTime(.0001,t+.035);key.connect(body);body.connect(gain);key.start(t);key.stop(t+.04);key.onended=()=>{key.disconnect();body.disconnect()};
}
function updateSoundscape(){
 if(!audio)return;
 const quiet=!['explore','gather'].includes(endingStage)||!!active?.lucid||visitor.lucid||document.hidden||!!document.querySelector('dialog[open]');
 if(endingStage==='gather')roomGain.gain.setTargetAtTime(.055*(1-clamp(endingClock/25,0,1)),audio.currentTime,.5);
 if(quiet!==audioQuiet){roomGain.gain.setTargetAtTime(quiet?0:.055,audio.currentTime,quiet?.12:1.6);audioQuiet=quiet;}
 if(active!==audioMemory){audioMemory=active;audioChars=0;}
 if(active){const count=Math.floor(active.version.length*active.textExposure);if(count-audioChars>=3){if(!quiet)typeSound();audioChars=count;}}
}
$('#sound').onclick=async()=>{
 try{if(!audio)initSoundscape();await audio.resume();sound=!sound;
 gain.gain.cancelScheduledValues(audio.currentTime);gain.gain.setTargetAtTime(sound&&!document.hidden?.45:0,audio.currentTime,.18);
 $('#sound').setAttribute('aria-pressed',sound);$('#sound span').textContent=sound?'On':'Off';audioQuiet=null;updateSoundscape();
 }catch{sound=false;if(gain&&audio)gain.gain.setTargetAtTime(0,audio.currentTime,.05);$('#sound').setAttribute('aria-pressed','false');$('#sound span').textContent='Off';announce('Sound is unavailable.');}
};
document.addEventListener('visibilitychange',()=>{if(!audio)return;gain.gain.setTargetAtTime(sound&&!document.hidden?.45:0,audio.currentTime,.12);updateSoundscape()});


const teaButton = $('#skip-to-tea');
teaButton.onclick = () => {
  if (!entered || endingStage !== 'explore') return;
  begin();
  releaseMemory();
  speech.hidden = true;
  pointer.x = light.x = w / 2;
  pointer.y = light.y = h * .42;
  endingPhase('arrival');
};
const sitWait=25, attentionWait=8;
let teaAnchor=null, attentionOrigin=null, attentionTime=0, endingSat=false;
function cameraFailed(pose) {
  return cameraStatus!=='granted' || !window.VisitorSilhouette || !window.VisitorPosture
    || ['unavailable','generic'].includes(window.VisitorSilhouette.status().mode)
    || pose?.mode==='unavailable';
}
function isSitting(dt) {
  const pose=window.VisitorPosture?.status();
  if (pose?.posture==='sitting' && (pose.mode==='camera' || (debugEnabled && pose.mode==='simulation'))) return true;
  if (!cameraFailed(pose) || !near(lastMemory,8)) {
    attentionOrigin=null;
    attentionTime=0;
    return false;
  }
  if (!attentionOrigin || Math.hypot(pointer.x-attentionOrigin.x,pointer.y-attentionOrigin.y)>9) {
    attentionOrigin={...pointer};
    attentionTime=0;
  }
  attentionTime+=dt;
  return attentionTime>=attentionWait;
}
function endingWords(words) {
  const f = lastMemory;
  f.version = words;
  f.speechPhase = 'waiting';
  f.chars = 0;
  f.looked = true;
  prepareWords(f);
  f.mistakes.clear();
}
function endingPhase(stage, sat = false) {
  endingStage = stage;
  endingClock = 0;
  document.body.classList.add('ending');
  teaButton.hidden = true;
  if(stage==='response')endingSat=sat;
  $('#menu').inert=true;
  $('#tools').inert=true;
  if (stage === 'arrival') {
    if (!visitor.shown) showVisitor(null);
    active = foreground = lastMemory;
    lastMemory.lucid = true;
    lastMemory.lucidUntil = Infinity;
    lastMemory.since = drift;
    endingWords(lastMemory.text.split('\n')[1]);
  }
  if (stage === 'response') endingWords(sat ? lastMemory.text.split('\n')[0] : 'The tea has gone cold.');
  if (stage === 'invitation') {
    $('#ending-invite').hidden = false;
    $('#ending-leave').focus();
    announce('One day, someone may have to remember for you. Leave something for them.');
  }
}
function advanceEnding(dt, modal) {
  if (!started || modal) return;
  if (endingStage === 'explore') {
    if (visitor.shown ? !visitorLine() : darknessTime>=300) endingPending = true;
    const speaking = active && ['waiting','revealing','hold'].includes(active.speechPhase);
    if (endingPending && !speaking) {
      releaseMemory();
      endingPhase('gather');
      dwell = null;
    }
    return;
  }
  endingClock += dt;
  if (endingStage === 'arrival') {
    if (endingClock >= 6 && lastMemory.speechPhase === 'hold') endingPhase('sit');
    return;
  }
  const canRespond=endingStage==='sit'||(!endingSat&&['response','fade'].includes(endingStage));
  if (canRespond && isSitting(dt)) {
    endingPhase('response',true);
    return;
  }
  if (endingStage==='sit' && endingClock>=sitWait) endingPhase('response');
  const next = {gather:[25,'arrival'], response:[7,'fade'], fade:[10,'black'], black:[3,'invitation']}[endingStage];
  if (next && endingClock >= next[0]) endingPhase(next[1]);
}
function renderEnding(dt){const phase=endingStage,black=['black','invitation','stay'].includes(phase),arrival=phase==='arrival'?clamp(endingClock/6,0,1):1,fade=phase==='fade'?clamp(endingClock/10,0,1):0,f=lastMemory;clarityMix=black?0:arrival*(1-fade);document.body.classList.toggle('clarity',clarityMix>.5);document.body.classList.remove('confused');f.lift=arrival;f.z=phase==='fade'?-600*fade:-500*(1-arrival);const reference=Math.min(300,w*.64)*(1100/(1100-f.z)),shape=window.MemoryObject3D?.measure('83',reference)||{width:0,height:0},beside=cameraStatus==='granted'&&window.VisitorSilhouette?.status().mode==='camera'&&visitor.rect,
 sideRoom=shape.width/2+35, rightX=beside?.right+shape.width/2+16, leftX=beside?.left-shape.width/2-16,
 target=!beside?teaAnchor||light:rightX<=w-sideRoom?{x:rightX,y:beside.top+beside.height*.66}:
 leftX>=sideRoom?{x:leftX,y:beside.top+beside.height*.66}:{x:beside.left+beside.width/2,y:beside.bottom+shape.height/2+16},
 x=clamp(target.x,shape.width/2+35,w-shape.width/2-35),y=clamp(target.y,shape.height/2+80,Math.max(shape.height/2+80,h-(w<=700?230:100)-shape.height/2));f.frame={id:'83',age:'83',x,y,z:f.z,reference,foreground:true,since:f.since};f.rect={left:x-shape.width/2,right:x+shape.width/2,top:y-shape.height/2,bottom:y+shape.height/2,width:shape.width,height:shape.height};if (!beside && phase==='sit' && !teaAnchor) teaAnchor={x,y};
 warmth.style.background='radial-gradient(circle 145px at '+x+'px '+y+'px, rgba(255,183,96,.25), transparent 75%)';
 warmth.style.opacity=black?0:clamp(attentionTime/attentionWait,0,1)*(1-fade);
 f.looked=!black;f.lucid=phase!=='fade';document.body.classList.toggle('ending-black',black);if(phase==='fade'){f.speechPhase='hold';f.chars=fade<.75?Math.ceil(f.version.length*(1-fade/.75)):0;showWords(f);speech.hidden=false;speech.classList.toggle('dispersing',fade>.75);speechPosition(f);}else updateSpeech(f,dt,true);if(black)speech.hidden=true;lightVeil(black?0:260*(1-fade),light.x,light.y,clarityMix,0,black);draw(black?[]:[f.frame],0,1-fade);}
let debugPanel=null;
function updateDebugPanel(){if(!debugPanel)return;const phases={gather:'收拢',arrival:'最后一件物品',sit:'等待坐下',response:'她的回应',fade:'褪去',black:'黑暗',invitation:'邀请',stay:'停留'};debugPanel.querySelector('[data-debug-state]').textContent=!entered?'门口':endingStage!=='explore'?'结尾 · '+phases[endingStage]:active?.lucid||visitor.lucid?'清醒':'混乱';const status=window.MemoryObject3D?.status();debugPanel.querySelector('[data-debug-models]').textContent=status?`模型 ${status.loaded}/8 · 当前 ${status.active||'—'} · 加载 ${status.loading||'—'} · 失败 ${status.failed.join(',')||'无'} · 背景 ${status.background}`:'';const body=window.VisitorSilhouette?.status();debugPanel.querySelector('[data-debug-body]').textContent=body?.mode==='camera'?(body.detected?'检测到人':'未检测到人'):body?.loading?'模型加载中':body?.mode==='unavailable'?'摄像头或分割不可用 · 通用轮廓':'未使用摄像头 · 通用轮廓';debugPanel.querySelector('[data-debug-visitor-stage]').textContent=visitor.stage;const pose=window.VisitorPosture?.status(),namesPose={standing:'站着',sitting:'坐着',unknown:'未知'};debugPanel.querySelector('[data-posture-state]').textContent=(pose?.mode==='simulation'?'模拟 · ':'')+(namesPose[pose?.posture]||'未知')+(pose?.candidate?' · 正在确认 '+(namesPose[pose.candidate])+' '+Math.round(pose.pending*100)+'%':'');const m=pose?.metrics;debugPanel.querySelector('[data-posture-values]').textContent=m?`髋 Y ${m.hip.toFixed(1)}px · 膝 Y ${m.knee.toFixed(1)}px · 比值 ${m.ratio.toFixed(2)} · 置信度 ${m.confidence.toFixed(2)}`:'髋 Y — · 膝 Y — · 比值 —';debugPanel.querySelector('[data-posture-reason]').textContent=pose?.reason||'未启用摄像头';debugPanel.querySelector('[data-posture-threshold-value]').textContent=(pose?.threshold??.45).toFixed(2);debugPanel.querySelector('[data-posture-simulate]').textContent=pose?.mode==='simulation'?'结束模拟':'模拟坐下';const level=confusion;debugPanel.querySelector('output[for="debug-chaos"]').textContent=level.toFixed(2);debugPanel.querySelector('#debug-chaos').value=level;const errors=active?.errors||{},names=Object.entries(errors).filter(([,on])=>on).map(([kind])=>ERROR_NAMES[kind]+(kind==='morph'?' '+active.age+'→'+active.errorTarget[0]:''));debugPanel.querySelector('[data-debug-errors]').textContent=(active?.lucid?'清醒覆盖 · ':'')+(names.join(' / ')||'暂无出错');}
function debugClarity(){if(!entered||endingStage!=='explore')return;begin();if(visitor.hover&&!active){visitor.lucid=true;visitor.lucidUntil=time+30;previousClarity=false;nextLucid=time+40;return;}if(!active)select(memories.find(f=>f.age===debugPanel.querySelector('[data-debug-age]').value)||memories[0]);active.lucid=true;active.lucidUntil=time+30;active.version=active.text;active.chars=0;active.speechPhase='waiting';prepareWords(active);previousClarity=false;nextLucid=time+40;updateDebugPanel();}
if(debugEnabled){debugPanel=document.createElement('aside');debugPanel.id='debug-panel';debugPanel.lang='zh-CN';debugPanel.setAttribute('aria-label','调试面板');debugPanel.innerHTML=`<strong>Debug</strong><div>当前状态：<span data-debug-state>混乱</span></div><label for="debug-chaos">混乱程度 <output for="debug-chaos">0.00</output></label><input id="debug-chaos" type="range" min="0" max="1" step="0.01" value="0"><div>当前出错：<span data-debug-errors>暂无出错</span></div><label>强制出错 <select data-debug-error aria-label="强制出错方式"><option value="auto">自动（按概率）</option><option value="language">话说不完整</option><option value="dissolve">物件不完整</option><option value="era">年代错位</option><option value="mismatch">认错东西</option><option value="morph">物件变成另一样</option></select></label><div class="debug-actions"><button type="button" data-debug-clarity>触发清醒</button><button type="button" data-debug-ending>触发结尾</button><label>物件 <select data-debug-age aria-label="物件年龄"><option>06</option><option>11</option><option>17</option><option>24</option><option>36</option><option>52</option><option>68</option></select></label><button type="button" data-debug-object>查看物件</button><div data-debug-models></div><button type="button" data-debug-reset>重置到开场</button></div><div>身体检测：<span data-debug-body></span></div><div>她对访客：<span data-debug-visitor-stage></span></div><button type="button" data-debug-visitor>立即显示身影</button><hr><div>站坐检测：<span data-posture-state>未知</span></div><div data-posture-values></div><div data-posture-reason></div><label for="posture-threshold">坐姿阈值 <output data-posture-threshold-value>0.45</output></label><input id="posture-threshold" type="range" min="0.15" max="0.85" step="0.01" value="0.45"><small>比值 =（膝 Y − 髋 Y）/ 躯干长度。越小越接近坐姿。</small><button type="button" data-posture-simulate>模拟坐下</button>`;document.body.append(debugPanel);debugPanel.querySelector('#posture-threshold').oninput=e=>window.VisitorPosture?.setThreshold(e.target.value);debugPanel.querySelector('[data-posture-simulate]').onclick=()=>{window.VisitorPosture?.simulateSit();updateDebugPanel();};debugPanel.querySelector('#debug-chaos').oninput=e=>{confusion=clamp(Number(e.target.value),0,1);confusionManual=true;updateDebugPanel()};debugPanel.querySelector('[data-debug-error]').onchange=e=>{forcedError=e.target.value;if(!entered||endingStage!=='explore')return;begin();if(!active){const f=memories.find(f=>f.age===debugPanel.querySelector('[data-debug-age]').value);pointer.x=light.x=w/2;pointer.y=light.y=h*(w<=700?.35:.5);select(f);}active.lucid=false;previousClarity=false;nextLucid=time+25;active.morphProgress=0;updateErrors(active,.05);updateDebugPanel();};debugPanel.querySelector('[data-debug-clarity]').onclick=debugClarity;debugPanel.querySelector('[data-debug-ending]').onclick=()=>{if(!entered||endingStage!=='explore')return;document.querySelectorAll('dialog[open]').forEach(d=>d.close());begin();releaseMemory();endingPending=false;endingPhase('gather');};debugPanel.querySelector('[data-debug-object]').onclick=()=>{if(!entered||endingStage!=='explore')return;begin();const f=memories.find(f=>f.age===debugPanel.querySelector('[data-debug-age]').value);pointer.x=light.x=w/2;pointer.y=light.y=h*(w<=700?.35:.5);select(f);f.lucid=false;nextLucid=time+25;};debugPanel.querySelector('[data-debug-visitor]').onclick=()=>{if(!entered||endingStage!=='explore')return;begin();releaseMemory();showVisitor({x:w*.35,y:h*.4});visitor.x=w/2;visitor.y=h*.4;pointer.x=light.x=visitor.x;pointer.y=light.y=visitor.y;};debugPanel.querySelector('[data-debug-reset]').onclick=()=>location.reload();updateDebugPanel();}
