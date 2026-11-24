// EvenUCan Enclosure Wizard - 02-geometry-engine.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- geometry engine (embedded Manifold)
let enginePromise=null;
const engine=function engine(){
  if(!enginePromise)enginePromise=(async()=>{
    const s=atob(window.MANIFOLD_WASM_B64),bin=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++)bin[i]=s.charCodeAt(i);
    const w=await window.ManifoldModule({wasmBinary:bin,locateFile:()=>'manifold.wasm'});
    w.setup();return w;
  })();
  return enginePromise;
};

// ---- Off-thread geometry worker (prevents UI freeze on heavy Manifold ops like threaded holes)
// The worker is created once and reused. It initialises its own Manifold WASM instance so all
// CPU-bound boolean/extrude operations run in a background thread with no "page not responding".
let _geoWorker=null,_geoWorkerReady=false,_geoPending=[],_geoJobs=new Map(),_geoJobId=0;
const _ensureGeoWorker=function _ensureGeoWorker(){
  if(_geoWorker)return;
  // Build the worker source: embed ManifoldModule source + threadCutter + message handler.
  // ManifoldModule is the async WASM loader already on window; .toString() gives its source.
  const mfSrc=window.ManifoldModule.toString();
  const workerSrc=`
const ManifoldModule=${mfSrc};
let _w=null;
function threadCutter(w,K,{Rmaj,Rmin,P},h){
  const prof=u=>{u=((u%P)+P)%P;
    if(u<P/8)return Rmaj;if(u<7*P/16)return Rmaj-(Rmaj-Rmin)*(u-P/8)/(5*P/16);
    if(u<11*P/16)return Rmin;return Rmin+(Rmaj-Rmin)*(u-11*P/16)/(5*P/16);};
  const N=Math.max(36,Math.min(72,Math.round(Rmaj*12))),poly=[];
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2,r=prof(-a/(2*Math.PI)*P);poly.push([r*Math.cos(a),r*Math.sin(a)]);}
  return K(w.Manifold.extrude([poly],h,Math.ceil(h/P*12),360*h/P));
}
self.onmessage=async e=>{
  const d=e.data;
  if(d.type==='init'){
    try{_w=await ManifoldModule({wasmBinary:d.bin,locateFile:()=>'manifold.wasm'});_w.setup();self.postMessage({type:'ready'});}
    catch(er){self.postMessage({type:'initfail',message:er&&er.message||String(er)});}
    return;
  }
  if(d.type==='drill'){
    const{bodyVerts,bodyTris,parts,through,pos,rotation,id}=d;
    const w=_w,M=w.Manifold,pool=[],K=x=>{pool.push(x);return x;},S=1000;
    try{
      const mesh=new w.Mesh({numProp:3,
        vertProperties:new Float32Array(bodyVerts.flatMap(p=>[p[0]*S,p[1]*S,p[2]*S])),
        triVerts:new Uint32Array(bodyTris.flat())});
      mesh.merge();
      const body=K(new w.Manifold(mesh));
      let cut=null;
      for(const q of parts){
        const depth=q.to==null?through:q.to,over=0.3;
        const piece=q.thread?K(threadCutter(w,K,q.thread,depth+over).translate([0,0,-depth]))
          :q.cone?K(M.cylinder(depth+over,q.cone[1]/2,q.cone[0]/2+over,48).translate([0,0,-depth]))
          :K(M.cylinder(depth+over,(q.hex?q.d/Math.sqrt(3):q.d/2),-1,q.hex?6:Math.max(24,Math.round(q.d*8))).translate([0,0,-depth]));
        cut=cut?K(cut.add(piece)):piece;
      }
      const[th,ph]=rotation;
      cut=K(K(cut.rotate([0,th,ph])).translate(pos));
      const out=K(body.subtract(cut));
      if(out.isEmpty())throw new Error('nothing would be left');
      const g=out.getMesh();
      const T=g.triVerts,P=g.vertProperties;
      self.postMessage({type:'result',id,T,P,numProp:g.numProp},[T.buffer,P.buffer]);
    }catch(er){self.postMessage({type:'error',id,message:er&&er.message||String(er)});}
    finally{for(const x of pool)try{x.delete();}catch(e){}}
  }
};`;
  _geoWorker=new Worker(URL.createObjectURL(new Blob([workerSrc],{type:'text/javascript'})));
  _geoWorker.onmessage=e=>{
    const d=e.data;
    if(d.type==='ready'){_geoWorkerReady=true;for(const f of _geoPending)f();_geoPending=[];}
    else if(d.type==='initfail'){console.error('EvenUCan: geo worker init failed',d.message);}
    else{const cb=_geoJobs.get(d.id);if(cb){cb(d);_geoJobs.delete(d.id);}}
  };
  // Decode WASM binary and send to worker (structured clone, not transfer — engine() may need it too)
  const s=atob(window.MANIFOLD_WASM_B64),bin=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++)bin[i]=s.charCodeAt(i);
  _geoWorker.postMessage({type:'init',bin:bin.buffer});
};
const _runInGeoWorker=function _runInGeoWorker(msg){
  _ensureGeoWorker();
  return new Promise((resolve,reject)=>{
    const id=++_geoJobId;msg=Object.assign({},msg,{id});
    const dispatch=()=>{
      _geoJobs.set(id,d=>d.type==='result'?resolve(d):reject(new Error(d.message||'geo worker error')));
      _geoWorker.postMessage(msg);
    };
    if(_geoWorkerReady)dispatch();else _geoPending.push(dispatch);
  });
};
