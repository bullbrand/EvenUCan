// ---------------------------------------------------------------- layout engine
// Coordinates: inside of the box, mm. x: left→right, y: front→back, z: up from the inside floor.
// Floor parts lie flat (rotated in 90° steps); wall parts (mics, speakers) press their face against a wall.
const SIDES=['xmax','ymax','xmin','ymin'];// anticlockwise
const rotSide=(s,r)=>SIDES[(SIDES.indexOf(s)+r)%4];
const ov2=(a,b,g)=>a.x0<b.x1+g&&b.x0<a.x1+g&&a.y0<b.y1+g&&b.y0<a.y1+g;
const ov3=(a,b,g,gz)=>ov2(a,b,g)&&a.z0<b.z1+gz&&b.z0<a.z1+gz;
const rdist=(a,b)=>Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.y0-b.y1,b.y0-a.y1));
function prep(inst,st){
  const p=inst.part,F=p.features||[];
  const mount=inst.mount!=='auto'?inst.mount:(p.mount||typeOf(p).mount);
  const o={inst,p,mount,pcb:+p.pcb||0,h:+p.h||0,below:+p.below||0,w:+p.w,d:+p.d,type:p.type};
  // Parts mounted outside the enclosure (soil probes, outdoor sensors, etc.) are wired through the box
  // but have no footprint inside it: skip them from the layout entirely.
  if(mount==='outside')return Object.assign(o,{outside:true});
  if(mount==='wall'){
    o.cone=F.some(f=>f.t==='cone');
    o.tk=o.below+o.pcb+o.h+(o.cone&&o.pcb===0?2.8:0)+(F.some(f=>f.t==='opening')&&o.pcb>0?1:0);// +1 for locating-pin tip beyond PCB
    o.floorOnly=o.cone;// heavy: sits on the floor
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
}
// Part point (mm from the part's own corner) → box x,y for a floor item.
function floorXY(it,lx,ly){
  const o=it.o,px=lx+o.pad.xmin,py=ly+o.pad.ymin;
  switch(it.rot){
    case 0:return [it.x0+px,it.y0+py];
    case 1:return [it.x0+o.fd-py,it.y0+px];
    case 2:return [it.x0+o.fw-px,it.y0+o.fd-py];
    default:return [it.x0+py,it.y0+o.fw-px];
  }
}
// Part face point (lx right and ly up, as seen from outside through the wall; n = mm into the box) → box x,y,z.
function wallXYZ(it,box,lx,ly,n){
  const L=it.o.w,z=it.z0+ly;
  switch(it.wall){
    case 'ymin':return [it.u0+lx,n,z];
    case 'ymax':return [it.u0+L-lx,box.D-n,z];
    case 'xmin':return [n,it.u0+L-lx,z];
    default:return [box.W-n,it.u0+lx,z];
  }
}
// Distance along the wall (box x for front/back, box y for left/right) of a wall part's face point.
function wallU(it,lx){return it.wall==='ymin'||it.wall==='xmax'?it.u0+lx:it.u0+it.o.w-lx;}
function setBounds(it,box){
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
}
function postsFor(box,st){
  if(st.lid!=='screws')return [];
  const P=POST,big=1e4;
  return [[0,0],[box.W-P,0],[0,box.D-P],[box.W-P,box.D-P]].map(([x,y])=>({kind:'post',b:{x0:x,y0:y,x1:x+P,y1:y+P,z0:-1,z1:big},keep:[],ant:[]}));
}
function candidates(o,placed,box,st){
  const out=[],g=st.gap,wg=st.wallGap;
  if(o.mount==='wall'){
    const walls=['ymin','ymax','xmin','xmax'].includes(o.inst.wall)?[o.inst.wall]:['ymin','ymax','xmin','xmax'];
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
}
function awayOK(a,b){
  if(!a.o||!b.o)return true;
  const ta=a.o.type,tb=b.o.type;
  for(const [p,q,d] of AWAY)if(((ta===p&&tb===q)||(ta===q&&tb===p))&&rdist(a.b,b.b)<d)return false;
  for(const A of a.ant)if(ANT_AWAY[tb]&&rdist(A,b.b)<ANT_AWAY[tb])return false;
  for(const B of b.ant)if(ANT_AWAY[ta]&&rdist(B,a.b)<ANT_AWAY[ta])return false;
  return true;
}
function valid(it,placed,box,st){
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
}
function score(it,placed,box,st){
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
}
function tryPack(box,order,st){
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
}
// Inside height: tallest part + clearance, and the lid's lip must clear parts that sit close to a wall.
function heightFor(items,box,st){
  let top=0,nearWall=0;const m=LIP_T+LID_CLEAR+0.3;
  for(const it of items){
    if(it.kind==='post'||it.kind==='brace')continue;
    top=Math.max(top,it.b.z1);
    if(it.b.x0<m||it.b.y0<m||it.b.x1>box.W-m||it.b.y1>box.D-m)nearWall=Math.max(nearWall,it.b.z1);
  }
  let H=top+st.topClear;
  if(st.lid!=='screws')H=Math.max(H,nearWall+LIP+0.5);
  return Math.ceil(H*2)/2;
}
function finishLayout(W,D,items,st){
  const L={W,D,items,st,manual:false};
  let H=heightFor(items,L,st);
  if(wiz.size==='min')H=Math.max(H,num(wiz.sH,0));
  if(wiz.size==='exact')H=num(wiz.sH,H);
  L.H=H;
  for(const it of items)if(it.kind==='floor')it.zb=raisedZb(it,H,st);
  return L;
}
const outerSize=L=>{const st=L.st,t=st.wall;return {w:L.W+2*t+(st.ears?24:0),d:L.D+2*t,h:st.floor+L.H,lid:st.floor+(st.lid==='screws'?0:LIP)};};
function autoLayout(){
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
}
// Re-check a layout after the user moved parts by hand.
function revalidate(L){
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
}
// How far LEDs should stand out of the lid (the largest "Pokes out" of a part's LEDs, 0 if none).
const pokeOf=p=>Math.max(0,...(p.features||[]).filter(f=>f.t==='led').map(f=>num(f.poke,0)));
// Height of a floor part's underside once the box height H is known. Displays go right up under the lid so they show
// through their window. A part whose LEDs poke out is raised so the LED tops (its tallest point, "Tallest part on top")
// stand that far out of the lid: its posts or rails grow to match, however tall other parts make the box. It is never
// raised so far that the board itself would reach the lid.
function raisedZb(it,H,st){
  const o=it.o,poke=pokeOf(o.p);
  if(poke>0)return Math.max(o.zb,Math.min(H+st.floor+poke-o.pcb-o.h,H-0.5-o.pcb));
  return o.type==='display'?Math.max(o.zb,H-0.8-o.pcb-o.h):o.zb;
}
// Wall item: lowest height it can sit at without hitting anything.
function settleWall(it,L){
  const others=L.items.filter(q=>q!==it);
  const zs=[0.8,...(it.o.floorOnly?[]:others.filter(q=>q.kind!=='post').map(q=>q.b.z1+1))].sort((a,b)=>a-b);
  for(const z of zs){it.z0=z;setBounds(it,L);if(!others.some(q=>ov3(it.b,q.b,0.5,0.8)))return;}
  it.z0=0.8;setBounds(it,L);
}

// What the layout does, in words: rules met (✓), warnings (!) and problems (✗).
// The standoffs of a wall part, one per mounting hole. Each sticks straight out of the wall, so it gets a 45°
// brace underneath to print without supports (cut around the part's round openings).
function wallStandoffs(it){
  return (it.o.p.features||[]).filter(f=>f.t==='hole').map(f=>({f,r:Math.max(2,f.dia/2+1.5),z:it.z0+f.y}));
}
function report(L){
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
  return '<div class="ewNote" style="margin-bottom:2px">Inside '+fx(L.W)+' × '+fx(L.D)+' × '+fx(L.H)+' mm · '+esc(st.name)+(L.manual?' · arranged by hand':'')+'</div><ul>'+out.map(([c,i,t])=>`<li class="${c}"><span class="ic">${i}</span><span style="color:var(--text)">${t}</span></li>`).join('')+'</ul>';
}

// ---------------------------------------------------------------- solid modelling
async function buildSolids(L){
  const w=await engine(),M=w.Manifold,pool=[];
  const K=m=>{pool.push(m);return m;};
  const st=L.st,t=st.wall,f=st.floor,W=L.W,D=L.D,H=L.H,R=st.corner_r!=null?st.corner_r:t+1,lt=st.floor;
  try{
    const cube=(x0,y0,z0,x1,y1,z1)=>K(M.cube([x1-x0,y1-y0,z1-z0]).translate([x0,y0,z0]));
    const seg=r=>Math.max(16,Math.min(64,Math.round(r*10)));
    const cylZ=(x,y,z0,z1,r,n)=>K(M.cylinder(z1-z0,r,r,n||seg(r)).translate([x,y,z0]));
    const coneZ=(x,y,z0,z1,r0,r1,n)=>K(M.cylinder(z1-z0,r0,r1,n||seg(Math.max(r0,r1))).translate([x,y,z0]));
    // canonical wall frame: u along X, n (into the box) along Y, z up
    const cylN=(u,z,n0,n1,r)=>K(K(M.cylinder(n1-n0,r,r,seg(r)).rotate([-90,0,0])).translate([u,n0,z]));
    const cylU=(u0,u1,n,z,r)=>K(K(M.cylinder(u1-u0,r,r,seg(r)).rotate([0,90,0])).translate([u0,n,z]));
    const rbox=(x0,y0,z0,x1,y1,z1,r)=>{
      r=Math.min(r,(x1-x0)/2-0.01,(y1-y0)/2-0.01);if(r<0.05)return cube(x0,y0,z0,x1,y1,z1);
      return K(M.hull([[x0+r,y0+r],[x1-r,y0+r],[x1-r,y1-r],[x0+r,y1-r]].map(([x,y])=>cylZ(x,y,z0,z1,r,32))));
    };
    const toWall=(m,wl)=>{switch(wl){
      case 'ymin':return m;
      case 'ymax':return K(K(m.mirror([0,1,0])).translate([0,D,0]));
      case 'xmin':return K(m.mirror([1,-1,0]));
      default:return K(K(K(m.mirror([1,-1,0])).mirror([1,0,0])).translate([W,0,0]));
    }};
    // A hole through a wall: rectangle u0..u1 × z0..z1 with rounded corners r (n0..n1 across the wall)
    const wallCut=(wl,u0,u1,z0,z1,r,n0,n1)=>{
      n0=n0===undefined?-t-1:n0;n1=n1===undefined?0.6:n1;
      r=Math.min(r||0,(u1-u0)/2-0.001,(z1-z0)/2-0.001);
      let m;
      if(r<0.05)m=cube(u0,n0,z0,u1,n1,z1);
      else if(Math.abs((u1-u0)-(z1-z0))<0.01&&r>=(u1-u0)/2-0.01)m=cylN((u0+u1)/2,(z0+z1)/2,n0,n1,(u1-u0)/2);
      else m=K(M.hull([[u0+r,z0+r],[u1-r,z0+r],[u1-r,z1-r],[u0+r,z1-r]].map(([u,z])=>cylN(u,z,n0,n1,r))));
      return toWall(m,wl);
    };
    // ---- pixel-font text debossing helpers (5×7 bitmap, 0.5 mm pixels default)
    const textFloor=(text,cx,cy,zSurf,depth,px)=>{
      px=px||0.5;const cw=5*px,cg=px,ch=7*px;
      const chars=[...text.toUpperCase()].filter(c=>FONT5X7[c]!==undefined).reverse();
      if(!chars.length)return null;
      const totalW=chars.length*(cw+cg)-cg;let sx=cx-totalW/2;const sy=cy-ch/2;
      const rects=[];
      for(const ch2 of chars){
        const rows=FONT5X7[ch2];
        for(let row=0;row<7;row++){
          const bits=rows[row];if(!bits)continue;
          let s=-1;
          for(let col=0;col<=5;col++){
            const on=col<5&&(bits>>col)&1;
            if(on&&s<0)s=col;else if(!on&&s>=0){rects.push(cube(sx+s*px,sy+row*px,zSurf-depth,sx+col*px,sy+(row+1)*px,zSurf+0.1));s=-1;}
          }
        }
        sx+=cw+cg;
      }
      return rects.length?K(M.union(rects)):null;
    };
    const textWall=(text,uc,zc,nOuter,depth,px)=>{
      px=px||0.5;const cw=5*px,cg=px,ch=7*px;
      const chars=[...text.toUpperCase()].filter(c=>FONT5X7[c]!==undefined).reverse();
      if(!chars.length)return null;
      const totalW=chars.length*(cw+cg)-cg;let su=uc-totalW/2;const sz=zc-ch/2;
      const rects=[];
      for(const ch2 of chars){
        const rows=FONT5X7[ch2];
        for(let row=0;row<7;row++){
          const bits=rows[row];if(!bits)continue;
          let s=-1;
          for(let col=0;col<=5;col++){
            const on=col<5&&(bits>>col)&1;
            if(on&&s<0)s=col;else if(!on&&s>=0){rects.push(cube(su+s*px,nOuter-depth,sz+row*px,su+col*px,nOuter+0.1,sz+(row+1)*px));s=-1;}
          }
        }
        su+=cw+cg;
      }
      return rects.length?K(M.union(rects)):null;
    };
    const adds=[],subs=[],lidAdds=[],lidSubs=[],lidAfter=[],cutsPerWall={xmin:[],xmax:[],ymin:[],ymax:[]};// lidAfter: added once the lid's holes are cut
    const lidHole=(x,y,r)=>lidSubs.push(cylZ(x,y,H-LIP-1,H+lt+1,r));
    const lidRect=(x0,y0,x1,y1)=>lidSubs.push(rbox(x0,y0,H-LIP-1,x1,y1,H+lt+1,0.6));
    // A flex button in the lid: a tab cut free on three sides by a 0.6 mm slot (the fourth side is the hinge), thinned
    // underneath so it springs, with a Ø3 post that stops just above the switch (stop: height of the post's end).
    // It is part of the lid, so nothing can fall into the box, and it prints with the lid (post pointing up).
    const flexButton=(x,y,stop)=>{
      const g=0.6,tw=7,free=3.5,tabT=Math.min(1.2,lt-0.4),m=LIP_T+LID_CLEAR+0.5;
      const [dx,dy,room]=[[1,0,W-x],[-1,0,x],[0,1,D-y],[0,-1,y]].sort((a,b)=>b[2]-a[2])[0];// hinge toward the most room
      const tl=Math.max(7,Math.min(12,room-m+free)),s0=-free,s1=tl-free;
      // a box in tab directions (s toward the hinge, c across) as a world-axis cube
      const rect=(a0,a1,c0,c1,z0,z1)=>{const P=[[a0,c0],[a1,c1]].map(([s,c])=>[x+s*dx-c*dy,y+s*dy+c*dx]);
        return cube(Math.min(P[0][0],P[1][0]),Math.min(P[0][1],P[1][1]),z0,Math.max(P[0][0],P[1][0]),Math.max(P[0][1],P[1][1]),z1);};
      lidSubs.push(rect(s0-g,s0,-tw/2-g,tw/2+g,H-LIP-1,H+lt+1),rect(s0-g,s1,tw/2,tw/2+g,H-LIP-1,H+lt+1),rect(s0-g,s1,-tw/2-g,-tw/2,H-LIP-1,H+lt+1));
      if(lt-tabT>0.15)lidSubs.push(rect(s0,s1,-tw/2,tw/2,H-LIP-1,H+lt-tabT));
      const under=H+lt-tabT,end=Math.min(stop,under-0.5);
      lidAfter.push(cylZ(x,y,end,under+0.3,1.5,24));
    };
    // through the floor: cut up to just under the part (top), so rails or posts under it don't block the hole
    const floorHole=(x,y,r,top)=>subs.push(cylZ(x,y,-f-1,Math.max(0.3,top-0.2),r));
    const floorRect=(x0,y0,x1,y1,top)=>subs.push(rbox(x0,y0,-f-1,x1,y1,Math.max(0.3,top-0.2),0.6));
    const vents=(x0,y0,x1,y1)=>{// slots across the longer side
      const along=x1-x0>=y1-y0,n=Math.max(1,Math.floor(((along?x1-x0:y1-y0)+1.5)/3.5));
      for(let i=0;i<n;i++){const c=(along?x0:y0)+((along?x1-x0:y1-y0)-(n-1)*3.5)/2+i*3.5;
        if(along)lidRect(c-0.8,y0,c+0.8,y1);else lidRect(x0,c-0.8,x1,c+0.8);}
    };
    const items=L.items.filter(i=>i.o);
    for(const it of items){
      const o=it.o,p=o.p,F=p.features||[];
      if(it.kind==='wall'){
        const tk=o.tk;
        for(const ft of F){
          if(ft.t==='cone'){// slotted oval grille
            const uc=wallU(it,ft.x),zc=it.z0+ft.y,A=ft.cw/2-1,B=ft.ch/2-1,sw=2,pitch=4,n=Math.floor(2*A/pitch);
            for(let i=0;i<=n;i++){
              const du=-A+(2*A-n*pitch)/2+i*pitch;if(Math.abs(du)>=A-0.8)continue;
              const half=B*Math.sqrt(Math.max(0,1-(du/A)**2))-0.6;if(half<2)continue;
              subs.push(wallCut(it.wall,uc+du-sw/2,uc+du+sw/2,zc-half,zc+half,sw/2));
            }
            cutsPerWall[it.wall].push([uc-A,uc+A]);
          }else if(ft.t==='mic'){
            const uc=wallU(it,ft.x),zc=it.z0+ft.y,r=Math.max(1.25,ft.dia/2+0.25);
            subs.push(wallCut(it.wall,uc-r,uc+r,zc-r,zc+r,r));cutsPerWall[it.wall].push([uc-r,uc+r]);
          }else if(ft.t==='opening'){// round hole through the wall (ultrasonic transducers, lenses...)
            const uc=wallU(it,ft.x),zc=it.z0+ft.y,r=Math.max(1,ft.dia/2+0.4);
            subs.push(wallCut(it.wall,uc-r,uc+r,zc-r,zc+r,r));cutsPerWall[it.wall].push([uc-r,uc+r]);
          }else if(ft.t==='hole'&&!(F.some(q=>q.t==='opening')&&o.pcb>0)){// locating peg into the mounting hole
            const u=wallU(it,ft.x),z=it.z0+ft.y,r=Math.max(0.6,ft.dia/2-0.2);
            adds.push(toWall(cylN(u,z,-0.1,o.pcb>0?o.pcb+1:3,r),it.wall));
          }
        }
        if(F.some(q=>q.t==='opening')&&o.pcb>0){
          // component side faces the wall: a standoff back to the board, then a pin through its hole.
          // Each standoff has a 45° brace into the wall underneath, kept 1 mm clear of the round parts that show through.
          const clear=F.filter(q=>q.t==='opening').map(q=>cylN(wallU(it,q.x),it.z0+q.y,-0.5,o.h+0.5,q.dia/2+1.4));
          for(const s of wallStandoffs(it)){
            const u=wallU(it,s.f.x),post=cylN(u,s.z,-0.1,o.h,s.r);
            const braceDepth=Math.min(s.z+s.r+1,o.h);// only as deep as needed for a 45° base; floor supports the rest
            let brace=K(M.hull([cylN(u,s.z,-0.1,braceDepth,s.r),cube(u-s.r,-0.1,Math.max(-0.1,s.z-s.r),u+s.r,0,s.z)]));
            for(const c of clear)brace=K(brace.subtract(c));
            adds.push(toWall(post,it.wall),toWall(brace,it.wall),toWall(cylN(u,s.z,o.h-0.1,o.h+o.pcb+1,Math.max(0.6,s.f.dia/2-0.2)),it.wall));
          }
        }
        if(!F.some(ft=>ft.t==='hole')){// a ring (round parts) or frame that the part presses into, with a 45° chamfer under it
          const u0=it.u0,u1=it.u0+o.w,z0=it.z0,z1=it.z0+o.d,c=0.25,rw=1.4,dep=Math.min(2,tk);
          if(p.shape==='round'){
            const uc=(u0+u1)/2,zc=(z0+z1)/2,r=o.w/2+c,ro=r+rw,zb=Math.max(-0.1,zc-ro-dep);
            const ring=K(M.hull([cylN(uc,zc,-0.1,dep,ro),cube(uc-ro*0.7,-0.1,zb,uc+ro*0.7,0,zc)]));
            adds.push(toWall(K(ring.subtract(cylN(uc,zc,-0.5,dep+0.5,r))),it.wall));
          }else{
            const b=z0-c-rw;
            adds.push(toWall(K(cube(u0-c-rw,-0.1,b,u1+c+rw,dep,z1+c+rw).subtract(cube(u0-c,-0.5,z0-c,u1+c,dep+0.5,z1+c))),it.wall),
              toWall(K(M.hull([cube(u0-c-rw,-0.1,b,u1+c+rw,dep,b+0.01),cube(u0-c-rw,-0.1,Math.max(-0.1,b-dep),u1+c+rw,0,b)])),it.wall));
          }
        }
        if(o.cone&&o.pcb===0&&it.z0<=1.5){// rib on the floor behind a speaker
          const ribH=Math.min(12,o.d*0.4),inset=Math.min(6,o.w*0.15);
          adds.push(toWall(cube(it.u0+inset,o.h+0.4,-0.1,it.u0+o.w-inset,o.h+2.4,ribH),it.wall));
        }
        if(p.name){
          const wlbl=partShortName(p.name),wpx=0.5,wcw=5*wpx,wcg=wpx;
          const wn=[...wlbl.toUpperCase()].filter(c=>FONT5X7[c]).length;
          if(wn>0&&wn*(wcw+wcg)-wcg<=o.w-2&&7*wpx<=o.d-2){
            const wm=textWall(wlbl,it.u0+o.w/2,it.z0+o.d/2,-t,0.5);
            if(wm)subs.push(toWall(wm,it.wall));
          }
        }
        continue;
      }
      // ---- floor parts
      const zb=it.zb,pt=(x,y)=>floorXY(it,x,y);
      const rectW=(x0,y0,x1,y1)=>{const a=pt(x0,y0),b=pt(x1,y1);return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];};
      if(p.name){
        const flbl=partShortName(p.name),fpx=0.5,fcw=5*fpx,fcg=fpx;
        const fn=[...flbl.toUpperCase()].filter(c=>FONT5X7[c]).length;
        const ftw=fn*(fcw+fcg)-fcg,bw=it.b.x1-it.b.x0,bd=it.b.y1-it.b.y0;
        if(fn>0&&ftw<=bw-1&&7*fpx<=bd-1){
          const fcx=(it.b.x0+it.b.x1)/2,fcy=(it.b.y0+it.b.y1)/2;
          const fm=textFloor(flbl,fcx,fcy,0,0.4);
          if(fm)subs.push(fm);
        }
      }
      if(o.pcb>0&&o.holes.length){
        for(const h of o.holes){
          const [x,y]=pt(h.x,h.y),ph=zb;
          if(h.mount==='peg'){
            // Push-fit peg: the board drops straight onto it through its own hole, no screw needed.
            // A friction-fit shaft a touch narrower than the hole, poking up past the board so the tip
            // can be melted flat over the top afterwards to rivet the board down for good.
            adds.push(cylZ(x,y,-0.1,ph+o.pcb+PEG_POKE,Math.max(h.dia/2-PEG_CLEAR,0.9)));
          }else{
            const BHI=wiz.inserts&&window.EvenUCanBoxHelpers,ss=BHI?BHI.screwForHole(h.dia):null;
            if(ss){// (1.9.38) a stand-off sized for a heat-set insert, with the insert hole in its top
              const I=BHI.INSERTS[ss],dep=BHI.boardInsertDepth(ss);
              adds.push(cylZ(x,y,-0.1,ph,Math.max(I.boss/2,h.dia/2+1.5)));
              subs.push(cylZ(x,y,Math.max(-f+0.8,ph-dep),ph+0.5,I.hole/2,32));
            }else{
            adds.push(cylZ(x,y,-0.1,ph,Math.max(h.dia/2+1.5,2.4)));
            subs.push(cylZ(x,y,Math.max(-f+0.8,ph-8),ph+0.5,Math.max(0.6,h.dia*0.42),24));
            }
          }
        }
        // fewer than 3 screws would let it rock: rests under the corners far from the holes, clear of pins
        if(o.holes.length<3){
          const pins=F.filter(x=>x.t==='header'&&x.dir==='down');
          for(const [cx,cy] of [[2.5,2.5],[o.w-2.5,2.5],[2.5,o.d-2.5],[o.w-2.5,o.d-2.5]]){
            if(o.holes.some(h=>Math.hypot(h.x-cx,h.y-cy)<8))continue;
            if(pins.some(x=>Math.abs(x.x-cx)<x.fw/2+2.5&&Math.abs(x.y-cy)<x.fd/2+2.5))continue;
            const r=rectW(cx-1.5,cy-1.5,cx+1.5,cy+1.5);adds.push(cube(r[0],r[1],-0.1,r[2],r[3],zb));
          }
        }
      }else if(o.pcb>0){
        // two rails along the long side, clear of any pins underneath, plus end stops
        const long=o.w>=o.d,len=long?o.w:o.d,cross=long?o.d:o.w,c=cross/2;
        const pins=F.filter(x=>x.t==='header'&&x.dir==='down').map(x=>long?[x.y-x.fd/2-1,x.y+x.fd/2+1]:[x.x-x.fw/2-1,x.x+x.fw/2+1]);
        const free=(a,b)=>!pins.some(([p0,p1])=>a<p1&&p0<b);
        let off=null;
        for(let k=Math.round(cross*0.3*2)/2;k>=1.5;k-=0.5)if(free(c-k-1.5,c-k+1.5)&&free(c+k-1.5,c+k+1.5)){off=k;break;}
        const rails=off===null?(free(c-1.5,c+1.5)?[c]:[c-cross*0.3,c+cross*0.3]):[c-off,c+off];
        for(const rc of rails){
          const r=long?rectW(Math.min(4,len*0.1),rc-1.5,len-Math.min(4,len*0.1),rc+1.5):rectW(rc-1.5,Math.min(4,len*0.1),rc+1.5,len-Math.min(4,len*0.1));
          adds.push(cube(r[0],r[1],-0.1,r[2],r[3],zb));
        }
        const sw=Math.min(8,cross*0.4);
        for(const s of long?['xmin','xmax']:['ymin','ymax']){
          if(!o.pad[s])continue;
          let r;
          if(s==='xmin')r=rectW(-1.9,c-sw/2,-0.3,c+sw/2);else if(s==='xmax')r=rectW(o.w+0.3,c-sw/2,o.w+1.9,c+sw/2);
          else if(s==='ymin')r=rectW(c-sw/2,-1.9,c+sw/2,-0.3);else r=rectW(c-sw/2,o.d+0.3,c+sw/2,o.d+1.9);
          adds.push(cube(r[0],r[1],-0.1,r[2],r[3],zb+o.pcb+1.5));
        }
        // Two springy clips over the board's long edges, so it can't lift or slide sideways without
        // screws: flex one aside by hand while fitting the board, then let it spring back over the edge.
        if(cross>=8){
          const cw=4,ct=1.1,over=0.6,lipH=1,topZ=zb+o.pcb,postTop=topZ-lipH;
          const pickX=s=>{// a length-axis spot clear of any header near that edge
            const lo=s==='ymin'||s==='xmin';
            const nearEdge=x=>{const cv=long?(lo?x.y-x.fd/2:x.y+x.fd/2):(lo?x.x-x.fw/2:x.x+x.fw/2);return lo?cv<3.5:cv>cross-3.5;};
            const near=F.filter(x=>x.t==='header'&&nearEdge(x)).map(x=>long?[x.x-x.fw/2-1,x.x+x.fw/2+1]:[x.y-x.fd/2-1,x.y+x.fd/2+1]);
            const ok=v=>!near.some(([p0,p1])=>v-cw/2<p1&&p0<v+cw/2);
            return [len/2,len*0.25,len*0.75,len*0.12,len*0.88].find(ok)??len/2;
          };
          for(const s of long?['ymin','ymax']:['xmin','xmax']){
            const cx=pickX(s);
            let base,lipHi;
            if(s==='ymin'){base=rectW(cx-cw/2,-ct,cx+cw/2,0);lipHi=rectW(cx-cw/2,-ct,cx+cw/2,over);}
            else if(s==='ymax'){base=rectW(cx-cw/2,o.d,cx+cw/2,o.d+ct);lipHi=rectW(cx-cw/2,o.d-over,cx+cw/2,o.d+ct);}
            else if(s==='xmin'){base=rectW(-ct,cx-cw/2,0,cx+cw/2);lipHi=rectW(-ct,cx-cw/2,over,cx+cw/2);}
            else{base=rectW(o.w,cx-cw/2,o.w+ct,cx+cw/2);lipHi=rectW(o.w-over,cx-cw/2,o.w+ct,cx+cw/2);}
            adds.push(cube(base[0],base[1],-0.1,base[2],base[3],postTop));
            adds.push(K(M.hull([cube(base[0],base[1],postTop,base[2],base[3],postTop+0.3),cube(lipHi[0],lipHi[1],topZ+lipH*0.5,lipHi[2],lipHi[3],topZ+lipH)])));
          }
        }
      }else{
        // blocks (batteries, switches): L-shaped corner clips
        const hh=Math.max(3,Math.min(8,(o.top||o.h)*0.5)),c=0.4,th=1.6,lx=Math.min(8,o.w*0.3),ly=Math.min(8,o.d*0.3);
        for(const [cx,cy,sx,sy] of [[0,0,1,1],[o.w,0,-1,1],[0,o.d,1,-1],[o.w,o.d,-1,-1]]){
          // the two legs overlap in the corner square (blocks meeting only along an edge aren't a valid solid)
          const ox=cx-sx*c,oy=cy-sy*c;
          const a=rectW(Math.min(ox,ox-sx*th),Math.min(oy-sy*th,oy+sy*ly),Math.max(ox,ox-sx*th),Math.max(oy-sy*th,oy+sy*ly));
          const b=rectW(Math.min(ox-sx*th,ox+sx*lx),Math.min(oy,oy-sy*th),Math.max(ox-sx*th,ox+sx*lx),Math.max(oy,oy-sy*th));
          adds.push(cube(a[0],a[1],-0.1,a[2],a[3],hh),cube(b[0],b[1],-0.1,b[2],b[3],hh));
        }
      }
      for(const ft of F){
        if((ft.t==='port'||ft.t==='switch'||ft.t==='cutout')&&isEdge(ft)){
          const s=rotSide(ft.side,it.rot);
          const lp=ft.side==='xmin'?[0,ft.u]:ft.side==='xmax'?[o.w,ft.u]:ft.side==='ymin'?[ft.u,0]:[ft.u,o.d];
          const cut=ft.t==='cutout',round=cut?ft.shape!=='rect':ROUND_KINDS.has(ft.kind);
          const [x,y]=pt(lp[0],lp[1]),u=s[0]==='y'?x:y,zcRaw=zb+o.pcb+ft.zc;
          const pw=cut?ft.cw:round?Math.max(ft.pw,ft.ph):ft.pw,ph=round?pw:cut?ft.ch:ft.ph;
          const zc=Math.min(zcRaw,H-ph/2-1);
          subs.push(wallCut(s,u-pw/2,u+pw/2,zc-ph/2,zc+ph/2,round?pw/2:Math.min(1.5,ph/2)));
          cutsPerWall[s].push([u-pw/2,u+pw/2]);
        }else if(ft.t==='port'||ft.t==='cutout'){// a socket pointing up or down, or a cut-out, through the lid or the floor
          const cut=ft.t==='cutout',round=cut?ft.shape!=='rect':ROUND_KINDS.has(ft.kind);
          const cw=cut?ft.cw:round?Math.max(ft.pw,ft.ph):ft.pw,ch=round?cw:cut?ft.ch:ft.ph,g=cut?0.2:0;// (port sizes already allow for the plug)
          const fl=ft.thru==='floor';
          if(round){const [x,y]=pt(ft.x,ft.y);fl?floorHole(x,y,cw/2+g,zb):lidHole(x,y,cw/2+g);}
          else{const r=rectW(ft.x-cw/2-g,ft.y-ch/2-g,ft.x+cw/2+g,ft.y+ch/2+g);fl?floorRect(r[0],r[1],r[2],r[3],zb):lidRect(r[0],r[1],r[2],r[3]);}
        }else if(ft.t==='wire'){
          const s=rotSide(ft.side,it.rot),lp=ft.side==='xmin'?[0,ft.u]:ft.side==='xmax'?[o.w,ft.u]:ft.side==='ymin'?[ft.u,0]:[ft.u,o.d];
          const [x,y]=pt(lp[0],lp[1]),u=s[0]==='y'?x:y,hw=ft.dia/2+0.5;
          subs.push(wallCut(s,u-hw,u+hw,H-ft.dia-2,H+1,hw));
          if(st.lid!=='screws')lidSubs.push(wallCut(s,u-hw-0.5,u+hw+0.5,H-LIP-1,H+0.05,0,-1,LIP_T+LID_CLEAR+1));
          cutsPerWall[s].push([u-hw,u+hw]);
        }else if(ft.t==='button'){const [x,y]=pt(ft.x,ft.y);
          if(ft.lid==='flex')flexButton(x,y,zb+num(ft.btop,o.pcb+1.5)-o.below+0.4);
          else{const br=ft.lid==='pin'?0.75:ft.dia/2+0.6;lidHole(x,y,br);
            {const lpx=0.5,lch=7*lpx,lcy=y-(br+0.5+lch/2);const lm=textFloor('BTN',x,(lcy>=1?lcy:y+(br+0.5+lch/2)),H+lt,0.4,lpx);if(lm)lidSubs.push(lm);}}}
        else if(ft.t==='led'){const [x,y]=pt(ft.x,ft.y);const lr=Math.max(1,ft.dia/2+0.3);lidHole(x,y,lr);
          {const lpx=0.5,lch=7*lpx,lcy=y-(lr+0.5+lch/2);const lm=textFloor('LED',x,(lcy>=1?lcy:y+(lr+0.5+lch/2)),H+lt,0.4,lpx);if(lm)lidSubs.push(lm);}}
        else if(ft.t==='mic'){const [x,y]=pt(ft.x,ft.y);const mr=Math.max(1.25,ft.dia/2+0.25);lidHole(x,y,mr);
          {const lpx=0.5,lch=7*lpx,lcy=y-(mr+0.5+lch/2);const lm=textFloor('MIC',x,(lcy>=1?lcy:y+(mr+0.5+lch/2)),H+lt,0.4,lpx);if(lm)lidSubs.push(lm);}}
        else if(ft.t==='opening'){const [x,y]=pt(ft.x,ft.y);const or2=Math.max(1,ft.dia/2+0.4);lidHole(x,y,or2);
          {const lpx=0.5,lch=7*lpx,lcy=y-(or2+0.5+lch/2);const lm=textFloor('OPN',x,(lcy>=1?lcy:y+(or2+0.5+lch/2)),H+lt,0.4,lpx);if(lm)lidSubs.push(lm);}}
        else if(ft.t==='window'){const r=rectW(ft.x-ft.fw/2,ft.y-ft.fd/2,ft.x+ft.fw/2,ft.y+ft.fd/2);lidRect(r[0]-0.3,r[1]-0.3,r[2]+0.3,r[3]+0.3);}
        else if(ft.t==='heat'){const r=rectW(ft.x-ft.fw/2,ft.y-ft.fd/2,ft.x+ft.fw/2,ft.y+ft.fd/2);vents(r[0],r[1],r[2],r[3]);}
        else if(ft.t==='cone'){const r=rectW(ft.x-ft.cw/2+1,ft.y-ft.ch/2+1,ft.x+ft.cw/2-1,ft.y+ft.ch/2-1);vents(r[0],r[1],r[2],r[3]);}
      }
    }
    // Prototype style: a slot at the top of the quietest wall for jumper wires and leads
    if(st.cable){
      const walls=['ymax','xmax','xmin','ymin'].sort((a,b)=>cutsPerWall[a].length-cutsPerWall[b].length);
      let done=false;
      for(const wl of walls){
        const len=wl[0]==='y'?W:D,busy=[...cutsPerWall[wl],...items.filter(i=>i.kind==='wall'&&i.wall===wl&&i.b.z1>H-9).map(i=>[i.u0,i.u0+i.o.w])];
        for(const fr of [0.5,0.3,0.7,0.2,0.8]){
          const u=len*fr;if(u-7<(st.lid==='screws'?POST:2)||u+7>len-(st.lid==='screws'?POST:2))continue;
          if(busy.some(([a,b])=>u-7<b&&a<u+7))continue;
          subs.push(wallCut(wl,u-6,u+6,H-7,H+1,2));
          if(st.lid!=='screws')lidSubs.push(wallCut(wl,u-6.5,u+6.5,H-LIP-1,H+0.05,0,-1,LIP_T+LID_CLEAR+1));
          done=true;break;
        }
        if(done)break;
      }
    }
    // Lid screw posts
    const postC=POST/2;
    if(st.lid==='screws'){
      for(const [x,y] of [[0,0],[W-POST,0],[0,D-POST],[W-POST,D-POST]]){
        adds.push(cube(x-0.5*(x===0),y-0.5*(y===0),-0.1,x+POST+0.5*(x!==0),y+POST+0.5*(y!==0),H));
        subs.push(cylZ(x+postC,y+postC,H-10,H+1,1.25,24));
      }
    }
    // Snap-fit: dimples inside the walls that the bumps on the lid lip click into
    const snaps=[];
    if(st.lid==='snap')for(const wl of ['ymin','ymax','xmin','xmax']){const len=wl[0]==='y'?W:D;for(const fr of len>70?[0.28,0.72]:[0.5])snaps.push([wl,len*fr]);}
    for(const [wl,u] of snaps)subs.push(toWall(cylU(u-5,u+5,0,H-LIP/2,0.85),wl));
    // Mounting ears
    if(st.ears){
      // 16 mm wide tabs reaching 12 mm out from each end wall, with a rounded tip and a Ø4.5 screw hole
      for(const sgn of [-1,1]){
        const xc=sgn<0?-t-4:W+t+4;
        adds.push(K(cube(sgn<0?-t-4:W+t-0.5,D/2-8,-f,sgn<0?-t+0.5:W+t+4,D/2+8,-f+3).add(cylZ(xc,D/2,-f,-f+3,8))));
        subs.push(cylZ(sgn<0?-t-6:W+t+6,D/2,-f-1,-f+4,2.25,32));
      }
    }
    if(D>=12){
      const bp=0.5,bch=7*bp,bcg=bp,bcw=5*bp;
      const line1='MADE WITH',line2='EVENUCAN';
      const n1=[...line1].filter(c=>FONT5X7[c]).length,n2=[...line2].filter(c=>FONT5X7[c]).length;
      const tw1=n1*(bcw+bcg)-bcg,tw2=n2*(bcw+bcg)-bcg;
      if(tw1<=W-4&&tw2<=W-4){
        // Branding goes on the OUTSIDE bottom face (z=-f), not the inside floor
        const bz=-f+0.4;// cube runs bz-0.4 .. bz+0.1, so it cuts 0.4 mm up from the bottom face
        const bcy1=D/2-bch*0.5-0.25,bcy2=D/2+bch*0.5+0.25;
        // Mirror the text so it reads correctly when the box is flipped over to view the bottom
        const mirrorBottom=m=>K(K(m.mirror([1,0,0])).translate([W,0,0]));
        const bm1=textFloor(line1,W/2,bcy1,bz,0.4,bp);if(bm1)subs.push(mirrorBottom(bm1));
        const bm2=textFloor(line2,W/2,bcy2,bz,0.4,bp);if(bm2)subs.push(mirrorBottom(bm2));
      }
    }
    // ---- base
    let base=K(rbox(-t,-t,-f,W+t,D+t,H,R).subtract(rbox(0,0,0,W,D,H+1,1)));
    if(adds.length)base=K(M.union([base,...adds]));
    if(st.groove){// gasket groove along the middle of the rim: 3 mm wide, a common O-ring/gasket cord size
      const a=t/2+1.5,b=t/2-1.5;
      subs.push(K(rbox(-a,-a,H-1.2,W+a,D+a,H+1,a+0.5).subtract(rbox(-b,-b,H-2,W+b,D+b,H+2,b+0.5))));
    }
    if(subs.length)base=K(M.difference([base,...subs]));
    // ---- lid (built in place on top of the base, then turned over for printing)
    let lid=rbox(-t,-t,H,W+t,D+t,H+lt,R);
    if(st.lid!=='screws'){
      const c=LID_CLEAR;
      lidAdds.push(K(rbox(c,c,H-LIP,W-c,D-c,H+0.1,Math.max(0.3,1-c)).subtract(rbox(c+LIP_T,c+LIP_T,H-LIP-1,W-c-LIP_T,D-c-LIP_T,H+0.05,0.3))));
      for(const [wl,u] of snaps)lidAdds.push(toWall(cylU(u-4,u+4,c+0.45,H-LIP/2,0.75),wl));
    }else{
      for(const [x,y] of [[0,0],[W-POST,0],[0,D-POST],[W-POST,D-POST]]){
        lidSubs.push(cylZ(x+postC,y+postC,H-1,H+lt+1,1.7,32));
        if(lt>=2.8)lidSubs.push(cylZ(x+postC,y+postC,H+lt-1.5,H+lt+1,3.1,32));
      }
    }
    if(lidAdds.length)lid=K(M.union([lid,...lidAdds]));
    if(lidSubs.length)lid=K(M.difference([lid,...lidSubs]));
    if(lidAfter.length)lid=K(M.union([lid,...lidAfter]));
    // ---- accessories: printable plugs for round wall holes/glands, and push-fit rivets for the screw
    // posts, each a touch undersize for a friction fit (tune to your printer, like every other clearance
    // in this app). One PER HOLE (not one per size) and each its own separate solid, so a 3MF export
    // keeps them as separate, individually movable/deletable objects in the slicer - matching the real
    // count of holes in the box, not just one sample of each size.
    const extras=[];
    if(st.lid==='screws'){
      const plugList=[];
      for(const it of items)for(const ft of it.o.p.features||[]){
        if(!isEdge(ft))continue;
        const round=ft.t==='cutout'?ft.shape!=='rect':(ft.t==='port'&&ROUND_KINDS.has(ft.kind));
        if(!round)continue;
        const dia=ft.t==='cutout'?ft.cw:Math.max(ft.pw,ft.ph);
        if(dia>0)plugList.push(Math.round(dia*10)/10);
      }
      const rivetList=[];
      for(const it of items)if(it.kind!=='wall'&&it.o.pcb>0)for(const h of it.o.holes||[])if(h.mount!=='peg')rivetList.push(Math.round(h.dia*10)/10);
      // Built on the same z as the base (bottom at -f, so it lands on the bed once placed), flange-down:
      // the wide cap/head sits flat on the bed (best adhesion, no overhang) and the narrower shaft rises
      // straight up from it, so neither needs supports. A short cone, not an abrupt step, carries the
      // width down from cap/head to shaft: printed over a few layers rather than in one, an abrupt step
      // (especially the rivet's wide head to its much narrower shaft) is exactly where a print is most
      // likely to catch on something nearby and snap off, as a real print found out the hard way.
      for(const dia of plugList){
        const shaftR=Math.max(dia/2-PLUG_CLEAR,1),capR=dia/2+PLUG_CAP_OVER,flatH=PLUG_CAP_T-1,taperH=1,shaftLen=t+0.6;
        const m=K(M.union([cylZ(0,0,-f,-f+flatH,capR),coneZ(0,0,-f+flatH-0.05,-f+flatH+taperH,capR,shaftR),cylZ(0,0,-f+flatH+taperH-0.1,-f+flatH+taperH-0.1+shaftLen,shaftR)]));
        extras.push({m,w:capR*2,dia,kind:'plug'});
      }
      for(const dia of rivetList){
        const shaftR=dia/2,headR=Math.max(dia/2+1.5,2.4)+1,shaftLen=9,flatH=1,taperH=1.5,barbZ=flatH+taperH+shaftLen*0.4;
        const m=K(M.union([cylZ(0,0,-f,-f+flatH,headR),coneZ(0,0,-f+flatH-0.05,-f+flatH+taperH,headR,shaftR),cylZ(0,0,-f+flatH+taperH-0.1,-f+flatH+taperH-0.1+shaftLen,shaftR),cylZ(0,0,-f+barbZ,-f+barbZ+1.2,shaftR+RIVET_BARB)]));
        extras.push({m,w:headR*2,dia,kind:'rivet'});
      }
      // A flexible gasket cord to go in the groove: the same rounded-rectangle loop, printed in TPU (or
      // another flexible filament - switch filament for this one piece). A touch narrower than the groove
      // so it's an easy push-fit, and shallower than the groove's depth so the lid still pulls down snug.
      if(st.groove&&st.gasket){
        const ga=t/2+1.2,gb=t/2-1.2,gh=1.6;
        const m=K(rbox(-ga,-ga,-f,W+ga,D+ga,-f+gh,ga+0.5).subtract(rbox(-gb,-gb,-f-1,W+gb,D+gb,-f+gh+1,gb+0.5)));
        extras.push({m,w:W+2*ga,dia:'',kind:'gasket'});
      }
    }
    // One summary line per distinct size, e.g. "5 plugs for a 12.5 mm hole", not one per piece.
    const extraSummary=(()=>{
      const counts=new Map();
      for(const e of extras){const k=e.kind+'|'+e.dia;counts.set(k,(counts.get(k)||0)+1);}
      return [...counts.entries()].map(([k,n])=>{
        const [kind,dia]=k.split('|');
        if(kind==='gasket')return 'a TPU gasket for the groove (print this one piece in a flexible filament)';
        return n+' '+(kind==='plug'?'plug':'push-fit rivet')+(n>1?'s':'')+' for a '+dia+' mm hole';
      });
    })();
    const meshOf=m=>{const g=m.getMesh(),n=g.numProp,v=g.vertProperties,tv=g.triVerts,P=[];for(let i=0;i<v.length;i+=n)P.push([v[i],v[i+1],v[i+2]]);return {P,T:tv};};
    const status=[base.status(),lid.status(),...extras.map(e=>e.m.status())];
    return {base:meshOf(base),lid:meshOf(lid),baseVol:base.volume(),lidVol:lid.volume(),status,extraSummary,
      extras:extras.map(e=>({mesh:meshOf(e.m),w:e.w}))};
  }finally{
    for(const m of pool)try{m.delete();}catch(e){/* intentional: freeing engine memory */}
  }
}

// Turn the solids into editable faces in the drawing: base on the bed, lid turned over beside it.
function softEdges(faces){
  const kp=p=>p.map(v=>Math.round(v*1e7)).join(','),owner=new Map();
  const nrm=f=>{let x=0,y=0,z=0;const P=f.pts;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];x+=(a[1]-b[1])*(a[2]+b[2]);y+=(a[2]-b[2])*(a[0]+b[0]);z+=(a[0]-b[0])*(a[1]+b[1]);}const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
  const N=faces.map(nrm),lim=Math.cos(32*Math.PI/180);
  const each=(f,cb)=>{for(const L of [f.pts,...(f.holes||[])])for(let k=0;k<L.length;k++)cb(kp(L[k]),kp(L[(k+1)%L.length]));};
  faces.forEach((f,i)=>each(f,(a,b)=>owner.set(a+'|'+b,i)));
  faces.forEach((f,i)=>each(f,(a,b)=>{const j=owner.get(b+'|'+a);if(j===undefined)return;const c=N[i][0]*N[j][0]+N[i][1]*N[j][1]+N[i][2]*N[j][2];if(c>lim){f.soft=true;faces[j].soft=true;}}));// curved, or flat pieces left as separate triangles
}
function partShortName(name){
  const n=name.toLowerCase();
  if(/\b(battery|lipo|li-?po|lith)/i.test(n))return'Bat';
  if(/\b(switch|sw\b)/i.test(n))return'SW';
  if(/\bcharger|charging\b/i.test(n))return'Chr';
  if(/\b(display|oled|lcd|tft|screen|epaper|e-?ink)\b/i.test(n))return'Disp';
  if(/\b(speaker|buzzer|piezo)\b/i.test(n))return'Spk';
  if(/\b(sensor)\b/i.test(n))return'Sens';
  if(/\b(motor|servo)\b/i.test(n))return'Mot';
  if(/\b(fan|blower)\b/i.test(n))return'Fan';
  if(/\b(relay)\b/i.test(n))return'Rly';
  if(/\b(usb|connector|jack|socket)\b/i.test(n))return'USB';
  const words=name.trim().split(/[\s\-_]+/);
  for(const w of words){
    if(!/^[A-Za-z]/.test(w))continue;
    if(/^(on|off|the|and|or|for|to|a|an|with|v\d|board|module|dev|kit|unit|mini|micro|nano|pro)\b/i.test(w))continue;
    const clean=w.replace(/[^A-Za-z0-9]/g,'');
    if(clean.length>0)return clean.slice(0,6);
  }
  return name.replace(/[^A-Za-z0-9]/g,'').slice(0,6)||'Part';
}
const FONT5X7={
  ' ':[0,0,0,0,0,0,0],
  'A':[14,17,17,31,17,17,17],'B':[30,17,17,30,17,17,30],'C':[14,17,16,16,16,17,14],
  'D':[30,17,17,17,17,17,30],'E':[31,16,30,16,16,16,31],'F':[31,16,30,16,16,16,16],
  'G':[14,17,16,23,17,17,14],'H':[17,17,17,31,17,17,17],'I':[14,4,4,4,4,4,14],
  'J':[7,2,2,2,2,18,12],'K':[17,18,20,24,20,18,17],'L':[16,16,16,16,16,16,31],
  'M':[17,27,21,17,17,17,17],'N':[17,25,21,19,17,17,17],'O':[14,17,17,17,17,17,14],
  'P':[30,17,17,30,16,16,16],'Q':[14,17,17,17,21,19,15],'R':[30,17,17,30,20,18,17],
  'S':[15,16,16,14,1,1,30],'T':[31,4,4,4,4,4,4],'U':[17,17,17,17,17,17,14],
  'V':[17,17,17,17,10,10,4],'W':[17,17,17,21,27,27,17],'X':[17,17,10,4,10,17,17],
  'Y':[17,17,10,4,4,4,4],'Z':[31,1,2,4,8,16,31],
  '0':[14,17,17,17,17,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,6,8,16,31],
  '3':[14,17,1,6,1,17,14],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],
  '6':[15,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],
  '9':[14,17,17,15,1,1,14],'-':[0,0,0,31,0,0,0],'.':[0,0,0,0,0,6,6]
};
function ghostLines(L,toWorld){
  const lines=[];
  const col=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
  const loop=(pts,c)=>{for(let i=0;i<pts.length;i++)lines.push([toWorld(pts[i]),toWorld(pts[(i+1)%pts.length]),c]);};
  const prism=(base2d,z0,z1,c)=>{loop(base2d.map(([x,y])=>[x,y,z0]),c);loop(base2d.map(([x,y])=>[x,y,z1]),c);for(const [x,y] of base2d.filter((_,i)=>i%Math.max(1,Math.floor(base2d.length/4))===0))lines.push([toWorld([x,y,z0]),toWorld([x,y,z1]),c]);};
  for(const it of L.items){
    if(!it.o)continue;const o=it.o,p=o.p,c=col(typeOf(p).color);
    const outline=(fn)=>p.shape==='round'?Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return fn(o.w/2+Math.cos(a)*o.w/2,o.d/2+Math.sin(a)*o.d/2);}):[fn(0,0),fn(o.w,0),fn(o.w,o.d),fn(0,o.d)];
    if(it.kind==='wall'){
      const face=n=>outline((x,y)=>wallXYZ(it,L,x,y,n));
      const f0=face(0),f1=face(o.tk-(o.cone&&o.pcb===0?2.8:0));
      loop(f0,c);loop(f1,c);for(let i=0;i<f0.length;i+=Math.max(1,Math.floor(f0.length/4)))lines.push([toWorld(f0[i]),toWorld(f1[i]),c]);
      for(const ft of p.features||[])if(ft.t==='cone')loop(Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return wallXYZ(it,L,ft.x+Math.cos(a)*ft.cw/2,ft.y+Math.sin(a)*ft.ch/2,0.3);}),c);
      continue;
    }
    const b2=outline((x,y)=>floorXY(it,x,y));
    prism(b2,it.zb,it.zb+o.pcb,c);
    if(o.h>0)prism(b2,it.zb+o.pcb,it.zb+o.pcb+o.h,c.map(v=>v*0.5+0.5));
  }
  return lines;
}
async function generate(){
  if(!lay||lay.error)return WF.flash('Arrange the parts first');
  if(lay.items.some(i=>i.bad)&&!(await askConfirm('Some parts overlap or stick out (shown in red). Build the enclosure anyway?')))return;
  if(!WF.docEmpty&&!(await askConfirm('Replace the current drawing with the enclosure?\n\n(Undo brings your drawing back.)')))return;
  busy('Building the enclosure…');
  await new Promise(r=>setTimeout(r,30));
  try{
    const L=lay,st=L.st,t=st.wall,os=outerSize(L),bed=WF.bed;
    const r=await buildSolids(L);
    if(r.status.some(s=>s!=='NoError'))console.warn('Manifold status',r.status);
    // Lid beside the base (turned over: plate down, lip up), on whichever side keeps both on the bed.
    const sideY=os.d*2+8<=Math.min(bed.x,bed.y)||os.d*2+8<=Math.max(bed.x,bed.y)&&os.w<=Math.min(bed.x,bed.y),gap=8;
    const baseT=p=>[(p[0]-L.W/2)/1000,(p[1]-L.D/2)/1000,(p[2]+st.floor)/1000];
    const lidOff=sideY?[0,os.d+gap]:[os.w+gap,0];
    const lidT=p=>[(p[0]-L.W/2+lidOff[0])/1000,(-(p[1]-L.D/2)+lidOff[1])/1000,(-p[2]+L.H+st.floor)/1000];
    const tris=(m,T)=>{const out=[];for(let i=0;i<m.T.length;i+=3)out.push([T(m.P[m.T[i]]),T(m.P[m.T[i+1]]),T(m.P[m.T[i+2]])]);return out;};
    const baseFaces=WF.facesFromTriangles(tris(r.base,baseT)),lidFaces=WF.facesFromTriangles(tris(r.lid,lidT));
    const gB=WF.nid(),gL=WF.nid();
    for(const fc of baseFaces){fc.g=gB;fc.color='#cdd6e2';}
    for(const fc of lidFaces){fc.g=gL;fc.color='#9fb8d6';}
    // Accessories (plugs, push-fit rivets): one per hole, each its own separate piece, in a grid of
    // their own below the base, clear of it and the lid, wrapping to a new row once it's as wide as the
    // base (so a box with a lot of holes doesn't end up with one absurdly long row).
    const extraFaces=[];
    if(r.extras&&r.extras.length){
      const rowCap=Math.max(os.w,60);
      let ex=0,ey=0,rowH=0;
      for(const e of r.extras){
        if(ex>0&&ex+e.w>rowCap){ex=0;ey+=rowH+gap;rowH=0;}
        const ox=ex+e.w/2,oy=ey+e.w/2,T=p=>baseT([p[0]+ox,p[1]-(gap*2+oy),p[2]]);
        const fc=WF.facesFromTriangles(tris(e.mesh,T)),g=WF.nid();
        for(const f of fc){f.g=g;f.color='#d9b36c';}
        extraFaces.push(...fc);ex+=e.w+gap;rowH=Math.max(rowH,e.w);
      }
    }
    const faces=[...baseFaces,...lidFaces,...extraFaces];softEdges(faces);
    WF.pushUndo(null,'Enclosure Wizard');WF.replaceModel(faces,'Enclosure');WF.commitChange();
    WF.setGhosts(ghostLines(L,baseT),baseFaces);WF.ghostsShown($('ewGhost').checked);
    WF.zoomExtents();
    closeWizard();
    const extraMsg=r.extraSummary&&r.extraSummary.length?' Plus '+r.extraSummary.join(', ')+' in front of the base, each its own piece. Export 3MF (not STL) to keep them as separate, movable objects in your slicer.':'';
    busy('');
    if(gStep==='box')drawGuide();// (wizard-r2) the guide now says what's next: the wiring
    // (box-dl) offer the print file at once: the box is only useful once it's in the slicer
    await offerBoxDownload(`Base ${fx(os.w)} × ${fx(os.d)} × ${fx(os.h)} mm, plus the lid`,extraMsg);
  }catch(e){console.error(e);WF.flash('Could not build the enclosure: '+(e&&e.message||e),7000);}
  finally{busy('');}
}

