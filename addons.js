// ================================================================
//  addons.js v2 – Nexus Engine Addons
//  SSAO 32samples hemisfera · SSR ray-march · DOF Bokeh · ColorGrade
//  Renderizacao em Tempo Real progressiva · Volumetric Mie Scattering
//  Minerios shape-aware + diamantes longos · Gosma Ben-10 style
//  Gerador PBR procedural · Sistema de Luzes avancado
// ================================================================
import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { ShaderPass } from 'https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/ShaderPass.js';

function waitNexus(){return new Promise(r=>{const t=setInterval(()=>{if(window._nexusScene&&window._nexusFinalComposer&&window._nexusCamera){clearInterval(t);r();}},80);})}

// ─── SSAO 32 samples hemisfera ────────────────────────────────
const SSAOShader={uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1920,1080)},radius:{value:0.15},intensity:{value:1.0},bias:{value:0.025},time:{value:0.0}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`
uniform sampler2D tDiffuse;uniform vec2 resolution;uniform float radius,intensity,bias,time;varying vec2 vUv;
float hash13(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float pseudoDepth(vec2 uv){return dot(texture2D(tDiffuse,uv).rgb,vec3(0.299,0.587,0.114));}
vec3 estimateNormal(vec2 uv){vec2 e=1.5/resolution;float l=pseudoDepth(uv-vec2(e.x,0.)),r=pseudoDepth(uv+vec2(e.x,0.)),d=pseudoDepth(uv-vec2(0.,e.y)),u=pseudoDepth(uv+vec2(0.,e.y));return normalize(vec3(l-r,d-u,0.04));}
void main(){
  vec4 color=texture2D(tDiffuse,vUv);vec2 px=1.0/resolution;
  vec3 normal=estimateNormal(vUv);float refDepth=pseudoDepth(vUv);float ao=0.0;
  float goldenAngle=2.399963;
  for(int i=0;i<32;i++){
    float fi=float(i);float theta=goldenAngle*fi;float sinPhi=sqrt((fi+0.5)/32.0);float cosPhi=sqrt(1.0-sinPhi*sinPhi);
    float rot=hash13(vec3(vUv*resolution,time+fi))*6.2831;float st=sin(theta+rot),ct=cos(theta+rot);
    vec3 sampleDir=vec3(ct*cosPhi,sinPhi,st*cosPhi);if(dot(sampleDir,normal)<0.0)sampleDir=-sampleDir;
    vec2 sampleUV=clamp(vUv+sampleDir.xz*px*radius*50.0,px,1.0-px);float sD=pseudoDepth(sampleUV);
    float rC=smoothstep(0.0,1.0,radius/max(abs(sD-refDepth),0.0001));ao+=(sD>refDepth+bias?1.0:0.0)*rC;
  }
  ao=1.0-(ao/32.0)*intensity;
  // 3x3 blur
  float aoB=0.0;for(int bx=-1;bx<=1;bx++)for(int by=-1;by<=1;by++){vec2 o=vec2(float(bx),float(by))*px;float w=exp(-abs(pseudoDepth(vUv+o)-refDepth)*20.0);aoB+=ao*w;}ao=aoB/9.0;
  color.rgb*=clamp(ao,0.0,1.0);gl_FragColor=color;
}`};

// ─── SSR ray-march ─────────────────────────────────────────────
const SSRShader={uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1920,1080)},intensity:{value:0.5},roughCut:{value:0.5},time:{value:0.0}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`
uniform sampler2D tDiffuse;uniform vec2 resolution;uniform float intensity,roughCut,time;varying vec2 vUv;
float lum(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
vec3 estimateNorm(vec2 uv){vec2 e=1.5/resolution;float l=lum(texture2D(tDiffuse,uv-vec2(e.x,0.)).rgb),r=lum(texture2D(tDiffuse,uv+vec2(e.x,0.)).rgb),d=lum(texture2D(tDiffuse,uv-vec2(0.,e.y)).rgb),u=lum(texture2D(tDiffuse,uv+vec2(0.,e.y)).rgb);return normalize(vec3(l-r,0.05,d-u));}
void main(){
  vec4 color=texture2D(tDiffuse,vUv);float rough=1.0-lum(color.rgb);
  if(rough>roughCut){gl_FragColor=color;return;}
  vec3 norm=estimateNorm(vUv);vec3 viewDir=vec3(vUv*2.0-1.0,-1.0);vec3 reflDir=reflect(normalize(viewDir),norm);
  vec2 stepSize=(reflDir.xy/abs(reflDir.z+0.001))*(1.0/resolution)*2.5;vec2 curUV=vUv;vec3 reflColor=vec3(0.0);float hit=0.0;
  for(int i=0;i<32;i++){curUV+=stepSize*(1.0+float(i)*0.15);if(curUV.x<0.||curUV.x>1.||curUV.y<0.||curUV.y>1.)break;
    vec3 s=texture2D(tDiffuse,curUV).rgb;if(lum(s)>lum(color.rgb)+0.15){float fade=pow(1.0-float(i)/32.0,2.0);reflColor=s*fade;hit=fade;break;}}
  float rf=(1.0-rough/roughCut)*intensity*hit;color.rgb=mix(color.rgb,reflColor,rf);gl_FragColor=color;
}`};

// ─── DOF Bokeh ─────────────────────────────────────────────────
const DOFShader={uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1920,1080)},focusDepth:{value:0.5},focalRange:{value:0.2},bokehRadius:{value:8.0},bokehBlades:{value:6.0},time:{value:0.0}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`
uniform sampler2D tDiffuse;uniform vec2 resolution;uniform float focusDepth,focalRange,bokehRadius,bokehBlades;varying vec2 vUv;
float lum(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
vec3 bokeh(vec2 uv,float radius){
  vec3 acc=vec3(0.0);float w=0.0;
  vec2 disk[16];disk[0]=vec2(0.,0.5);disk[1]=vec2(0.5,0.);disk[2]=vec2(-0.5,0.);disk[3]=vec2(0.,-0.5);disk[4]=vec2(0.354,0.354);disk[5]=vec2(-0.354,0.354);disk[6]=vec2(0.354,-0.354);disk[7]=vec2(-0.354,-0.354);disk[8]=vec2(0.,0.875);disk[9]=vec2(0.875,0.);disk[10]=vec2(-0.875,0.);disk[11]=vec2(0.,-0.875);disk[12]=vec2(0.619,0.619);disk[13]=vec2(-0.619,0.619);disk[14]=vec2(0.619,-0.619);disk[15]=vec2(-0.619,-0.619);
  for(int i=0;i<16;i++){float a=atan(disk[i].y,disk[i].x);float bA=floor(a/(6.2831/bokehBlades))*(6.2831/bokehBlades);float bR=cos(3.14159/bokehBlades)/max(0.001,cos(a-bA-(6.2831/bokehBlades)*0.5));if(length(disk[i])>bR)continue;vec4 s=texture2D(tDiffuse,uv+disk[i]*radius/resolution);float wt=1.0+lum(s.rgb)*2.0;acc+=s.rgb*wt;w+=wt;}
  return w>0.?acc/w:texture2D(tDiffuse,uv).rgb;}
void main(){vec4 color=texture2D(tDiffuse,vUv);float depth=lum(color.rgb);float coc=clamp(abs(depth-focusDepth)/max(focalRange,0.001),0.,1.);float blur=coc*bokehRadius;if(blur<0.5){gl_FragColor=color;return;}color.rgb=bokeh(vUv,blur);gl_FragColor=color;}`};

