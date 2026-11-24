// EvenUCan 3D drawing app - 04-webgl-renderer.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- WebGL
// Opaque canvas: the view paints its own sky and ground, so it looks the same in every browser.
const gl=cv.getContext('webgl',{antialias:true,preserveDrawingBuffer:true,alpha:false});
if(!gl){document.body.innerHTML='<p style="padding:20px">Sorry, this browser does not support WebGL, which EvenUCan needs.</p>';throw new Error('EvenUCan needs WebGL, which this browser does not support');}
const shader=function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
const program=function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;};
const faceProg=program(
`attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;attribute float aId;attribute float aSel;
uniform mat4 uMVP;uniform float uHover;
varying vec3 vNor;varying vec3 vCol;varying float vSel;varying float vHov;
void main(){gl_Position=uMVP*vec4(aPos,1.0);vNor=aNor;vCol=aCol;vSel=aSel;vHov=abs(aId-uHover)<0.5?1.0:0.0;}`,
`precision mediump float;
varying vec3 vNor;varying vec3 vCol;varying float vSel;varying float vHov;
uniform vec3 uSun;uniform vec3 uFill;uniform vec3 uBack;
void main(){vec3 n=normalize(vNor);vec3 c=vCol;
if(!gl_FrontFacing){n=-n;c=uBack;}
float l=0.46+0.44*max(dot(n,uSun),0.0)+0.16*max(dot(n,uFill),0.0);
vec3 col=c*l;
if(vSel>0.5){float s=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),4.0);col=mix(col,vec3(0.18,0.38,0.95),s<1.0?0.65:0.18);}
if(vHov>0.5)col=mix(col,vec3(1.0,0.82,0.25),0.3);
gl_FragColor=vec4(min(col,vec3(1.0)),1.0);}`);
// Sky and ground, worked out per pixel from the view direction so the horizon sits where it really is.
// The ground grid and red/green axes are drawn here too, per pixel, so their thickness can be set in
// screen points (plain WebGL lines are stuck at 1 device pixel, which vanishes on high-DPI screens).
const SKY_VS=`attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.0,1.0);}`;
const SKY_COMMON=`varying vec2 vP;uniform float uDark;uniform vec3 uR;uniform vec3 uU;uniform vec3 uF;uniform vec2 uS;
uniform vec3 uEye;uniform vec2 uO;uniform float uOrtho;uniform float uStep;uniform float uPx;uniform vec3 uBed;
vec3 skyCol(){vec3 d=normalize(uF+uR*vP.x*uS.x+uU*vP.y*uS.y);float e=d.z;
vec3 sky=mix(vec3(0.80,0.88,0.95),vec3(0.42,0.62,0.85),smoothstep(0.0,0.55,e));
vec3 gnd=mix(vec3(0.82,0.82,0.78),vec3(0.70,0.71,0.67),smoothstep(0.0,0.6,-e));
return mix(gnd,sky,smoothstep(-0.003,0.003,e));}`;
const SKY_GRID_FS=`#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
${SKY_COMMON}
float lineA(float c,float fw,float w){return 1.0-smoothstep(w*0.5-0.5,w*0.5+0.5,abs(c)/max(fw,1e-7));}
float gridA(vec2 c,float w){vec2 fw=fwidth(c);vec2 g=fract(c+0.5)-0.5;
 float a=max(lineA(g.x,fw.x,w),lineA(g.y,fw.y,w));
 return a*(1.0-smoothstep(0.06,0.25,max(fw.x,fw.y)));}
void main(){vec3 col=mix(skyCol(),vec3(0.149,0.169,0.208),uDark);
 vec3 d=uOrtho>0.5?uF:normalize(uF+uR*vP.x*uS.x+uU*vP.y*uS.y);
 vec3 o=uOrtho>0.5?uEye+uR*vP.x*uO.x+uU*vP.y*uO.y-uF*uO.y*400.0:uEye;
 if(abs(d.z)>1e-6){float t=-o.z/d.z;if(t>0.0){
  vec2 p=(o+d*t).xy,c=p/uStep;vec2 fw=fwidth(c);
  // Print bed: a lighter plate with a border; the grid is only drawn on it.
  vec2 hb=uBed.xy*0.5;float inside=step(abs(p.x),hb.x)*step(abs(p.y),hb.y);
  col=mix(col,mix(vec3(0.90,0.91,0.91),vec3(0.196,0.220,0.270),uDark),inside*0.6);
  col=mix(col,mix(vec3(0.52,0.54,0.55),vec3(0.36,0.40,0.46),uDark),gridA(c*10.0,uPx*0.8)*0.35*inside);
  col=mix(col,mix(vec3(0.45,0.47,0.47),vec3(0.46,0.50,0.56),uDark),gridA(c,uPx)*0.55*inside);
  col=mix(col,mix(vec3(0.30,0.32,0.33),vec3(0.56,0.60,0.68),uDark),gridA(c/10.0,uPx*1.5)*0.65*inside);
  vec2 eb=(abs(p)-hb)/uStep;float near=1.0-smoothstep(0.5,3.0,max(fw.x,fw.y));
  float border=max(lineA(eb.x,fw.x,uPx*2.2)*step(abs(p.y),hb.y),lineA(eb.y,fw.y,uPx*2.2)*step(abs(p.x),hb.x))*near;
  col=mix(col,mix(vec3(0.22,0.25,0.30),vec3(0.62,0.67,0.76),uDark),border);float far=1.0-smoothstep(0.4,2.5,max(fw.x,fw.y));// fade axes toward the horizon
  float xa=lineA(c.y,fw.y,uPx*2.0)*(p.x<0.0?step(0.5,fract(c.x*0.5)):1.0)*far;
  float ya=lineA(c.x,fw.x,uPx*2.0)*(p.y<0.0?step(0.5,fract(c.y*0.5)):1.0)*far;
  col=mix(col,p.x<0.0?vec3(0.85,0.45,0.45):vec3(0.85,0.12,0.12),xa);
  col=mix(col,p.y<0.0?vec3(0.45,0.72,0.45):vec3(0.12,0.6,0.12),ya);
 }}
 gl_FragColor=vec4(col,1.0);}`;