// (box-dl) The box file for the 3D printer, named after the project ("Shed sensor box.3mf").
function boxFileName(){
  let n='';try{const it=intentNow();n=(it&&it.analysis&&it.analysis.name)||'';}catch(e){console.warn('EvenUCan: no project name for the box file',e);}
  n=String(n||'My project').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,50)||'My project';
  return /box$/i.test(n)?n:n+' box';
}
function downloadBox(fmt){
  if(!WF.model.faces.length){WF.flash('Make the box first.',5000);return false;}
  WF.setDocName(boxFileName());
  if(fmt==='stl')WF.exportSTL();else WF.export3MF();
  return true;
}
async function offerBoxDownload(sizeTxt,extraMsg){
  const nm=esc(boxFileName());
  const i=await askHtml(`<div class="kHead"><b>🎉 Your box is ready</b></div><p style="margin:0 0 6px">${esc(sizeTxt)}.${extraMsg?' '+esc(extraMsg):''}</p>
<p style="margin:0 0 6px"><b>Download it for your 3D printer now?</b> Open the file in your slicer (Cura, PrusaSlicer, Bambu Studio, OrcaSlicer…), slice it and print.</p>
<ul style="margin:0 0 4px;padding-left:20px"><li><b>3MF</b> (recommended): the base, lid and any small pieces stay separate objects, and the size in mm is kept. Every modern slicer opens it.</li><li><b>STL</b>: the older format every slicer opens. Use it if your program won't take 3MF.</li></ul>
<p class="ewNote" style="margin:4px 0 0">It goes to your Downloads folder as <b>${nm}.3mf</b> (or .stl). You can download it again any time from the guide, or with Export at the top.</p>`,
    ['Later','Download STL','Download 3MF (recommended)'],2);
  if(i===2)downloadBox('3mf');else if(i===1)downloadBox('stl');
  else{WF.flash('No problem: download the box later from the guide, or with Export 3MF / Export STL at the top.',7000);WF.openCheck();}
  if(gStep==='box')drawGuide();
}