// ─── Color Grading / ACES Tonemapping ──────────────────────────
const ColorGradeShader={uniforms:{tDiffuse:{value:null},exposure:{value:1.0},contrast:{value:1.0},saturation:{value:1.0},temperature:{value:0.0},tint:{value:0.0},tonemap:{value:1.0}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`
uniform sampler2D tDiffuse;uniform float exposure,contrast,saturation,temperature,tint,tonemap;varying vec2 vUv;
vec3 ACES(vec3 x){float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);}
vec3 Filmic(vec3 c){c=max(vec3(0.),c-0.004);return(c*(6.2*c+0.5))/(c*(6.2*c+1.7)+0.06);}
void main(){
  vec4 color=texture2D(tDiffuse,vUv);vec3 c=color.rgb*exposure;
  float l=dot(c,vec3(0.299,0.587,0.114));c=mix(vec3(l),c,saturation);c=mix(vec3(0.5),c,contrast);
  c.r+=temperature*0.08;c.b-=temperature*0.08;c.g+=tint*0.06;c.r-=tint*0.03;c.b-=tint*0.03;
  if(tonemap<0.5)c=clamp(c,0.,1.);else if(tonemap<1.5)c=ACES(c);else c=Filmic(c);
  gl_FragColor=vec4(c,color.a);}`};

// ─── Chroma + Barrel ───────────────────────────────────────────
const ChromaShader={uniforms:{tDiffuse:{value:null},intensity:{value:0.008},edgeFactor:{value:0.8},barrelK:{value:0.04}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform float intensity,edgeFactor,barrelK;varying vec2 vUv;
vec2 barrel(vec2 uv){vec2 c=uv-0.5;return c*(1.0+barrelK*dot(c,c))+0.5;}
void main(){vec2 uv=barrel(vUv);vec2 cen=uv-0.5;float edge=pow(length(cen)*2.,edgeFactor);vec2 off=cen*intensity*edge;
float r=texture2D(tDiffuse,clamp(uv-off,0.,1.)).r,g=texture2D(tDiffuse,clamp(uv,0.,1.)).g,b=texture2D(tDiffuse,clamp(uv+off*1.5,0.,1.)).b;gl_FragColor=vec4(r,g,b,1.);}`};

// ─── Film Grain blue-noise ──────────────────────────────────────
const GrainShader={uniforms:{tDiffuse:{value:null},intensity:{value:0.06},grainSize:{value:1.5},time:{value:0.0}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform float intensity,grainSize,time;varying vec2 vUv;
float bn(vec2 uv){float a=fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453);float b=fract(sin(dot(uv,vec2(63.7264,10.873)))*28756.2341);return(a+b)*0.5-0.5;}
void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(0.299,0.587,0.114));float mask=4.*l*(1.-l);vec2 uv2=floor(vUv*800./grainSize+time*61.3)/800.*grainSize+vec2(time*0.07,time*0.11);c.rgb+=bn(uv2)*mask*intensity;gl_FragColor=c;}`};

// ─── Vignette ──────────────────────────────────────────────────
const VignetteShader={uniforms:{tDiffuse:{value:null},offset:{value:1.0},darkness:{value:1.0},color:{value:new THREE.Color(0,0,0)},feather:{value:0.5}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform float offset,darkness,feather;uniform vec3 color;varying vec2 vUv;
void main(){vec4 t=texture2D(tDiffuse,vUv);vec2 uv=(vUv-0.5)*offset;float d=length(uv);float v=pow(clamp(smoothstep(1.-feather,1.+feather,d),0.,1.),darkness);t.rgb=mix(t.rgb,color*0.08,v);gl_FragColor=t;}`};

// ================================================================
//  VOLUMETRIC LIGHT v2 — Mie Scattering + Dust + Halo
// ================================================================
class VolumetricLightSystem{
  constructor(scene,camera){this.scene=scene;this.camera=camera;this.lights=new Map();}
  _getType(o){const l=o.userData?.light||o;if(l.isSpotLight)return'spot';if(l.isDirectionalLight)return'directional';return'point';}
  createVolumeMesh(lightObj,config){
    this.removeVolume(lightObj);
    const color=new THREE.Color(config.color||'#ffffff');
    const density=config.density||0.3,scatter=config.scatter||0.6;
    const range=(lightObj.userData?.light?.distance||8)*0.6;
    const ltype=this._getType(lightObj);
    const group=new THREE.Group();group.userData.isVolGroup=true;
    const volGeo=ltype==='spot'?new THREE.ConeGeometry(range*0.6,range*1.2,24,8,true):new THREE.SphereGeometry(range,24,16);
    const volMat=new THREE.ShaderMaterial({uniforms:{color:{value:color.clone()},density:{value:density},scatter:{value:scatter},time:{value:0.0},camPos:{value:new THREE.Vector3()},lightPos:{value:new THREE.Vector3()},range:{value:range}},
    vertexShader:`varying vec3 vWorldPos,vLocalPos,vViewDir;uniform vec3 camPos;void main(){vLocalPos=position;vec4 wp=modelMatrix*vec4(position,1.);vWorldPos=wp.xyz;vViewDir=normalize(camPos-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader:`
    uniform vec3 color,camPos,lightPos;uniform float density,scatter,time,range;varying vec3 vWorldPos,vLocalPos,vViewDir;
    float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5);}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){return noise(p)*0.5+noise(p*2.1)*0.25+noise(p*4.3)*0.125;}
    float hg(float ct,float g){float g2=g*g;return(1.-g2)/(4.*3.14159*pow(1.+g2-2.*g*ct,1.5));}
    void main(){
      float dist=length(vLocalPos)/range;if(dist>1.0)discard;
      float falloff=1.0-dist*dist;
      vec3 np=vWorldPos*0.4+vec3(time*0.04,time*0.02,-time*0.03);
      float dust=fbm(np)*0.8+0.2;
      vec3 toLight=normalize(lightPos-vWorldPos);float ct=dot(vViewDir,toLight);
      float phase=hg(ct,scatter*0.7);
      float alpha=density*falloff*dust*(0.5+phase*0.5);alpha=clamp(alpha,0.,0.55);
      vec3 warm=mix(color,color*vec3(1.2,1.1,0.9),(1.-dist)*0.3)*(1.+phase*scatter*0.8);
      gl_FragColor=vec4(warm,alpha);}`,
    transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false});
    const volMesh=new THREE.Mesh(volGeo,volMat);if(ltype==='spot')volMesh.rotation.x=Math.PI;group.add(volMesh);
    // Dust particles
    const pCount=80,pGeo=new THREE.BufferGeometry();const pPos=new Float32Array(pCount*3),pSeed=new Float32Array(pCount);
    for(let i=0;i<pCount;i++){const r=range*Math.cbrt(Math.random()),th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);pPos[i*3]=r*Math.sin(ph)*Math.cos(th);pPos[i*3+1]=r*Math.sin(ph)*Math.sin(th);pPos[i*3+2]=r*Math.cos(ph);pSeed[i]=Math.random();}
    pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('seed',new THREE.BufferAttribute(pSeed,1));
    const pMat=new THREE.PointsMaterial({color,size:range*0.03,transparent:true,opacity:density*0.4,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
    const dust=new THREE.Points(pGeo,pMat);group.add(dust);
    if(ltype==='point'){const hGeo=new THREE.TorusGeometry(range*0.25,range*0.04,8,32);const hMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:density*0.3,blending:THREE.AdditiveBlending,depthWrite:false});const halo=new THREE.Mesh(hGeo,hMat);halo.userData.isHalo=true;group.add(halo);}
    const wp=new THREE.Vector3();lightObj.getWorldPosition(wp);group.position.copy(wp);volMat.uniforms.lightPos.value.copy(wp);
    this.scene.add(group);this.lights.set(lightObj.uuid,{group,volMat,pGeo,pPos,range});return group;
  }
  removeVolume(lo){const d=this.lights.get(lo.uuid);if(!d)return;this.scene.remove(d.group);d.group.traverse(c=>{c.geometry?.dispose();c.material?.dispose?.();});this.lights.delete(lo.uuid);}
  update(delta){
    const cp=this.camera.position;
    this.lights.forEach(d=>{
      if(d.volMat){d.volMat.uniforms.time.value+=delta;d.volMat.uniforms.camPos.value.copy(cp);}
      if(d.pGeo&&d.pPos){const pos=d.pGeo.attributes.position,seed=d.pGeo.attributes.seed,t=d.volMat?.uniforms.time.value||0;
        for(let i=0;i<pos.count;i++){const s=seed.getX(i);pos.setY(i,d.pPos[i*3+1]+Math.sin(t*(0.02+s*0.03)+s*6.28)*d.range*0.08);pos.setX(i,d.pPos[i*3]+Math.cos(t*(0.015+s*0.02)+s*3.14)*d.range*0.04);}pos.needsUpdate=true;}
      d.group.children.forEach(c=>{if(c.userData?.isHalo)c.rotation.y+=delta*0.3;});
    });
  }
}

// ================================================================
//  MINERAL SYSTEM v2 — Shape-aware + Cristais longos
// ================================================================
const MINERAL_CONFIGS={
  diamond: {crystalColor:0xb3e8ff,emissive:0x38bdf8,emissiveIntensity:1.8,metalness:0.0,roughness:0.0,stoneColor:0x8899aa,ior:2.42,heightMult:1.0,name:'Diamante'},
  emerald: {crystalColor:0x4ade80,emissive:0x16a34a,emissiveIntensity:1.0,metalness:0.0,roughness:0.05,stoneColor:0x3d5e3d,ior:1.57,heightMult:0.65,name:'Esmeralda'},
  ruby:    {crystalColor:0xfb7185,emissive:0xdc2626,emissiveIntensity:1.1,metalness:0.0,roughness:0.04,stoneColor:0x5c2626,ior:1.76,heightMult:0.7,name:'Rubi'},
  amethyst:{crystalColor:0xd8b4fe,emissive:0x7c3aed,emissiveIntensity:0.9,metalness:0.0,roughness:0.06,stoneColor:0x4a3060,ior:1.54,heightMult:0.75,name:'Ametista'},
  gold:    {crystalColor:0xfef08a,emissive:0xca8a04,emissiveIntensity:0.5,metalness:0.95,roughness:0.12,stoneColor:0x78600a,ior:1.0,heightMult:0.5,name:'Ouro'},
  obsidian:{crystalColor:0x312e81,emissive:0x4338ca,emissiveIntensity:0.5,metalness:0.7,roughness:0.02,stoneColor:0x0f0e1a,ior:1.50,heightMult:0.6,name:'Obsidiana'},
};
class MineralSystem{
  constructor(scene){this.scene=scene;this.active=new Map();}
  _detectShape(obj){const ud=obj.userData?.shapeType||'';if(ud)return ud;if(!obj.geometry)return'box';const t=obj.geometry.type||'';if(t.includes('Sphere'))return'sphere';if(t.includes('Cylinder'))return'cylinder';if(t.includes('Cone'))return'cone';if(t.includes('Torus'))return'torus';return'box';}
  _buildRock(obj,cfg){
    const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3();box.getSize(size);const shape=this._detectShape(obj);const s=Math.max(size.x,size.y,size.z);
    let geo;
    if(shape==='sphere')geo=new THREE.SphereGeometry(s*0.5,14,10);
    else if(shape==='cylinder')geo=new THREE.CylinderGeometry(size.x*0.5,size.x*0.5,size.y,14,6);
    else if(shape==='cone')geo=new THREE.ConeGeometry(size.x*0.5,size.y,14,6);
    else if(shape==='torus')geo=new THREE.TorusGeometry(size.x*0.35,size.x*0.12,12,32);
    else geo=new THREE.BoxGeometry(size.x,size.y,size.z,8,8,8);
    const pos=geo.attributes.position,norm=geo.attributes.normal;
    for(let i=0;i<pos.count;i++){const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i),nx=norm.getX(i),ny=norm.getY(i),nz=norm.getZ(i);const n=(Math.sin(px*5.1)*Math.cos(py*4.7)*Math.sin(pz*5.9)*0.055+Math.sin(px*9.3+1.1)*Math.cos(pz*8.7+2.3)*0.025+Math.sin(px*15.7+py*12.3+3.1)*0.012)*s*0.6;pos.setXYZ(i,px+nx*n,py+ny*n,pz+nz*n);}
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:cfg.stoneColor,roughness:0.88,metalness:0.04});
    const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }
  _buildCrystal(cfg,sizeScale,seed){
    const rng=s=>Math.abs(Math.sin(s*127.1+311.7)*43758.5453%1);
    const isDiamond=cfg.name==='Diamante';
    const segs=isDiamond?8:6;
    const hMult=isDiamond?(3.5+rng(seed*1.2)*2.5):(1.2+rng(seed*1.3)*1.0);
    const height=hMult*sizeScale*cfg.heightMult;const radius=(isDiamond?0.06:0.09)+rng(seed*2.7)*0.08;const r=radius*sizeScale;
    const H2=height*0.5;
    const ringY=isDiamond?[-H2,-H2*0.4,0,H2*0.4,H2]:[-H2,H2*0.1,H2];
    const ringR=isDiamond?[0.01,r*1.0,r*1.15,r*1.0,0.01]:[r*0.85,r*1.0,0.01];
    const verts=[],norms=[],idx=[];
    for(let ri=0;ri<ringY.length;ri++){for(let si=0;si<segs;si++){const a=(si/segs)*Math.PI*2+ri*0.08;const rr=ringR[ri];verts.push(Math.cos(a)*rr,ringY[ri],Math.sin(a)*rr);norms.push(Math.cos(a),0,Math.sin(a));}}
    for(let ri=0;ri<ringY.length-1;ri++){for(let si=0;si<segs;si++){const a=ri*segs+si,b=ri*segs+(si+1)%segs,c=(ri+1)*segs+si,d=(ri+1)*segs+(si+1)%segs;idx.push(a,b,c,b,d,c);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(verts),3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(norms),3));geo.setIndex(idx);geo.computeVertexNormals();
    const mat=new THREE.MeshPhysicalMaterial({color:cfg.crystalColor,emissive:new THREE.Color(cfg.emissive),emissiveIntensity:cfg.emissiveIntensity*(0.6+rng(seed*4.9)*0.4),metalness:cfg.metalness,roughness:cfg.roughness,transparent:true,opacity:isDiamond?(0.55+rng(seed*6.1)*0.3):(0.7+rng(seed*6.1)*0.3),side:THREE.DoubleSide,clearcoat:isDiamond?1.0:0.3,clearcoatRoughness:0.0,ior:cfg.ior||1.5,reflectivity:isDiamond?1.0:0.5});
    const mesh=new THREE.Mesh(geo,mat);
    if(isDiamond){const iGeo=geo.clone(),iMat=new THREE.MeshBasicMaterial({color:cfg.emissive,transparent:true,opacity:0.2+rng(seed*8.3)*0.2,side:THREE.BackSide,blending:THREE.AdditiveBlending});const inner=new THREE.Mesh(iGeo,iMat);inner.scale.setScalar(0.85);mesh.add(inner);}
    return mesh;
  }
  _buildCluster(obj,cfg,density,crystalSize){
    const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3();box.getSize(size);const group=new THREE.Group();
    const rng=s=>Math.abs(Math.sin(s*127.1+311.7)*43758.5453%1);const count=Math.round(density);
    for(let i=0;i<count;i++){
      const c=this._buildCrystal(cfg,crystalSize,i*17.3+3.7);c.castShadow=true;c.layers.enable(1);
      const face=Math.floor(rng(i*3.14)*6);let px=0,py=0,pz=0,nx=0,ny=0,nz=0;const ru=(rng(i*5.1)-0.5)*0.85,rv=(rng(i*7.3)-0.5)*0.85;
      if(face===0){px=size.x*.5;py=size.y*ru;pz=size.z*rv;nx=1;}else if(face===1){px=-size.x*.5;py=size.y*ru;pz=size.z*rv;nx=-1;}else if(face===2){py=size.y*.5;px=size.x*ru;pz=size.z*rv;ny=1;}else if(face===3){py=-size.y*.5;px=size.x*ru;pz=size.z*rv;ny=-1;}else if(face===4){pz=size.z*.5;px=size.x*ru;py=size.y*rv;nz=1;}else{pz=-size.z*.5;px=size.x*ru;py=size.y*rv;nz=-1;}
      c.position.set(px,py,pz);const dir=new THREE.Vector3(nx,ny,nz).normalize(),up=new THREE.Vector3(0,1,0);const q=new THREE.Quaternion().setFromUnitVectors(up,dir);const spin=new THREE.Quaternion().setFromAxisAngle(dir,rng(i*9.2)*Math.PI*2);c.quaternion.copy(spin).multiply(q);const tq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rng(i)*2-1,rng(i*2)*2-1,rng(i*3)*2-1).normalize(),(rng(i*11.1)-0.5)*0.35);c.quaternion.premultiply(tq);group.add(c);
    }
    if(cfg.emissiveIntensity>0.4){const glow=new THREE.PointLight(cfg.emissive,cfg.emissiveIntensity*0.4,Math.max(size.x,size.y,size.z)*3.5);group.add(glow);}
    return group;
  }
  async applyMineral(obj,type,density,crystalSize,speed,onProgress){
    if(this.active.has(obj.uuid))this.removeMineral(obj);const cfg=MINERAL_CONFIGS[type];if(!cfg)return;
    const group=new THREE.Group();group.position.copy(obj.position);group.rotation.copy(obj.rotation);group.scale.copy(obj.scale);obj.visible=false;
    const rock=this._buildRock(obj,cfg);rock.scale.setScalar(0.01);group.add(rock);this.scene.add(group);this.active.set(obj.uuid,{group,originalObj:obj,type});
    await this._animScale(rock,1,0.7/speed,onProgress,0,0.45);
    const cluster=this._buildCluster(obj,cfg,density,crystalSize);cluster.scale.setScalar(0.01);group.add(cluster);
    await this._animScale(cluster,1,0.9/speed,onProgress,0.45,1.0);
    window._nexusInvalidateBloom?.();window._nexusRequestShadow?.();
  }
  _animScale(obj,target,dur,onProgress,pS,pE){return new Promise(res=>{const start=performance.now();const step=()=>{const t=Math.min((performance.now()-start)/(dur*1000),1.0);const ease=t<0.5?2*t*t:-1+(4-2*t)*t;obj.scale.setScalar(0.01+(target-0.01)*ease);onProgress?.(pS+(pE-pS)*t);t<1?requestAnimationFrame(step):(obj.scale.setScalar(target),onProgress?.(pE),res());};requestAnimationFrame(step);});}
  removeMineral(obj){const d=this.active.get(obj.uuid);if(!d)return;this.scene.remove(d.group);d.group.traverse(c=>{c.geometry?.dispose();c.material?.dispose?.();});d.originalObj.visible=true;this.active.delete(obj.uuid);window._nexusInvalidateBloom?.();}
}

