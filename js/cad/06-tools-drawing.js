// EvenUCan 3D drawing app - 06-tools-drawing.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- tools
const tools={};
let tool={},toolNameCad='';
const endOp=function endOp(){preview.lines=[];lockAxis=null;setMarker(null);requestDraw();};

// What a selection box from d0 to m picks. Left→right (window): only things completely inside.
// Right→left (crossing): anything the box touches.
// Which points can be seen (not hidden behind a face). Window selection only judges what you can see,
// so a slot cut through a part can be boxed from above without its hidden lower corners spoiling it.
const visibleMap=function visibleMap(){
  const vis=new Map();
  const check=p=>{
    const k=key(p);if(vis.has(k))return;
    const s=toScreen(p);if(!s){vis.set(k,false);return;}
    const ray=screenRay(s[0],s[1]),tp=dot(sub(p,ray.o),ray.d),h=pickFace(ray);
    vis.set(k,!(h&&h.t<tp-Math.max(1e-6,tp*2e-4)));
  };
  for(const f of model.faces)f.pts.forEach(check);
  for(const e of model.edges){check(e.a);check(e.b);}
  for(const g of model.guides)check(g.p);
  return vis;
};
const boxPick=function boxPick(d0,m,vis){
  const x0=Math.min(d0.x,m.x),x1=Math.max(d0.x,m.x),y0=Math.min(d0.y,m.y),y1=Math.max(d0.y,m.y),crossing=m.x<d0.x;
  const inb=s=>s[0]>=x0&&s[0]<=x1&&s[1]>=y0&&s[1]<=y1;
  const R=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const test=(ps,closed)=>{
    const S=ps.map(toScreen);
    if(!crossing){
      const seen=vis?S.filter((s,i)=>vis.get(key(ps[i]))):S;
      return seen.length>0&&seen.every(s=>s&&inb(s));
    }
    const onScreen=S.filter(Boolean);if(!onScreen.length)return false;
    if(onScreen.some(inb))return true;
    const n=closed?S.length:S.length-1;
    for(let i=0;i<n;i++){const a=S[i],b=S[(i+1)%S.length];if(!a||!b)continue;for(let j=0;j<4;j++)if(segX(a,b,R[j],R[(j+1)%4]))return true;}
    return !!closed&&S.every(Boolean)&&pip(R[0],S);// box entirely inside the shape
  };
  const out=new Set();
  for(const f of model.faces)if(!f.hidden&&test(f.pts,true))out.add(f.id);
  for(const ed of model.edges)if(test([ed.a,ed.b],false))out.add(ed.id);
  for(const g of model.guides)if(test([g.p],false))out.add(g.id);
  return out;
};
tools.select=()=>{
  let down=null,before=null,vis=null;const box=$cad('box');
  // While dragging, show the would-be selection live (on top of what was already selected when adding).
  const preview=(m,add_)=>{
    if(!vis)vis=visibleMap();// the camera doesn't move during a drag, so work this out once
    const picked=boxPick(down,m,vis),crossing=m.x<down.x;
    // A group counts as one item: touched (right→left) or wholly inside (left→right) picks all of it.
    const members=new Map();
    for(const x of groupable())if(x.g&&!x.hidden){if(!members.has(x.g))members.set(x.g,[]);members.get(x.g).push(x.id);}
    for(const [g,list] of members){
      const any=list.some(id=>picked.has(id)),all=list.every(id=>picked.has(id));
      if(crossing?any:all)list.forEach(id=>picked.add(id));else list.forEach(id=>picked.delete(id));
    }
    selection=new Set(add_?before:[]);for(const id of picked)selection.add(id);selChanged();
  };
  return {label:'',hint:'Click to select · Shift/Ctrl+click adds · Double-click selects a whole object · Drag left→right to select what is fully inside, right→left for anything touched · Delete removes',
    down(e,m){down=m;before=new Set(selection);vis=null;},
    move(e,m){
      if(!down||!(e.buttons&1))return;
      const x0=Math.min(down.x,m.x),y0=Math.min(down.y,m.y);
      if(Math.abs(m.x-down.x)>4||Math.abs(m.y-down.y)>4){
        box.style.display='block';box.className=m.x<down.x?'cross':'';
        Object.assign(box.style,{left:x0+'px',top:y0+'px',width:Math.abs(m.x-down.x)+'px',height:Math.abs(m.y-down.y)+'px'});
        preview(m,e.shiftKey||e.ctrlKey);
      }
    },
    up(e,m){
      if(!down)return;const d0=down;
      const add_=e.shiftKey||e.ctrlKey;
      if(Math.abs(m.x-d0.x)>4||Math.abs(m.y-d0.y)>4){
        preview(m,add_);down=null;box.style.display='none';
        if(!selection.size)flash(m.x>d0.x?'Nothing was completely inside the box. Drag right-to-left to pick anything the box touches.':'Nothing touched the box.',3500);
        return;
      }
      down=null;box.style.display='none';
      const hit=pickEntity(m.x,m.y);
      if(!add_)selection.clear();
      if(hit!==null){
        const all=expandGroups(new Set([hit]));// clicking any part of a group picks the whole group
        if(add_&&selection.has(hit))all.forEach(id=>selection.delete(id));else all.forEach(id=>selection.add(id));
      }
      selChanged();
    },
    dbl(e,m){const h=pickFace(screenRay(m.x,m.y));if(h){for(const id of componentOf(h.face.id))selection.add(id);selChanged();}},
    cancel(){
      if(down&&before){selection=before;selChanged();}// Esc mid-drag restores the old selection
      const busy=!!down;down=null;box.style.display='none';return busy;
    }
  };
};

