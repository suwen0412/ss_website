import * as T from '../vendor/three.module.js';
import {SoftwareRenderer} from './garden-software.js';
/* Procedural low-poly art. All models, textures, and scenery are generated locally. */
const COLORS={grass:0xadc49a,grass2:0x94b18a,deep:0x638673,cream:0xe7e2c6,stone:0xcbceb0,wood:0x8f9b77,rose:0xc9a29a,blue:0x9eb9bd,gold:0xc8b17e,ink:0x496b58};
export class GardenWorld {
 constructor(canvas,regions){
  this.regions=regions;this.canvas=canvas;this.scene=new T.Scene();this.scene.background=new T.Color(0xdde8df);this.scene.fog=new T.FogExp2(0xdde8df,.0095);
  this.camera=new T.PerspectiveCamera(43,1,.1,220);const context=canvas.getContext('webgl2',{antialias:true,alpha:false});this.renderer=context?new T.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'high-performance'}):new SoftwareRenderer(canvas);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
  this.materials=new Map();this.geometries=new Map();this.models=[];this.bolts=new Map();this.ringModels=new Map();this.particles=[];this.look=new T.Vector3(0,1,23);this.goal=new T.Vector3();this.hasCamera=false;
  const sky=new T.HemisphereLight(0xfffbe8,0x6d9784,2.4);this.scene.add(sky);
  const sun=new T.DirectionalLight(0xffedd3,3.1);sun.position.set(-28,50,26);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-62;sun.shadow.camera.right=62;sun.shadow.camera.top=62;sun.shadow.camera.bottom=-62;sun.shadow.camera.far=150;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;this.scene.add(sun);this.scene.add(new T.AmbientLight(0xffffff,.18));
  this.makeIsland();regions.forEach((r,i)=>this.makeRegion(r,i));this.makeScenery();this.setCharacter('boy','sage');
  this.playerShadow=this.mesh(new T.CircleGeometry(.65,20),this.mat(0x526a48,{transparent:true,opacity:.16,depthWrite:false}),[0,.14,0]);this.playerShadow.rotation.x=-Math.PI/2;this.playerShadow.castShadow=false;this.playerShadow.userData.softwareLayer=-40;this.scene.add(this.playerShadow);
  this.aimRay=new T.Raycaster();
  this.aimGround=new T.Plane(new T.Vector3(0,1,0),-.05);
 }
 mat(color,options={}){const key=color+JSON.stringify(options);if(!this.materials.has(key))this.materials.set(key,new T.MeshStandardMaterial({color,roughness:.92,flatShading:true,...options}));return this.materials.get(key);}
 geo(key,make){if(!this.geometries.has(key))this.geometries.set(key,make());return this.geometries.get(key);}
 mesh(g,color,pos=[0,0,0],options={}){const m=new T.Mesh(g,typeof color==='number'?this.mat(color,options):color);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;return m;}
 box(w,h,d,color,pos=[0,0,0],opts={}){return this.mesh(this.geo(`b${w},${h},${d}`,()=>new T.BoxGeometry(w,h,d)),color,pos,opts);}
 ball(r,color,pos=[0,0,0],detail=1,opts={}){return this.mesh(this.geo(`i${r},${detail}`,()=>new T.IcosahedronGeometry(r,detail)),color,pos,opts);}
 cylinder(rt,rb,h,color,pos=[0,0,0],n=12,opts={}){return this.mesh(this.geo(`c${rt},${rb},${h},${n}`,()=>new T.CylinderGeometry(rt,rb,h,n)),color,pos,opts);}
 torus(r,t,color,n=32,s=7){return this.mesh(this.geo(`t${r},${t},${n},${s}`,()=>new T.TorusGeometry(r,t,s,n)),color);}
 rod(a,b,r,color){const v1=new T.Vector3(...a),v2=new T.Vector3(...b),d=v2.clone().sub(v1);const m=this.cylinder(r,r,d.length(),color,v1.clone().add(v2).multiplyScalar(.5).toArray(),6);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 curve(points,r,color){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return this.mesh(new T.TubeGeometry(curve,24,r,5,false),color);}
 label(title,sub='',w=6){const c=document.createElement('canvas');c.width=512;c.height=112;const x=c.getContext('2d');x.fillStyle='#f7f6e8ed';x.strokeStyle='#aaba97';x.lineWidth=2;x.beginPath();x.roundRect(2,2,508,108,19);x.fill();x.stroke();x.textAlign='center';x.fillStyle='#526d49';x.font='27px Georgia';x.fillText(title,256,49);x.font='13px Arial';x.fillStyle='#94a081';x.fillText(sub.toUpperCase(),256,79);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:tex,depthWrite:false,transparent:true}));s.scale.set(w,w*112/512,1);return s;}
 tree(x,z,size=1,color=COLORS.grass2){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(size);g.add(this.cylinder(.13,.23,2,COLORS.wood,[0,1,0],7));const leaf=this.ball(1.25,color,[0,2.75,0],1);leaf.scale.set(1.1,1.15,1);g.add(leaf);g.add(this.ball(.85,color,[-.75,2.2,.15],0));g.add(this.ball(.85,color,[.7,2.45,-.1],0));this.scene.add(g);return g;}
 bush(x,z,size=1,color=COLORS.grass2){const g=this.ball(size,color,[x,size*.55,z],0);g.scale.y=.68;this.scene.add(g);}
 flower(x,z,color=0xddc798){const g=new T.Group();g.position.set(x,0,z);g.add(this.cylinder(.025,.025,.65,0x809a70,[0,.3,0],5));for(let i=0;i<5;i++){const a=i*6.28/5;g.add(this.ball(.13,color,[Math.sin(a)*.15,.65,Math.cos(a)*.15],0));}g.add(this.ball(.07,0xd9ba72,[0,.7,0],0));this.scene.add(g);}
 makeIsland(){
  const lower=this.cylinder(47,35,7,0x829e8b,[0,-5.7,0],45);lower.castShadow=false;this.scene.add(lower);
  const middle=this.cylinder(52,47,4,COLORS.stone,[0,-2.8,0],64);middle.castShadow=false;this.scene.add(middle);
  const soil=this.cylinder(53,52,1.1,0xc0c7a1,[0,-.5,0],64);soil.castShadow=false;this.scene.add(soil);
  const top=this.cylinder(53,53,.16,COLORS.grass,[0,-.025,0],64);top.castShadow=false;this.scene.add(top);
  const rim=this.torus(52.7,.19,0xbacd9e,80,5);rim.rotation.x=Math.PI/2;rim.position.y=-.04;this.scene.add(rim);
  const floor=this.mesh(new T.PlaneGeometry(2000,2000),0xc8ddd3,[0,-13,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.receiveShadow=false;this.scene.add(floor);
  const pathMat=this.mat(0xe1dfb9);for(const r of this.regions){const end=new T.Vector3(r.x,0.09,r.z+3);const start=new T.Vector3(0,.09,7);const mid=start.clone().lerp(end,.5);mid.x+=r.x<0?-2:2;const curve=new T.QuadraticBezierCurve3(start,mid,end);const points=curve.getPoints(30),verts=[],indices=[];for(let i=0;i<points.length;i++){const t=curve.getTangent(i/(points.length-1));const off=new T.Vector3(-t.z,0,t.x).multiplyScalar(.62);verts.push(...points[i].clone().add(off).toArray(),...points[i].clone().sub(off).toArray());if(i<points.length-1){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();const m=new T.Mesh(geo,pathMat);m.receiveShadow=true;this.scene.add(m);}
  const plaza=this.cylinder(6.3,6.3,.07,0xd6d6b2,[0,.09,7],48);plaza.castShadow=false;this.scene.add(plaza);
  this.scene.children.forEach((obj,i)=>{if(obj.isMesh)obj.userData.softwareLayer=-100+i;});
 }
 makeScenery(){
  let seed=72;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
  for(let i=0;i<65;i++){const a=rand()*Math.PI*2,r=38+rand()*12,x=Math.sin(a)*r,z=Math.cos(a)*r;if(this.regions.some(p=>Math.hypot(x-p.x,z-p.z)<8))continue;this.tree(x,z,.6+rand()*.7,[0x9bb58a,0xb7c69b,0x87a98b][i%3]);}
  for(let i=0;i<95;i++){const x=(rand()-.5)*99,z=(rand()-.5)*99;if(Math.hypot(x,z)>50||this.regions.some(p=>Math.hypot(x-p.x,z-p.z)<7))continue;if(i%3===0)this.flower(x,z,0xd3bd93);else this.bush(x,z,.25+rand()*.5,i%2?0x97b28a:0xb7c79d);}
  for(let i=0;i<18;i++){const a=i*2.399,r=62+rand()*32;const x=Math.sin(a)*r,z=Math.cos(a)*r;const rock=this.ball(2+rand()*3,0xaec6ad,[x,-7-rand()*8,z],0);rock.scale.set(1.6,.8,1.3);rock.castShadow=false;this.scene.add(rock);}
  for(let i=0;i<12;i++){const a=i*1.618,r=65+rand()*30;const g=new T.Group();g.position.set(Math.sin(a)*r,5+rand()*12,Math.cos(a)*r);for(let j=0;j<4;j++){const cloud=this.ball(2+rand()*2,0xecf0e4,[j*2-3,rand(),0],1);cloud.scale.set(1.5,.55,1);cloud.castShadow=false;g.add(cloud);}this.scene.add(g);}
  // A few floating field rings above the outer rocks.
  for(let i=0;i<4;i++){const a=i*1.6;const ring=this.torus(2.2,.025,0xbfcea9,40,4);ring.position.set(Math.sin(a)*57,7+i%2*3,Math.cos(a)*57);ring.rotation.set(.5,a,.5);ring.castShadow=false;this.scene.add(ring);}
 }
 makeRegion(r,i){
  const root=new T.Group();root.position.set(r.x,0,r.z);this.scene.add(root);
  const pad=this.cylinder(6.6,6.8,.11,0xc7d1ab,[0,.05,0],32);pad.castShadow=false;pad.userData.softwareLayer=-50;root.add(pad);
  const ring=this.torus(6.6,.045,0xe4dfae,64,5);ring.rotation.x=Math.PI/2;ring.position.y=.13;ring.userData.softwareLayer=-49;root.add(ring);
  const building=new T.Group();building.position.z=-5;root.add(building);this.buildLandmark(building,r.kind,r.color);
  const gate=new T.Group();gate.position.set(0,0,1);root.add(gate);
  const arch=this.mesh(new T.TorusGeometry(1.65,.11,6,36,Math.PI),this.mat(0xc6b68b));arch.position.y=1.1;gate.add(arch);[-1,1].forEach(s=>{gate.add(this.cylinder(.11,.15,1.1,0xb3ae86,[s*1.65,.56,0],8));gate.add(this.ball(.15,0xdfc986,[s*1.65,1.08,0],1));});
  const door=this.mesh(new T.CircleGeometry(1.5,32),this.mat(0xded6a0,{transparent:true,opacity:.14,side:T.DoubleSide,depthWrite:false}),[0,1.35,0]);gate.add(door);
  const base=this.cylinder(1.9,2,.13,0xe0d9b5,[0,.16,1],32);base.userData.softwareLayer=-49;root.add(base);
  const marker=this.ball(.18,0xe6d799,[0,3.1,1],0,{emissive:0x9c8936,emissiveIntensity:.3});root.add(marker);
  const label=this.label(r.name,`${String(i).padStart(2,'0')} · ${r.nav}`);label.position.set(0,6.8,-5);root.add(label);
  const cores=[];for(let j=0;j<3;j++){const position=[[0,4.8],[4.5,.2],[-4.3,-.5]][j];const g=new T.Group();g.position.set(position[0],1.1,position[1]);const gem=this.mesh(new T.OctahedronGeometry(.31,0),this.mat(0xe7cf83,{emissive:0xdab651,emissiveIntensity:.3}));g.add(gem);const orbit=this.torus(.49,.019,0xf3e2a1,24,4);orbit.rotation.x=.7;g.add(orbit);const beam=this.cylinder(.035,.035,1.05,0xe9db9e,[0,-.5,0],5,{transparent:true,opacity:.3});beam.castShadow=false;g.add(beam);root.add(g);cores.push(g);}
  const droneModels=Array.from({length:r.drones},()=>{const m=this.makeDrone(r.color);this.scene.add(m);return m;});const boss=this.makeBoss(r);this.scene.add(boss);boss.visible=false;
  const trees=[[-7,-3,.85],[7,-4,1.1]];trees.forEach(p=>this.tree(r.x+p[0],r.z+p[1],p[2],i%2?0x9db390:0xb5c397));for(let j=0;j<4;j++)this.flower(r.x-5+j*.5,r.z+6,i%2?0xd8b5ad:0xe0cd9c);
  this.models.push({root,arch,door,marker,label,cores,droneModels,boss,ring});
 }
 buildLandmark(g,kind,color){
  const c=COLORS;
  if(kind==='arrival'){
   g.add(this.cylinder(3.5,3.7,.35,c.cream,[0,.2,0],32));
   const dome=this.mesh(new T.SphereGeometry(3.35,22,12,0,Math.PI*2,0,Math.PI/2),this.mat(0xaec9b4,{transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false}),[0,.4,0]);dome.castShadow=false;g.add(dome);
   for(let a=0;a<Math.PI*2;a+=Math.PI/4){const points=[];for(let j=0;j<=14;j++){const t=j/14*Math.PI/2;points.push([Math.cos(a)*Math.cos(t)*3.37,.4+Math.sin(t)*3.37,Math.sin(a)*Math.cos(t)*3.37]);}g.add(this.curve(points,.035,0x88a98a));}
   for(const h of [1.3,2.5]){const rr=Math.sqrt(3.35*3.35-(h-.4)*(h-.4));const t=this.torus(rr,.035,0x8eac8c,36,5);t.rotation.x=Math.PI/2;t.position.y=h;g.add(t);}
   g.add(this.cylinder(.055,.055,1,c.gold,[0,4.2,0],7));g.add(this.ball(.18,c.gold,[0,4.8,0],1));
   g.add(this.cylinder(.45,.55,.55,c.wood,[-1.4,.5,.5],8));g.add(this.ball(.7,0x9ab584,[-1.4,1.3,.5],1));
  }else if(kind==='geometry'){
   g.add(this.cylinder(2.6,2.9,.35,c.stone,[0,.2,0],16));
   for(let i=0;i<3;i++){const tube=new T.Group();tube.position.set((i-1)*1.7,.4,i===1?-1:0);tube.rotation.z=(i-1)*-.15;const h=i===1?6.5:4.3;const glass=this.cylinder(1,.08,h,this.mat(0xb2d5cc,{transparent:true,opacity:.38,side:T.DoubleSide,depthWrite:false}),[0,h/2,0],12);g.add(tube);tube.add(glass);const rim=this.torus(1,.045,0x89b3a3,24,5);rim.rotation.x=Math.PI/2;rim.position.y=h;tube.add(rim);for(let j=0;j<5;j++)tube.add(this.ball(.09,j%2?c.rose:c.blue,[(j%2-.5)*.4,.6+j*h/6,0],1));}
  }else if(kind==='circuits'){
   for(let i=-1;i<=1;i++){g.add(this.cylinder(.65,.9,1.7,c.stone,[i*2,1,0],10));const loop=this.torus(.9,.15,c.gold,28,7);loop.position.set(i*2,2.2,0);g.add(loop);g.add(this.ball(.27,0xe4d495,[i*2,3.3,0],1));}
   g.add(this.curve([[-2,3.5,0],[-1.5,5.2,-.3],[0,3.9,0],[1.5,5.2,-.3],[2,3.5,0]],.08,c.gold));g.add(this.box(6,.25,1.7,c.cream,[0,.25,0]));
  }else if(kind==='polymer'){
   g.add(this.cylinder(2.6,3,.35,0xb5bf9e,[0,.2,0],16));
   for(let side=-1;side<=1;side++){const h=side===0?4.6:3.4;const p=side*1.4;g.add(this.rod([p,.3,0],[p*.7,h,0],.16,0xa58d81));for(let j=0;j<6;j++){const a=j*2.4,hh=.8+j*h/7;const end=[p+Math.sin(a)*1.1,hh+.7,Math.cos(a)*.7];g.add(this.rod([p,hh,0],end,.07,0xab9487));const blossom=this.ball(.55,j%2?0xc7a0a3:0xb3bc96,end,0);blossom.scale.set(1,.6,.8);g.add(blossom);}}
   const ca=this.label('Ca²⁺','chemical memory',2.3);ca.position.set(2,4.4,.5);g.add(ca);
  }else if(kind==='archive'){
   g.add(this.box(5.5,4.2,1.4,0xc9cbaa,[0,2.2,0]));g.add(this.box(5,3.7,.2,0x7c9b80,[0,2.3,.8]));for(let row=0;row<4;row++){g.add(this.box(5.4,.13,1.7,c.cream,[0,.65+row,0]));for(let j=0;j<12;j++){const h=.5+((j*7+row*5)%4)*.08;g.add(this.box(.27,h,.55,[c.rose,c.gold,c.blue,0xafbd97][(j+row)%4],[-2.2+j*.4,.75+row+h/2,.95]));}}
   const roof=this.cylinder(.1,3.7,1.7,0x9aaf86,[0,5,0],4);roof.rotation.y=Math.PI/4;g.add(roof);const a=this.box(1.3,.1,1.8,c.cream,[-.6,6,0]);a.rotation.z=-.18;g.add(a);const b=this.box(1.3,.1,1.8,c.cream,[.6,6,0]);b.rotation.z=.18;g.add(b);
  }else if(kind==='teaching'){
   g.add(this.cylinder(.4,.7,4,c.wood,[0,2,0],9));[-1,1].forEach(s=>{g.add(this.rod([0,2,0],[s*1.6,3.9,0],.2,c.wood));g.add(this.ball(1.8,s>0?0xa9bb94:0xb5c79b,[s*1.4,4.8,0],1));});g.add(this.ball(2,0xb8c99b,[0,5.3,-.4],1));g.add(this.box(2.9,1.8,.16,c.wood,[2,1.6,2]));g.add(this.box(2.6,1.5,.17,0x557b66,[2,1.6,2.02]));const board=this.label('ask · try · discover','chemistry + curiosity',2.5);board.position.set(2,1.65,2.15);g.add(board);g.add(this.rod([.9,0,2],[1.2,1.1,2],.08,c.wood));g.add(this.rod([3.1,0,2],[2.8,1.1,2],.08,c.wood));
  }else if(kind==='news'){
   for(const x of [-1,1])for(const z of [-1,1])g.add(this.rod([x*1.2,.1,z*1.2],[x*.5,5,z*.5],.09,c.wood));
   for(let h=1;h<5;h++){g.add(this.rod([-1,h,1],[1,h+1,1],.04,c.wood));g.add(this.rod([1,h,1],[-1,h+1,1],.04,c.wood));}
   g.add(this.cylinder(1.1,1.1,.2,c.cream,[0,5,0],12));const dish=this.mesh(new T.SphereGeometry(1.65,18,10,0,Math.PI*2,0,.55*Math.PI),this.mat(c.gold,{side:T.DoubleSide}),[0,5.8,0]);dish.rotation.z=.7;g.add(dish);g.add(this.rod([0,5.8,0],[-1.4,7.3,0],.05,c.ink));g.add(this.ball(.14,0xe8d7a5,[-1.4,7.3,0],1));
  }else if(kind==='toolkit'){
   g.add(this.box(6,.25,3.8,c.cream,[0,.2,0]));const glass=this.box(5.5,3.4,3.2,this.mat(0xb6d0b9,{transparent:true,opacity:.3,depthWrite:false}),[0,2,0]);glass.castShadow=false;g.add(glass);
   for(const x of [-2.8,0,2.8])for(const z of [-1.65,1.65])g.add(this.rod([x,.3,z],[x,3.8,z],.055,c.wood));
   for(const z of [-1.7,1.7]){g.add(this.rod([-2.9,3.7,z],[0,5.3,z],.09,c.wood));g.add(this.rod([0,5.3,z],[2.9,3.7,z],.09,c.wood));}g.add(this.rod([0,5.3,-1.7],[0,5.3,1.7],.07,c.wood));g.add(this.box(2.5,1.6,.3,0x4e7560,[-1.1,2,1.75]));const screen=this.label('f(x) = memory','data · ideas · experiments',2.3);screen.position.set(-1.1,2,1.96);g.add(screen);for(let j=0;j<3;j++){g.add(this.cylinder(.25,.4,.7,j%2?c.gold:c.blue,[.7+j*.55,.8,.7],8));}
  }else if(kind==='contact'){
   g.add(this.cylinder(.17,.25,2.4,c.wood,[0,1.2,0],8));g.add(this.box(3,1.9,1.6,0xb8c69e,[0,3.2,0]));const roof=this.cylinder(.95,.95,3,0x9db48f,[0,4.1,0],16);roof.rotation.z=Math.PI/2;g.add(roof);g.add(this.box(2.6,1.45,.08,c.cream,[0,3.2,.85]));g.add(this.rod([-1.3,3.9,.92],[0,3.1,.92],.025,c.gold));g.add(this.rod([0,3.1,.92],[1.3,3.9,.92],.025,c.gold));g.add(this.rod([1.9,2.6,0],[1.9,4.6,0],.05,c.wood));g.add(this.box(.8,.55,.1,c.rose,[2.3,4.3,0]));
  }
 }
 makeDrone(color){const g=new T.Group();const body=this.ball(.55,color,[0,0,0],1);body.material=this.mat(color).clone();g.add(body);const eye=this.ball(.17,0xe4e7cd,[0,.02,.48],1);eye.scale.set(1.5,.65,.6);g.add(eye);const pupil=this.ball(.06,0x546a5b,[0,.02,.59],1);g.add(pupil);const ring=this.torus(.72,.045,0xc9c5a0,24,5);ring.rotation.x=.3;g.add(ring);g.userData.body=body;return g;}
 makeBoss(r){const g=new T.Group();const body=this.ball(1.15,r.color,[0,0,0],1);body.scale.y=.9;body.material=this.mat(r.color).clone();g.add(body);[-1,1].forEach(s=>{const e=this.ball(.18,0xf0e9cf,[s*.35,.13,.93],1);g.add(e);g.add(this.ball(.07,0x52695b,[s*.35,.13,1.08],1));const leg=this.cylinder(.16,.21,.4,0x8b9e84,[s*.6,-1.05,0],7);g.add(leg);});const crest=new T.Group();g.add(crest);
  if(r.kind==='polymer'){for(let j=0;j<6;j++){const a=j*Math.PI/3;const m=this.ball(.55,0xcfabb1,[Math.cos(a)*1.1,.5,Math.sin(a)*1.1],0);m.scale.set(.75,.45,1.4);crest.add(m);}}
  else if(r.kind==='archive'){for(let j=0;j<3;j++){const b=this.box(1.5,.2,1.2,j%2?0xe0d5b4:0xa7b6a0,[0,1+j*.21,0]);b.rotation.y=j*.3;crest.add(b);}}
  else if(r.kind==='geometry'){crest.add(this.cylinder(.04,.5,1.2,0xc5dfd5,[0,1.3,0],8));}
  else if(r.kind==='toolkit'){const t=this.torus(.7,.16,0xb6c4a4,12,5);t.position.y=1.2;crest.add(t);}
  else{crest.add(this.cylinder(.14,.4,.7,0xd9c28e,[0,1.15,0],6));crest.add(this.ball(.17,0xecddac,[0,1.7,0],0));}
  const orbit=this.torus(1.48,.055,0xd2c490,36,5);orbit.rotation.x=-.35;g.add(orbit);g.userData.body=body;g.userData.orbit=orbit;return g;
 }
 setCharacter(gender,color){
  if(this.playerModel)this.scene.remove(this.playerModel);const g=new T.Group(),suit={sage:0x88a68b,rose:0xbf979d,blue:0x91a5bc}[color]||0x88a68b;const skin=0xe1b695,hair=gender==='girl'?0x705b50:0x58574b;
  const torso=this.cylinder(.24,.29,.55,suit,[0,.99,0],9);g.add(torso);g.add(this.cylinder(.11,.11,.16,skin,[0,1.34,0],8));
  g.add(this.ball(.32,skin,[0,1.61,.01],2));const cap=this.ball(.337,hair,[0,1.76,-.07],1);cap.scale.y=.72;g.add(cap);const fringe=this.ball(.17,hair,[-.13,1.8,.18],1);fringe.scale.set(1.2,.6,.5);g.add(fringe);
  if(gender==='girl'){const back=this.ball(.3,hair,[0,1.48,-.2],1);back.scale.set(1.05,1.2,.7);g.add(back);g.add(this.ball(.16,hair,[.29,1.55,-.18],1));g.add(this.ball(.14,hair,[.34,1.36,-.2],1));g.add(this.ball(.06,suit,[.3,1.52,-.16],1));}
  [-1,1].forEach(s=>{g.add(this.ball(.045,0x3d5043,[s*.11,1.63,.302],1));g.add(this.ball(.045,0xdca08c,[s*.22,1.52,.24],1));});
  const mouth=this.torus(.057,.01,0x9e7560,16,4);mouth.scale.y=.45;mouth.position.set(0,1.49,.308);g.add(mouth);
  const legs=[];for(const s of [-1,1]){const limb=new T.Group();limb.position.set(s*.13,.77,0);limb.add(this.cylinder(.09,.1,.48,0x6b7f70,[0,-.24,0],7));limb.add(this.box(.22,.14,.33,0x536e5c,[0,-.53,.055]));g.add(limb);legs.push(limb);}
  const arms=[];for(const s of [-1,1]){const limb=new T.Group();limb.position.set(s*.29,1.2,0);const sleeve=this.cylinder(.09,.1,.35,suit,[0,-.15,0],7);limb.add(sleeve);limb.add(this.ball(.085,skin,[0,-.38,.025],1));g.add(limb);arms.push(limb);}
  const pack=this.box(.38,.4,.2,0xc9b888,[0,1,-.28]);g.add(pack);g.add(this.box(.12,.21,.06,0xe0d5af,[0,1,-.41]));
  const bow=new T.Group();
  bow.name='ionBow';
  bow.position.set(0,-.38,.025);
  bow.rotation.y=.42;
  const upper=[-.22,.66,-.16],lower=[-.22,-.66,-.16];
  bow.add(this.curve([lower,[-.04,-.52,-.08],[.09,-.27,.02],[.13,0,.10],[.09,.27,.02],[-.04,.52,-.08],upper],.043,0xab753d));
  bow.add(this.rod(lower,upper,.013,0xf3dfaa));
  bow.add(this.cylinder(.057,.057,.24,0x406857,[.12,0,.09],8));
  bow.add(this.ball(.063,0xe8c676,upper,1),this.ball(.063,0xe8c676,lower,1));
  arms[1].add(bow);
  g.userData.bow=bow;
  g.add(this.rod([0,1.3,.24],[0,.76,.28],.018,0xe1dfbd));
  g.userData.legs=legs;g.userData.arms=arms;g.scale.setScalar(1.15);this.playerModel=g;this.scene.add(g);
  const halo=this.torus(.48,.018,0xe5ddaa,28,4);halo.rotation.x=Math.PI/2;halo.position.y=.03;g.add(halo);
 }
 aimAt(screen,targets){
  this.aimRay.setFromCamera(new T.Vector2(2*screen.x-1,1-2*screen.y),this.camera);
  const ray=this.aimRay.ray,point=new T.Vector3(),sphere=new T.Sphere();
  let target=null,closest=Infinity;
  for(const candidate of targets){
   sphere.center.set(candidate.p.x,candidate.p.y,candidate.p.z);
   sphere.radius=candidate.radius+.13;
   const hit=ray.intersectSphere(sphere,point);
   if(hit&&ray.origin.distanceToSquared(hit)<closest){
    closest=ray.origin.distanceToSquared(hit);
    target=candidate;
   }
  }
  if(target)return{point:target.p,target};
  return{point:ray.intersectPlane(this.aimGround,point)||ray.at(45,point),target:null};
 }
 projectAim(point){
  const projected=new T.Vector3(point.x,point.y,point.z).project(this.camera);
  if(projected.z<-1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return null;
  return{x:(projected.x+1)/2,y:(1-projected.y)/2};
 }
 burst(x,y,z,color=0xe5d59b,count=14){for(let i=0;i<count;i++){if(this.particles.length>100)break;const m=this.ball(.06+(i%3)*.02,color,[x,y,z],0);m.castShadow=false;this.scene.add(m);this.particles.push({mesh:m,v:new T.Vector3(Math.sin(i*5.2)*2,1+(i%4)*.5,Math.cos(i*5.2)*2),life:.65+(i%3)*.12});}}
 resize(){const r=this.canvas.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
 render(state,view,dt,selecting=false){
  const t=state.time,p=state.player,model=this.playerModel;this.playerShadow.position.set(p.x,.14,p.z);this.playerShadow.scale.setScalar(1+p.y*.12);model.position.set(p.x,p.y,p.z);model.rotation.y=selecting?view.theta:p.yaw;const speed=Math.hypot(p.vx,p.vz);const walk=Math.sin(t*12)*Math.min(speed*.09,.55);model.userData.legs.forEach((m,i)=>m.rotation.x=(i%2?-1:1)*walk);model.userData.arms.forEach((m,i)=>m.rotation.x=(i%2?1:-1)*walk*.6);model.visible=p.invulnerable>0&&p.health<5?Math.floor(t*12)%2===0:true;
  if(selecting){model.userData.legs.forEach(m=>m.rotation.x=0);model.userData.arms.forEach(m=>m.rotation.x=.05);}
  const bowArm=model.userData.arms[1];
  bowArm.rotation.x=-1.02-(state.fireCooldown>.15?.08:0);
  model.userData.bow.rotation.x=-bowArm.rotation.x;
  model.userData.bow.rotation.z=-.18;
  for(let i=0;i<this.models.length;i++){
   const m=this.models[i],q=state.quests[i],r=this.regions[i],clear=state.cleared.has(r.id),active=state.active===i;
   m.arch.material=clear?this.mat(0x95ba7b,{emissive:0x638f47,emissiveIntensity:.2}):this.mat(0xc6b68b);m.door.material=clear?this.mat(0xb9dc9e,{transparent:true,opacity:.2,side:T.DoubleSide,depthWrite:false}):this.mat(0xded6a0,{transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false});
   m.marker.position.y=3.1+Math.sin(t*1.7+i)*.15;m.marker.rotation.y=t;m.marker.material=clear?this.mat(0xb5d694,{emissive:0x70934f,emissiveIntensity:.3}):this.mat(0xe6d799,{emissive:0x9c8936,emissiveIntensity:.3});
   m.label.visible=Math.hypot(p.x-r.x,p.z-r.z)<39;
   m.cores.forEach((c,j)=>{c.visible=active&&q.phase==='collect'&&!q.cores.has(j);c.rotation.y=t*.8+j;c.position.y=1.1+Math.sin(t*2+j)*.13;});
   m.droneModels.forEach((d,j)=>{const target=q.drones[j];d.visible=active&&q.phase==='drones'&&target.hp>0;if(d.visible){d.position.set(target.x,target.y,target.z);d.rotation.y=Math.atan2(p.x-target.x,p.z-target.z);d.userData.body.material.emissive.setHex(target.flash>0?0xe8deb0:0x000000);}});
   const b=q.boss;m.boss.visible=active&&q.phase==='boss'&&b.hp>0;if(m.boss.visible){m.boss.position.set(b.x,b.y,b.z);m.boss.rotation.y=Math.atan2(p.x-b.x,p.z-b.z);m.boss.userData.orbit.rotation.z=t*.5;m.boss.userData.body.material.emissive.setHex(b.flash>0?0xe8deb0:0x000000);}
  }
  const ids=new Set();
  for(const projectile of state.projectiles){
   ids.add(projectile.id);
   let model=this.bolts.get(projectile.id);
   if(!model){
    model=new T.Group();
    if(projectile.friendly){
     model.name='ionArrow';
     model.add(this.cylinder(.032,.032,.64,0xcba561));
     model.add(this.cylinder(0,.10,.23,0xffe7a7,[0,.41,0],6,{emissive:0xd3a64a,emissiveIntensity:.5}));
     const fletching=this.box(.21,.15,.034,0x659883,[0,-.27,0]);
     model.add(fletching);
     model.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(projectile.vx,projectile.vy,projectile.vz).normalize());
    }else{
     model.add(this.ball(.2,0xd6a0a4,[0,0,0],1,{emissive:0xa35a64,emissiveIntensity:.7}));
     model.add(this.ball(.3,0xe8b1af,[0,0,0],1,{transparent:true,opacity:.18,depthWrite:false}));
    }
    model.traverse(mesh=>{mesh.castShadow=false;});
    this.scene.add(model);
    this.bolts.set(projectile.id,model);
   }
   model.position.set(projectile.x,projectile.y,projectile.z);
  }
  for(const[id,m]of this.bolts)if(!ids.has(id)){this.scene.remove(m);this.bolts.delete(id);}
  const rings=new Set();for(const r of state.rings){rings.add(r.id);let m=this.ringModels.get(r.id);if(!m){m=this.torus(1,.025,0xdbb295,64,5);m.rotation.x=-Math.PI/2;this.scene.add(m);this.ringModels.set(r.id,m);}m.position.set(r.x,.12,r.z);m.scale.setScalar(r.radius);m.material=r.time<0?this.mat(0xe0c5a6,{transparent:true,opacity:.35,depthWrite:false}):this.mat(0xdcb09d,{emissive:0xa76d52,emissiveIntensity:.25});}
  for(const[id,m]of this.ringModels)if(!rings.has(id)){this.scene.remove(m);this.ringModels.delete(id);}
  for(let i=this.particles.length-1;i>=0;i--){const part=this.particles[i];part.life-=dt;part.mesh.position.addScaledVector(part.v,dt);part.v.y-=3*dt;part.mesh.scale.multiplyScalar(Math.max(.9,1-dt*.9));if(part.life<=0){this.scene.remove(part.mesh);this.particles.splice(i,1);}}
  const focus=new T.Vector3(p.x,selecting?1.5:1.1,p.z);this.look.lerp(focus,this.hasCamera?1-Math.exp(-dt*8):1);const dist=selecting?view.distance*.75:view.distance;this.goal.set(this.look.x+Math.sin(view.theta)*Math.cos(view.elevation)*dist,this.look.y+Math.sin(view.elevation)*dist,this.look.z+Math.cos(view.theta)*Math.cos(view.elevation)*dist);this.camera.position.lerp(this.goal,this.hasCamera?1-Math.exp(-dt*8):1);this.camera.lookAt(this.look);this.hasCamera=true;
  this.renderer.render(this.scene,this.camera);
 }
}