// ================================================================
//  CLOTH SIMULATION
// ================================================================
class ClothSimulation{
  constructor(scene){this.scene=scene;this.cloths=new Map();}
  apply(obj,config){
    if(this.cloths.has(obj.uuid))this.remove(obj);const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3();box.getSize(size);const center=new THREE.Vector3();box.getCenter(center);const res=config.res||16,W=Math.max(size.x,.5),H=Math.max(size.y,.5);
    const particles=[];for(let i=0;i<=res;i++){particles[i]=[];for(let j=0;j<=res;j++){const px=center.x+(j/res-.5)*W,py=box.max.y+.01+(i/res)*H*.5,pz=center.z+(Math.random()-.5)*.01;particles[i][j]={pos:new THREE.Vector3(px,py,pz),prev:new THREE.Vector3(px,py,pz),pinned:i===0};}}
    const geo=new THREE.BufferGeometry(),positions=new Float32Array((res+1)*(res+1)*3),indices=[];
    for(let i=0;i<res;i++)for(let j=0;j<res;j++){const a=i*(res+1)+j,b=a+1,c=a+(res+1),d=c+1;indices.push(a,b,c,b,d,c);}
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setIndex(indices);
    const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(config.color||'#e0c080'),roughness:.7,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:.9});
    const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);
    const inst={particles,geo,mesh,config,restH:W/res,restV:H*.5/res};this.cloths.set(obj.uuid,inst);this._updateGeo(inst);
  }
  _updateGeo(inst){const pos=inst.geo.attributes.position,res=inst.config.res||16;for(let i=0;i<=res;i++)for(let j=0;j<=res;j++){const p=inst.particles[i][j],idx=i*(res+1)+j;pos.setXYZ(idx,p.pos.x,p.pos.y,p.pos.z);}pos.needsUpdate=true;inst.geo.computeVertexNormals();}
  update(delta){this.cloths.forEach(inst=>{const{config:cfg,restH,restV}=inst,res=cfg.res||16,grav=cfg.gravity||9.8,wind=cfg.wind||0,stiff=cfg.stiffness||.8;
    for(let i=0;i<=res;i++)for(let j=0;j<=res;j++){const p=inst.particles[i][j];if(p.pinned)continue;const temp=p.pos.clone();p.pos.x+=(p.pos.x-p.prev.x)*.98+wind*delta*.05*Math.sin(Date.now()*.001+i*.3);p.pos.y+=(p.pos.y-p.prev.y)*.98-grav*delta*delta;p.pos.z+=(p.pos.z-p.prev.z)*.98;if(p.pos.y<-10)p.pos.y=-10;p.prev.copy(temp);}
    for(let iter=0;iter<4;iter++){for(let i=0;i<=res;i++)for(let j=0;j<res;j++){const p1=inst.particles[i][j],p2=inst.particles[i][j+1],dx=p2.pos.x-p1.pos.x,dy=p2.pos.y-p1.pos.y,dz=p2.pos.z-p1.pos.z,dist=Math.sqrt(dx*dx+dy*dy+dz*dz)||.0001,diff=(dist-restH)/dist*.5*stiff;if(!p1.pinned){p1.pos.x+=dx*diff;p1.pos.y+=dy*diff;p1.pos.z+=dz*diff;}if(!p2.pinned){p2.pos.x-=dx*diff;p2.pos.y-=dy*diff;p2.pos.z-=dz*diff;}}
    for(let i=0;i<res;i++)for(let j=0;j<=res;j++){const p1=inst.particles[i][j],p2=inst.particles[i+1][j],dx=p2.pos.x-p1.pos.x,dy=p2.pos.y-p1.pos.y,dz=p2.pos.z-p1.pos.z,dist=Math.sqrt(dx*dx+dy*dy+dz*dz)||.0001,diff=(dist-restV)/dist*.5*stiff;if(!p1.pinned){p1.pos.x+=dx*diff;p1.pos.y+=dy*diff;p1.pos.z+=dz*diff;}if(!p2.pinned){p2.pos.x-=dx*diff;p2.pos.y-=dy*diff;p2.pos.z-=dz*diff;}}}
    this._updateGeo(inst);window._nexusMarkDirty?.(1);});}
  remove(obj){const inst=this.cloths.get(obj.uuid);if(!inst)return;this.scene.remove(inst.mesh);inst.geo.dispose();inst.mesh.material.dispose();this.cloths.delete(obj.uuid);}
}