tools.line=()=>{
  let pts=[],chain=[],cur=null;
  const reset=()=>{pts=[];chain=[];cur=null;endOp();};
  function addPoint(p){
    p=clean(p);
    if(!pts.length){pts=[p];setHintCad('Click the next point · Click the start point to close a face · Esc to finish');return;}
    const a=pts[pts.length-1];if(dist(a,p)<1e-6)return;
    pushUndo();
    const settle=()=>{planarizeSeg(a,p);commitChange();};
    if(trySplit(a,p)){settle();pts=[p];chain=[];return;}
    // Traced along the rim of a hole: fill it.
    const rim=openEdgeUnder(a,p);
    if(rim){
      if(closeLoop(rim[0],rim[1],null)){settle();flash('Hole closed');reset();setHintCad(tool.hint);}
      else{dropUndo();flash('That open edge is not part of a flat loop, so it cannot be filled');pts=[p];}
      return;
    }
    const closing=pts.length>=3&&key(p)===key(pts[0]);
    const eid=nid();model.edges.push({id:eid,a,b:p});chain.push(eid);
    if(closing){
      if(isPlanar(pts)){model.edges=model.edges.filter(e=>!chain.includes(e.id));addFace(pts);}
      settle();reset();setHintCad(tool.hint);return;
    }
    if(closeLoop(a,p,eid)){settle();reset();setHintCad(tool.hint);return;}
    pts.push(p);settle();
  }
  return {label:'Length',hint:'Click to start a line · Arrow keys lock to an axis · Type a length and press Enter',
    move(e,m){
      cur=inferPoint(m.x,m.y,{base:pts[pts.length-1],extra:pts});setMarker(cur);preview.lines=[];
      if(pts.length&&cur){const a=pts[pts.length-1];preview.lines.push([a,cur.p,axisColor(cur)]);if(cur.from)preview.lines.push([cur.p,cur.from,[0.55,0.55,0.6]]);vcbShow(fmt(dist(a,cur.p)));}
    },
    down(e,m){if(cur)addPoint(cur.p);},
    vcb(t){
      if(!pts.length||!cur)return flash('Start the line first, then type a length');
      const L=parseLen(t);if(!(L>0))return flash('Could not read that length');
      const a=pts[pts.length-1],d=sub(cur.p,a);if(len(d)<1e-9)return;
      addPoint(add(a,mul(norm(d),L)));
    },
    busy:()=>pts.length>0,
    cancel(){const busy=pts.length>0;reset();setHintCad(tool.hint);return busy;}
  };
};

const planeFor=function planeFor(inf){return {p:inf.p,n:inf.face?faceNormal(inf.face):workPlane.n};};

