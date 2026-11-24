// EvenUCan Enclosure Wizard - 05-box-layout.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- layout engine
// Coordinates: inside of the box, mm. x: left→right, y: front→back, z: up from the inside floor.
// Floor parts lie flat (rotated in 90° steps); wall parts (mics, speakers) press their face against a wall.
const SIDES=['xmax','ymax','xmin','ymin'];// anticlockwise
const rotSide=(s,r)=>SIDES[(SIDES.indexOf(s)+r)%4];
const ov2=(a,b,g)=>a.x0<b.x1+g&&b.x0<a.x1+g&&a.y0<b.y1+g&&b.y0<a.y1+g;
const ov3=(a,b,g,gz)=>ov2(a,b,g)&&a.z0<b.z1+gz&&b.z0<a.z1+gz;
const rdist=(a,b)=>Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.y0-b.y1,b.y0-a.y1));
const prep=function prep(inst,st){
  const p=inst.part,F=p.features||[];
  // Speakers, buzzers and piezos: always on a wall (the front wall by default), never floating in the middle of the box.
  const isSound=p.type==='speaker';
  // A saved 'floor' or 'auto' setting is ignored for sound parts: they stay on a wall (or the lid, if chosen).
  const mount=isSound?(inst.mount==='lid'?'lid':'wall'):(inst.mount!=='auto'?inst.mount:(p.mount||typeOf(p).mount));
  const o={inst,p,mount,pcb:+p.pcb||0,h:+p.h||0,below:+p.below||0,w:+p.w,d:+p.d,type:p.type};
  // Parts mounted outside the enclosure (soil probes, outdoor sensors, etc.) are wired through the box
  // but have no footprint inside it: skip them from the layout entirely.
  if(mount==='outside')return Object.assign(o,{outside:true});
  if(mount==='wall'){
    o.cone=F.some(f=>f.t==='cone');
    o.tk=o.below+o.pcb+o.h+(o.cone&&o.pcb===0?2.8:0)+(F.some(f=>f.t==='opening')&&o.pcb>0?1:0);// +1 for locating-pin tip beyond PCB
    o.floorOnly=o.cone;// heavy: sits on the floor
    o.wallPref=inst.wall!=='auto'?inst.wall:(isSound?'ymin':null);// sound parts default to the front wall
    o.portSides=[];o.ant=[];return o;
  }
  const up=F.some(f=>f.t==='header'&&f.dir==='up'),down=F.some(f=>f.t==='header'&&f.dir==='down');
  // Screw posts need to be tall enough to actually hold a screw (or a heat-set insert): styles that ask for
  // this (st.postH) raise the board on taller posts, rather than leaving the default 2 mm clearance.
  let minZb=(F.some(f=>f.t==='hole')&&st.postH)?st.postH:2;
  // (1.9.38) heat-set insert stand-offs (Box step): tall enough for the insert hole
  const BHI=wiz.inserts&&window.EvenUCanBoxHelpers;
  if(BHI&&o.pcb>0)for(const f of F)if(f.t==='hole'&&f.mount!=='peg'){const s=BHI.screwForHole(f.dia);if(s)minZb=Math.max(minZb,BHI.boardInsertDepth(s)+0.6);}
  o.zb=o.pcb>0?Math.max(o.below,minZb)+(down?st.headDown:0):o.below;
  o.top=o.zb+o.pcb+o.h+(up?st.headUp:0);
  o.portSides=[...new Set(F.filter(f=>(f.t==='port'||f.t==='switch'||f.t==='cutout')&&isEdge(f)).map(f=>f.side))];
  o.holes=F.filter(f=>f.t==='hole');
  o.ant=F.filter(f=>f.t==='antenna');
  // Room around the part for whatever holds it: corner clips for blocks, end stops for boards on rails.
  const pad={xmin:0,xmax:0,ymin:0,ymax:0};
  if(o.pcb===0)for(const s in pad)pad[s]=2;
  else if(!o.holes.length)for(const s of o.w>=o.d?['xmin','xmax']:['ymin','ymax'])pad[s]=2.2;
  for(const s of o.portSides)pad[s]=0;
  // A cut-out with "Room behind it" set (screw terminals, a row of header pins to reach...) keeps that whole
  // edge back from the wall by that much, instead of flush: the hole still opens through the wall, there's
  // just open space behind it to work in.
  for(const f of F)if(f.t==='cutout'&&f.thru==='wall'&&num(f.clear,0)>0)pad[f.side]=Math.max(pad[f.side],num(f.clear,0));
  // A part can also ask for room on an edge with no cut-out at all (e.g. a second row of screw terminals
  // that doesn't need its own hole - the wiring reaches it from inside the box): p.edgeClear:{side:mm}.
  // Unlike a cut-out's "Room behind it", this never forces that edge against a wall, so two opposite edges
  // can both ask for room without the box needing an exact size to satisfy both at once.
  if(p.edgeClear)for(const s in p.edgeClear)pad[s]=Math.max(pad[s],num(p.edgeClear[s],0));
  o.pad=pad;o.fw=o.w+pad.xmin+pad.xmax;o.fd=o.d+pad.ymin+pad.ymax;
  return o;
};
// Part point (mm from the part's own corner) → box x,y for a floor item.
const floorXY=function floorXY(it,lx,ly){
  const o=it.o,px=lx+o.pad.xmin,py=ly+o.pad.ymin;
  switch(it.rot){
    case 0:return [it.x0+px,it.y0+py];
    case 1:return [it.x0+o.fd-py,it.y0+px];
    case 2:return [it.x0+o.fw-px,it.y0+o.fd-py];
    default:return [it.x0+py,it.y0+o.fw-px];
  }
};
// Part face point (lx right and ly up, as seen from outside through the wall; n = mm into the box) → box x,y,z.
const wallXYZ=function wallXYZ(it,box,lx,ly,n){
  const L=it.o.w,z=it.z0+ly;
  switch(it.wall){
    case 'ymin':return [it.u0+lx,n,z];
    case 'ymax':return [it.u0+L-lx,box.D-n,z];
    case 'xmin':return [n,it.u0+L-lx,z];
    default:return [box.W-n,it.u0+lx,z];
  }
};
// Distance along the wall (box x for front/back, box y for left/right) of a wall part's face point.
const wallU=function wallU(it,lx){return it.wall==='ymin'||it.wall==='xmax'?it.u0+lx:it.u0+it.o.w-lx;};
const setBounds=function setBounds(it,box){
  const o=it.o;
  if(it.kind==='wall'){
    const L=o.w,tk=o.tk;let b;
    switch(it.wall){
      case 'ymin':b={x0:it.u0,x1:it.u0+L,y0:0,y1:tk};break;
      case 'ymax':b={x0:it.u0,x1:it.u0+L,y0:box.D-tk,y1:box.D};break;
      case 'xmin':b={x0:0,x1:tk,y0:it.u0,y1:it.u0+L};break;
      default:b={x0:box.W-tk,x1:box.W,y0:it.u0,y1:it.u0+L};
    }
    b.z0=it.z0;b.z1=it.z0+o.d;
    // Extend along-wall bounds to cover standoff cylinder footprints (standoff radius can
    // protrude slightly beyond the part's footprint, causing near-misses with floor items).
    for(const s of wallStandoffs(it)){
      const u=wallU(it,s.f.x);
      if(it.wall==='xmin'||it.wall==='xmax'){b.y0=Math.min(b.y0,u-s.r);b.y1=Math.max(b.y1,u+s.r);}
      else{b.x0=Math.min(b.x0,u-s.r);b.x1=Math.max(b.x1,u+s.r);}
    }
    it.b=b;it.keep=[];it.ant=[];return it;
  }
  const fw=it.rot%2?o.fd:o.fw,fd=it.rot%2?o.fw:o.fd;
  it.b={x0:it.x0,y0:it.y0,x1:it.x0+fw,y1:it.y0+fd,z0:0,z1:o.top};
  it.keep=[];it.ant=[];
  for(const f of o.ant){
    const s=rotSide(f.side,it.rot),x=f.side==='xmin'||f.side==='xmax';
    const a0=x?[f.side==='xmin'?0:o.w-f.len,f.u-f.width/2]:[f.u-f.width/2,f.side==='ymin'?0:o.d-f.len];
    const a1=x?[f.side==='xmin'?f.len:o.w,f.u+f.width/2]:[f.u+f.width/2,f.side==='ymin'?f.len:o.d];
    const p=floorXY(it,a0[0],a0[1]),q=floorXY(it,a1[0],a1[1]);
    const a={x0:Math.min(p[0],q[0]),x1:Math.max(p[0],q[0]),y0:Math.min(p[1],q[1]),y1:Math.max(p[1],q[1])};
    it.ant.push(a);
    const k=Object.assign({},a);
    if(s==='xmin')k.x0-=ANT_KEEP;else if(s==='xmax')k.x1+=ANT_KEEP;else if(s==='ymin')k.y0-=ANT_KEEP;else k.y1+=ANT_KEEP;
    it.keep.push(k);
  }
  return it;
};
const postsFor=function postsFor(box,st){
  if(st.lid!=='screws')return [];
  const P=POST,big=1e4;
  return [[0,0],[box.W-P,0],[0,box.D-P],[box.W-P,box.D-P]].map(([x,y])=>({kind:'post',b:{x0:x,y0:y,x1:x+P,y1:y+P,z0:-1,z1:big},keep:[],ant:[]}));
};
const candidates=function candidates(o,placed,box,st){
  const out=[],g=st.gap,wg=st.wallGap;
  if(o.mount==='wall'){
    const walls=['ymin','ymax','xmin','xmax'].includes(o.wallPref)?[o.wallPref]:['ymin','ymax','xmin','xmax'];
    for(const wl of walls){
      const len=wl[0]==='y'?box.W:box.D,alongX=wl[0]==='y';
      if(o.w>len-1)continue;
      const us=new Set([0.5,len-0.5-o.w,snap((len-o.w)/2)]);
      for(const q of placed){const a0=alongX?q.b.x0:q.b.y0,a1=alongX?q.b.x1:q.b.y1;us.add(a1+g);us.add(a0-g-o.w);}
      const zs=new Set([0.8]);
      if(!o.floorOnly)for(const q of placed)if(q.kind!=='post')zs.add(q.b.z1+1);
      for(const u0 of us){if(u0<0.5-1e-9||u0+o.w>len-0.5+1e-9)continue;
        for(const z0 of zs)out.push(setBounds({o,kind:'wall',wall:wl,u0,z0},box));}
    }
    return out;
  }
  for(let rot=0;rot<4;rot++){
    const fw=rot%2?o.fd:o.fw,fd=rot%2?o.fw:o.fd;
    const ps=o.portSides.map(s=>rotSide(s,rot));
    if(['xmin','xmax','ymin','ymax'].includes(o.inst.wall)&&ps.length&&ps[0]!==o.inst.wall)continue;
    // A port needing an edge already claimed by another port ON THE SAME AXIS (xmin vs xmax, or ymin vs
    // ymax - opposite sides, never both reachable by one flush edge) doesn't reject the whole placement
    // any more: the first one found wins that axis, and the loser is left "soft" - placed normally rather
    // than forced flush, with its own wall cut still made at wherever it ends up (report() already warns
    // about the resulting gap, via the same check it uses for a port someone's dragged away from a wall).
    let fxv=null,fyv=null,soft=[];
    for(const s of ps){
      const v={xmin:['x',PORT_GAP],xmax:['x',box.W-PORT_GAP-fw],ymin:['y',PORT_GAP],ymax:['y',box.D-PORT_GAP-fd]}[s];
      if(v[0]==='x'){if(fxv===null)fxv=v[1];else if(Math.abs(fxv-v[1])>0.01)soft.push(s);}
      else{if(fyv===null)fyv=v[1];else if(Math.abs(fyv-v[1])>0.01)soft.push(s);}
    }
    const xs=fxv!==null?[fxv]:[wg,box.W-wg-fw],ys=fyv!==null?[fyv]:[wg,box.D-wg-fd];
    for(const q of placed){if(fxv===null)xs.push(q.b.x1+g,q.b.x0-g-fw);if(fyv===null)ys.push(q.b.y1+g,q.b.y0-g-fd);}
    if(fxv===null)xs.push(snap((box.W-fw)/2));
    if(fyv===null)ys.push(snap((box.D-fd)/2));
    for(const x0 of new Set(xs))for(const y0 of new Set(ys))out.push(setBounds({o,kind:'floor',rot,x0,y0,soft},box));
  }
  return out;
};
const awayOK=function awayOK(a,b){
  if(!a.o||!b.o)return true;
  const ta=a.o.type,tb=b.o.type;
  for(const [p,q,d] of AWAY)if(((ta===p&&tb===q)||(ta===q&&tb===p))&&rdist(a.b,b.b)<d)return false;
  for(const A of a.ant)if(ANT_AWAY[tb]&&rdist(A,b.b)<ANT_AWAY[tb])return false;
  for(const B of b.ant)if(ANT_AWAY[ta]&&rdist(B,a.b)<ANT_AWAY[ta])return false;
  return true;
};
const valid=function valid(it,placed,box,st){
  const b=it.b,e=1e-6;
  if(b.x0<-e||b.y0<-e||b.x1>box.W+e||b.y1>box.D+e)return false;
  if(box.Hmax&&b.z1>box.Hmax+e)return false;
  if(it.kind==='floor'){
    // A "soft" side (see candidates()) isn't going to be flush, so it mustn't be held to the tight
    // port-gap margin - that would force the whole box tight against it too, defeating the point.
    const ps=new Set(it.o.portSides.map(s=>rotSide(s,it.rot)).filter(s=>!(it.soft&&it.soft.includes(s))));
    const m=s=>(ps.has(s)?PORT_GAP:st.wallGap)-1e-6;
    if(b.x0<m('xmin')||b.y0<m('ymin')||box.W-b.x1<m('xmax')||box.D-b.y1<m('ymax'))return false;
  }
  for(const q of placed){
    if(ov3(b,q.b,q.kind==='post'?0.3:q.kind==='brace'?2:st.gap-1e-6,q.kind==='brace'?2:0.8))return false;
    if(q.kind==='post'||q.kind==='brace')continue;
    for(const k of q.keep)if(ov2(b,k,0))return false;
    for(const k of it.keep)if(ov2(q.b,k,0))return false;
    if(!awayOK(it,q))return false;
  }
  return true;
};
const score=function score(it,placed,box,st){
  const b=it.b,g=st.gap+0.05,wg=Math.max(st.wallGap,PORT_GAP)+0.05;
  let contact=0;
  if(b.x0<=wg)contact+=b.y1-b.y0;if(box.W-b.x1<=wg)contact+=b.y1-b.y0;
  if(b.y0<=wg)contact+=b.x1-b.x0;if(box.D-b.y1<=wg)contact+=b.x1-b.x0;
  for(const q of placed){
    const c=q.b;if(c.z0>b.z1||b.z0>c.z1)continue;
    const oy=Math.min(b.y1,c.y1)-Math.max(b.y0,c.y0),ox=Math.min(b.x1,c.x1)-Math.max(b.x0,c.x0);
    if(oy>0&&(Math.abs(b.x0-c.x1)<=g||Math.abs(c.x0-b.x1)<=g))contact+=oy;
    if(ox>0&&(Math.abs(b.y0-c.y1)<=g||Math.abs(c.y0-b.y1)<=g))contact+=ox;
  }
  let s=-contact+(b.x0+b.y0)*0.02;
  if(it.kind==='wall'&&it.z0>1)s+=it.z0*1.5;
  const ty=it.o.type;
  for(const q of placed){
    if(!q.o)continue;const tq=q.o.type;
    for(const [a,c] of NEAR)if((ty===a&&tq===c)||(ty===c&&tq===a))s+=rdist(b,q.b)*0.6;
    if(((ty==='mic'&&tq==='speaker')||(ty==='speaker'&&tq==='mic'))&&it.wall&&it.wall===q.wall)s+=40;
  }
  return s;
};
const tryPack=function tryPack(box,order,st){
  const placed=postsFor(box,st);
  // Wall items first so their brace keep-out zones are registered before floor items are placed.
  const sortedOrder=[...order].sort((a,b)=>(a.mount==='wall'?0:1)-(b.mount==='wall'?0:1));
  for(const o of sortedOrder){
    let best=null,bs=Infinity;
    for(const it of candidates(o,placed,box,st)){
      if(!valid(it,placed,box,st))continue;
      const s=score(it,placed,box,st);if(s<bs){bs=s;best=it;}
    }
    if(!best)return null;
    placed.push(best);
    // After placing a wall item, register each standoff brace as a keep-out zone so
    // floor items are placed with ≥2 mm clearance from the 45° brace geometry.
    if(best.kind==='wall'){
      for(const s of wallStandoffs(best)){
        const u=wallU(best,s.f.x);
        const bd=Math.min(s.z+s.r+1,best.o.h);
        const zlo=Math.max(0,s.z-s.r),zhi=s.z+s.r;
        let bb;
        if(best.wall==='xmin')      bb={x0:0,        x1:bd,        y0:u-s.r,y1:u+s.r,z0:zlo,z1:zhi};
        else if(best.wall==='xmax') bb={x0:box.W-bd,  x1:box.W,     y0:u-s.r,y1:u+s.r,z0:zlo,z1:zhi};
        else if(best.wall==='ymin') bb={x0:u-s.r,     x1:u+s.r,     y0:0,     y1:bd,   z0:zlo,z1:zhi};
        else                        bb={x0:u-s.r,     x1:u+s.r,     y0:box.D-bd,y1:box.D,z0:zlo,z1:zhi};
        placed.push({kind:'brace',b:bb});
      }
    }
  }
  return placed;
};
// Inside height: tallest part + clearance, and the lid's lip must clear parts that sit close to a wall.
const heightFor=function heightFor(items,box,st){
  let top=0,nearWall=0;const m=LIP_T+LID_CLEAR+0.3;
  for(const it of items){
    if(it.kind==='post'||it.kind==='brace')continue;
    top=Math.max(top,it.b.z1);
    if(it.b.x0<m||it.b.y0<m||it.b.x1>box.W-m||it.b.y1>box.D-m)nearWall=Math.max(nearWall,it.b.z1);
  }
  let H=top+st.topClear;
  if(st.lid!=='screws')H=Math.max(H,nearWall+LIP+0.5);
  return Math.ceil(H*2)/2;
};
const finishLayout=function finishLayout(W,D,items,st){
  const L={W,D,items,st,manual:false};
  let H=heightFor(items,L,st);
  if(wiz.size==='min')H=Math.max(H,num(wiz.sH,0));
  if(wiz.size==='exact')H=num(wiz.sH,H);
  L.H=H;
  for(const it of items)if(it.kind==='floor')it.zb=raisedZb(it,H,st);
  return L;
};
const outerSize=L=>{const st=L.st,t=st.wall;return {w:L.W+2*t+(st.ears?24:0),d:L.D+2*t,h:st.floor+L.H,lid:st.floor+(st.lid==='screws'?0:LIP)};};
const autoLayout=function autoLayout(){
  const st=styleNow(),insts=instances();
  if(!insts.length)return {error:'Add some parts to put in the box.'};
  const os=insts.map(i=>prep(i,st)).filter(o=>!o.outside);
  const area=o=>o.mount==='wall'?o.w*o.tk:o.fw*o.fd;
  const pri=o=>o.mount==='wall'?0:(o.portSides.length?1:2);
  const orders=[[...os].sort((a,b)=>pri(a)-pri(b)||area(b)-area(a)),[...os].sort((a,b)=>area(b)-area(a))];
  const t=st.wall,bed=WF.bed,bedMax=Math.max(bed.x,bed.y);
  let lo=8,A0=0,longest=0;
  for(const o of os){
    if(o.mount==='wall'){A0+=o.w*o.tk;longest=Math.max(longest,o.w+1);lo=Math.max(lo,o.tk+st.wallGap);}
    else{A0+=(o.fw+st.gap)*(o.fd+st.gap);lo=Math.max(lo,Math.min(o.fw,o.fd)+2*st.wallGap);longest=Math.max(longest,Math.max(o.fw,o.fd)+2*st.wallGap);}
  }
  lo=Math.ceil(lo);
  const sizes=[];
  if(wiz.size==='exact')sizes.push([num(wiz.sW,80),num(wiz.sD,60)]);
  else{
    const hi=Math.ceil(Math.max(bedMax-2*t,longest+30,lo+40)),step=hi-lo>140?2:1;
    for(let W=lo;W<=hi;W+=step)for(let D=lo;D<=hi;D+=step){
      if(wiz.size==='min'&&(W<num(wiz.sW,0)||D<num(wiz.sD,0)))continue;
      if(W*D<A0*0.85||Math.max(W,D)<longest)continue;
      sizes.push([W,D]);
    }
    sizes.sort((a,b)=>a[0]*a[1]-b[0]*b[1]||Math.abs(a[0]-a[1])-Math.abs(b[0]-b[1]));
  }
  let best=null,firstArea=0;const t0=performance.now();
  for(const [W,D] of sizes){
    if(firstArea&&W*D>firstArea*1.25)break;
    if(performance.now()-t0>(best?1500:6000))break;
    const box={W,D,Hmax:wiz.size==='exact'?num(wiz.sH,40)-st.topClear:0};
    for(const ord of orders){
      const items=tryPack(box,ord,st);if(!items)continue;
      const L=finishLayout(W,D,items,st),os2=outerSize(L);
      let cost=os2.w*os2.d*(os2.h+os2.lid);
      if(!WF.fitsBed({size:[os2.w/1000,os2.d/1000,os2.h/1000]}))cost*=20;
      if(!best||cost<best.cost){best=L;best.cost=cost;}
      if(!firstArea)firstArea=W*D;
      break;
    }
  }
  if(!best)return {error:wiz.size==='exact'?'The parts don\'t fit in a box of that exact size. Make it bigger or choose Auto.':'Couldn\'t fit the parts together. Try another style, fewer parts, or set the mount/wall of a part to Auto.'};
  return best;
};
// Re-check a layout after the user moved parts by hand.
const revalidate=function revalidate(L){
  const st=L.st,box=L;
  for(const it of L.items)if(it.kind!=='post')setBounds(it,box);
  const posts=postsFor(box,st);L.items=[...posts,...L.items.filter(i=>i.kind!=='post')];
  const real=L.items.filter(i=>i.kind!=='post');
  for(const it of real){
    it.bad=null;it.warn=null;const b=it.b;
    if(b.x0<-0.01||b.y0<-0.01||b.x1>L.W+0.01||b.y1>L.D+0.01)it.bad='sticks out of the box';
  }
  for(let i=0;i<L.items.length;i++)for(let j=i+1;j<L.items.length;j++){
    const a=L.items[i],c=L.items[j];if(a.kind==='post'&&c.kind==='post')continue;
    const name=x=>x.kind==='post'?'a lid screw post':x.o.p.name;
    if(ov3(a.b,c.b,-0.01,0)){if(a.o)a.bad=a.bad||'overlaps '+name(c);if(c.o)c.bad=c.bad||'overlaps '+name(a);continue;}
    if(a.kind==='post'||c.kind==='post')continue;
    for(const k of a.keep)if(ov2(c.b,k,0))c.bad=c.bad||'is in the antenna\'s clear zone';
    for(const k of c.keep)if(ov2(a.b,k,0))a.bad=a.bad||'is in the antenna\'s clear zone';
    if(!awayOK(a,c)){a.warn=a.warn||'is close to '+c.o.p.name;}
  }
  L.H=heightFor(L.items,L,st);
  if(wiz.size==='min')L.H=Math.max(L.H,num(wiz.sH,0));
  if(wiz.size==='exact')L.H=num(wiz.sH,L.H);
  for(const it of real)if(it.kind==='floor')it.zb=raisedZb(it,L.H,st);
  return L;
};
// How far LEDs should stand out of the lid (the largest "Pokes out" of a part's LEDs, 0 if none).
const pokeOf=p=>Math.max(0,...(p.features||[]).filter(f=>f.t==='led').map(f=>num(f.poke,0)));
// Height of a floor part's underside once the box height H is known. Displays go right up under the lid so they show
// through their window. A part whose LEDs poke out is raised so the LED tops (its tallest point, "Tallest part on top")
// stand that far out of the lid: its posts or rails grow to match, however tall other parts make the box. It is never
// raised so far that the board itself would reach the lid.
const raisedZb=function raisedZb(it,H,st){
  const o=it.o,poke=pokeOf(o.p);
  if(poke>0)return Math.max(o.zb,Math.min(H+st.floor+poke-o.pcb-o.h,H-0.5-o.pcb));
  return o.type==='display'?Math.max(o.zb,H-0.8-o.pcb-o.h):o.zb;
};
// Wall item: lowest height it can sit at without hitting anything.
const settleWall=function settleWall(it,L){
  const others=L.items.filter(q=>q!==it);
  const zs=[0.8,...(it.o.floorOnly?[]:others.filter(q=>q.kind!=='post').map(q=>q.b.z1+1))].sort((a,b)=>a-b);
  for(const z of zs){it.z0=z;setBounds(it,L);if(!others.some(q=>ov3(it.b,q.b,0.5,0.8)))return;}
  it.z0=0.8;setBounds(it,L);
};