// ================================================================
//  GOOP v2 — Ben 10 style: corpo amorfo, tentáculos, nucleo
// ================================================================
class GoopSimulation{
  constructor(scene){this.scene=scene;this.goops=new Map();this.splats=[];}
  apply(obj,config){
    if(this.goops.has(obj.uuid))this.remove(obj);const cfg=config||{};const color=new THREE.Color(cfg.color||'#16a34a');
    const box=new THREE.Box3().setFromObject(obj);const size=new THREE.Vector3();box.getSize(size);const scale=Math.max(size.x,size.y,size.z)||1;
    obj.visible=false;
    const group=new THREE.Group();group.position.copy(obj.position);group.userData.isGoopGroup=true;
    // Amorphous body
    const bGeo=new THREE.SphereGeometry(scale*0.55,32,24);const bPos=bGeo.attributes.position;
    for(let i=0;i<bPos.count;i++){const x=bPos.getX(i),y=bPos.getY(i),z=bPos.getZ(i);const n=Math.sin(x*3.1)*Math.cos(y*2.7)*Math.sin(z*3.5)*0.18+Math.sin(x*7.3+1.1)*Math.cos(z*6.9+2.3)*0.08;bPos.setXYZ(i,x*(1+n),y*(1+n),z*(1+n));}bGeo.computeVertexNormals();
    const bMat=new THREE.MeshPhysicalMaterial({color,emissive:color.clone().multiplyScalar(0.2),roughness:0.05,metalness:0,transmission:0.35,thickness:scale*0.4,ior:1.33,clearcoat:1.0,clearcoatRoughness:0.0,transparent:true,opacity:cfg.opacity||0.88});
    const body=new THREE.Mesh(bGeo,bMat);body.castShadow=true;body.layers.enable(1);body.userData.isGoopBody=true;group.add(body);
    // Outer shell
    const sMat=new THREE.MeshPhysicalMaterial({color:color.clone().multiplyScalar(0.6),roughness:0,metalness:0,transparent:true,opacity:0.3,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false});const shell=new THREE.Mesh(bGeo.clone(),sMat);shell.scale.setScalar(1.06);group.add(shell);
    // Core
    const cGeo=new THREE.SphereGeometry(scale*0.12,16,12);const cMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending});const core=new THREE.Mesh(cGeo,cMat);core.layers.enable(1);group.add(core);
    const hGeo=new THREE.SphereGeometry(scale*0.22,12,8);const hMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.4,blending:THREE.AdditiveBlending,depthWrite:false});const halo=new THREE.Mesh(hGeo,hMat);halo.layers.enable(1);group.add(halo);
    const cLight=new THREE.PointLight(color.getHex(),0.8,scale*2.5);group.add(cLight);
    // Tentacles
    const tentacles=[];const tCount=Math.round(4+(cfg.stickiness||0.7)*6);
    const rng=s=>Math.abs(Math.sin(s*127.1+311.7)*43758.5453%1);
    for(let ti=0;ti<tCount;ti++){
      const theta=rng(ti*3.1)*Math.PI*2,phi=rng(ti*5.3)*Math.PI;const dir=new THREE.Vector3(Math.sin(phi)*Math.cos(theta),Math.sin(phi)*Math.sin(theta),Math.cos(phi));
      const pts=[];for(let i=0;i<=8;i++){const t=i/8;const sway=Math.sin(i*0.9+ti)*scale*0.15*t;pts.push(new THREE.Vector3(dir.x*scale*0.5*t+sway,dir.y*scale*0.5*t+Math.cos(i*1.3+ti)*scale*0.08*t,dir.z*scale*0.5*t+sway*0.5));}
      const curve=new THREE.CatmullRomCurve3(pts);const tGeo=new THREE.TubeGeometry(curve,16,scale*(0.04+rng(ti*7.1)*0.04),7,false);
      const tMat=new THREE.MeshPhysicalMaterial({color,roughness:0.05,metalness:0,transmission:0.3,transparent:true,opacity:(cfg.opacity||0.88)*0.9,side:THREE.DoubleSide});
      const tMesh=new THREE.Mesh(tGeo,tMat);tMesh.castShadow=true;tMesh.layers.enable(1);group.add(tMesh);
      const tipGeo=new THREE.SphereGeometry(scale*0.06,8,6);const tip=new THREE.Mesh(tipGeo,tMat.clone());tip.position.copy(pts[pts.length-1]);tMesh.add(tip);
      tentacles.push({mesh:tMesh,seed:ti,scale});
    }
    // Drips
    const drips=[];if(cfg.drip!==false){for(let di=0;di<8;di++){const ang=rng(di*4.7)*Math.PI*2;const dGeo=new THREE.SphereGeometry(scale*(0.06+rng(di*2.1)*0.05),8,6);const dMat=new THREE.MeshPhysicalMaterial({color,roughness:0.02,metalness:0,transparent:true,opacity:(cfg.opacity||0.88)*0.85});const dMesh=new THREE.Mesh(dGeo,dMat);const sx=Math.cos(ang)*scale*0.45*(0.7+rng(di*9.1)*0.3),sz=Math.sin(ang)*scale*0.45*(0.7+rng(di*11.3)*0.3);dMesh.position.set(sx,-scale*0.5,sz);group.add(dMesh);drips.push({mesh:dMesh,startX:sx,startY:-scale*0.5,startZ:sz,fallSpeed:0.015+rng(di*5.1)*0.025,elapsed:rng(di*7.3)*2.0,scale});}}
    this.scene.add(group);this.goops.set(obj.uuid,{group,obj,body,shell,core,halo,cLight,tentacles,drips,config:cfg,color,time:0,morphPhase:Math.random()*Math.PI*2});window._nexusInvalidateBloom?.();
  }
  _addSplat(pos,color,scale){
    const geo=new THREE.CircleGeometry(scale*(0.15+Math.random()*0.2),10);const mat=new THREE.MeshStandardMaterial({color:color.clone().multiplyScalar(0.7),roughness:0.1,metalness:0,transparent:true,opacity:0.75});const mesh=new THREE.Mesh(geo,mat);mesh.position.copy(pos);mesh.rotation.x=-Math.PI/2;mesh.position.y+=0.02;this.scene.add(mesh);
    for(let i=0;i<4;i++){const dr=Math.random()*scale*0.3,da=Math.random()*Math.PI*2;const dm=new THREE.Mesh(new THREE.CircleGeometry(scale*0.04,7),mat.clone());dm.position.set(pos.x+Math.cos(da)*dr,pos.y+0.02,pos.z+Math.sin(da)*dr);dm.rotation.x=-Math.PI/2;this.scene.add(dm);this.splats.push({mesh:dm,life:0.8+Math.random()*0.2});}
    this.splats.push({mesh,life:1.0});
  }
  update(delta){
    this.goops.forEach(inst=>{
      inst.time+=delta;const t=inst.time,cfg=inst.config,visc=1.0-(cfg.viscosity||0.6),scale=inst.body.scale.x*0.55;
      const mX=1.0+Math.sin(t*0.9+inst.morphPhase)*0.12*visc,mY=1.0+Math.sin(t*1.1+inst.morphPhase+1)*0.10*visc,mZ=1.0+Math.cos(t*0.7+inst.morphPhase+2)*0.10*visc;
      inst.body.scale.set(mX,mY,mZ);inst.shell.scale.set(mX*1.06,mY*1.06,mZ*1.06);
      const cr=(scale||0.3)*0.18,cPhi=t*1.8,cThe=t*1.1;inst.core.position.set(Math.sin(cPhi)*Math.cos(cThe)*cr,Math.sin(cThe)*cr,Math.cos(cPhi)*Math.cos(cThe)*cr);inst.core.scale.setScalar(0.9+Math.sin(t*3.5)*0.1);inst.halo.position.copy(inst.core.position).multiplyScalar(0.5);inst.cLight.position.copy(inst.core.position);
      inst.tentacles.forEach((tent,ti)=>{const wave=Math.sin(t*1.5+ti*0.8)*visc*0.15,lift=Math.cos(t*1.1+ti*1.2)*visc*0.10;tent.mesh.rotation.set(wave,ti*0.628,lift);});
      inst.drips.forEach(drip=>{drip.elapsed+=delta;const fallDist=drip.elapsed*drip.fallSpeed*8;drip.mesh.position.y=drip.startY-fallDist;const str=1+fallDist*0.5;drip.mesh.scale.set(1/Math.sqrt(str),str,1/Math.sqrt(str));
        if(drip.mesh.position.y<-drip.scale*1.5){this._addSplat(new THREE.Vector3(inst.group.position.x+drip.startX,inst.group.position.y+drip.mesh.position.y,inst.group.position.z+drip.startZ),inst.color,drip.scale);drip.elapsed=0;drip.mesh.position.y=drip.startY;}});
      window._nexusMarkDirty?.(1);
    });
    this.splats=this.splats.filter(s=>{s.life-=delta*0.05;if(s.mesh.material)s.mesh.material.opacity=Math.max(0,s.life*0.75);if(s.life<=0){this.scene.remove(s.mesh);s.mesh.geometry?.dispose();s.mesh.material?.dispose();return false;}return true;});
  }
  remove(obj){const inst=this.goops.get(obj.uuid);if(!inst)return;this.scene.remove(inst.group);inst.group.traverse(c=>{c.geometry?.dispose();c.material?.dispose?.();});inst.obj.visible=true;this.goops.delete(obj.uuid);window._nexusInvalidateBloom?.();}
}