const SKY_PLAIN_FS=`precision mediump float;${SKY_COMMON}void main(){gl_FragColor=vec4(skyCol(),1.0);}`;
let skyProg,gridInSky=false;
if(gl.getExtension('OES_standard_derivatives')){try{skyProg=program(SKY_VS,SKY_GRID_FS);gridInSky=true;}catch(err){console.warn(err);}}
if(!skyProg)skyProg=program(SKY_VS,SKY_PLAIN_FS);
const SK={buf:gl.createBuffer(),aP:gl.getAttribLocation(skyProg,'aP')};
for(const u of ['uR','uU','uF','uS','uEye','uO','uOrtho','uStep','uPx','uBed','uDark'])SK[u]=gl.getUniformLocation(skyProg,u);
gl.bindBuffer(gl.ARRAY_BUFFER,SK.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const drawSky=function drawSky(){
  const C=getCB();gl.useProgram(skyProg);
  gl.uniform3fv(SK.uR,C.r);gl.uniform3fv(SK.uU,C.u);gl.uniform3fv(SK.uF,C.f);gl.uniform2f(SK.uS,C.th*C.asp,C.th);
  gl.uniform3fv(SK.uEye,C.eye);gl.uniform2f(SK.uO,C.hh*C.asp,C.hh);gl.uniform1f(SK.uOrtho,cam.ortho?1:0);
  gl.uniform1f(SK.uStep,gridStep());gl.uniform1f(SK.uPx,1.15*(window.devicePixelRatio||1));
  if(SK.uBed)gl.uniform3f(SK.uBed,bed.x/1000,bed.y/1000,bed.z/1000);
  if(SK.uDark)gl.uniform1f(SK.uDark,document.documentElement.getAttribute('data-theme')==='dark'?1:0);
  gl.bindBuffer(gl.ARRAY_BUFFER,SK.buf);gl.enableVertexAttribArray(SK.aP);gl.vertexAttribPointer(SK.aP,2,gl.FLOAT,false,0,0);
  gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.enable(gl.DEPTH_TEST);
  gl.disableVertexAttribArray(SK.aP);
};
const lineProg=program(
`attribute vec3 aPos;attribute vec3 aCol;uniform mat4 uMVP;uniform vec3 uEye;uniform float uPull;uniform vec2 uOff;uniform vec2 uRes;varying vec3 vCol;
void main(){gl_Position=uMVP*vec4(aPos+(uEye-aPos)*uPull,1.0);gl_Position.xy+=uOff*2.0/uRes*gl_Position.w;vCol=aCol;}`,
`precision mediump float;varying vec3 vCol;void main(){gl_FragColor=vec4(vCol,1.0);}`);
const FL={},LL={};
for(const a of ['aPos','aNor','aCol','aId','aSel'])FL[a]=gl.getAttribLocation(faceProg,a);
for(const u of ['uMVP','uHover','uSun','uFill','uBack'])FL[u]=gl.getUniformLocation(faceProg,u);
for(const a of ['aPos','aCol'])LL[a]=gl.getAttribLocation(lineProg,a);
LL.uMVP=gl.getUniformLocation(lineProg,'uMVP');LL.uEye=gl.getUniformLocation(lineProg,'uEye');LL.uPull=gl.getUniformLocation(lineProg,'uPull');LL.uOff=gl.getUniformLocation(lineProg,'uOff');LL.uRes=gl.getUniformLocation(lineProg,'uRes');
const mkBuf=()=>gl.createBuffer();
const BF={pos:mkBuf(),nor:mkBuf(),col:mkBuf(),id:mkBuf(),sel:mkBuf()},BE={pos:mkBuf(),col:mkBuf(),n:0},BG={pos:mkBuf(),col:mkBuf(),n:0},BP={pos:mkBuf(),col:mkBuf(),n:0},BC={pos:mkBuf(),col:mkBuf(),n:0},BH={pos:mkBuf(),col:mkBuf(),n:0};
// Ghost lines: see-through outlines (e.g. the parts inside a generated enclosure). Never saved or exported.
// They belong to a group (the enclosure base): they are kept relative to four of its corners and redrawn
// wherever that group is now, so they move, turn and flip with it, and disappear when it is deleted or undone.
// (Before 1.9.36 they were fixed in space, so moving the box left them behind as stray "ghost lines".)
let ghostOn=true,ghostSrc=null;
const ghostAnchors=function ghostAnchors(faces){
  const all=[];for(const f of faces||[])if(f&&f.id!=null)f.pts.forEach((p,i)=>all.push({id:f.id,i,p:p.slice()}));
  if(all.length<3)return null;
  const far=(sc)=>all.reduce((b,a)=>sc(a.p)>sc(b.p)?a:b,all[0]);
  const a0=all[0],a1=far(p=>dist(p,a0.p));if(dist(a1.p,a0.p)<1e-7)return null;
  const e1=norm(sub(a1.p,a0.p)),off=p=>{const v=sub(p,a0.p);return len(sub(v,mul(e1,dot(v,e1))));};
  const a2=far(off);if(off(a2.p)<1e-7)return null;
  const n=norm(cross(e1,sub(a2.p,a0.p))),a3=far(p=>Math.abs(dot(sub(p,a0.p),n)));
  return Math.abs(dot(sub(a3.p,a0.p),n))>1e-7?[a0,a1,a2,a3]:[a0,a1,a2];
};
const ghostFrame=function ghostFrame(q){
  const e1=norm(sub(q[1],q[0])),v=sub(q[2],q[0]),e2=norm(sub(v,mul(e1,dot(v,e1))));
  let e3=cross(e1,e2);
  if(q[3]){const w=sub(q[3],q[0]);e3=norm(sub(sub(w,mul(e1,dot(w,e1))),mul(e2,dot(w,e2))));}
  return [e1,e2,e3];
};
const setGhosts=function setGhosts(lines,owner){
  const P=[],C=[];for(const [a,b,c] of lines||[]){P.push(...a,...b);C.push(...c,...c);}
  const anchors=P.length&&owner?ghostAnchors(owner):null;
  ghostSrc=P.length?{P,anchors,sig:null,cur:null}:null;
  upload(BH.col,C);BH.n=0;ghostOn=true;placeGhosts();requestDraw();
};
// Called before every redraw: cheap unless the owning group has moved since last time.
const placeGhosts=function placeGhosts(){
  const S=ghostSrc;if(!S){BH.n=0;return;}
  if(!S.anchors){if(S.sig!=='fixed'){upload(BH.pos,S.P);BH.n=S.P.length/3;S.cur=S.P;S.sig='fixed';}return;}
  const byId=new Map();for(const a of S.anchors)byId.set(a.id,null);
  for(const f of model.faces)if(byId.has(f.id))byId.set(f.id,f);
  const now=[];
  for(const a of S.anchors){const f=byId.get(a.id);if(!f||f.hidden||!f.pts[a.i]){if(S.sig!=='gone'){BH.n=0;S.cur=null;S.sig='gone';}return;}now.push(f.pts[a.i]);}
  const sig=now.map(p=>p.join(',')).join(';');if(sig===S.sig)return;S.sig=sig;
  // resized or reshaped: the outlines would no longer fit, so hide them rather than draw them wrong
  if(now.some((p,i)=>i&&Math.abs(dist(p,now[0])-dist(S.anchors[i].p,S.anchors[0].p))>1e-6+1e-4*dist(S.anchors[i].p,S.anchors[0].p))){BH.n=0;S.cur=null;return;}
  const o=S.anchors[0].p,F0=ghostFrame(S.anchors.map(a=>a.p)),F1=ghostFrame(now),Q=new Array(S.P.length);
  for(let k=0;k<S.P.length;k+=3){
    const v=[S.P[k]-o[0],S.P[k+1]-o[1],S.P[k+2]-o[2]],c=F0.map(e=>dot(v,e));
    for(let i=0;i<3;i++)Q[k+i]=now[0][i]+c[0]*F1[0][i]+c[1]*F1[1][i]+c[2]*F1[2][i];
  }
  upload(BH.pos,Q);BH.n=Q.length/3;S.cur=Q;
};
let faceCount=0;
const upload=function upload(b,arr){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);};
const attrib=function attrib(loc,b,size){if(loc<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);};
const hex=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