tools.rect=()=>{
  let p0=null,plane=null,U,V,cur=null,ab=[0,0];
  const reset=()=>{p0=null;endOp();setHintCad(t.hint);};
  const corners=()=>[p0,add(p0,mul(U,ab[0])),add(add(p0,mul(U,ab[0])),mul(V,ab[1])),add(p0,mul(V,ab[1]))];
  let hgt=0;   // a height typed as the third number (e.g. 20, 15, 15): the face is then pulled up into a box
  function finish(){if(Math.abs(ab[0])<1e-6||Math.abs(ab[1])<1e-6)return;pushUndo();const c=corners(),f=addFace(c,plane.n);if(f)planarize(faceNormal(f),f.pts[0]);if(f&&hgt)pushPullMany([f.id],hgt);hgt=0;rememberShape(mul(add(c[0],c[2]),0.5),plane.n);commitChange();reset();}
  const t={label:'Dimensions',hint:'Click the first corner (on the ground or on a face)',
    move(e,m){
      if(!p0){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);
      const d=sub(q.p,p0);ab=[dot(d,U),dot(d,V)];
      const c=corners(),col=[0.1,0.1,0.1];preview.lines=c.map((p,i)=>[p,c[(i+1)%4],col]);
      vcbShow(fmt(Math.abs(ab[0]))+', '+fmt(Math.abs(ab[1])));
    },
    down(e,m){
      if(!p0){if(!cur)return;p0=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);ab=[0,0];setHintCad('Click the opposite corner · or type width, length and press Enter (e.g. 3, 4)');return;}
      finish();
    },
    vcb(s){
      if(!p0)return flash('Click the first corner, then type the size');
      const parts=s.split(/[,;x]/i).map(parseLen);
      if((parts.length!==2&&parts.length!==3)||parts.some(v=>!(Math.abs(v)>0)))return flash('Type two sizes, e.g. 3, 4, or three for a box, e.g. 20, 15, 15 (length, width, height)');
      ab=[parts[0]*(ab[0]<0?-1:1),parts[1]*(ab[1]<0?-1:1)];hgt=parts.length===3?parts[2]:0;finish();
    },
    busy:()=>!!p0,
    cancel(){const busy=!!p0;reset();return busy;}
  };
  return t;
};

tools.circle=()=>{
  let c=null,plane=null,U,V,r=0,cur=null,segs=24;
  const reset=()=>{c=null;endOp();setHintCad(t.hint);};
  const ring=()=>{const out=[];for(let i=0;i<segs;i++){const a=i/segs*Math.PI*2;out.push(add(c,add(mul(U,Math.cos(a)*r),mul(V,Math.sin(a)*r))));}return out;};
  function finish(){if(r<1e-6)return;pushUndo();const f=addFace(ring(),plane.n);if(f)planarize(faceNormal(f),f.pts[0]);rememberShape(c,plane.n);commitChange();reset();}
  const t={label:'Radius',hint:'Click the centre of the circle · type e.g. 36s to change the number of sides',
    move(e,m){
      if(!c){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);
      r=dist(q.p,c);const ps=ring(),col=[0.1,0.1,0.1];
      preview.lines=ps.map((p,i)=>[p,ps[(i+1)%ps.length],col]);preview.lines.push([c,q.p,[0.4,0.4,0.4]]);
      vcbShow(fmt(r));
    },
    down(e,m){
      if(!c){if(!cur)return;c=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);r=0;setHintCad('Click to set the radius, or type it and press Enter');return;}
      finish();
    },
    vcb(s){
      const m=s.match(/^(\d+)\s*s$/i);
      if(m){segs=clamp(parseInt(m[1]),3,360);return flash(segs+' sides');}
      if(!c)return flash('Click the centre first');
      const L=parseLen(s);if(!(L>0))return flash('Could not read that radius');r=L;finish();
    },
    busy:()=>!!c,
    cancel(){const busy=!!c;reset();return busy;}
  };
  return t;
};