// ================================================================
//  PBR TEXTURE GENERATOR — Procedural
// ================================================================
const PBR_PRESETS={stone:{albedo:[120,110,100],roughVar:0.85,metalness:0.05,freq:5.2,octaves:4,pattern:'cracked'},wood:{albedo:[160,110,60],roughVar:0.75,metalness:0.0,freq:3.5,octaves:3,pattern:'streaks'},metal:{albedo:[180,180,185],roughVar:0.25,metalness:0.95,freq:8.0,octaves:2,pattern:'brushed'},marble:{albedo:[240,235,230],roughVar:0.10,metalness:0.0,freq:2.0,octaves:5,pattern:'marble'},concrete:{albedo:[130,130,125],roughVar:0.92,metalness:0.0,freq:7.0,octaves:3,pattern:'porous'},brick:{albedo:[180,90,60],roughVar:0.88,metalness:0.0,freq:4.0,octaves:2,pattern:'brick'},fabric:{albedo:[100,60,150],roughVar:0.95,metalness:0.0,freq:12.0,octaves:3,pattern:'weave'},lava:{albedo:[40,10,5],roughVar:0.70,metalness:0.0,freq:3.0,octaves:4,pattern:'lava'}};
class PBRTextureGenerator{
  constructor(){this.size=512;}
  _n2d(x,y,freq,seed=0){const n=Math.sin(x*freq+seed*31.1)*Math.cos(y*freq+seed*23.7);return Math.sin(n*43758.5453)*0.5+0.5;}
  _fbm(x,y,freq,octaves,seed=0){let v=0,a=0.5;for(let o=0;o<octaves;o++){v+=this._n2d(x,y,freq*Math.pow(2,o),seed+o)*a;a*=0.5;}return v;}
  _pat(pat,x,y,freq,oct,seed){switch(pat){case'streaks':return this._fbm(x*0.1,y,freq,oct,seed)*0.7+this._fbm(x,y*0.05,freq*3,2,seed+1)*0.3;case'brushed':return this._fbm(x,y*0.02,freq,2,seed)*0.8+this._fbm(x*3,y*0.05,freq*2,1,seed+2)*0.2;case'marble':{const b=(x+y)*freq+this._fbm(x,y,freq*2,oct,seed)*3;return Math.abs(Math.sin(b*Math.PI));}case'porous':{const p=this._fbm(x,y,freq,oct,seed);return p<0.55?p*0.7:1-(p-0.55)*3;}case'brick':{const row=Math.floor(y*5),off=row%2===0?0:0.5,col=Math.floor((x+off)*10),bx=(x+off)*10-col,by=y*5-row;const m=(bx<0.05||bx>0.95||by<0.06||by>0.94)?0:1;return m*(0.85+this._fbm(x,y,freq*2,2,seed)*0.25);}case'weave':{const wx=Math.abs(Math.sin(x*freq*Math.PI)),wy=Math.abs(Math.sin(y*freq*Math.PI));return(Math.floor(x*freq)+Math.floor(y*freq))%2===0?wx:wy;}case'lava':{const l=this._fbm(x,y,freq,oct,seed);return l<0.4?l/0.4:Math.max(0,1-(l-0.4)*8);}default:return this._fbm(x,y,freq,oct,seed);}}
  generate(type){const p=PBR_PRESETS[type]||PBR_PRESETS.stone,s=this.size,[ar,ag,ab]=p.albedo;const makeC=()=>{const c=document.createElement('canvas');c.width=c.height=s;return c;};
    const aC=makeC(),rC=makeC(),nC=makeC(),aoC=makeC();const aCtx=aC.getContext('2d'),rCtx=rC.getContext('2d'),nCtx=nC.getContext('2d'),aoCtx=aoC.getContext('2d');const aD=aCtx.createImageData(s,s),rD=rCtx.createImageData(s,s),nD=nCtx.createImageData(s,s),aoD=aoCtx.createImageData(s,s);
    for(let y=0;y<s;y++)for(let x=0;x<s;x++){const nx=x/s,ny=y/s;const v=this._pat(p.pattern,nx,ny,p.freq,p.octaves,0);const i4=(y*s+x)*4;const mod=0.7+v*0.6;aD.data[i4]=Math.min(255,ar*mod)|0;aD.data[i4+1]=Math.min(255,ag*mod)|0;aD.data[i4+2]=Math.min(255,ab*mod)|0;aD.data[i4+3]=255;const r=p.roughVar*(0.5+(1-v)*0.5)*255|0;rD.data[i4]=rD.data[i4+1]=rD.data[i4+2]=r;rD.data[i4+3]=255;const dx=this._pat(p.pattern,nx+1/s,ny,p.freq,p.octaves,0)-this._pat(p.pattern,nx-1/s,ny,p.freq,p.octaves,0),dy=this._pat(p.pattern,nx,ny+1/s,p.freq,p.octaves,0)-this._pat(p.pattern,nx,ny-1/s,p.freq,p.octaves,0);nD.data[i4]=Math.min(255,(dx*128+128)|0);nD.data[i4+1]=Math.min(255,(dy*128+128)|0);nD.data[i4+2]=255;nD.data[i4+3]=255;const ao=(0.6+v*0.4)*255|0;aoD.data[i4]=aoD.data[i4+1]=aoD.data[i4+2]=ao;aoD.data[i4+3]=255;}
    aCtx.putImageData(aD,0,0);rCtx.putImageData(rD,0,0);nCtx.putImageData(nD,0,0);aoCtx.putImageData(aoD,0,0);
    const mk=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;};
    return{albedo:mk(aC),roughness:mk(rC),normal:mk(nC),ao:mk(aoC),metalness:p.metalness,roughVar:p.roughVar};}
  applyToObject(obj,type){const maps=this.generate(type);const apply=mesh=>{if(!mesh.isMesh)return;const mat=new THREE.MeshStandardMaterial({map:maps.albedo,roughnessMap:maps.roughness,normalMap:maps.normal,aoMap:maps.ao,roughness:maps.roughVar,metalness:maps.metalness});mat.needsUpdate=true;mesh.material=mat;mesh.geometry?.setAttribute('uv2',mesh.geometry?.attributes.uv);};if(obj.isMesh)apply(obj);else obj.traverse(apply);window._nexusMarkDirty?.(4);window._nexusRequestShadow?.();return maps;}
}

