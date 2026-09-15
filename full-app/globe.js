import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const UP = new THREE.Vector3(0, 1, 0);
const R = 2.1;
const clamp = THREE.MathUtils.clamp;
let seed = 4831;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const noise = (x,y,z) => Math.sin(x*3.7+y*1.2)*Math.cos(z*3.3-y*1.8)*.5 + Math.sin(y*6.3+z*2.2)*.2 + Math.cos(x*7.1-z*5.3)*.12;
const land = n => noise(n.x,n.y,n.z) + n.y*.22;
const radius = n => R + noise(n.x*1.2,n.y*1.2,n.z*1.2)*.055;
const material = (color, extra={}) => new THREE.MeshStandardMaterial({ color, roughness: .95, ...extra });
const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
const pebbleGeo = new THREE.IcosahedronGeometry(1, 1);
const trunkMat = material('#846747');
const leafMats = ['#91b763','#a9c977','#749b53','#b8cd83','#608f62'].map(c=>material(c));
function ellipsoid(parent, mat, pos, scale, geo=sphereGeo) {
 const m = new THREE.Mesh(geo,mat); m.position.set(...pos); m.scale.set(...scale);
 m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function radial(parent, direction, offset=0) {
 const n=direction.clone().normalize(); const g=new THREE.Group();
 g.position.copy(n.clone().multiplyScalar(radius(n)+offset)); g.quaternion.setFromUnitVectors(UP,n); parent.add(g); return g;
}
function branch(parent, a, b, width) {
 const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b),d=v2.clone().sub(v1);
 const m=new THREE.Mesh(new THREE.CylinderGeometry(width*.65,width,d.length(),7),trunkMat);
 m.position.copy(v1.add(v2).multiplyScalar(.5));m.quaternion.setFromUnitVectors(UP,d.normalize());m.castShadow=true;parent.add(m);return m;
}
function tree(parent, size=1, variant=0) {
 const g=new THREE.Group();parent.add(g);g.scale.setScalar(size);
 branch(g,[0,0,0],[.01,.7,0],.075);
 if(variant===1){for(let j=0;j<4;j++)ellipsoid(g,leafMats[4],[0,.55+j*.2,0],[.28-j*.044,.33,.25-j*.04]);}
 else {
  branch(g,[0,.38,0],[-.24,.83,0],.04);branch(g,[0,.5,0],[.24,.88,.05],.033);
  [[0,1,0,.36],[-.27,.86,.02,.29],[.24,.87,.03,.32],[-.06,.92,.25,.28],[.03,1.2,-.1,.29],[.05,.91,-.25,.27]].forEach(([x,y,z,s],i)=>ellipsoid(g,leafMats[(i+variant)%4],[x,y,z],[s,s*.83,s]));
 }
 return g;
}
function makeMascot(parent) {
 const g=new THREE.Group(); parent.add(g);
 const body=material('#e8ddb5'), head=material('#e9e4bd'), green=material('#7b9973'), dark=material('#274847'), cream=material('#fff7dd'), pink=material('#daa88f');
 ellipsoid(g,body,[0,.22,0],[.135,.17,.10]);
 ellipsoid(g,head,[0,.43,.012],[.18,.155,.145]);
 ellipsoid(g,green,[-.078,.63,0],[.06,.15,.033]).rotation.z=-.4;
 ellipsoid(g,leafMats[1],[.06,.63,.007],[.055,.15,.032]).rotation.z=.36;
 ellipsoid(g,body,[-.14,.22,.02],[.045,.095,.048]).rotation.z=-.25;
 ellipsoid(g,body,[.14,.22,.02],[.045,.095,.048]).rotation.z=.25;
 const foot1=ellipsoid(g,green,[-.06,.055,.035],[.056,.055,.072]);
 const foot2=ellipsoid(g,green,[.06,.055,.035],[.056,.055,.072]);
 for(const x of [-.065,.065]){ellipsoid(g,cream,[x,.46,.133],[.035,.044,.012]);ellipsoid(g,dark,[x,.456,.145],[.018,.025,.01]);ellipsoid(g,cream,[x-.005,.466,.153],[.006,.007,.004]);ellipsoid(g,pink,[x*1.48,.407,.13],[.029,.015,.006]);}
 ellipsoid(g,dark,[0,.393,.154],[.018,.009,.007]);
 ellipsoid(g,green,[0,.31,.017],[.14,.022,.10]);
 ellipsoid(g,material('#b7a475'),[0,.24,-.108],[.093,.106,.048]);
 return {group:g,foot1,foot2};
}
function patchGeometry(normal, size, depth=.01, segments=56) {
 const tangent=new THREE.Vector3().crossVectors(UP,normal).normalize();if(tangent.length()<.1)tangent.set(1,0,0);
 const bitangent=new THREE.Vector3().crossVectors(normal,tangent).normalize();
 const vertices=[],indices=[];
 const center=normal.clone().multiplyScalar(radius(normal)+depth);vertices.push(...center.toArray());
 for(let i=0;i<=segments;i++){
  const angle=i/segments*Math.PI*2, rad=size*(1+.1*Math.sin(angle*3)+.06*Math.cos(angle*5));
  const p=normal.clone().multiplyScalar(R).addScaledVector(tangent,Math.cos(angle)*rad).addScaledVector(bitangent,Math.sin(angle)*rad*.72).normalize();
  vertices.push(...p.multiplyScalar(radius(p)+depth).toArray());
  if(i>0)indices.push(0,i,i+1);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export class LivingWorld {
 constructor(container, options={}) {
  this.options=options;this.container=container;this.focused=false;this.walking=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.scene=new THREE.Scene();
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
  this.renderer.setClearColor(0x000000,0);container.appendChild(this.renderer.domElement);
  this.renderer.domElement.setAttribute('aria-label','Your living 3D world. Drag to rotate, pinch or scroll to zoom. Use the nearby buttons for keyboard controls.');
  this.camera=new THREE.PerspectiveCamera(37,1,.05,60);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);
  this.controls.enableDamping=true;this.controls.dampingFactor=.065;this.controls.enablePan=false;
  this.controls.minDistance=3.05;this.controls.maxDistance=15;
  this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.65;
  this.controls.touches.ONE=THREE.TOUCH.ROTATE;this.controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
  this.controls.addEventListener('start',()=>{this.transition=null;this.interacted=true});
  this.scene.add(new THREE.HemisphereLight('#f1ffdd','#779599',2.4));
  const light=new THREE.DirectionalLight('#fff1ce',3.8);light.position.set(-3,7,5);light.castShadow=true;
  light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});light.shadow.normalBias=.025;light.shadow.bias=-.0003;this.scene.add(light);
  const fill=new THREE.DirectionalLight('#94e4d9',.8);fill.position.set(4,1,-3);this.scene.add(fill);
  this.planet=new THREE.Group();this.scene.add(this.planet);
  this.makeTerrain();this.makeDetails();this.makeTreeAndCompanion();this.makeFireflies();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();this.reset(true);
  this.raycaster=new THREE.Raycaster();let down=null;const pointers=new Set();
  this.renderer.domElement.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);down=pointers.size===1?{x:e.clientX,y:e.clientY,time:performance.now()}:null;});
  this.renderer.domElement.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;});
  this.renderer.domElement.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||performance.now()-down.time>600)return;const rect=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);const hits=this.raycaster.intersectObjects([this.planet],true);if(hits.length){let p=hits[0].object;while(p.parent&&p!==this.treeAnchor&&p!==this.mascotAnchor)p=p.parent;if(p===this.treeAnchor||p===this.mascotAnchor)this.options.onSelect?.(p===this.treeAnchor?'tree':'companion')}});
  this.frame=this.frame.bind(this);this.frame();
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.options.onError?.()});
 }
 makeTerrain(){
  const geo=new THREE.IcosahedronGeometry(R,6),positions=geo.attributes.position,colors=[];
  const green=new THREE.Color('#82a65e'),lush=new THREE.Color('#a3bb71'),brown=new THREE.Color('#b39670'),light=new THREE.Color('#ccb68c');
  for(let i=0;i<positions.count;i++){
   const n=new THREE.Vector3().fromBufferAttribute(positions,i).normalize(),h=land(n),r=radius(n);positions.setXYZ(i,n.x*r,n.y*r,n.z*r);
   let c=h>-.04?green.clone().lerp(lush,clamp(h+.2,0,1)):brown.clone().lerp(light,clamp(-h,0,1));
   c.multiplyScalar(1+.04*Math.sin(n.x*180+n.z*73)*Math.cos(n.y*141));colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;ground.castShadow=true;this.planet.add(ground);
  const pondNormal=new THREE.Vector3(-.52,.22,.88).normalize();
  const sand=new THREE.Mesh(patchGeometry(pondNormal,.53,.012),material('#cfbd91'));sand.receiveShadow=true;this.planet.add(sand);
  const water=new THREE.Mesh(patchGeometry(pondNormal,.45,.022),new THREE.MeshPhysicalMaterial({color:'#58b8b2',roughness:.26,metalness:.05,clearcoat:1}));water.receiveShadow=true;this.planet.add(water);
  const pondGroup=radial(this.planet,pondNormal,.03);for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.RingGeometry(.08+j*.08,.083+j*.08,44),new THREE.MeshBasicMaterial({color:'#c9f5db',transparent:true,opacity:.4,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.015;pondGroup.add(ring)}
  const trailMat=material('#d0bf8d');for(let j=0;j<60;j++){const t=j/59;const n=new THREE.Vector3(.28+Math.sin(t*5.8)*.14,.12+t*.67,.97-t*.17).normalize();const g=radial(this.planet,n,.008);ellipsoid(g,trailMat,[0,.012,0],[.052,.014,.035]);}
 }
 makeDetails(){
  const rockMat=material('#989b83');
  const treeDirections=[[-.73,.7,.13],[.78,.6,-.13],[-.36,.81,-.5],[.18,.95,-.35],[-.94,-.22,.19],[.55,-.68,.5],[.35,.1,-.9],[-.25,-.84,-.58],[-.6,.2,-.8],[.87,-.4,-.3],[.64,.62,.41]];
  treeDirections.forEach((d,i)=>{const g=radial(this.planet,new THREE.Vector3(...d));g.rotateY(i*2);tree(g,.5+(i%3)*.15,i%3===0?1:i%4)});
  const dummy=new THREE.Object3D(),moss=new THREE.InstancedMesh(sphereGeo,material('#9fba6b'),340);moss.castShadow=true;moss.receiveShadow=true;
  let count=0;for(let i=0;i<1800&&count<340;i++){
   const n=new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1).normalize();const l=land(n);if(Math.abs(l+.03)>.08||n.z>.6&&n.x<-.3&&n.y>.03&&n.y<.48)continue;
   const s=.025+rand()*.08;dummy.position.copy(n.clone().multiplyScalar(radius(n)+s*.2));dummy.quaternion.setFromUnitVectors(UP,n);dummy.scale.set(s,s*.65,s);dummy.updateMatrix();moss.setMatrixAt(count++,dummy.matrix);
  }moss.count=count;this.planet.add(moss);
  for(let i=0;i<18;i++){const n=new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1).normalize();const g=radial(this.planet,n);const s=.08+rand()*.09;const m=ellipsoid(g,rockMat,[0,s*.2,0],[s,s*.6,s*.8],pebbleGeo);m.rotation.y=rand()*4;}
  this.flowerGroup=new THREE.Group();this.planet.add(this.flowerGroup);this.addFlowers(60,483);
  const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.011,.075,3),material('#729751'),700);grass.receiveShadow=true;let gc=0;
  for(let i=0;i<1100&&gc<700;i++){const n=new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1).normalize();if(land(n)<.04)continue;dummy.position.copy(n.clone().multiplyScalar(radius(n)+.03));dummy.quaternion.setFromUnitVectors(UP,n);dummy.scale.setScalar(.6+rand()*.7);dummy.updateMatrix();grass.setMatrixAt(gc++,dummy.matrix);}grass.count=gc;this.planet.add(grass);
 }
 addFlowers(amount,offset=0){
  const colors=['#f3d47a','#f7ecd5','#dfafae','#ad95c8'];
  const stemMat=material('#608952');
  for(let i=0;i<amount;i++){
   const phi=i*2.39996+offset, y=Math.sin(i*1.56+offset)*.8,n=new THREE.Vector3(Math.cos(phi)*Math.sqrt(1-y*y),y,Math.sin(phi)*Math.sqrt(1-y*y));
   if(land(n)<-.08)continue;
   const g=radial(this.flowerGroup,n,.006);const h=.07+rand()*.05;
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,h,3),stemMat);stem.position.y=h/2;g.add(stem);
   const petal=ellipsoid(g,material(colors[i%4]),[0,h,0],[.034,.015,.034]);
   ellipsoid(g,material('#d9b456'),[0,h+.012,0],[.009,.009,.009]);
  }
 }
 makeTreeAndCompanion(){
  this.treeNormal=new THREE.Vector3(-.08,.77,.64).normalize();
  this.treeAnchor=radial(this.planet,this.treeNormal,.015);this.personalTree=tree(this.treeAnchor,.78,2);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.34,.008,6,64),material('#ecda8c',{emissive:'#bca04e',emissiveIntensity:.25}));ring.rotation.x=Math.PI/2;ring.position.y=.025;this.treeAnchor.add(ring);
  this.mascotNormal=new THREE.Vector3(.28,.38,.88).normalize();this.mascotAnchor=radial(this.planet,this.mascotNormal,.012);this.mascot=makeMascot(this.mascotAnchor);this.mascotAnchor.rotateY(.04);
 }
 makeFireflies(){const vertices=[];for(let i=0;i<60;i++){const n=new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1).normalize().multiplyScalar(2.26+rand()*.2);vertices.push(...n.toArray())}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));this.fireflies=new THREE.Points(g,new THREE.PointsMaterial({color:'#fff5b8',size:.024,transparent:true,opacity:.65,depthWrite:false}));this.scene.add(this.fireflies)}
 resize(){const {width,height}=this.container.getBoundingClientRect();this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();if(!this.interacted&&!this.focused)this.reset(true)}
 baseDistance(){return this.camera.aspect<.8?10.6:this.camera.aspect<1.2?9:8.1}
 reset(instant=false){this.focused=false;this.controls.minDistance=3.05;this.controls.maxDistance=15;this.controls.maxPolarAngle=Math.PI;this.controls.minPolarAngle=0;const pos=new THREE.Vector3(0,1.5,this.baseDistance()),target=new THREE.Vector3(0,0,0);if(instant){this.camera.position.copy(pos);this.controls.target.copy(target);this.controls.update()}else this.animateTo(pos,target);this.options.onFocus?.(false)}
 focus(){this.focused=true;this.controls.minDistance=.65;this.controls.maxDistance=7;this.controls.minPolarAngle=0;this.controls.maxPolarAngle=Math.PI*.85;const target=this.mascotAnchor.position.clone().addScaledVector(this.mascotNormal,.24);const pos=target.clone().addScaledVector(this.mascotNormal,1.9).add(new THREE.Vector3(0,.12,0));this.animateTo(pos,target);this.options.onFocus?.(true)}
 animateTo(pos,target){this.transition={from:this.camera.position.clone(),targetFrom:this.controls.target.clone(),pos,target,start:performance.now()}}
 zoom(factor){const v=this.camera.position.clone().sub(this.controls.target);v.setLength(clamp(v.length()*factor,this.controls.minDistance,this.controls.maxDistance));this.animateTo(this.controls.target.clone().add(v),this.controls.target.clone())}
 rotate(amount){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(UP,amount);this.animateTo(this.controls.target.clone().add(offset),this.controls.target.clone())}
 grow(steps){const level=Math.floor(steps/3000);this.personalTree.scale.setScalar(.78+Math.min(level,8)*.065);this.treeAnchor.userData.level=level;}
 decorate(owned){const next=new Set(owned);if(next.has('daisies')&&!this.decorations?.has('daisies'))this.addFlowers(70,70);if(next.has('wildflowers')&&!this.decorations?.has('wildflowers'))this.addFlowers(100,102);if(next.has('grove')&&!this.decorations?.has('grove')){for(const d of [[.4,.82,.6],[-.55,.71,.57]])tree(radial(this.planet,new THREE.Vector3(...d)),.55,1)}this.decorations=next;}
 setLight(mode){document.body.dataset.light=mode;this.fireflies.material.opacity=mode==='dusk'?.95:.5;}
 frame(){requestAnimationFrame(this.frame);if(document.hidden)return;const t=performance.now()/1000;
  if(this.transition){const p=clamp((performance.now()-this.transition.start)/850,0,1),e=p*p*(3-2*p);this.camera.position.lerpVectors(this.transition.from,this.transition.pos,e);this.controls.target.lerpVectors(this.transition.targetFrom,this.transition.target,e);if(p===1)this.transition=null;}
  if(!this.reduced){this.mascot.group.rotation.z=Math.sin(t*1.5)*.035;this.mascot.group.position.y=Math.sin(t*2)*.005;this.mascot.foot1.rotation.x=this.walking?Math.sin(t*6)*.35:0;this.mascot.foot2.rotation.x=this.walking?-Math.sin(t*6)*.35:0;this.fireflies.rotation.y=Math.sin(t*.08)*.012;}
  this.controls.update();this.renderer.render(this.scene,this.camera);
 }
}
