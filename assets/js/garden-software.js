import {Matrix4,Vector3,DoubleSide,Frustum} from '../vendor/three.module.js';
/* Perspective triangle renderer for browsers without WebGL. It draws the same
   Three.js scene and models, so the adventure remains a true 3D experience. */
export class SoftwareRenderer{
 constructor(canvas){this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('No supported graphics context.');this.shadowMap={enabled:false};this.w=1;this.h=1;this.cache=new WeakMap();this.mv=new Matrix4();this.v=new Vector3();this.isSoftware=true;}
 setPixelRatio(){}
 setSize(w,h){this.w=Math.round(w);this.h=Math.round(h);this.domElement.width=this.w;this.domElement.height=this.h;}
 geometry(g){let cached=this.cache.get(g);if(cached)return cached;const p=g.attributes.position,idx=g.index?.array,faces=[];for(let i=0;i<(idx?idx.length:p.count);i+=3)faces.push([idx?idx[i]:i,idx?idx[i+1]:i+1,idx?idx[i+2]:i+2]);cached={p:p.array,faces,count:p.count};this.cache.set(g,cached);return cached;}
 render(scene,camera){
  scene.updateMatrixWorld();camera.updateMatrixWorld();const ctx=this.ctx,w=this.w,h=this.h;
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#dce8e0');sky.addColorStop(1,'#d1e1d5');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const proj=camera.projectionMatrix.elements,fx=proj[0]*w/2,fy=proj[5]*h/2,view=camera.matrixWorldInverse,polys=[],sprites=[];
  const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,view));
  const fog=[221,232,223],light=new Vector3(-.45,.8,.4).normalize();
  scene.traverseVisible(obj=>{
   if(obj.isSprite){this.v.setFromMatrixPosition(obj.matrixWorld).applyMatrix4(view);if(this.v.z>-.5||this.v.z<-85)return;const depth=-this.v.z,sz=obj.scale;const width=fx*sz.x/depth,height=fy*sz.y/depth;sprites.push({x:w/2+fx*this.v.x/depth-width/2,y:h/2-fy*this.v.y/depth-height/2,w:width,h:height,z:this.v.z,img:obj.material.map?.image});return;}
   if(!obj.isMesh||!obj.geometry.attributes.position||Array.isArray(obj.material)||obj.material.opacity<.06)return;
   const geo=obj.geometry;if(geo.parameters?.width>1000||!frustum.intersectsObject(obj))return;
   this.v.setFromMatrixPosition(obj.matrixWorld).applyMatrix4(view);if(this.v.z<-84||this.v.z>12)return;
   const {p,faces,count}=this.geometry(geo);this.mv.multiplyMatrices(view,obj.matrixWorld);const m=this.mv.elements,mw=obj.matrixWorld.elements,pts=new Float32Array(count*3);
   for(let i=0;i<count;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2];pts[i*3]=m[0]*x+m[4]*y+m[8]*z+m[12];pts[i*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];pts[i*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
   const material=obj.material,hex=material.color?.getHex()||0xffffff,base=[hex>>16&255,hex>>8&255,hex&255],em=material.emissive?.getHex()||0;let opacity=material.transparent?material.opacity:1;
   for(const face of faces){
    const [ia,ib,ic]=face.map(i=>i*3),a=[pts[ia],pts[ia+1],pts[ia+2]],b=[pts[ib],pts[ib+1],pts[ib+2]],c=[pts[ic],pts[ic+1],pts[ic+2]];
    if(a[2]>-.12&&b[2]>-.12&&c[2]>-.12)continue;
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    if(material.side!==DoubleSide&&(uy*vz-uz*vy)*a[0]+(uz*vx-ux*vz)*a[1]+(ux*vy-uy*vx)*a[2]>=0)continue;
    let poly=[a,b,c];if(a[2]>-.12||b[2]>-.12||c[2]>-.12){const out=[];for(let i=0;i<3;i++){const v=poly[i],next=poly[(i+1)%3],inside=v[2]<=-.12,nextIn=next[2]<=-.12;if(inside)out.push(v);if(inside!==nextIn){const t=(-.12-v[2])/(next[2]-v[2]);out.push([v[0]+t*(next[0]-v[0]),v[1]+t*(next[1]-v[1]),-.12]);}}poly=out;}
    if(poly.length<3)continue;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,depth=0;const screen=[];
    for(const v of poly){const x=w/2-fx*v[0]/v[2],y=h/2+fy*v[1]/v[2];screen.push(x,y);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);depth+=v[2];}
    if(maxX<0||minX>w||maxY<0||minY>h)continue;depth/=poly.length;
    const pax=p[ia],pay=p[ia+1],paz=p[ia+2],pbx=p[ib]-pax,pby=p[ib+1]-pay,pbz=p[ib+2]-paz,pcx=p[ic]-pax,pcy=p[ic+1]-pay,pcz=p[ic+2]-paz;
    const nx=pby*pcz-pbz*pcy,ny=pbz*pcx-pbx*pcz,nz=pbx*pcy-pby*pcx;let wx=mw[0]*nx+mw[4]*ny+mw[8]*nz,wy=mw[1]*nx+mw[5]*ny+mw[9]*nz,wz=mw[2]*nx+mw[6]*ny+mw[10]*nz;const length=Math.hypot(wx,wy,wz)||1;wx/=length;wy/=length;wz/=length;
    const shade=em ? .97 : Math.max(.66,.76+Math.max(0,wx*light.x+wy*light.y+wz*light.z)*.24),f=(obj.userData.softwareLayer??10)<0 ? .035 : Math.min(.5,Math.max(0,(-depth-24)/90));
    const rgb=base.map((v,i)=>Math.round(v*shade*(1-f)+fog[i]*f));polys.push({p:screen,z:depth,c:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,a:opacity,layer:obj.userData.softwareLayer??10});
   }
  });
  polys.sort((a,b)=>a.layer-b.layer||a.z-b.z);let color='',alpha=1;
  for(const poly of polys){if(color!==poly.c){ctx.fillStyle=poly.c;color=poly.c;}if(alpha!==poly.a){ctx.globalAlpha=poly.a;alpha=poly.a;}const p=poly.p;ctx.beginPath();ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.closePath();ctx.fill();}
  ctx.globalAlpha=1;sprites.sort((a,b)=>a.z-b.z);for(const s of sprites){if(!s.img)continue;ctx.globalAlpha=Math.min(1,Math.max(0,(65+s.z)/25));ctx.drawImage(s.img,s.x,s.y,s.w,s.h);}ctx.globalAlpha=1;
 }
}