// ================================================================
//  ADVANCED LIGHT SYSTEM v2
// ================================================================
class AdvancedLightSystem{
  constructor(scene,renderer){this.scene=scene;this.renderer=renderer;}
  kelvinToColor(k){k=Math.max(1000,Math.min(40000,k));let r,g,b;const t=k/100;if(t<=66){r=255;g=t<=19?0:99.4708*Math.log(t-10)-161.1196;b=t>=19?255:t<=10?0:138.5177*Math.log(t-10)-305.0448;}else{r=329.699*Math.pow(t-60,-0.1332);g=288.122*Math.pow(t-60,-0.0755);b=255;}return new THREE.Color(Math.max(0,Math.min(255,r))/255,Math.max(0,Math.min(255,g))/255,Math.max(0,Math.min(255,b))/255);}
  setPhysicalFalloff(lo,on){const l=lo.userData?.light||lo;if(!l.isLight)return;l.decay=on?2:1;window._nexusMarkDirty?.(4);}
  setTemperature(lo,k){const l=lo.userData?.light||lo;if(!l.isLight)return;l.color.copy(this.kelvinToColor(k));window._nexusMarkDirty?.(4);window._nexusRequestShadow?.();}
  setShadowSoftness(lo,r){const l=lo.userData?.light||lo;if(!l.shadow)return;l.shadow.radius=r;l.shadow.blurSamples=Math.round(4+r*4);this.renderer.shadowMap.needsUpdate=true;window._nexusMarkDirty?.(4);}
  createAreaLight(pos,width,height,color,intensity){
    const group=new THREE.Group();group.position.copy(pos);group.userData.isAreaLight=true;
    const rows=3,cols=3,pI=intensity/(rows*cols);
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const pl=new THREE.PointLight(color,pI,Math.max(width,height)*2);pl.position.set((c/(cols-1)-0.5)*width,0,(r/(rows-1)-0.5)*height);pl.castShadow=false;group.add(pl);}
    const vGeo=new THREE.PlaneGeometry(width,height);const vMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.4,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});group.add(new THREE.Mesh(vGeo,vMat));
    this.scene.add(group);window._nexusMarkDirty?.(4);return group;
  }
}

// ================================================================
//  REAL-TIME PROGRESSIVE RENDERER
// ================================================================
class RealtimeRenderer{
  constructor(renderer,scene,camera){this.renderer=renderer;this.scene=scene;this.camera=camera;this.active=false;this.samples=0;this.maxSamples=64;}
  enable(max=64){this.active=true;this.maxSamples=max;this.reset();}
  disable(){this.active=false;this.samples=0;}
  reset(){this.samples=0;}
  get progress(){return this.maxSamples>0?Math.min(this.samples/this.maxSamples,1):0;}
  get isDone(){return this.samples>=this.maxSamples;}
  tick(){
    if(!this.active||this.isDone)return;
    const j=0.5/this.renderer.domElement.width;
    this.camera.setViewOffset(this.renderer.domElement.width,this.renderer.domElement.height,(Math.random()-.5)*j,(Math.random()-.5)*j,this.renderer.domElement.width,this.renderer.domElement.height);
    this.samples++;
    requestAnimationFrame(()=>{this.camera.clearViewOffset();});
  }
  onSceneChange(){if(this.active)this.reset();}
}

// ================================================================
//  UI HELPERS
// ================================================================
function wireSlider(rId,nId,fn){const r=document.getElementById(rId),n=document.getElementById(nId);if(!r||!n)return;const u=v=>{r.value=v;n.value=v;fn?.(parseFloat(v));};r.addEventListener('input',()=>u(r.value));n.addEventListener('input',()=>u(n.value));}
const getV=id=>parseFloat(document.getElementById(id)?.value||0);
const getS=id=>document.getElementById(id)?.value||'';
const getC=id=>document.getElementById(id)?.checked;