// What the layout does, in words: rules met (✓), warnings (!) and problems (✗).
// The standoffs of a wall part, one per mounting hole. Each sticks straight out of the wall, so it gets a 45°
// brace underneath to print without supports (cut around the part's round openings).
const wallStandoffs=function wallStandoffs(it){
  return (it.o.p.features||[]).filter(f=>f.t==='hole').map(f=>({f,r:Math.max(2,f.dia/2+1.5),z:it.z0+f.y}));
};
const report=function report(L){
  const out=[],ok=t=>out.push(['ok','✓',t]),warn=t=>out.push(['warn','!',t]),bad=t=>out.push(['bad','✗',t]);
  const os=outerSize(L),st=L.st;
  const fit=WF.fitsBed({size:[os.w/1000,os.d/1000,os.h/1000]});
  (fit?ok:bad)(`Base ${fx(os.w)} × ${fx(os.d)} × ${fx(os.h)} mm, lid ${fx(os.w)} × ${fx(os.d)} × ${fx(os.lid)} mm: ${fit?'fits':'does <b>not</b> fit'} your printer (${WF.bedText()})`);
  for(const it of L.items){
    if(!it.o)continue;const p=it.o.p,nm='<b>'+esc(p.name)+'</b>';
    if(it.bad)bad(nm+' '+esc(it.bad));
    if(it.warn)warn(nm+' '+esc(it.warn));
    if(accOf(p)==='approx')warn(nm+': its sizes are approximate (e.g. from a Fritzing picture, which is drawn for wiring diagrams): measure it and use "Check size" in the Parts Library before printing');
    else if(accOf(p)!=='measured')warn(nm+': its sizes come from a drawing or a listing, not from your own part, and makers differ a little. If you have it in your hand, measure it and compare with the Parts Library: change the sizes there if they are different, then set Sizes to Measured');
    if(it.kind==='wall'){
      const F=p.features||[];
      if(F.some(f=>f.t==='mic'))ok(nm+': sound hole through the '+SIDE_NAME[it.wall].toLowerCase()+' wall'+(it.z0>2?', '+fx(it.z0)+' mm up':''));
      else if(F.some(f=>f.t==='opening')){
        const n=F.filter(f=>f.t==='opening').length,s=it.o.pcb>0?wallStandoffs(it):[];
        ok(nm+': '+n+' round opening'+(n>1?'s':'')+' through the '+SIDE_NAME[it.wall].toLowerCase()+' wall'+(s.length?', held on '+s.length+' standoff'+(s.length>1?'s':''):''));
        if(s.length)ok(nm+': its standoffs have 45° braces underneath, so they print without supports');
      }
      else if(F.some(f=>f.t==='cone'))ok(nm+': grille in the '+SIDE_NAME[it.wall].toLowerCase()+' wall'+(F.some(f=>f.t==='hole')?', held on pegs':''));
      else ok(nm+': against the '+SIDE_NAME[it.wall].toLowerCase()+' wall');
      continue;
    }
    for(const f of (p.features||[]).filter(f=>(f.t==='port'||f.t==='cutout')&&!isEdge(f)))ok(nm+': '+esc(f.t==='cutout'?(f.shape==='rect'?'rectangular':'round')+' cut-out':(f.kind||'port'))+' opens through the '+THRU[f.thru]);
    for(const f of (p.features||[]).filter(f=>(f.t==='port'||f.t==='switch'||f.t==='cutout')&&isEdge(f))){
      const s=rotSide(f.side,it.rot),b=it.b,gap={xmin:b.x0,xmax:L.W-b.x1,ymin:b.y0,ymax:L.D-b.y1}[s];
      const soft=it.soft&&it.soft.includes(s),lbl=f.t==='switch'?'switch lever':f.t==='cutout'?'cut-out':(f.kind||'port');
      (gap<=PORT_GAP+0.6?ok:warn)(nm+': '+esc(lbl)+(gap<=PORT_GAP+0.6?' opens through the '+SIDE_NAME[s].toLowerCase()+' wall':
        soft?' is '+fx(gap)+' mm from the '+SIDE_NAME[s].toLowerCase()+' wall, with a hole cut for it there anyway: this part has ports on two sides that can\'t both sit flush, so check a cable actually reaches before you print'
        :' is '+fx(gap)+' mm from the wall, too far for a plug: drag it against the wall'));
      if(st.groove){// the gasket groove runs right round the rim, in the top ~2 mm of the wall
        const cut=f.t==='cutout',round=cut?f.shape!=='rect':ROUND_KINDS.has(f.kind);
        const ph=round?(cut?f.cw:Math.max(f.pw,f.ph)):(cut?f.ch:f.ph);
        const zTop=it.zb+it.o.pcb+f.zc+ph/2;
        const lbl=f.t==='switch'?'switch lever':f.t==='cutout'?'cut-out':(f.kind||'port');
        if(zTop>L.H-1.8)warn(nm+': this '+lbl+' reaches to within '+fx(Math.max(0,L.H-zTop))+' mm of the top of the wall, where the gasket groove runs: lower its "Centre above PCB" (or shrink it) so it stays clear, or the groove won\'t seal there');
      }
    }
    if(it.ant.length&&!it.bad)ok(nm+': antenna has '+ANT_KEEP+' mm clear in front, away from batteries and the speaker');
    if(it.o.holes&&it.o.holes.length){
      const pegs=it.o.holes.filter(h=>h.mount==='peg').length,screws=it.o.holes.length-pegs,bits=[];
      if(screws)bits.push(screws+' screw post'+(screws>1?'s':''));
      if(pegs)bits.push(pegs+' push-fit peg'+(pegs>1?'s':''));
      ok(nm+': '+bits.join(', ')+(it.zb>2?' ('+fx(it.zb)+' mm tall)':''));
    }
    else if(it.o.pcb>0)ok(nm+': sits on rails '+fx(it.zb)+' mm high'+(it.o.below>1?' (clears '+fx(it.o.below)+' mm of pins underneath)':'')+', with end stops');
    else ok(nm+': held by corner clips');
    const poke=pokeOf(p);
    if(poke>0){// LEDs through the lid: say how far they stand out, or why they can't
      const out=it.zb+it.o.pcb+it.o.h-(L.H+st.floor);
      if(out>=poke-0.05)ok(nm+': LEDs stand '+fx(out)+' mm out of the lid (raised '+fx(it.zb)+' mm off the floor)');
      else warn(nm+': its LEDs only reach '+(out>0?fx(out)+' mm out of':fx(-out)+' mm below the top of')+' the lid, not '+fx(poke)+' mm out: set "Tallest part on top" to the LEDs\' real height above the board');
    }
    for(const f of (p.features||[]).filter(f=>f.t==='button'&&(f.lid==='flex'||f.lid==='pin'))){
      const sw=it.zb+num(f.btop,it.o.pcb+1.5)-it.o.below,under=L.H+st.floor-Math.min(1.2,st.floor-0.4);
      if(f.lid==='pin'){const d=L.H+st.floor-sw;ok(nm+': 1.5 mm paper-clip hole above a button'+(d>18?' ('+fx(d)+' mm down: use a long pin)':''));}
      else if(under-(sw+0.4)>=0.5)ok(nm+': button pressed through a flex tab in the lid (post '+fx(under-(sw+0.4))+' mm long)');
      else warn(nm+': a flex button\'s switch is almost touching the lid: check its "Button top", or use a paper-clip hole');
    }
    for(const f of (p.features||[]).filter(f=>f.t==='button'&&!(f.lid==='flex'||f.lid==='pin'))){const depth=L.H-(it.zb+it.o.pcb+it.o.h);if(depth>6)warn(nm+': a button is '+fx(depth)+' mm below the lid: press it through the hole with a pin, or fit a taller button');}
  }
  if(st.headUp||st.headDown)ok('Dupont headroom: '+st.headUp+' mm above upward pins, '+st.headDown+' mm below downward pins');
  if(st.cable)ok('Cable slot in the wall for jumper wires and leads');
  ok(LIDS[st.lid]+(st.groove?', with a gasket groove in the rim':'')+(st.ears?'; mounting ears with Ø4.5 holes':''));
  const mic=L.items.find(i=>i.o&&i.o.type==='mic'),spk=L.items.find(i=>i.o&&i.o.type==='speaker');
  if(mic&&spk)(mic.wall&&mic.wall===spk.wall?warn:ok)('Microphone is '+fx(rdist(mic.b,spk.b))+' mm from the speaker'+(mic.wall&&mic.wall===spk.wall?', on the same wall':', on a different wall'));
  return '<div class="ewNote" style="margin-bottom:2px">Inside '+fx(L.W)+' × '+fx(L.D)+' × '+fx(L.H)+' mm · '+esc(st.name)+(L.manual?' · <b>arranged by hand</b> (your positions are kept; <i>Auto arrange</i> goes back to automatic)':'')+'</div><ul>'+out.map(([c,i,t])=>`<li class="${c}"><span class="ic">${i}</span><span style="color:var(--text)">${t}</span></li>`).join('')+'</ul>';
};
