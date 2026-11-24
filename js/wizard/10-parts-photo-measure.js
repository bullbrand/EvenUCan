// EvenUCan Enclosure Wizard - 10-parts-photo-measure.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- photo measuring: straighten a top photo from its 4 corners; heights from a side photo
let photoKind='top';
const pickPhoto=function pickPhoto(kind){
  if(kind==='top'&&!(ed.w>0&&ed.d>0))return WF.flash('Type the board size first');
  photoKind=kind;photoFrom='';$('plPhotoIn').click();
};
// The photo isn't used as-is: a few clicks on it line it up with the part's real size first (the small
// yellow hint bar above the picture says so too, but it's easy to miss next to a big photo you're looking
// at) - so say it up front, in something the person has to dismiss, not just a line of text they can skip past.
$('plPhotoIn').addEventListener('change',e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const url=URL.createObjectURL(file),im=new Image();
  im.onload=async()=>{
    rawImg=im;clicks=[];edMode=photoKind==='top'?'corners':'side';renderEditor();
    await askHtml(photoKind==='top'
      ?'<div class="kHead"><b>Line up the photo</b></div><p style="margin:0">It isn\'t used yet - click the <b>4 corners of the board</b> in the picture, in this order: <b>top-left, top-right, bottom-right, bottom-left</b>. That lines the photo up with the part\'s real size.</p>'
      :'<div class="kHead"><b>Line up the photo</b></div><p style="margin:0">It isn\'t used yet - click 5 points on the picture in order: the board\'s <b>left end</b> and <b>right end</b> (both at the bottom of the board), its <b>top surface</b>, the <b>top of the tallest part</b>, then the <b>bottom tip of any pins</b> underneath.</p>',
      ['Got it'],0);
  };
  im.onerror=()=>WF.flash('Could not read that picture');
  im.src=url;
});
// Product image: resize to max 600 px on the longest side, store as JPEG in ed.img.
$('plImgIn').addEventListener('change',e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const url=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{
    URL.revokeObjectURL(url);
    const K=Math.min(1,600/Math.max(im.naturalWidth,im.naturalHeight));
    const oc=document.createElement('canvas');oc.width=Math.round(im.naturalWidth*K);oc.height=Math.round(im.naturalHeight*K);
    oc.getContext('2d').drawImage(im,0,0,oc.width,oc.height);
    ed.img=oc.toDataURL('image/jpeg',0.82);
    imgSave(ed.id,ed.img);
    const bp=builtinById(ed.id);if(bp)bp.img=ed.img;
    const cp=custom.find(c=>c.id===ed.id);if(cp)cp.img=ed.img;
    thumbInvalidate(ed.id);
    markDirty();renderEditor();renderList();
  };
  im.onerror=()=>{URL.revokeObjectURL(url);WF.flash('Could not read that picture');};
  im.src=url;
});
const solve=function solve(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    [M[c],M[p]]=[M[p],M[c]];const d=M[c][c];if(Math.abs(d)<1e-12)throw new Error('points in a line');
    for(let r=0;r<n;r++){if(r===c)continue;const k=M[r][c]/d;for(let j=c;j<=n;j++)M[r][j]-=k*M[c][j];}
  }
  return M.map((r,i)=>r[n]/r[i]);
};
// Projective map taking src[i] to dst[i] (4 point pairs).
const homography=function homography(src,dst){
  const A=[],b=[];
  for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
  return [...solve(A,b),1];
};
const finishCorners=function finishCorners(){
  const p=ed,s=Math.min(10,900/Math.max(p.w,p.d)),ow=Math.max(8,Math.round(p.w*s)),oh=Math.max(8,Math.round(p.d*s));
  const out=document.createElement('canvas');out.width=ow;out.height=oh;const oc=out.getContext('2d');
  let turned=false;
  try{
    if(p.shape==='round'){
      // circle through the 3 clicks, then crop the square around it
      const [[ax,ay],[bx,by],[cx,cy]]=clicks,d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-9)throw new Error('points in a line');
      const ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d,uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d,r=Math.hypot(ax-ux,ay-uy);
      oc.fillStyle='#e6e6e6';oc.fillRect(0,0,ow,oh);oc.drawImage(rawImg,ux-r,uy-r,2*r,2*r,0,0,ow,oh);
    }else{
      // Photo taken the other way round (e.g. a portrait shot of a board whose Length runs left→right):
      // the clicked shape is tall where the part is wide, so start from the 2nd corner (a quarter turn).
      const dd=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),[c0,c1,c2,c3]=clicks;
      const across=(dd(c0,c1)+dd(c3,c2))/2,down=(dd(c1,c2)+dd(c0,c3))/2,want=Math.log(p.w/p.d);
      if(Math.abs(want)>0.15&&Math.abs(Math.log(down/across)-want)<Math.abs(Math.log(across/down)-want)){clicks=[c1,c2,c3,c0];turned=true;}
      const k=Math.min(1,2400/Math.max(rawImg.naturalWidth,rawImg.naturalHeight)),sw=Math.round(rawImg.naturalWidth*k),sh=Math.round(rawImg.naturalHeight*k);
      const sc=document.createElement('canvas');sc.width=sw;sc.height=sh;const sx=sc.getContext('2d');sx.drawImage(rawImg,0,0,sw,sh);
      const src=sx.getImageData(0,0,sw,sh).data,Hm=homography([[0,0],[ow,0],[ow,oh],[0,oh]],clicks.map(([x,y])=>[x*k,y*k]));
      const id=oc.createImageData(ow,oh),o=id.data;
      for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
        const X=x+0.5,Y=y+0.5,w=Hm[6]*X+Hm[7]*Y+1,u=(Hm[0]*X+Hm[1]*Y+Hm[2])/w-0.5,v=(Hm[3]*X+Hm[4]*Y+Hm[5])/w-0.5,i=(y*ow+x)*4;
        o[i+3]=255;
        if(u<0||v<0||u>=sw-1||v>=sh-1){o[i]=o[i+1]=o[i+2]=230;continue;}
        const x0=u|0,y0=v|0,fx_=u-x0,fy_=v-y0,q=(y0*sw+x0)*4;
        for(let ch=0;ch<3;ch++){const a=src[q+ch]*(1-fx_)+src[q+4+ch]*fx_,b=src[q+sw*4+ch]*(1-fx_)+src[q+sw*4+4+ch]*fx_;o[i+ch]=a*(1-fy_)+b*fy_;}
      }
      oc.putImageData(id,0,0);
    }
  }catch(err){WF.flash('Those points don\'t make a board outline. Try again.');clicks=[];setHint();drawEd();return;}
  ed.photo=out.toDataURL('image/jpeg',0.82);
  if(photoFrom){ed.notes=('Photo from '+photoFrom+'\n'+(ed.notes||'')).slice(0,2000);photoFrom='';}
  edMode='select';clicks=[];rawImg=null;markDirty();renderEditor();
  WF.flash(turned?'The photo was taken the other way round, so it has been turned a quarter to match the part\'s sizes. If it is upside down, click "Turn photo 180°".':'Photo straightened to scale. Now add features: pick a button above the picture, then click or drag on it.',turned?8000:6000);
};
// Turn the straightened photo a quarter turn clockwise (90°).
const turnPhoto90=function turnPhoto90(){
  const im=imgOf(ed.photo);if(!im)return;
  const c=document.createElement('canvas');c.width=im.naturalHeight;c.height=im.naturalWidth;
  const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);
  ed.photo=c.toDataURL('image/jpeg',0.82);markDirty();drawEd();renderList();
  if(typeof WF!=='undefined'&&WF.flash)WF.flash('Rotated photo 90° clockwise');
};
// Turn the straightened photo half a turn (it keeps the same size and scale).
const turnPhoto=function turnPhoto(){
  const im=imgOf(ed.photo);if(!im)return;
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const x=c.getContext('2d');x.translate(c.width,c.height);x.rotate(Math.PI);x.drawImage(im,0,0);
  ed.photo=c.toDataURL('image/jpeg',0.82);markDirty();drawEd();renderList();
  if(typeof WF!=='undefined'&&WF.flash)WF.flash('Turned photo 180° upside down');
};
// Turn a whole part a quarter turn clockwise, seen from above: the top edge becomes the right edge.
// Its sizes, features, pins and photo all turn together.
const TURN_SIDE={ymax:'xmax',xmax:'ymin',ymin:'xmin',xmin:'ymax'};
const PIN_TURN_SIDE={left:'top',top:'right',right:'bottom',bottom:'left'};
const turnPart=async function turnPart(p){
  const w=p.w,turn=o=>{const x=o.x;o.x=o.y;o.y=+(w-x).toFixed(2);};
  for(const f of p.features||[]){
    if(f.side){if(f.side==='ymin'||f.side==='ymax')f.u=+(w-f.u).toFixed(2);f.side=TURN_SIDE[f.side];}
    if(f.x!==undefined)turn(f);
    if(f.fw!==undefined)[f.fw,f.fd]=[f.fd,f.fw];
    if(f.cw!==undefined)[f.cw,f.ch]=[f.ch,f.cw];
  }
  for(const q of p.pins||[]){
    if(q.x!==undefined)turn(q);
    if(q.side&&PIN_TURN_SIDE[q.side])q.side=PIN_TURN_SIDE[q.side];
  }
  [p.w,p.d]=[p.d,w];
  if(p.photo){
    const im=await loadImg(p.photo),c=document.createElement('canvas');c.width=im.naturalHeight;c.height=im.naturalWidth;
    const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);
    p.photo=c.toDataURL('image/jpeg',0.85);
    photoSave(p.id, p.photo);
    thumbInvalidate(p.id);
  }
};
const finishSide=function finishSide(pins){
  const [a,b,top,tall]=clicks,ref=sideRef==='d'?ed.d:ed.w,L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(L<5)return WF.flash('The two ends are too close together. Try again.');
  const mmPerPx=ref/L,dist=q=>Math.abs((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))/L*mmPerPx;
  ed.pcb=r1(dist(top));ed.h=r1(Math.max(0,dist(tall)-ed.pcb));ed.below=pins?r1(dist(pins)):0;
  edMode='select';clicks=[];rawImg=null;markDirty();renderEditor();
  WF.flash(`Measured: board ${fx(ed.pcb)} mm, tallest part ${fx(ed.h)} mm above it, ${fx(ed.below)} mm underneath. Check the numbers look right.`,7000);
};

// Opens the Measure a Part from Photos page (moved here from the old photo-rig file).
const openPhotoMeasurement=function openPhotoMeasurement() {
  const origin = (location.protocol.startsWith('http')) 
    ? location.origin 
    : 'http://localhost:8080';
  const url = origin + '/measure-part.html';
  const w = 1260;
  const h = 880;
  const left = Math.max(0, Math.round((screen.availWidth - w) / 2));
  const top = Math.max(0, Math.round((screen.availHeight - h) / 2));
  const win = window.open(url, 'EvenUCan_MeasurePart', `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`);
  if (win) {
    try { win.focus(); } catch (e) {}
    if (typeof flash === 'function') {
      flash('Photo Measuring tool opened. Scanned parts will automatically save into your Parts Library.', 6000);
    }
  } else {
    window.open(url, '_blank');
  }
};
window.openPhotoMeasurement = openPhotoMeasurement;
