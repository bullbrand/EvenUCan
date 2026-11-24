// EvenUCan 3D drawing app - 03-groups-units-camera-picking.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- Groups: faces/lines sharing a `g` value select and move as one unit and never merge with other geometry.
const groupable=()=>[...model.faces,...model.edges];
// Add every member of any group that one of these ids belongs to.
const expandGroups=function expandGroups(ids){
  const gs=new Set();for(const x of groupable())if(ids.has(x.id)&&x.g)gs.add(x.g);
  if(!gs.size)return ids;
  const out=new Set(ids);for(const x of groupable())if(x.g&&gs.has(x.g))out.add(x.id);
  return out;
};
const hasGroup=ids=>groupable().some(x=>ids.has(x.id)&&x.g);
// Move/rotate only these entities' own points, so a group stays rigid and doesn't drag touching geometry.
const xformIds=function xformIds(ids,fn){
  const m=p=>clean(fn(p));
  for(const f of model.faces)if(ids.has(f.id)){f.pts=f.pts.map(m);f.holes=f.holes.map(h=>h.map(m));delete f._tc;}
  for(const e of model.edges)if(ids.has(e.id)){e.a=m(e.a);e.b=m(e.b);}
};
const groupCount=()=>new Set(groupable().map(x=>x.g).filter(Boolean)).size;
const isPlanar=function isPlanar(pts){const n=loopNormal(pts);return len(n)>0.5&&pts.every(p=>Math.abs(dot(sub(p,pts[0]),n))<1e-5);};