const rebuild=function rebuild(){
  const P=[],N=[],C=[],I=[],S=[],EP=[],EC=[],HP=[],HC=[],HIDE=[0.62,0.63,0.66];
  model.faces.forEach((f,idx)=>{
    // Hidden faces: no fill, just a faint outline (drawn first so real edges on top win).
    if(f.hidden){for(const L of loops(f))for(let i=0;i<L.length;i++){HP.push(...L[i],...L[(i+1)%L.length]);HC.push(...HIDE,...HIDE);}return;}
    let t=tcGet(f);
    if(!t){try{t=triangulate(f);tcSet(f,t);}catch(err){return;}}
    const n=faceNormal(f),col=f.color?hex(f.color):DEF_FRONT,sel=selection.has(f.id)?1:0;
    for(const i of t.tris){const p=t.V[i];P.push(p[0],p[1],p[2]);N.push(n[0],n[1],n[2]);C.push(col[0],col[1],col[2]);I.push(idx);S.push(sel);}
    const ec=sel?SEL_EDGE:EDGE;
    // Soft faces (the facets of a curved surface) don't draw their own edges; flat neighbours outline them.
    if(!f.soft||sel)for(const L of loops(f))for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length];EP.push(a[0],a[1],a[2],b[0],b[1],b[2]);EC.push(...ec,...ec);}
  });
  for(const e of model.edges){const ec=selection.has(e.id)?SEL_EDGE:EDGE;EP.push(...e.a,...e.b);EC.push(...ec,...ec);}
  EP.unshift(...HP);EC.unshift(...HC);
  // A selected group gets a blue bounding box, like SketchUp.
  const gsel=new Set(groupable().filter(x=>x.g&&selection.has(x.id)).map(x=>x.g));
  for(const g of gsel){
    const b=bounds(new Set(groupable().filter(x=>x.g===g).map(x=>x.id)));if(!b)continue;
    const pad=Math.max(...b.size)*0.02+1e-4,mn=b.mn.map(v=>v-pad),mx=b.mx.map(v=>v+pad);
    const c=(i,j,k)=>[i?mx[0]:mn[0],j?mx[1]:mn[1],k?mx[2]:mn[2]];
    for(const [p,q] of [[c(0,0,0),c(1,0,0)],[c(0,1,0),c(1,1,0)],[c(0,0,1),c(1,0,1)],[c(0,1,1),c(1,1,1)],[c(0,0,0),c(0,1,0)],[c(1,0,0),c(1,1,0)],[c(0,0,1),c(0,1,1)],[c(1,0,1),c(1,1,1)],[c(0,0,0),c(0,0,1)],[c(1,0,0),c(1,0,1)],[c(0,1,0),c(0,1,1)],[c(1,1,0),c(1,1,1)]]){
      EP.push(...p,...q);EC.push(...SEL_EDGE,...SEL_EDGE);
    }
  }
  upload(BF.pos,P);upload(BF.nor,N);upload(BF.col,C);upload(BF.id,I);upload(BF.sel,S);faceCount=P.length/3;
  upload(BE.pos,EP);upload(BE.col,EC);BE.n=EP.length/3;
  // Missing-corner hints: purple cross plus dotted lines from both ends of the L.
  const CP=[],CC=[],pc=[0.61,0.19,0.85];
  for(const c of completions()){
    const segs=[...crossLines(c.p,dist(c.A,c.p)*0.06,pc)];
    for(const S of [c.A,c.B])for(let i=0;i<12;i+=2)segs.push([add(S,mul(sub(c.p,S),i/12)),add(S,mul(sub(c.p,S),(i+1)/12)),pc]);
    for(const [a,b,col] of segs){CP.push(...a,...b);CC.push(...col,...col);}
  }
  // Centre points: bold orange cross inside a diamond, drawn on top of everything.
  for(const g of model.guides){
    const s=gridStep()*0.5,col=selection.has(g.id)?SEL_EDGE:GUIDE_COL,segs=crossLines(g.p,s,col);
    for(const o of [0,0.04,-0.04])segs.push([add(g.p,[-s,o*s,0]),add(g.p,[s,o*s,0]),col],[add(g.p,[o*s,-s,0]),add(g.p,[o*s,s,0]),col]);
    const d=[[s*0.6,0,0],[0,s*0.6,0],[-s*0.6,0,0],[0,-s*0.6,0]].map(v=>add(g.p,v));
    for(let i=0;i<4;i++)segs.push([d[i],d[(i+1)%4],col]);
    for(const [a,b,c] of segs){CP.push(...a,...b);CC.push(...c,...c);}
  }
  upload(BC.pos,CP);upload(BC.col,CC);BC.n=CP.length/3;
};
const buildGrid=function buildGrid(){
  const s=gridStep(),n=20,E=n*s,P=[],C=[];
  const minor=[0.63,0.64,0.62],major=[0.48,0.50,0.50];
  const ax=(D,c,cl)=>{P.push(0,0,0,...mul(D,E*4));C.push(...c,...c);
    for(let k=0;k<E*4;k+=s){P.push(...mul(D,-k),...mul(D,-(k+s*0.5)));C.push(...cl,...cl);}};
  // When the ground shader draws the grid and red/green axes, only the blue (up) axis is a line here.
  if(!gridInSky){
    for(let i=-n;i<=n;i++){if(!i)continue;const c=i%10===0?major:minor;
      P.push(i*s,-E,0,i*s,E,0,-E,i*s,0,E,i*s,0);for(let k=0;k<4;k++)C.push(...c);}
    ax(X,[0.85,0.15,0.15],[0.9,0.6,0.6]);ax(Y,[0.15,0.6,0.15],[0.6,0.82,0.6]);
  }
  ax(Z,[0.15,0.25,0.9],[0.6,0.65,0.92]);
  // Build volume outline is no longer drawn (its vertical and top edges looked odd); bx/by/bz still size the work-plane grid.
  const bx=bed.x/2000,by=bed.y/2000,bz=bed.z/1000;
  // The side picked on the view cube: a light blue grid on it, through the middle of the bed.
  if(workPlane.name!=='ground'){
    const {u,v}=workPlane,ext=w=>Math.abs(dot(w,X))>0.5?bx:Math.abs(dot(w,Y))>0.5?by:bz,wc=[0.62,0.74,0.96],lo=w=>Math.abs(dot(w,Z))>0.5?0:-ext(w);
    const eu=ext(u),ev=ext(v),stepM=Math.max(s,0.01);
    for(let a=lo(u);a<=eu+1e-9;a+=stepM){P.push(...add(mul(u,a),mul(v,lo(v))),...add(mul(u,a),mul(v,ev)));C.push(...wc,...wc);}
    for(let b=lo(v);b<=ev+1e-9;b+=stepM){P.push(...add(mul(v,b),mul(u,lo(u))),...add(mul(v,b),mul(u,eu)));C.push(...wc,...wc);}
  }
  upload(BG.pos,P);upload(BG.col,C);BG.n=P.length/3;
};
// pull: move lines this fraction of the way toward the camera, so edges win over their own faces
// without letting edges hidden behind the model show through.
const drawLines=function drawLines(B,M,pull,thick){
  if(!B.n)return;
  gl.useProgram(lineProg);gl.uniformMatrix4fv(LL.uMVP,false,M);
  gl.uniform3fv(LL.uEye,getCB().eye);gl.uniform1f(LL.uPull,pull||0);gl.uniform2f(LL.uRes,cv.width,cv.height);
  attrib(LL.aPos,B.pos,3);attrib(LL.aCol,B.col,3);
  // WebGL lines are always 1 px wide, so a thick line is the same line drawn again, shifted by 1 px (x 0..1, y 0..1 = about 2 px).
  const s=window.devicePixelRatio||1,offs=thick?[[0,0],[1,0],[0,1],[1,1]]:[[0,0]];
  for(const [ox,oy] of offs){gl.uniform2f(LL.uOff,ox*s,oy*s);gl.drawArrays(gl.LINES,0,B.n);}
  gl.disableVertexAttribArray(LL.aPos);gl.disableVertexAttribArray(LL.aCol);
};
let pending=false,dirtyGeom=true,hoverIdx=-10;
const preview={lines:[]};
const requestDraw=function requestDraw(){if(!pending){pending=true;requestAnimationFrame(draw);}if(window.EvenUCanRibbonRefresh)window.EvenUCanRibbonRefresh();};
let geomVer=0;
const markDirtyCad=function markDirtyCad(){dirtyGeom=true;compCache=null;sceneBoxCache=undefined;geomVer++;requestDraw();if(window.wfUpdateStrip)window.wfUpdateStrip();};
// Bounding box of everything drawn (cached until the model changes); used for the camera's near cut-off.
let sceneBoxCache;
const sceneBox=()=>sceneBoxCache===undefined?(sceneBoxCache=bounds()):sceneBoxCache;
const draw=function draw(){
  pending=false;
  if(window.evenucanAppReady)window.evenucanAppReady();   // the splash screen waits for the first drawing
  const dpr=window.devicePixelRatio||1,w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;CB=null;}
  if(dirtyGeom){rebuild();dirtyGeom=false;}
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0.8,0.86,0.92,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawSky();
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const M=mvp();
  gl.depthMask(false);drawLines(BG,M);gl.depthMask(true);
  if(faceCount){
    gl.useProgram(faceProg);gl.uniformMatrix4fv(FL.uMVP,false,M);gl.uniform1f(FL.uHover,hoverIdx);
    gl.uniform3fv(FL.uSun,norm([0.35,-0.55,0.8]));gl.uniform3fv(FL.uFill,norm([-0.6,0.5,0.2]));gl.uniform3fv(FL.uBack,BACK);
    attrib(FL.aPos,BF.pos,3);attrib(FL.aNor,BF.nor,3);attrib(FL.aCol,BF.col,3);attrib(FL.aId,BF.id,1);attrib(FL.aSel,BF.sel,1);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,4);
    gl.drawArrays(gl.TRIANGLES,0,faceCount);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    for(const a of ['aPos','aNor','aCol','aId','aSel'])if(FL[a]>=0)gl.disableVertexAttribArray(FL[a]);
  }
  drawLines(BE,M,0.002,true);
  if(BC.n){gl.disable(gl.DEPTH_TEST);drawLines(BC,M);gl.enable(gl.DEPTH_TEST);}
  placeGhosts();
  if(BH.n&&ghostOn){gl.disable(gl.DEPTH_TEST);drawLines(BH,M);gl.enable(gl.DEPTH_TEST);}
  if(preview.lines.length){
    const P=[],C=[];for(const [a,b,c] of preview.lines){P.push(...a,...b);C.push(...c,...c);}
    upload(BP.pos,P);upload(BP.col,C);BP.n=P.length/3;
    gl.disable(gl.DEPTH_TEST);drawLines(BP,M,0,true);gl.enable(gl.DEPTH_TEST);
  }
  placeMarker();
  placeDims();
  drawCube();
  drawProblems();
};
// Print-check overlay: thick red gaps and orange inside-out faces, drawn on top so they can't be missed.
const ov=$cad('ov'),ovx=ov.getContext('2d');
const drawProblems=function drawProblems(){
  const dpr=window.devicePixelRatio||1;
  if(ov.width!==cv.width||ov.height!==cv.height){ov.width=cv.width;ov.height=cv.height;}
  ovx.clearRect(0,0,ov.width,ov.height);
  if(!check)return;
  ovx.lineCap='round';ovx.lineJoin='round';
  const seg=(a,b)=>{const s=toScreen(a),t=toScreen(b);if(!s||!t)return false;ovx.moveTo(s[0]*dpr,s[1]*dpr);ovx.lineTo(t[0]*dpr,t[1]*dpr);return true;};
  // inside-out faces: orange outline
  ovx.beginPath();
  for(const f of model.faces)if(check.wrongFaces.has(f.id))for(const L of loops(f))for(let i=0;i<L.length;i++)seg(L[i],L[(i+1)%L.length]);
  ovx.strokeStyle='#ff8c00';ovx.lineWidth=3.5*dpr;ovx.stroke();
  // gaps: red line with a white edge, plus a dot so even tiny gaps show
  ovx.beginPath();for(const [a,b] of check.openSegs)seg(a,b);
  ovx.strokeStyle='#ffffff';ovx.lineWidth=7*dpr;ovx.stroke();
  ovx.strokeStyle='#e0141e';ovx.lineWidth=4*dpr;ovx.stroke();
  ovx.fillStyle='#e0141e';
  for(const [a,b] of check.openSegs){const s=toScreen(mul(add(a,b),0.5));if(!s)continue;ovx.beginPath();ovx.arc(s[0]*dpr,s[1]*dpr,4.5*dpr,0,Math.PI*2);ovx.fill();}
};
