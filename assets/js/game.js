import {Adventure,SAVE_KEY} from './garden-core.js';
import {regions} from './garden-content.js';
import {GardenWorld} from './garden-world.js';
const $=id=>document.getElementById(id),canvas=$('world'),stage=$('stage');
let saved={};try{const value=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');if(value&&typeof value==='object')saved=value;}catch(_){}
let character=saved.character==='girl'?'girl':'boy',jacket=['sage','rose','blue'].includes(saved.jacket)?saved.jacket:'sage';
let state=new Adventure(regions,saved),world,paused=false,selecting=false,shooting=false,dragging=false,dragX=0,dragY=0,lastFrame=performance.now(),pendingJump=false,pendingDash=false,pendingFire=false,rewardIndex=0,sound=false,audioCtx,toastTimer,hurtTimer,uiTimer=0;
const view={theta:0,elevation:.62,distance:24},keys=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sectionTitles={home:'Suwen Shi',research:'Research',publications:'Publications',teaching:'Teaching',news:'News',toolkit:'Toolkit',contact:'Contact'};
const modal=()=>document.querySelector('dialog[open]');
const blocked=()=>paused||selecting||!!modal()||document.hidden;
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({...state.snapshot(),character,jacket}));}catch(_){}}
function announce(text){$('announcement').textContent=text;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);announce(text);}
function tone(freq=600,duration=.13){if(!sound||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.15,audioCtx.currentTime+duration);g.gain.setValueAtTime(.025,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration+.1);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration+.1);}
function clearInput(){keys.clear();shooting=false;pendingJump=pendingDash=pendingFire=false;}
async function showDialog(d){clearInput();if(document.fullscreenElement)await document.exitFullscreen();if(!d.open)d.showModal();}
function closeDialog(d){if(d.open)d.close();}
for(const d of document.querySelectorAll('dialog')){d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>d.close()));d.addEventListener('close',()=>{clearInput();lastFrame=performance.now();if(!modal()&&!selecting)canvas.focus({preventScroll:true});});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});}
try{world=new GardenWorld(canvas,regions);world.setCharacter(character,jacket);world.resize();$('loading').hidden=true;canvas.dataset.renderer=world.renderer.isSoftware?'software3d':'webgl';}
catch(error){$('loading').hidden=true;$('webglError').hidden=false;canvas.dataset.renderer='unavailable';console.error('3D garden could not initialize.',error);}
if(world){new ResizeObserver(()=>world.resize()).observe(stage);}
$('year').textContent=new Date().getFullYear();
function characterUI(){document.querySelectorAll('[data-character]').forEach(b=>{const active=b.dataset.character===character;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-color]').forEach(b=>{const active=b.dataset.color===jacket;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});$('explorerLabel').textContent=character==='boy'?'Boy explorer':'Girl explorer';canvas.dataset.character=character;canvas.dataset.jacket=jacket;}
function choose(){if(!world)return;clearInput();selecting=true;$('characterOverlay').hidden=false;$('worldHeading').hidden=false;$('missionCard').hidden=true;$('vitals').hidden=true;$('interactButton').hidden=true;$('enterButton').textContent=saved.character?'Return to the garden →':'Enter the garden →';characterUI();document.querySelector(`[data-character="${character}"]`).focus({preventScroll:true});}
for(const b of document.querySelectorAll('[data-character]'))b.addEventListener('click',()=>{character=b.dataset.character;world?.setCharacter(character,jacket);characterUI();tone(420);});
for(const b of document.querySelectorAll('[data-color]'))b.addEventListener('click',()=>{jacket=b.dataset.color;world?.setCharacter(character,jacket);characterUI();});
$('enterButton').addEventListener('click',()=>{selecting=false;$('characterOverlay').hidden=true;$('missionCard').hidden=false;$('vitals').hidden=false;saved.character=character;persist();clearInput();lastFrame=performance.now();canvas.focus({preventScroll:true});updateUI();toast('Welcome, explorer. Press E at a glowing gate to start a mission.');});
$('characterButton').addEventListener('click',()=>{closeDialog(modal()||$('helpDialog'));choose();});
function travel(index){closeDialog($('mapDialog'));closeDialog($('missionDialog'));setPaused(false);state.active=-1;state.travel(index);view.theta=0;world.hasCamera=false;clearInput();updateUI();canvas.focus({preventScroll:true});announce(`Travelled to ${regions[index].name}. Press E to ${state.cleared.has(regions[index].id)?'explore':'start a mission'}.`);}
function startMission(index){closeDialog($('missionDialog'));state.activate(index);view.theta=0;world.hasCamera=false;clearInput();lastFrame=performance.now();updateUI();toast(`Mission started: ${regions[index].name}. Collect the three golden cores.`);}
function openBrief(index){
 const r=regions[index],q=state.quests[index],clear=state.cleared.has(r.id);
 $('briefTag').textContent=clear?`UNLOCKED · ${r.tag}`:`MISSION ${String(index+1).padStart(2,'0')} · ${r.nav.toUpperCase()}`;$('briefTitle').textContent=r.name;
 $('briefContent').innerHTML=clear?`<div class="brief-emblem">✧</div><p class="brief-copy">${r.intro}</p><p class="brief-body">${r.body}</p>${r.status?`<p class="brief-status">${r.status}</p>`:''}${r.id==='toolkit'?'<div class="tool-shortcuts"><button data-tool="converter" type="button">DTA → Excel</button><button data-tool="tool2.html" type="button">Equation visualizer ↗</button><button data-tool="tool3.html" type="button">Time-series plotter ↗</button></div>':''}<div class="brief-actions"><button id="briefAction" class="dark-button" type="button">${r.action} ↗</button><button id="briefReturn" class="text-button" type="button">Keep exploring →</button></div>`:`<div class="brief-emblem">${String(index+1).padStart(2,'0')}</div><p class="brief-copy">A little chaos is hiding a good story.</p><p class="brief-body">Restore the signal at ${r.name} to unlock ${r.section==='research'?`research aim ${index}`:r.nav.toLowerCase()}.</p><ol class="brief-steps"><li><span>01</span> Find the three golden memory cores ${q.cores.size?`(${q.cores.size}/3 found)`:''}</li><li><span>02</span> Shoot ${r.drones} drifting noise drones</li><li><span>03</span> Defeat ${r.boss}, the mini guardian</li></ol><p class="brief-status">Unlimited ion pulses and generous auto-aim. Hold F or click to shoot. Jump over shockwaves, dash away from danger, and recharge nearby if you run out of energy.</p><div class="brief-actions"><button id="briefAction" class="dark-button" type="button">${q.cores.size||q.phase!=='collect'?'Continue':'Start'} mission →</button><button id="briefReturn" class="text-button" type="button">Wander a little longer</button></div>`;
 $('briefAction').addEventListener('click',()=>{if(clear){closeDialog($('missionDialog'));openContent(r.section);}else startMission(index);});$('briefReturn').addEventListener('click',()=>closeDialog($('missionDialog')));
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{closeDialog($('missionDialog'));openContent('toolkit',b.dataset.tool==='converter'?undefined:b.dataset.tool);}));showDialog($('missionDialog'));
}
function requestSection(section,url){if(state.unlocked(section)){openContent(section,url);return;}const index=regions.findIndex(r=>r.section===section);if(index<0)return;closeDialog($('contentDialog'));toast(`Complete ${regions[index].name} to unlock this section in Adventure mode.`);openBrief(index);}
function openContent(section,url){
 if(!state.unlocked(section)){requestSection(section);return;}
 $('contentTitle').textContent=sectionTitles[section]||'Research';$('fullPageLink').href=url||`index.html#${section}`;
 $('contentFrame').src=url||`index.html?embedded=1&adventure=3d&section=${encodeURIComponent(section)}#${section}`;showDialog($('contentDialog'));
}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('contentFrame').contentWindow||!event.data)return;const d=event.data;if(d.type==='garden-open-request')requestSection(d.section);else if(d.type==='garden-section'){if(state.unlocked(d.section)){$('contentTitle').textContent=sectionTitles[d.section];$('fullPageLink').href=`index.html#${d.section}`;}}else if(d.type==='garden-landmark'){const index=regions.findIndex(r=>r.id===d.landmark);if(index>=0){closeDialog($('contentDialog'));openBrief(index);}}});
// Keep the original tools' "Back to Toolkit" links inside the same unlock policy.
$('contentFrame').addEventListener('load',()=>{try{const doc=$('contentFrame').contentDocument;if(!doc)return;doc.addEventListener('click',event=>{if(event.defaultPrevented)return;const a=event.target.closest('a[href]');if(!a)return;const dest=new URL(a.href,location.href);if(dest.origin!==location.origin)return;if(dest.pathname.endsWith('/index.html')||dest.pathname.endsWith('/')){const section=dest.hash.slice(1)||'home';if(!Object.hasOwn(sectionTitles,section))return;event.preventDefault();requestSection(section);}else if(dest.pathname.endsWith('/game.html')){event.preventDefault();const index=regions.findIndex(r=>r.id===(dest.searchParams.get('landmark')||'home'));if(index>=0){closeDialog($('contentDialog'));openBrief(index);}}});}catch(_){}});
function openMap(){
 if(selecting)return;clearInput();$('mapGrid').innerHTML=regions.map((r,i)=>{const clear=state.cleared.has(r.id),active=state.active===i&&!clear;return`<article class="map-card ${clear?'cleared':active?'active':''}"><span class="map-num">${String(i).padStart(2,'0')}</span><span class="map-state">${clear?'✓ UNLOCKED':active?'IN PROGRESS':'◇ MISSION'}</span><h3>${r.name}</h3><p>${r.nav} · ${r.sub}</p><p class="guardian-label">Guardian · ${r.boss}</p><div class="map-card-actions"><button data-travel="${i}" type="button" aria-label="Travel to ${r.name}">Travel here ↗</button><button data-open="${i}" type="button" ${clear?'':'disabled'} aria-label="Open ${r.nav} section">${clear?'Explore section →':'Section locked'}</button></div></article>`;}).join('');
 for(const b of document.querySelectorAll('[data-travel]'))b.addEventListener('click',()=>travel(Number(b.dataset.travel)));
 for(const b of document.querySelectorAll('[data-open]'))b.addEventListener('click',()=>{closeDialog($('mapDialog'));openBrief(Number(b.dataset.open));});
 $('mapProgress').textContent=`${state.cleared.size} of 9 missions complete · Completed unlocks are saved on this device.`;$('resetConfirm').hidden=true;showDialog($('mapDialog'));
}
regions.forEach((r,i)=>{const b=document.createElement('button');b.className='journey-stop';b.type='button';b.setAttribute('aria-label',`Travel to ${r.name}, ${r.nav}`);b.title=`Travel to ${r.name}`;b.innerHTML=`<span class="stop-dot">◇</span><span class="stop-number">${String(i).padStart(2,'0')}</span><span>${r.nav}</span>`;b.addEventListener('click',()=>{if(!selecting)travel(i);});$('journeyNav').appendChild(b);});
for(const id of ['mapButton','miniMapButton','questButton','missionLogButton'])$(id).addEventListener('click',openMap);
$('helpButton').addEventListener('click',()=>{if(!selecting)showDialog($('helpDialog'));});
$('interactButton').addEventListener('click',()=>{if(!blocked()&&state.nearest.distance<9)openBrief(state.nearest.index);});
$('resetButton').addEventListener('click',()=>$('resetConfirm').hidden=false);$('cancelResetButton').addEventListener('click',()=>$('resetConfirm').hidden=true);
$('confirmResetButton').addEventListener('click',()=>{state=new Adventure(regions);persist();closeDialog($('mapDialog'));view.theta=0;world.hasCamera=false;updateUI();toast('A fresh island of possibilities. Mission progress reset.');});
$('soundButton').addEventListener('click',()=>{sound=!sound;if(sound){try{audioCtx ||= new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();tone(500);}catch(_){sound=false;}}$('soundButton').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');$('soundButton').title=sound?'Sound on':'Sound off';$('soundButton').style.opacity=sound?'1':'.55';});
function setPaused(value){paused=value;clearInput();$('pauseOverlay').hidden=!value;$('pauseButton').setAttribute('aria-label',value?'Resume adventure':'Pause adventure');lastFrame=performance.now();if(value)$('resumeButton').focus();else if(!selecting)canvas.focus({preventScroll:true});}
$('pauseButton').addEventListener('click',()=>{if(!selecting)setPaused(!paused);});$('resumeButton').addEventListener('click',()=>setPaused(false));
function resetCamera(){view.theta=0;view.elevation=.62;view.distance=24;}
$('cameraResetButton').addEventListener('click',resetCamera);
$('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch(_){toast('Fullscreen is not available here. You can keep exploring in this view.');}});
$('rewardOpenButton').addEventListener('click',()=>{closeDialog($('rewardDialog'));openContent(regions[rewardIndex].section);});$('rewardContinueButton').addEventListener('click',()=>closeDialog($('rewardDialog')));
function controlsKey(e,down){
 if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select'))return;
 const k=e.key.toLowerCase();if(!down){keys.delete(k);return;}
 if(selecting||modal())return;
 if(k==='escape'){e.preventDefault();setPaused(!paused);return;}if(k==='m'){e.preventDefault();if(!e.repeat)openMap();return;}if(paused)return;
 const ui=e.target!==canvas&&e.target!==document.body;if(ui&&[' ','enter','arrowup','arrowdown','arrowleft','arrowright'].includes(k))return;
 if(['w','a','s','d',' ','shift','f','e','q','c','r','enter','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){
  e.preventDefault();keys.add(k);if(!e.repeat){if(k===' '){pendingJump=true;lastFrame=performance.now();}if(k==='shift')pendingDash=true;if(k==='f')pendingFire=true;if((k==='e'||k==='enter')&&state.nearest.distance<9)openBrief(state.nearest.index);if(k==='r')resetCamera();}
 }
}
document.addEventListener('keydown',e=>controlsKey(e,true));document.addEventListener('keyup',e=>controlsKey(e,false));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{clearInput();lastFrame=performance.now();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(blocked())return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);if(e.button===2||e.pointerType==='touch'){dragging=true;dragX=e.clientX;dragY=e.clientY;}else if(e.button===0){shooting=true;pendingFire=true;}});
canvas.addEventListener('pointermove',e=>{if(!dragging||blocked())return;view.theta-=(e.clientX-dragX)*.007;view.elevation=Math.max(.3,Math.min(1.14,view.elevation+(e.clientY-dragY)*.004));dragX=e.clientX;dragY=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{dragging=false;shooting=false;});
canvas.addEventListener('wheel',e=>{if(blocked())return;e.preventDefault();view.distance=Math.max(12,Math.min(36,view.distance+e.deltaY*.012));},{passive:false});
for(const b of document.querySelectorAll('[data-touch]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(blocked())return;b.setPointerCapture(e.pointerId);const k=b.dataset.touch;keys.add(k);if(k===' ')pendingJump=true;if(k==='shift')pendingDash=true;if(k==='f')pendingFire=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.touch));}
function drawMap(){const c=$('miniMap'),x=c.getContext('2d'),cx=170,cy=130,k=2.1;x.clearRect(0,0,c.width,c.height);x.beginPath();x.arc(cx,cy,113,0,Math.PI*2);x.fillStyle='#dde6d1';x.fill();x.strokeStyle='#c2d0af';x.lineWidth=1.3;x.stroke();x.strokeStyle='#c4c9a6';x.lineWidth=2;for(const r of regions){x.beginPath();x.moveTo(cx,cy+7*k);x.lineTo(cx+r.x*k,cy+r.z*k);x.stroke();}for(let i=0;i<regions.length;i++){const r=regions[i],xx=cx+r.x*k,yy=cy+r.z*k,clear=state.cleared.has(r.id);if(state.active===i){x.beginPath();x.arc(xx,yy,11,0,Math.PI*2);x.strokeStyle='#b8a06b';x.lineWidth=2;x.stroke();}x.beginPath();x.arc(xx,yy,6,0,Math.PI*2);x.fillStyle=clear?'#8eaa71':'#c0b28f';x.fill();x.strokeStyle='#f3f3e6';x.lineWidth=2;x.stroke();x.fillStyle='#7c8d6b';x.textAlign='center';x.font='11px Arial';x.fillText(String(i),xx,yy-11);}const p=state.player;x.save();x.translate(cx+p.x*k,cy+p.z*k);x.rotate(-p.yaw);x.beginPath();x.moveTo(0,7);x.lineTo(-5,-5);x.lineTo(5,-5);x.closePath();x.fillStyle='#3b6447';x.fill();x.strokeStyle='#f2f1df';x.lineWidth=1.5;x.stroke();x.restore();}
function updateUI(){
 const n=state.nearest,r=regions[n.index],q=state.activeQuest,ar=state.activeRegion,clear=state.cleared.has(r.id),p=state.player;
 $('locationName').textContent=r.name;$('locationSubtitle').textContent=r.sub;$('coreCount').textContent=`${state.coreCount} / 27 cores`;$('unlockCount').textContent=`${state.cleared.size} / 9 unlocked`;$('questBadge').textContent=`${state.cleared.size}/9`;
 $('healthText').textContent=`${p.health} / 5`;$('healthPips').setAttribute('aria-label',`${p.health} of 5 energy`);[...$('healthPips').children].forEach((pip,i)=>pip.classList.toggle('empty',i>=p.health));$('dashFill').style.width=`${(1-p.dashCooldown/1.45)*100}%`;
 $('worldHeading').hidden=state.active>=0&&!selecting;$('missionCard').hidden=selecting;$('vitals').hidden=selecting;
 if(q&&q.phase!=='complete'){
  $('missionTag').textContent=`MISSION ${String(state.active+1).padStart(2,'0')} · ${ar.nav.toUpperCase()}`;$('missionTitle').textContent=ar.name;
  const phase=q.phase,done=q.drones.filter(d=>d.hp<=0).length,outside=Math.hypot(p.x-ar.x,p.z-ar.z)>18;
  $('missionDescription').textContent=outside?`Head back to ${ar.name} to continue.`:phase==='collect'?'A little energy will bring the signal back.':phase==='drones'?'A few noisy visitors. Clear a path to the guardian.':`The ${ar.boss} has appeared. Keep moving and firing!`;
  $('missionSteps').innerHTML=`<li class="${phase==='collect'?'active':'done'}">Memory cores · ${q.cores.size}/3</li><li class="${phase==='drones'?'active':phase==='boss'?'done':''}">Noise drones · ${done}/${ar.drones}</li><li class="${phase==='boss'?'active':''}">${ar.boss}</li>`;
  $('missionHint').innerHTML=phase==='collect'?'Walk into the golden cores':'Hold <kbd>F</kbd> to shoot · <kbd>space</kbd> jump · <kbd>shift</kbd> dash';
 }else{
  $('missionTag').textContent=q?'A STORY IS WAITING':'YOUR NEXT LITTLE ADVENTURE';$('missionTitle').textContent=q?'A new connection':r.name;$('missionDescription').textContent=q?'Mission complete. Step through the gate to read the story inside.':clear?'You’ve restored this landmark. Its website section is ready.':'Press E at this landmark to start a short mission.';
  $('missionSteps').innerHTML=clear||q?'<li class="done">Memory cores restored</li><li class="done">Noise drones cleared</li><li class="done">Mini guardian defeated</li>':'<li>Collect 3 memory cores</li><li>Clear the noise drones</li><li>Defeat the mini guardian</li>';$('missionHint').innerHTML=clear||q?'Press <kbd>E</kbd> to explore the unlocked story':'Walk to a landmark · Press <kbd>E</kbd>';
 }
 const boss=!!q&&q.phase==='boss'&&Math.hypot(p.x-ar.x,p.z-ar.z)<20&&!selecting;$('bossHud').hidden=!boss;if(boss){$('bossName').textContent=ar.boss;$('bossFill').style.width=`${q.boss.hp/ar.bossHP*100}%`;$('bossHint').textContent=ar.pattern==='pulse'?'Jump over the glowing shockwaves.':ar.pattern==='charge'?'Dash away when the guardian lunges.':'Keep moving between the slow pulses.';}
 const target=state.autoTarget();$('aimHint').hidden=!target||selecting||!!modal();$('aimText').textContent=target?.type==='boss'?'GUARDIAN LOCKED · HOLD F':'AUTO-AIM READY · HOLD F';
 $('interactButton').hidden=selecting||paused||!!modal()||n.distance>=9||p.respawn>0;$('interactText').textContent=clear?`Explore ${r.nav}`:`${state.active===n.index?'Continue':'Start'} ${r.name} mission`;
 document.querySelectorAll('.journey-stop').forEach((b,i)=>{const done=state.cleared.has(regions[i].id);b.classList.toggle('current',n.index===i);b.classList.toggle('cleared',done);b.querySelector('.stop-dot').textContent=done?'✓':'◇';if(n.index===i)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});
 canvas.dataset.playerX=p.x.toFixed(2);canvas.dataset.playerY=p.y.toFixed(2);canvas.dataset.playerZ=p.z.toFixed(2);canvas.dataset.health=String(p.health);canvas.dataset.activeMission=ar?.id||'';canvas.dataset.phase=q?.phase||'idle';canvas.dataset.unlocked=String(state.cleared.size);canvas.dataset.coreCount=String(state.coreCount);canvas.dataset.cameraTheta=view.theta.toFixed(2);canvas.dataset.cameraDistance=view.distance.toFixed(1);canvas.dataset.shots=String(state.shots);canvas.dataset.hits=String(state.hits);
 drawMap();
}
function processEvents(){for(const e of state.events.splice(0)){
 if(e.type==='shoot')tone(260,.04);else if(e.type==='jump')tone(330,.06);else if(e.type==='dash')tone(210,.07);else if(e.type==='core'){const point=state.corePosition(e.index,e.core);world.burst(point.x,1.2,point.z,0xe8d69d,10);tone(650+e.number*100);toast(`Memory core ${e.number}/3 recovered.`);}
 else if(e.type==='impact'){world.burst(e.x,e.y,e.z,0xe8d69d,5);tone(e.boss?300:450,.05);}
 else if(e.type==='pop'){world.burst(e.x,e.y,e.z,0xcbd8aa,20);tone(590,.12);}
 else if(e.type==='phase'){toast(e.phase==='drones'?'Cores restored. Hold F or click to clear the noise drones.':`${state.activeRegion.boss} has appeared. Hold F to fire; keep moving!`);}
 else if(e.type==='warning')announce(e.text);
 else if(e.type==='hurt'){$('hurtFlash').classList.add('visible');clearTimeout(hurtTimer);hurtTimer=setTimeout(()=>$('hurtFlash').classList.remove('visible'),250);tone(150,.15);}
 else if(e.type==='recharge')toast('A quick recharge… Your mission progress is safe.');
 else if(e.type==='win'){
  persist();rewardIndex=e.index;const r=regions[e.index];world.burst(r.x,2,r.z,0xdfe2a0,48);tone(800,.3);$('rewardTitle').textContent=`${r.nav} unlocked.`;$('rewardDescription').textContent=`You restored the signal at ${r.name} and defeated ${r.boss}. A new part of my website is ready to explore.`;$('rewardOpenButton').textContent=`Explore ${r.nav.toLowerCase()} ↗`;showDialog($('rewardDialog'));announce(`Mission complete. ${r.nav} section unlocked.`);
 }
}}
function frame(ts){const dt=Math.min(Math.max((ts-lastFrame)/1000,0),1);lastFrame=ts;if(!blocked()&&world){if(keys.has('q'))view.theta+=dt*1.25;if(keys.has('c'))view.theta-=dt*1.25;const f=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),r=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);const input={x:-Math.sin(view.theta)*f+Math.cos(view.theta)*r,z:-Math.cos(view.theta)*f-Math.sin(view.theta)*r,jump:pendingJump,dash:pendingDash,fire:pendingFire||keys.has('f')||shooting};let remaining=dt;while(remaining>0){const step=Math.min(remaining,1/90);state.update(step,input);input.jump=input.dash=false;input.fire=keys.has('f')||shooting;remaining-=step;}pendingJump=pendingDash=pendingFire=false;processEvents();}
 if(world){world.render(state,view,Math.min(dt,.1),selecting);uiTimer+=dt;if(uiTimer>.08){updateUI();uiTimer=0;}}requestAnimationFrame(frame);
}
characterUI();updateUI();const query=new URLSearchParams(location.search),initial=regions.findIndex(r=>r.id===query.get('landmark'));if(initial>=0)state.travel(initial);
if(!saved.character)choose();else if(initial>=0&&query.get('open')==='1')openBrief(initial);
if(world)requestAnimationFrame(frame);