// ================================================================
//  MAIN INIT
// ================================================================
async function initAddons(){
  await waitNexus();
  const scene=window._nexusScene,camera=window._nexusCamera,renderer=window._nexusRenderer,composer=window._nexusFinalComposer;

  // ── Insert post-FX ────────────────────────────────────────────
  const finalPass=composer.passes.pop();finalPass.renderToScreen=false;
  const ssaoPass=new ShaderPass(SSAOShader);ssaoPass.enabled=false;
  const ssrPass=new ShaderPass(SSRShader);ssrPass.enabled=false;
  const dofPass=new ShaderPass(DOFShader);dofPass.enabled=false;
  const cgPass=new ShaderPass(ColorGradeShader);cgPass.enabled=false;
  const chromaPass=new ShaderPass(ChromaShader);chromaPass.enabled=false;
  const grainPass=new ShaderPass(GrainShader);grainPass.enabled=false;
  const vigPass=new ShaderPass(VignetteShader);vigPass.enabled=false;
  [ssaoPass,ssrPass,dofPass,cgPass,chromaPass,grainPass,vigPass,finalPass].forEach(p=>composer.addPass(p));
  finalPass.renderToScreen=true;
  const W=renderer.domElement.width,H=renderer.domElement.height;
  ssaoPass.uniforms.resolution.value.set(W,H);ssrPass.uniforms.resolution.value.set(W,H);dofPass.uniforms.resolution.value.set(W,H);
  window.addEventListener('resize',()=>{const w=renderer.domElement.width,h=renderer.domElement.height;ssaoPass.uniforms.resolution.value.set(w,h);ssrPass.uniforms.resolution.value.set(w,h);dofPass.uniforms.resolution.value.set(w,h);});

  const volSystem=new VolumetricLightSystem(scene,camera);
  const mineralSys=new MineralSystem(scene);
  const clothSys=new ClothSimulation(scene);
  const goopSys=new GoopSimulation(scene);
  const pbrGen=new PBRTextureGenerator();
  const advLight=new AdvancedLightSystem(scene,renderer);
  const rtR=new RealtimeRenderer(renderer,scene,camera);
  window._nexusAddons={volSystem,mineralSys,clothSys,goopSys,pbrGen,advLight,rtR};

  // ── Update loop ──────────────────────────────────────────────
  let lastT=0;function loop(ts){requestAnimationFrame(loop);const dt=Math.min((ts-lastT)/1000,0.05);lastT=ts;ssaoPass.uniforms.time.value+=dt*0.3;ssrPass.uniforms.time.value+=dt;dofPass.uniforms.time.value+=dt;if(grainPass.enabled&&getC('grain-animated'))grainPass.uniforms.time.value+=dt;volSystem.update(dt);clothSys.update(dt);goopSys.update(dt);
  if(rtR.active&&!rtR.isDone){rtR.tick();const pct=Math.round(rtR.progress*100);const fill=document.getElementById('rt-progress-fill');const txt=document.getElementById('rt-progress-text');if(fill)fill.style.width=pct+'%';if(txt)txt.textContent=`Amostras: ${rtR.samples}/${rtR.maxSamples} (${pct}%)`;window._nexusMarkDirty?.(2);}
  }requestAnimationFrame(loop);

  // ── Post-FX UI ────────────────────────────────────────────────
  document.getElementById('raytracing-toggle')?.addEventListener('change',e=>{ssaoPass.enabled=e.target.checked;document.getElementById('raytracing-controls').style.display=e.target.checked?'':'none';window._nexusMarkDirty?.(4);});
  wireSlider('ssao-intensity','ssao-intensity-num',v=>ssaoPass.uniforms.intensity.value=v);
  wireSlider('ssao-radius','ssao-radius-num',v=>ssaoPass.uniforms.radius.value=v);
  wireSlider('ssr-intensity','ssr-intensity-num',v=>ssrPass.uniforms.intensity.value=v);
  wireSlider('ssr-roughness','ssr-roughness-num',v=>ssrPass.uniforms.roughCut.value=v);
  // SSR enable when raytracing is on
  document.getElementById('raytracing-toggle')?.addEventListener('change',e=>{ssrPass.enabled=e.target.checked;});
  document.getElementById('adv-shadow-mode')?.querySelectorAll('.seg-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.getElementById('adv-shadow-mode').querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('seg-active'));btn.classList.add('seg-active');const m=btn.dataset.val;renderer.shadowMap.type=m==='pcss'?THREE.PCFSoftShadowMap:m==='vsmm'?THREE.VSMShadowMap:THREE.BasicShadowMap;renderer.shadowMap.needsUpdate=true;window._nexusMarkDirty?.(4);});});
  document.getElementById('chroma-toggle')?.addEventListener('change',e=>{chromaPass.enabled=e.target.checked;document.getElementById('chroma-controls').style.display=e.target.checked?'':'none';window._nexusMarkDirty?.(4);});
  wireSlider('chroma-intensity','chroma-intensity-num',v=>chromaPass.uniforms.intensity.value=v);
  wireSlider('chroma-edge','chroma-edge-num',v=>chromaPass.uniforms.edgeFactor.value=v);
  document.getElementById('grain-toggle')?.addEventListener('change',e=>{grainPass.enabled=e.target.checked;document.getElementById('grain-controls').style.display=e.target.checked?'':'none';window._nexusMarkDirty?.(4);});
  wireSlider('grain-intensity','grain-intensity-num',v=>grainPass.uniforms.intensity.value=v);
  wireSlider('grain-size','grain-size-num',v=>grainPass.uniforms.grainSize.value=v);
  document.getElementById('vignette-toggle')?.addEventListener('change',e=>{vigPass.enabled=e.target.checked;document.getElementById('vignette-controls').style.display=e.target.checked?'':'none';window._nexusMarkDirty?.(4);});
  wireSlider('vignette-offset','vignette-offset-num',v=>vigPass.uniforms.offset.value=v);
  wireSlider('vignette-darkness','vignette-darkness-num',v=>vigPass.uniforms.darkness.value=v);
  document.getElementById('vignette-color')?.addEventListener('input',e=>{vigPass.uniforms.color.value.set(e.target.value);window._nexusMarkDirty?.(2);});
  // DOF
  document.getElementById('dof-toggle')?.addEventListener('change',e=>{dofPass.enabled=e.target.checked;document.getElementById('dof-controls').style.display=e.target.checked?'':'none';window._nexusMarkDirty?.(4);});
  wireSlider('dof-focus','dof-focus-num',v=>dofPass.uniforms.focusDepth.value=v);
  wireSlider('dof-range','dof-range-num',v=>dofPass.uniforms.focalRange.value=v);
  wireSlider('dof-bokeh','dof-bokeh-num',v=>dofPass.uniforms.bokehRadius.value=v);
  wireSlider('dof-blades','dof-blades-num',v=>dofPass.uniforms.bokehBlades.value=v);
  // Color Grade
  document.getElementById('colorgrade-toggle')?.addEventListener('change',e=>{cgPass.enabled=e.target.checked;document.getElementById('colorgrade-controls').style.display=e.target.checked?'':'none';window._nexusMarkDirty?.(4);});
  wireSlider('cg-exposure','cg-exposure-num',v=>cgPass.uniforms.exposure.value=v);
  wireSlider('cg-contrast','cg-contrast-num',v=>cgPass.uniforms.contrast.value=v);
  wireSlider('cg-saturation','cg-saturation-num',v=>cgPass.uniforms.saturation.value=v);
  wireSlider('cg-temperature','cg-temperature-num',v=>cgPass.uniforms.temperature.value=v);
  wireSlider('cg-tint','cg-tint-num',v=>cgPass.uniforms.tint.value=v);
  document.getElementById('cg-tonemap')?.querySelectorAll('.seg-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.getElementById('cg-tonemap').querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('seg-active'));btn.classList.add('seg-active');cgPass.uniforms.tonemap.value=parseFloat(btn.dataset.val);window._nexusMarkDirty?.(4);});});
  // RT
  document.getElementById('rt-toggle')?.addEventListener('change',e=>{const on=e.target.checked;document.getElementById('rt-controls').style.display=on?'':'none';if(on)rtR.enable(parseInt(document.getElementById('rt-samples')?.value||64));else rtR.disable();});
  document.getElementById('rt-samples')?.addEventListener('change',e=>{if(rtR.active)rtR.enable(parseInt(e.target.value));});
  document.getElementById('rt-reset-btn')?.addEventListener('click',()=>{if(rtR.active)rtR.reset();});
  const origMD=window._nexusMarkDirty;if(origMD){window._nexusMarkDirty=v=>{origMD(v);if(rtR.active&&v>2)rtR.onSceneChange();};}

  // ── Volumetric light ──────────────────────────────────────────
  const getVolCfg=()=>({density:getV('vol-density'),scatter:getV('vol-scatter'),steps:getV('vol-steps'),color:getS('vol-color')});
  const applyVol=lo=>{volSystem.createVolumeMesh(lo,getVolCfg());window._nexusMarkDirty?.(4);};
  document.getElementById('volumetric-toggle')?.addEventListener('change',e=>{const on=e.target.checked;document.getElementById('volumetric-controls').style.display=on?'':'none';const ao=window._nexusGetActive?.();if(!ao)return;if(on)applyVol(ao);else volSystem.removeVolume(ao);window._nexusMarkDirty?.(4);});
  ['vol-density','vol-scatter','vol-steps','vol-color'].forEach(id=>{document.getElementById(id)?.addEventListener('input',()=>{const ao=window._nexusGetActive?.();if(ao&&document.getElementById('volumetric-toggle')?.checked)applyVol(ao);});});
  wireSlider('vol-density','vol-density-num',()=>{});wireSlider('vol-scatter','vol-scatter-num',()=>{});wireSlider('vol-steps','vol-steps-num',()=>{});

  // ── Advanced light UI ─────────────────────────────────────────
  document.getElementById('light-physical-toggle')?.addEventListener('change',e=>{const ao=window._nexusGetActive?.();if(!ao)return;advLight.setPhysicalFalloff(ao,e.target.checked);});
  const tempInput=document.getElementById('light-temperature');tempInput?.addEventListener('input',e=>{const ao=window._nexusGetActive?.();if(!ao)return;advLight.setTemperature(ao,parseFloat(e.target.value));const sw=document.getElementById('light-temp-swatch');if(sw){const c=advLight.kelvinToColor(parseFloat(e.target.value));sw.style.background=`rgb(${c.r*255|0},${c.g*255|0},${c.b*255|0})`;}});
  wireSlider('light-shadow-softness','light-shadow-softness-num',v=>{const ao=window._nexusGetActive?.();if(!ao)return;advLight.setShadowSoftness(ao,v);});
  document.getElementById('area-light-add-btn')?.addEventListener('click',()=>{const pos=camera.position.clone().add(new THREE.Vector3(0,-1,-3));advLight.createAreaLight(pos,getV('area-light-width')||2,getV('area-light-height')||1,getS('area-light-color')||'#ffffff',getV('area-light-intensity')||1);window._nexusMarkDirty?.(4);});

  // ── Addons button/tabs ────────────────────────────────────────
  const addonsBtn=document.getElementById('addons-btn'),addonsPanel=document.getElementById('addons-panel');
  addonsBtn?.addEventListener('click',()=>{addonsBtn.classList.toggle('active');addonsPanel.classList.toggle('hidden');refreshPanel();});
  document.addEventListener('click',e=>{if(!addonsPanel?.classList.contains('hidden')&&!addonsPanel.contains(e.target)&&!addonsBtn.contains(e.target)){addonsPanel.classList.add('hidden');addonsBtn.classList.remove('active');}});
  document.querySelectorAll('.addons-tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.addons-tab').forEach(t=>t.classList.remove('addons-tab-active'));document.querySelectorAll('.addons-tab-content').forEach(c=>c.classList.add('hidden'));tab.classList.add('addons-tab-active');document.getElementById(`addons-tab-${tab.dataset.tab}`)?.classList.remove('hidden');});});

  // ── Minerals UI ───────────────────────────────────────────────
  let selMineral='diamond';
  document.querySelectorAll('.mineral-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.mineral-btn').forEach(b=>b.classList.remove('mineral-selected'));btn.classList.add('mineral-selected');selMineral=btn.dataset.mineral;});});
  document.querySelector('[data-mineral="diamond"]')?.classList.add('mineral-selected');
  wireSlider('mineral-speed','mineral-speed-num',()=>{});wireSlider('mineral-density','mineral-density-num',()=>{});wireSlider('mineral-crystal-size','mineral-crystal-size-num',()=>{});
  document.getElementById('mineral-apply-btn')?.addEventListener('click',async()=>{const ao=window._nexusGetActive?.();if(!ao||window._nexusIsLight?.(ao))return;const applyBtn=document.getElementById('mineral-apply-btn'),progress=document.getElementById('mineral-progress');applyBtn.disabled=true;progress?.classList.remove('hidden');await mineralSys.applyMineral(ao,selMineral,getV('mineral-density')||8,getV('mineral-crystal-size')||0.25,getV('mineral-speed')||1,pct=>{const fill=document.getElementById('mineral-progress-fill'),txt=document.getElementById('mineral-progress-text');if(fill)fill.style.width=(pct*100)+'%';if(txt)txt.textContent=pct<0.45?'Solidificando pedra...':'Cristais emergindo...';});applyBtn.disabled=false;progress?.classList.add('hidden');document.getElementById('mineral-remove-btn').style.display='';applyBtn.textContent='✅ Mineral aplicado!';setTimeout(()=>{applyBtn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>Transformar em Minério';},2200);});
  document.getElementById('mineral-remove-btn')?.addEventListener('click',()=>{const ao=window._nexusGetActive?.();if(!ao)return;mineralSys.removeMineral(ao);document.getElementById('mineral-remove-btn').style.display='none';refreshPanel();});

  // ── Simulation bridge ─────────────────────────────────────────
  document.getElementById('sim-physics-toggle')?.addEventListener('change',e=>{document.getElementById('sim-physics-sub').style.display=e.target.checked?'':'none';const st=document.getElementById('physics-toggle');if(st){st.checked=e.target.checked;st.dispatchEvent(new Event('change',{bubbles:true}));}});
  ['simulate','stop','reset'].forEach(a=>{document.getElementById(`sim-${a}-btn`)?.addEventListener('click',()=>{document.getElementById(`physics-${a}-btn`)?.click();});});

  // ── Cloth UI ─────────────────────────────────────────────────
  document.getElementById('cloth-toggle')?.addEventListener('change',e=>{document.getElementById('cloth-sub-controls').style.display=e.target.checked?'':'none';});
  wireSlider('cloth-res','cloth-res-num',()=>{});wireSlider('cloth-stiffness','cloth-stiffness-num',()=>{});wireSlider('cloth-gravity','cloth-gravity-num',()=>{});wireSlider('cloth-wind','cloth-wind-num',()=>{});
  document.getElementById('cloth-apply-btn')?.addEventListener('click',()=>{const ao=window._nexusGetActive?.();if(!ao||window._nexusIsLight?.(ao))return;clothSys.apply(ao,{res:getV('cloth-res')||16,stiffness:getV('cloth-stiffness')||.8,gravity:getV('cloth-gravity')||9.8,wind:getV('cloth-wind')||0,color:getS('cloth-color')||'#e0c080'});document.getElementById('cloth-apply-btn').style.display='none';document.getElementById('cloth-remove-btn').style.display='';});
  document.getElementById('cloth-remove-btn')?.addEventListener('click',()=>{const ao=window._nexusGetActive?.();if(!ao)return;clothSys.remove(ao);document.getElementById('cloth-apply-btn').style.display='';document.getElementById('cloth-remove-btn').style.display='none';});
  ['cloth-gravity','cloth-wind','cloth-stiffness'].forEach(id=>{document.getElementById(id)?.addEventListener('input',e=>{const ao=window._nexusGetActive?.();if(!ao)return;const inst=clothSys.cloths.get(ao.uuid);if(!inst)return;inst.config[id.replace('cloth-','')]=parseFloat(e.target.value);});});

  // ── Goop UI ──────────────────────────────────────────────────
  document.getElementById('goop-toggle')?.addEventListener('change',e=>{document.getElementById('goop-sub-controls').style.display=e.target.checked?'':'none';});
  wireSlider('goop-viscosity','goop-viscosity-num',()=>{});wireSlider('goop-elasticity','goop-elasticity-num',()=>{});wireSlider('goop-stickiness','goop-stickiness-num',()=>{});wireSlider('goop-opacity','goop-opacity-num',()=>{});
  document.getElementById('goop-apply-btn')?.addEventListener('click',()=>{const ao=window._nexusGetActive?.();if(!ao||window._nexusIsLight?.(ao))return;goopSys.apply(ao,{color:getS('goop-color')||'#16a34a',viscosity:getV('goop-viscosity')||.6,elasticity:getV('goop-elasticity')||.4,stickiness:getV('goop-stickiness')||.7,opacity:getV('goop-opacity')||.85,drip:getC('goop-drip')});document.getElementById('goop-apply-btn').style.display='none';document.getElementById('goop-remove-btn').style.display='';});
  document.getElementById('goop-remove-btn')?.addEventListener('click',()=>{const ao=window._nexusGetActive?.();if(!ao)return;goopSys.remove(ao);document.getElementById('goop-apply-btn').style.display='';document.getElementById('goop-remove-btn').style.display='none';});

  // ── PBR Generator UI ─────────────────────────────────────────
  let selPBR='stone';
  document.querySelectorAll('.pbr-preset-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.pbr-preset-btn').forEach(b=>b.classList.remove('pbr-selected'));btn.classList.add('pbr-selected');selPBR=btn.dataset.preset;const prev=document.getElementById('pbr-preview-canvas');if(prev){const maps=pbrGen.generate(selPBR);const ctx=prev.getContext('2d');ctx.drawImage(maps.albedo.image,0,0,128,128);maps.albedo.dispose();maps.roughness.dispose();maps.normal.dispose();maps.ao.dispose();}});});
  document.getElementById('pbr-apply-btn')?.addEventListener('click',()=>{const ao=window._nexusGetActive?.();if(!ao||window._nexusIsLight?.(ao))return;pbrGen.applyToObject(ao,selPBR);window._nexusInvalidateBloom?.();const btn=document.getElementById('pbr-apply-btn');btn.textContent='✅ Textura aplicada!';setTimeout(()=>{btn.textContent='🎨 Aplicar Textura PBR';},2000);});
  setTimeout(()=>{document.querySelector('[data-preset="stone"]')?.classList.add('pbr-selected');},600);

  // ── Panel refresh ─────────────────────────────────────────────
  function refreshPanel(){
    const ao=window._nexusGetActive?.();const hasObj=ao&&!window._nexusIsLight?.(ao)&&!window._nexusIsParticle?.(ao);const isLight=ao&&window._nexusIsLight?.(ao);
    document.getElementById('minerals-no-sel').style.display=hasObj?'none':'';document.getElementById('minerals-controls').style.display=hasObj?'':'none';
    document.getElementById('pbr-no-sel').style.display=hasObj?'none':'';document.getElementById('pbr-controls').style.display=hasObj?'':'none';
    if(hasObj){const isMine=mineralSys.active.has(ao.uuid);document.getElementById('mineral-remove-btn').style.display=isMine?'':'none';document.getElementById('mineral-apply-btn').style.display=isMine?'none':'';document.getElementById('goop-apply-btn').style.display=goopSys.goops.has(ao.uuid)?'none':'';document.getElementById('goop-remove-btn').style.display=goopSys.goops.has(ao.uuid)?'':'none';document.getElementById('cloth-apply-btn').style.display=clothSys.cloths.has(ao.uuid)?'none':'';document.getElementById('cloth-remove-btn').style.display=clothSys.cloths.has(ao.uuid)?'':'none';}
    if(isLight){const hasVol=volSystem.lights.has(ao.uuid);const vt=document.getElementById('volumetric-toggle');if(vt){vt.checked=hasVol;document.getElementById('volumetric-controls').style.display=hasVol?'':'none';}}
  }
  let _lastUUID=null;setInterval(()=>{const ao=window._nexusGetActive?.();const uuid=ao?.uuid||null;if(uuid!==_lastUUID){_lastUUID=uuid;if(!addonsPanel?.classList.contains('hidden'))refreshPanel();}},200);
  console.log('🔌 Nexus Addons v2 loaded: SSAO×32 SSR-raymarch DOF-bokeh ACES-tonemap Volumetric-Mie Minerals-shapAware Goop-Ben10 PBR-procedural AdvLight');
}
initAddons().catch(e=>console.error('[Addons v2]',e));