// ---------------------------------------------------------------- units
const UNITS={mm:0.001,cm:0.01,m:1,in:0.0254,ft:0.3048};
const fmt=function fmt(m){
  if(units==='ft'){
    const sign=m<0?'-':'';let a=Math.abs(m)/0.0254,ft=Math.floor(a/12+1e-9),inch=Math.round((a-ft*12)*100)/100;
    if(inch>=12){ft++;inch-=12;}
    return sign+(ft?ft+"' ":'')+inch+'"';
  }
  const dp={mm:1,cm:2,m:3,in:2}[units];
  return (+(m/UNITS[units]).toFixed(dp))+(units==='in'?'"':' '+units);
};
const parseLen=function parseLen(s){
  s=s.trim();
  let m=s.match(/^(-?\d*\.?\d+)\s*'\s*(?:(\d*\.?\d+)\s*"?)?$/);
  if(m){const f=parseFloat(m[1]);return (f*12+(m[2]?parseFloat(m[2]):0)*(f<0||m[1][0]==='-'?-1:1))*0.0254;}
  m=s.match(/^(-?\d*\.?\d+)\s*(mm|cm|m|in|ft|"|')?$/i);
  if(!m)return NaN;
  const u=(m[2]||'').toLowerCase();
  const f=u==='"'?0.0254:u==="'"?0.3048:u?UNITS[u]:UNITS[units];
  return parseFloat(m[1])*f;
};

// ---------------------------------------------------------------- camera
const cam={target:[0,0,1],dist:20,yaw:-1.0,pitch:0.27,fov:35*Math.PI/180,ortho:false};
const cv=$cad('gl');
let CB=null;
const camDirty=function camDirty(){CB=null;requestDraw();};
const getCB=function getCB(){
  if(CB)return CB;
  const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  const dir=[cp*Math.cos(cam.yaw),cp*Math.sin(cam.yaw),sp];
  const eye=add(cam.target,mul(dir,cam.dist)),f=mul(dir,-1),r=[-Math.sin(cam.yaw),Math.cos(cam.yaw),0],u=cross(r,f);
  const W=cv.clientWidth||1,H=cv.clientHeight||1,th=Math.tan(cam.fov/2);
  return CB={eye,f,r,u,W,H,th,asp:W/H,hh:cam.dist*th};
};
const screenRay=function screenRay(mx,my){
  const C=getCB(),x=mx/C.W*2-1,y=1-my/C.H*2;
  if(!cam.ortho)return {o:C.eye,d:norm(add(C.f,add(mul(C.r,x*C.th*C.asp),mul(C.u,y*C.th))))};
  const o=add(C.eye,add(mul(C.r,x*C.hh*C.asp),mul(C.u,y*C.hh)));
  return {o:sub(o,mul(C.f,cam.dist*50)),d:C.f};
};
const toScreen=function toScreen(p){
  const C=getCB(),d=sub(p,C.eye),z=dot(d,C.f);let x,y;
  if(!cam.ortho){if(z<1e-6)return null;x=dot(d,C.r)/(z*C.th*C.asp);y=dot(d,C.u)/(z*C.th);}
  else{x=dot(d,C.r)/(C.hh*C.asp);y=dot(d,C.u)/C.hh;}
  return [(x+1)/2*C.W,(1-y)/2*C.H];
};
const mvp=function mvp(){
  const C=getCB(),{eye,f,r,u}=C;
  const view=[r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,eye),-dot(u,eye),dot(f,eye),1];
  // Keep the depth range snug around the scene (grid included) so small parts get full depth precision.
  const far=cam.dist*40+gridStep()*200;let proj;
  if(!cam.ortho){
    // Near cut-off from how close the camera really is to the model, so zooming in close never slices parts away.
    let near=Math.max(cam.dist/150,1e-5);
    const sb=sceneBox();
    if(sb){const q=[0,1,2].map(i=>Math.max(sb.mn[i]-eye[i],0,eye[i]-sb.mx[i]));near=Math.max(Math.min(near,len(q)*0.5),cam.dist/5000,1e-5);}
    const t=1/C.th;
    proj=[t/C.asp,0,0,0,0,t,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
  else{const hw=C.hh*C.asp;proj=[1/hw,0,0,0,0,1/C.hh,0,0,0,0,-1/far,0,0,0,0,1];}
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let rr=0;rr<4;rr++){let s=0;for(let k=0;k<4;k++)s+=proj[k*4+rr]*view[c*4+k];o[c*4+rr]=s;}
  return o;
};
const zoomAt=function zoomAt(mx,my,factor){
  const ray=screenRay(mx,my);
  let p=null;const h=pickFace(ray);
  if(h)p=h.p;else{const g=rayPlane(ray,[0,0,0],Z);if(g)p=g;}
  if(!p||dist(p,getCB().eye)>cam.dist*10)p=cam.ortho?add(ray.o,mul(ray.d,cam.dist*51)):add(ray.o,mul(ray.d,cam.dist));
  const nd=clamp(cam.dist*factor,0.0003,1e5);factor=nd/cam.dist;
  cam.target=add(p,mul(sub(cam.target,p),factor));cam.dist=nd;camDirty();
  // Keep the camera's centre point on the surface in front of it, so the next zoom steps stay in proportion.
  const C=getCB(),cr=screenRay(C.W/2,C.H/2),hc=pickFace(cr);
  if(factor<1&&hc&&!cam.ortho&&hc.t<cam.dist){cam.target=hc.p;cam.dist=Math.max(hc.t,0.0003);camDirty();}
};
const setView=function setView(v){
  const P={iso:[-1.0,0.27],top:[-Math.PI/2,Math.PI/2-1e-4],front:[-Math.PI/2,0],right:[0,0],back:[Math.PI/2,0],left:[Math.PI,0]}[v];
  cam.yaw=P[0];cam.pitch=P[1];camDirty();
};
const zoomExtents=function zoomExtents(ids){// ids: fit only these (e.g. the selection)
  const pts=[];for(const f of model.faces)if(!ids||ids.has(f.id))for(const p of f.pts)pts.push(p);for(const e of model.edges)if(!ids||ids.has(e.id))pts.push(e.a,e.b);
  if(ids)for(const g of model.guides)if(ids.has(g.id))pts.push(g.p);
  if(!pts.length){homeCam();return camDirty();}
  const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of pts)for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}
  cam.target=mul(add(mn,mx),0.5);
  const r=Math.max(dist(mn,mx)/2,0.002),C=getCB();
  cam.dist=r/Math.sin(Math.min(cam.fov/2,Math.atan(C.th*C.asp)))*1.1;camDirty();
};

// ---------------------------------------------------------------- picking & inference
const pickFace=function pickFace(ray,faces,ex){
  let best=null;
  for(const f of faces||model.faces){
    if(f.hidden||ex&&ex.has(f.id))continue;
    const n=faceNormal(f),den=dot(ray.d,n);if(Math.abs(den)<1e-9)continue;
    const t=dot(sub(f.pts[0],ray.o),n)/den;if(t<=0||(best&&t>=best.t))continue;
    const p=add(ray.o,mul(ray.d,t));if(!insideFace(f,p,false))continue;
    best={t,p,face:f};
  }
  return best;
};
const pickEdge=function pickEdge(mx,my){
  let best=null,bd=8;
  for(const e of model.edges){const a=toScreen(e.a),b=toScreen(e.b);if(!a||!b)continue;
    const d=dSeg2([mx,my],a,b);if(d<bd){bd=d;best=e;}}
  return best;
};
const pickGuide=function pickGuide(mx,my){
  let best=null,bd=8;
  for(const g of model.guides){const s=toScreen(g.p);if(!s)continue;const d=Math.hypot(s[0]-mx,s[1]-my);if(d<bd){bd=d;best=g;}}
  return best;
};
const pickEntity=function pickEntity(mx,my){const g=pickGuide(mx,my);if(g)return g.id;const e=pickEdge(mx,my);if(e)return e.id;const h=pickFace(screenRay(mx,my));return h?h.face.id:null;};
const SNAP=10;
// The corner, line end or guide point under the mouse, if any.
const cornerNear=function cornerNear(mx,my,ex){
  let best=null,bd=SNAP;
  const consider=p=>{const s=toScreen(p);if(!s)return;const d=Math.hypot(s[0]-mx,s[1]-my);if(d<bd){bd=d;best=p;}};
  for(const f of model.faces){if(f.hidden||ex&&ex.has(f.id))continue;for(const L of loops(f))L.forEach(consider);}
  for(const e of model.edges){if(ex&&ex.has(e.id))continue;consider(e.a);consider(e.b);}
  for(const g of model.guides)consider(g.p);
  return best;
};
const inferPoint=function inferPoint(mx,my,o){
  o=o||{};
  const ray=screenRay(mx,my),faces=o.faces||model.faces,ex=o.exclude;
  const fin=(p,type,extra)=>{
    const r=Object.assign({p:clean(o.plane?projPlane(p,o.plane):p),type},extra||{});
    if(!o.plane){const fh=pickFace(ray,faces,ex);if(fh&&Math.abs(dot(sub(r.p,fh.face.pts[0]),faceNormal(fh.face)))<1e-5)r.face=fh.face;}
    return r;
  };
  if(o.base&&lockAxis&&!o.plane){
    const D=AXES[lockAxis],P=cornerNear(mx,my,ex);
    // "From Point": hovering a corner while locked gives the point on the axis level with it (e.g. a post up to another part's height)
    if(P&&Math.abs(dot(sub(P,o.base),D))>1e-6)return fin(add(o.base,mul(D,dot(sub(P,o.base),D))),'axis',{axis:lockAxis,locked:true,label:'From Point',from:P});
    return fin(add(o.base,mul(D,rayLineClosest(ray.o,ray.d,o.base,D))),'axis',{axis:lockAxis,locked:true});
  }
  let best=null,bd=SNAP;
  // A corner or edge hidden behind a face can't be snapped to (as in SketchUp): otherwise the far edge of a thin post,
  // seen through it, steals the click and a rectangle meant for its side is drawn flat.
  const hidden=p=>{const s=toScreen(p);if(!s)return false;const r=screenRay(s[0],s[1]),h=pickFace(r,faces,ex);if(!h)return false;const tp=dot(sub(p,r.o),r.d);return h.t<tp-1e-6-tp*1e-4;};
  const consider=(p,type,label)=>{const s=toScreen(p);if(!s)return;const d=Math.hypot(s[0]-mx,s[1]-my);if(d<bd&&!hidden(p)){bd=d;best={p,type,label};}};
  const segs=[];
  if(!o.vertexOnly)consider([0,0,0],'endpoint');
  for(const f of faces){if(ex&&ex.has(f.id))continue;for(const L of loops(f))for(let i=0;i<L.length;i++){consider(L[i],'endpoint');segs.push([L[i],L[(i+1)%L.length]]);}}
  for(const e of model.edges){if(ex&&ex.has(e.id))continue;consider(e.a,'endpoint');consider(e.b,'endpoint');segs.push([e.a,e.b]);}
  for(const g of model.guides)consider(g.p,'guide');
  if(!o.vertexOnly)for(const c of completions())consider(c.p,'complete',c.label);
  if(o.extra){o.extra.forEach(p=>consider(p,'endpoint'));for(let i=1;i<o.extra.length;i++)segs.push([o.extra[i-1],o.extra[i]]);}
  if(best)return fin(best.p,best.type,{label:best.label});
  if(o.vertexOnly)return null;
  bd=SNAP-2;
  for(const [a,b] of segs)consider(mul(add(a,b),0.5),'midpoint');
  if(best)return fin(best.p,'midpoint');
  let eb=null;bd=7;
  for(const [a,b] of segs){
    const D=sub(b,a);if(dot(D,D)<1e-12)continue;
    const q=add(a,mul(D,clamp(rayLineClosest(ray.o,ray.d,a,D),0,1))),sp=toScreen(q);if(!sp)continue;
    const d=Math.hypot(sp[0]-mx,sp[1]-my);if(d<bd&&!hidden(q)){bd=d;eb=q;}
  }
  if(eb)return fin(eb,'edge');
  if(o.base&&!o.noAxes){
    // Snap to the red/green/blue direction by angle, as in SketchUp: the further the mouse is from the start,
    // the wider the catch, so moving roughly upwards draws straight up.
    const s0=toScreen(o.base),reach=s0?Math.hypot(mx-s0[0],my-s0[1]):0;
    let ab=null,bs=1;
    for(const name of ['x','y','z']){
      const D=AXES[name];
      if(!s0||Math.abs(dot(D,ray.d))>0.85)continue;// this axis points (nearly) at the viewer: no direction to follow on screen
      const q=add(o.base,mul(D,rayLineClosest(ray.o,ray.d,o.base,D))),sp=toScreen(q);if(!sp)continue;
      const tol=Math.max(SNAP,reach*0.2),r=Math.hypot(sp[0]-mx,sp[1]-my)/tol;
      if(r<bs&&dist(q,o.base)>1e-6){bs=r;ab={q,name};}
    }
    if(ab)return fin(ab.q,'axis',{axis:ab.name});
  }
  if(o.plane){const p=rayPlane(ray,o.plane.p,o.plane.n);return p?{p:clean(p),type:'plane'}:null;}
  const fh=pickFace(ray,faces,ex);
  if(fh)return {p:clean(fh.p),type:'face',face:fh.face};
  const gp=rayPlane(ray,o.base||[0,0,0],workPlane.n);
  return gp?{p:clean(gp),type:o.base?'plane':'ground'}:null;
};
const AXCOL={x:[0.85,0.1,0.1],y:[0.1,0.6,0.1],z:[0.1,0.25,0.95]};
const axisColor=inf=>inf&&inf.type==='axis'?AXCOL[inf.axis]:[0.1,0.1,0.1];
