/* Pure game rules: camera-relative movement, generous combat, and mission gates. */
export const SAVE_KEY='suwen-ion-garden-3d-v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function segmentDistance(ax,ay,az,bx,by,bz,p){const dx=bx-ax,dy=by-ay,dz=bz-az,l=dx*dx+dy*dy+dz*dz;const t=l?clamp(((p.x-ax)*dx+(p.y-ay)*dy+(p.z-az)*dz)/l,0,1):0;return Math.hypot(ax+dx*t-p.x,ay+dy*t-p.y,az+dz*t-p.z);}
export class Adventure {
 constructor(regions,saved={}){
  this.regions=regions;this.cleared=new Set(Array.isArray(saved.cleared)?saved.cleared.filter(id=>regions.some(r=>r.id===id)):[]);
  this.player={x:0,y:0,z:26,vx:0,vz:0,vy:0,yaw:Math.PI,health:5,invulnerable:0,dash:0,dashCooldown:0,respawn:0};
  this.quests=regions.map((r,i)=>({phase:this.cleared.has(r.id)?'complete':'collect',cores:new Set(this.cleared.has(r.id)?[0,1,2]:[]),drones:Array.from({length:r.drones},(_,j)=>({hp:this.cleared.has(r.id)?0:2,x:r.x+Math.cos(j*2.5)*4,y:1.2,z:r.z+Math.sin(j*2.5)*4,cooldown:1.4+j*.6})),boss:{x:r.x,y:1.8,z:r.z,hp:this.cleared.has(r.id)?0:r.bossHP,cooldown:1.6,flash:0,charge:0,dx:0,dz:0}}));
  this.active=-1;this.time=0;this.projectiles=[];this.rings=[];this.events=[];this.serial=0;this.fireCooldown=0;this.regen=0;this.shots=0;this.hits=0;
  this.obstacles=regions.map(r=>({x:r.x,z:r.z-5,r:r.kind==='teaching'?1:2.3}));
 }
 snapshot(){return{cleared:[...this.cleared]};}
 get coreCount(){return this.quests.reduce((n,q)=>n+q.cores.size,0);}
 get activeRegion(){return this.active>=0?this.regions[this.active]:null;}
 get activeQuest(){return this.active>=0?this.quests[this.active]:null;}
 get nearest(){let index=0,best=Infinity;this.regions.forEach((r,i)=>{const d=dist2(this.player,r);if(d<best){best=d;index=i;}});return{index,distance:best};}
 unlocked(section){return this.regions.some(r=>r.section===section&&this.cleared.has(r.id));}
 corePosition(index,j){const r=this.regions[index],offset=[[0,4.8],[4.5,.2],[-4.3,-.5]][j];return{x:r.x+offset[0],y:1.1,z:r.z+offset[1]};}
 travel(index){const r=this.regions[index];this.player.x=r.x;this.player.z=r.z+8;this.player.y=0;this.player.vy=0;this.player.vx=this.player.vz=0;this.player.yaw=Math.PI;this.player.health=5;this.player.respawn=0;this.player.dash=0;this.player.dashCooldown=0;this.player.invulnerable=1.5;this.projectiles.length=0;this.rings.length=0;}
 activate(index){this.travel(index);this.active=index;this.events.push({type:'start',index});}
 targets(){const q=this.activeQuest;if(!q)return[];if(q.phase==='drones')return q.drones.filter(d=>d.hp>0).map((d,i)=>({p:d,radius:.7,type:'drone',id:d}));if(q.phase==='boss'&&q.boss.hp>0)return[{p:q.boss,radius:1.5,type:'boss',id:q.boss}];return[];}
 autoTarget(){if(this.player.respawn>0)return null;return this.targets().filter(t=>dist2(t.p,this.player)<23).sort((a,b)=>dist2(a.p,this.player)-dist2(b.p,this.player))[0]||null;}
 jump(){if(this.player.y<.015&&this.player.respawn<=0){this.player.vy=8.4;this.events.push({type:'jump'});}}
 dash(dx,dz){const p=this.player;if(p.dashCooldown>0||p.respawn>0)return;const l=Math.hypot(dx,dz);p.dashX=l?dx/l:Math.sin(p.yaw);p.dashZ=l?dz/l:Math.cos(p.yaw);p.dash=.22;p.dashCooldown=1.45;p.invulnerable=Math.max(p.invulnerable,.3);this.events.push({type:'dash'});}
 shoot(aim){
  if(this.fireCooldown>0||this.player.respawn>0)return;
  const player=this.player;
  const destination=aim??this.autoTarget()?.p;
  if(destination&&dist2(destination,player)>.05){
   player.yaw=Math.atan2(destination.x-player.x,destination.z-player.z);
  }
  const forwardX=Math.sin(player.yaw),forwardZ=Math.cos(player.yaw);
  const start={
   x:player.x+forwardX*.39+forwardZ*.34,
   y:player.y+1.16,
   z:player.z+forwardZ*.39-forwardX*.34
  };
  const dx=destination?destination.x-start.x:forwardX;
  const dy=destination?destination.y-start.y:0;
  const dz=destination?destination.z-start.z:forwardZ;
  const length=Math.hypot(dx,dy,dz);
  if(length<.05)return;
  const speed=32/length;
  this.projectiles.push({
   id:++this.serial,...start,vx:dx*speed,vy:dy*speed,vz:dz*speed,life:1.15,friendly:true
  });
  this.fireCooldown=.23;
  this.shots++;
  this.events.push({type:'shoot'});
 }
 enemyShot(x,y,z,angle=0,speed=4.8){const p=this.player,a=Math.atan2(p.x-x,p.z-z)+angle;this.projectiles.push({id:++this.serial,x,y,z,vx:Math.sin(a)*speed,vy:0,vz:Math.cos(a)*speed,life:4.5,friendly:false});}
 damage(){const p=this.player;if(p.invulnerable>0||p.respawn>0)return;p.health--;p.invulnerable=1.25;this.events.push({type:'hurt',health:p.health});if(p.health<=0){p.respawn=1.15;this.projectiles.length=0;this.rings.length=0;this.events.push({type:'recharge'});}}
 hit(target,bolt){if(target.p.hp<=0)return;target.p.hp--;target.p.flash=.16;this.hits++;this.events.push({type:'impact',x:bolt.x,y:bolt.y,z:bolt.z,boss:target.type==='boss'});if(target.p.hp<=0)this.events.push({type:'pop',x:target.p.x,y:target.p.y,z:target.p.z});}
 complete(){const r=this.activeRegion,q=this.activeQuest;if(!r||q.phase==='complete')return;q.phase='complete';this.cleared.add(r.id);this.player.health=5;this.projectiles.length=0;this.rings.length=0;this.events.push({type:'win',index:this.active});}
 update(dt,input={}){
  dt=clamp(dt,0,.04);this.time+=dt;this.fireCooldown=Math.max(0,this.fireCooldown-dt);const p=this.player;
  p.invulnerable=Math.max(0,p.invulnerable-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.dash=Math.max(0,p.dash-dt);
  if(p.respawn>0){p.respawn-=dt;if(p.respawn<=0){this.travel(this.active>=0?this.active:0);p.health=5;}return;}
  let dx=input.x||0,dz=input.z||0;const l=Math.hypot(dx,dz);if(l>1){dx/=l;dz/=l;}
  if(input.jump)this.jump();if(input.dash)this.dash(dx,dz);if(input.fire)this.shoot(input.aim);
  const speed=6.5;p.vx+=(dx*speed-p.vx)*(1-Math.exp(-dt*13));p.vz+=(dz*speed-p.vz)*(1-Math.exp(-dt*13));
  if(p.dash>0){p.x+=p.dashX*17*dt;p.z+=p.dashZ*17*dt;}else{p.x+=p.vx*dt;p.z+=p.vz*dt;}
  if(l>.1&&!input.fire)p.yaw=Math.atan2(dx,dz);
  p.vy-=21*dt;p.y=Math.max(0,p.y+p.vy*dt);if(p.y===0)p.vy=0;
  const radius=Math.hypot(p.x,p.z);if(radius>51){p.x*=51/radius;p.z*=51/radius;}
  for(const o of this.obstacles){const d=dist2(p,o),rr=o.r+.4;if(d<rr&&p.y<3){const a=Math.atan2(p.x-o.x,p.z-o.z);p.x=o.x+Math.sin(a)*rr;p.z=o.z+Math.cos(a)*rr;}}
  const q=this.activeQuest,r=this.activeRegion,inArena=r&&dist2(p,r)<18;
  if(q&&inArena&&q.phase!=='complete'){
   if(q.phase==='collect'){for(let j=0;j<3;j++){if(!q.cores.has(j)&&dist2(p,this.corePosition(this.active,j))<1.15&&p.y<2.7){q.cores.add(j);this.events.push({type:'core',index:this.active,core:j,number:q.cores.size});}}if(q.cores.size===3){q.phase='drones';this.events.push({type:'phase',phase:'drones'});}}
   if(q.phase==='drones'){
    q.drones.forEach((d,j)=>{if(d.hp<=0)return;const a=this.time*.55+j*Math.PI*2/r.drones;d.x=r.x+Math.cos(a)*4;d.z=r.z+Math.sin(a)*3;d.y=1.15+Math.sin(this.time*2+j)*.18;d.cooldown-=dt;d.flash=Math.max(0,(d.flash||0)-dt);if(d.cooldown<=0){this.enemyShot(d.x,.8,d.z);d.cooldown=3.3+j*.4;}});
    if(q.drones.every(d=>d.hp<=0)){q.phase='boss';this.projectiles=this.projectiles.filter(b=>b.friendly);this.events.push({type:'phase',phase:'boss'});}
   }
   if(q.phase==='boss'){
    const b=q.boss;b.flash=Math.max(0,b.flash-dt);b.y=1.75+Math.sin(this.time*1.8)*.18;b.cooldown-=dt;
    if(b.charge>0){b.charge-=dt;b.x+=b.dx*6*dt;b.z+=b.dz*6*dt;const d=dist2(b,r);if(d>6){b.x=r.x+(b.x-r.x)*6/d;b.z=r.z+(b.z-r.z)*6/d;}}
    else{b.x+=(r.x+Math.sin(this.time*.6)*1.4-b.x)*dt;b.z+=(r.z+Math.cos(this.time*.6)*1.4-b.z)*dt;}
    if(b.cooldown<=0){if(r.pattern==='pulse'){this.rings.push({id:++this.serial,x:b.x,z:b.z,time:-.9,radius:.6,hit:false});this.enemyShot(b.x,.7,b.z,0,4.2);}else if(r.pattern==='fan'){[-.27,0,.27].forEach(a=>this.enemyShot(b.x,.8,b.z,a,4.7));}else{const d=Math.max(.1,dist2(p,b));b.dx=(p.x-b.x)/d;b.dz=(p.z-b.z)/d;b.charge=.75;this.events.push({type:'warning',text:'Guardian dash — step aside!'});[-.3,.3].forEach(a=>this.enemyShot(b.x,.7,b.z,a,4));}b.cooldown=2.8;}
    if(dist2(p,b)<1.65&&p.y<1.1)this.damage();if(b.hp<=0)this.complete();
   }
  }else if(q&&q.phase!=='complete'){this.projectiles=this.projectiles.filter(b=>b.friendly);this.rings.length=0;}
  const targets=this.targets();
  for(let i=this.projectiles.length-1;i>=0;i--){const b=this.projectiles[i];if(!b)continue;const ox=b.x,oy=b.y,oz=b.z;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.life-=dt;let hit=false;
   if(b.friendly){for(const t of targets){if(t.p.hp>0&&segmentDistance(ox,oy,oz,b.x,b.y,b.z,t.p)<t.radius+.13){this.hit(t,b);hit=true;break;}}}
   else if(segmentDistance(ox,oy,oz,b.x,b.y,b.z,{x:p.x,y:p.y+.8,z:p.z})<.52){this.damage();hit=true;}
   if(hit||b.life<=0)this.projectiles.splice(i,1);
  }
  for(let i=this.rings.length-1;i>=0;i--){const ring=this.rings[i];ring.time+=dt;ring.radius=ring.time<0?.7:.7+ring.time*5.2;if(ring.time>=0&&!ring.hit&&Math.abs(dist2(p,ring)-ring.radius)<.5&&p.y<.65){this.damage();ring.hit=true;}if(ring.radius>12)this.rings.splice(i,1);}
  if(q&&q.phase==='boss'&&q.boss.hp<=0)this.complete();
  if(!q||q.phase==='complete'||q.phase==='collect'){this.regen+=dt;if(this.regen>=5){p.health=Math.min(5,p.health+1);this.regen=0;}}else this.regen=0;
 }
}