// Two-point arc, as in SketchUp: click both ends, then pull out the bulge. It is drawn as short lines, so it
// cuts a face it crosses and closes loops like any other line.
tools.arc=()=>{
  let A=null,B=null,plane=null,cur=null,h=0,segs=0;
  const reset=()=>{A=B=null;h=0;endOp();setHintCad(t.hint);};
  function points(){
    const c=dist(A,B),s=Math.abs(h);if(c<1e-9)return [A,B];
    const u=norm(sub(B,A)),w0=norm(cross(plane.n,u)),w=h<0?mul(w0,-1):w0,M=mul(add(A,B),0.5);
    if(s<1e-9)return [A,B];
    const R=(c*c/4+s*s)/(2*s),O=add(M,mul(w,s-R)),th=4*Math.atan(2*s/c);
    const n=segs||Math.max(2,Math.round(th/(Math.PI*2)*24));
    const out=[];for(let i=0;i<=n;i++){const f=-th/2+th*i/n;out.push(clean(add(O,add(mul(u,R*Math.sin(f)),mul(w,R*Math.cos(f))))));}
    out[0]=A;out[n]=B;return out;
  }
  function finish(){
    const P=points();if(P.length<3)return flash('Pull the arc out from the line first');
    pushUndo();let last=null;
    for(let i=1;i<P.length;i++){last={id:nid(),a:P[i-1],b:P[i]};model.edges.push(last);}
    // join up with what is there: fill a closed loop, or cut the face it was drawn across
    if(!closeLoop(last.a,last.b,last.id)){
      const f=model.faces.find(f=>!f.g&&!f.hidden&&P.every(p=>Math.abs(dot(sub(p,f.pts[0]),faceNormal(f)))<1e-6));
      if(f)planarize(faceNormal(f),f.pts[0]);else if(P.every(p=>Math.abs(p[2]-P[0][2])<1e-9))planarize(Z,[0,0,P[0][2]]);
    }
    commitChange();reset();
  }
  const t={label:'Bulge',hint:'Click the start of the arc · type e.g. 12s to set the number of pieces',
    move(e,m){
      if(!A){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:!!B,base:B?null:A});if(!q)return;cur=q;setMarker(q);
      if(!B){preview.lines=[[A,q.p,axisColor(q)]];vcbShow(fmt(dist(A,q.p)));return;}
      const u=norm(sub(B,A)),w=norm(cross(plane.n,u)),c=dist(A,B);
      h=dot(sub(q.p,mul(add(A,B),0.5)),w);
      if(Math.abs(Math.abs(h)-c/2)<c*0.04)h=Math.sign(h)*c/2;// snaps to a half circle
      const P=points(),col=[0.1,0.1,0.1];preview.lines=P.slice(1).map((p,i)=>[P[i],p,col]);
      vcbShow(fmt(Math.abs(h)));setHintCad(Math.abs(Math.abs(h)-c/2)<1e-9?'Half circle · click to finish':'Click to set the bulge, or type it and press Enter');
    },
    down(e,m){
      if(!cur)return;
      if(!A){A=clean(cur.p);plane=planeFor(cur);setHintCad('Click the end of the arc · or type the distance between the ends');return;}
      if(!B){if(dist(cur.p,A)<1e-6)return;B=clean(cur.p);h=0;setHintCad('Move to pull out the bulge, then click');return;}
      finish();
    },
    vcb(s){
      const m=s.match(/^(\d+)\s*s$/i);
      if(m){segs=clamp(parseInt(m[1]),2,180);flash(segs+' pieces');return;}
      const L=parseLen(s);if(!(L>0))return flash('Could not read that');
      if(A&&!B&&cur){const d=sub(cur.p,A);if(len(d)<1e-9)return;B=clean(add(A,mul(norm(d),L)));h=0;setHintCad('Move to pull out the bulge, then click');return;}
      if(B){h=(h<0?-1:1)*L;finish();return;}
      flash('Click the start of the arc first');
    },
    busy:()=>!!A,
    cancel(){const busy=!!A;reset();return busy;}
  };
  return t;
};

// Polygon: like the circle, but with few straight sides (6 = hexagon, 3 = triangle). The mouse sets a corner.
let polySides=6;
tools.polygon=()=>{
  let c=null,plane=null,U,V,r=0,ang=0,cur=null;
  const reset=()=>{c=null;endOp();setHintCad(t.hint);};
  const ring=()=>{const out=[];for(let i=0;i<polySides;i++){const a=ang+i/polySides*Math.PI*2;out.push(add(c,add(mul(U,Math.cos(a)*r),mul(V,Math.sin(a)*r))));}return out;};
  function finish(){if(r<1e-6)return;pushUndo();const f=addFace(ring(),plane.n);if(f)planarize(faceNormal(f),f.pts[0]);rememberShape(c,plane.n);commitChange();reset();}
  const t={label:'Radius',hint:'Click the centre · '+polySides+' sides now: type e.g. 6s (hexagon), 3s (triangle), 8s (octagon) and Enter to change',
    move(e,m){
      if(!c){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);
      const d=sub(q.p,c);r=len(d);if(r>1e-9)ang=Math.atan2(dot(d,V),dot(d,U));
      const ps=ring(),col=[0.1,0.1,0.1];
      preview.lines=ps.map((p,i)=>[p,ps[(i+1)%ps.length],col]);preview.lines.push([c,q.p,[0.4,0.4,0.4]]);
      vcbShow(fmt(r));
    },
    down(e,m){
      if(!c){if(!cur)return;c=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);r=0;ang=0;setHintCad('Click to set the size (centre to corner), or type it and press Enter');return;}
      finish();
    },
    vcb(s){
      const mm=s.match(/^(\d+)\s*s$/i);
      if(mm){polySides=clamp(parseInt(mm[1]),3,100);t.hint='Click the centre · '+polySides+' sides now: type e.g. 6s (hexagon), 3s (triangle), 8s (octagon) and Enter to change';if(!c)setHintCad(t.hint);return flash(polySides+' sides');}
      if(!c)return flash('Click the centre first');
      const L=parseLen(s);if(!(L>0))return flash('Could not read that size');r=L;finish();
    },
    busy:()=>!!c,
    cancel(){const busy=!!c;reset();return busy;}
  };
  return t;
};
