/* The eight objects carry her memories; presentation settings below are the only per-age controls. */
(() => {
  const VERSION = '0.170.0';
  // size: relative to a 300px reference at the front. angle: [X,Y,Z] in radians.
  // Missing tooth/diary/radio/sock files currently use the existing corresponding assets.
  const models = {
    '06': { file: 'obj-06-kids-cycle.glb', size: .18, angle: [0, -.85, -.08] },
    '11': { file: 'obj-11-autograph-book.glb', size: .65, angle: [Math.PI / 2, -.18, -.13] },
    '17': { file: 'obj-17-cassette.glb', size: 1.20, angle: [.10, -.20, -.05] },
    '24': { file: 'obj-24-key.glb', size: .42, angle: [0, .12, -.35] },
    '36': { file: 'old-duck-toy.glb', size: .47, angle: [.08, -.45, -.08] },
    '52': { file: 'obj-52-glasses.glb', size: .72, angle: [.12, -.12, -.10] },
    '68': { file: 'obj-68-ring.glb', size: .18, angle: [Math.PI / 2 + .22, -.18, -.28] },
    '83': { file: 'obj-83-teacup.glb', size: .95, angle: [.25, -.32, -.08] }
  };
  const cache = new Map(), failures = new Set(), queue = [];
  const api = window.MemoryObject3D = {
    ready: false, bounds: null, update, preload, measure,
    has: age => Object.hasOwn(models, age),
    isReady: age => cache.has(age),
    status: () => ({ loaded: cache.size, failed: [...failures], loading: loadingAge, active: currentAge, background: backgroundRoot?.children.length||0, renders })
  };
  let enginePromise, THREE, renderer, backgroundRenderer, world, backgroundWorld, backgroundRoot, backgroundSpot, camera, spot, subject, loader;
  let lastBackgroundDraw=-1,lastBackgroundLight={x:NaN,y:NaN},lastBackgroundKey='';
  let loadingAge = null, pumping = false, visible = false, currentAge = null, lastSize = '', renders = 0;

  function engine() {
    return enginePromise ||= (async () => {
      THREE = await import(`https://cdn.jsdelivr.net/npm/three@${VERSION}/build/three.module.js`);
      const { GLTFLoader } = await import(`https://cdn.jsdelivr.net/npm/three@${VERSION}/examples/jsm/loaders/GLTFLoader.js`);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.domElement.id = 'object-layer';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.hidden = true;
      document.querySelector('#space').append(renderer.domElement);
      backgroundRenderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});backgroundRenderer.setClearColor(0x000000,0);backgroundRenderer.outputColorSpace=THREE.SRGBColorSpace;backgroundRenderer.toneMapping=THREE.ACESFilmicToneMapping;backgroundRenderer.domElement.id='background-objects';backgroundRenderer.domElement.setAttribute('aria-hidden','true');backgroundRenderer.domElement.hidden=true;document.querySelector('#space').append(backgroundRenderer.domElement);
      backgroundWorld=new THREE.Scene();backgroundRoot=new THREE.Group();backgroundWorld.add(backgroundRoot,new THREE.AmbientLight(0xcbd0d5,.16));backgroundSpot=new THREE.SpotLight(0xcbd0d5,1.3,0,Math.PI/3,.9,0);backgroundWorld.add(backgroundSpot,backgroundSpot.target);
      renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); hide(); api.ready = false; });
      world = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, 1, 1, 5000); camera.position.z = 1100;
      world.add(new THREE.AmbientLight(0xcbd0d5, .16));
      spot = new THREE.SpotLight(0xffedcf, 5, 0, Math.PI / 3, .85, 0); world.add(spot, spot.target);
      subject = new THREE.Group(); world.add(subject); loader = new GLTFLoader();
      const { MeshoptDecoder } = await import('./assets/vendor/meshopt_decoder.module.js');
      await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder); api.ready = true;
    })();
  }

  function enqueue(age, priority = false) {
    if (!api.has(age) || cache.has(age) || failures.has(age) || loadingAge === age) return;
    const existing = queue.indexOf(age); if (existing >= 0) queue.splice(existing, 1);
    priority ? queue.unshift(age) : queue.push(age);
    pump();
  }
  function preload(firstAge) { enqueue(firstAge); for (const age of Object.keys(models)) enqueue(age); }
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      await engine();
      while (queue.length) {
        const age = queue.shift(); loadingAge = age;
        try {
          const gltf = await loader.loadAsync('assets/models/' + models[age].file + '?v=meshopt-webp-1');
          const model = gltf.scene, pose = new THREE.Group(), wrapper = new THREE.Group(), uniforms = [], materials = [];
          pose.add(model); pose.rotation.set(...models[age].angle); pose.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(pose), size = box.getSize(new THREE.Vector3());
          pose.position.sub(box.getCenter(new THREE.Vector3())); wrapper.add(pose);
          model.traverse(node => {
            if (!node.isMesh) return;
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
              if (age === '83') {
                // The supplied FBX exported default metallic-white materials; restore aged porcelain.
                material.color.setRGB(.70, .64, .49); material.metalness = 0; material.roughness = .82;
              }
              const clarity = { value: 0 }, dissolve = { value: 0 };
              node.geometry.computeBoundingBox();
              const extent=node.geometry.boundingBox.getSize(new THREE.Vector3());
              const noiseScale={value:4/Math.max(.001,extent.x,extent.y,extent.z)};
              uniforms.push({clarity,dissolve});
              materials.push({material, roughness: material.roughness ?? .8, metalness: material.metalness ?? 0});
              material.onBeforeCompile = shader => {
                shader.uniforms.memoryClarity = clarity;
                shader.uniforms.memoryDissolve = dissolve;
                shader.uniforms.memoryNoiseScale = noiseScale;
                shader.vertexShader='varying vec3 memoryPosition;\n'+shader.vertexShader;
                shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmemoryPosition=position;');
                shader.fragmentShader = `uniform float memoryClarity;
                uniform float memoryDissolve;
                uniform float memoryNoiseScale;
                varying vec3 memoryPosition;
                float memoryHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
                float memoryNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(memoryHash(i),memoryHash(i+vec3(1,0,0)),f.x),mix(memoryHash(i+vec3(0,1,0)),memoryHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(memoryHash(i+vec3(0,0,1)),memoryHash(i+vec3(1,0,1)),f.x),mix(memoryHash(i+vec3(0,1,1)),memoryHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
                ` + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
                  #include <color_fragment>
                  float remembered=memoryNoise(memoryPosition*memoryNoiseScale*1.7);
                  if(memoryDissolve>0.0&&remembered<memoryDissolve)discard;
                  float gray = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
                  vec3 faded = mix(vec3(gray), diffuseColor.rgb, .12) * vec3(.48, .50, .52);
                  vec3 warm = diffuseColor.rgb * vec3(1.04, 1.0, .94);
                  diffuseColor.rgb = mix(faded, warm, memoryClarity);
                `);
              };
              material.customProgramCacheKey = () => 'memory-object-confusion-v1';
            }
          });
          const background=makeDistant(wrapper,.28),ghost=makeDistant(wrapper,.65);
          wrapper.updateMatrixWorld(true);
          const points=makePoints(wrapper,size);
          cache.set(age, { wrapper, background, ghost, points, size, uniforms, materials });
        } catch { failures.add(age); }
        loadingAge = null;
        // Yield between models; only one network/decode task is in flight.
        await new Promise(resolve => setTimeout(resolve, 180));
      }
    } catch { for (const age of Object.keys(models)) failures.add(age); hide(); }
    finally { loadingAge = null; pumping = false; }
  }

  function makeDistant(wrapper,shade){
    const distant=wrapper.clone(true);
    distant.traverse(node=>{if(!node.isMesh)return;const faded=m=>{
      const copy=m.clone();copy.color.multiplyScalar(shade);copy.roughness=.95;copy.metalness=.05;
      copy.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat gray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=vec3(gray)*vec3(.48,.50,.52);');};
      copy.customProgramCacheKey=()=> 'distant-memory-cold-v1';return copy;
    };node.material=Array.isArray(node.material)?node.material.map(faded):faded(node.material);});return distant;
  }
  function makePoints(wrapper,size){
    const surfaces=[];let total=0;
    wrapper.traverse(node=>{if(node.isMesh&&node.geometry.attributes.position){total+=node.geometry.attributes.position.count;surfaces.push({node,end:total});}});
    const count=Math.min(1600,total),positions=new Float32Array(count*3),scatter=new Float32Array(count*3),colors=new Float32Array(count*3),seeds=new Float32Array(count);
    let seed=9137;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<count;i++){
      const pick=random()*total,surface=surfaces.find(s=>pick<s.end)||surfaces[surfaces.length-1];
      const {node}=surface,attribute=node.geometry.attributes.position,index=Math.floor(random()*attribute.count);
      const point=node.localToWorld(new THREE.Vector3(attribute.getX(index),attribute.getY(index),attribute.getZ(index)));
      positions.set([point.x,point.y,point.z],i*3);scatter.set([(random()-.5)*1.5,(random()-.5)*1.3,(random()-.5)*.7],i*3);seeds[i]=random();
      const material=Array.isArray(node.material)?node.material[0]:node.material;
      colors.set([material.color.r,material.color.g,material.color.b],i*3);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('memoryScatter',new THREE.BufferAttribute(scatter,3));geometry.setAttribute('memoryColor',new THREE.BufferAttribute(colors,3));geometry.setAttribute('memorySeed',new THREE.BufferAttribute(seeds,1));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{dispersion:{value:0},extent:{value:Math.max(size.x,size.y,size.z)},opacity:{value:0},pixelRatio:{value:1}},vertexShader:`
      attribute vec3 memoryScatter;attribute vec3 memoryColor;attribute float memorySeed;
      uniform float dispersion;uniform float extent;uniform float pixelRatio;
      varying vec3 ink;
      void main(){ink=mix(vec3(.36,.39,.41),memoryColor*.7,.18);vec3 moved=position+memoryScatter*dispersion*extent*.55;gl_Position=projectionMatrix*modelViewMatrix*vec4(moved,1.0);gl_PointSize=min(5.0,(1.2+memorySeed*1.8)*pixelRatio);}
    `,fragmentShader:`uniform float opacity;varying vec3 ink;
      void main(){float radius=length(gl_PointCoord-vec2(.5));if(radius>.5)discard;gl_FragColor=vec4(ink,opacity*(1.0-smoothstep(.1,.5,radius)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    const points=new THREE.Points(geometry,material);points.frustumCulled=false;return points;
  }
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  function measure(age, reference) {
    const item=cache.get(age), config=models[age];
    if(!item||!config)return {width:0,height:0};
    let width=reference*config.size,height=width*item.size.y/Math.max(.001,item.size.x);
    const fit=Math.min(1,reference*.95/Math.max(.001,height));
    return {width:width*fit,height:height*fit};
  }
  function materialState(item,clarity,dissolve=0){
    for(const uniform of item.uniforms){uniform.clarity.value=clarity;uniform.dissolve.value=dissolve;}
    for(const entry of item.materials){entry.material.roughness=Math.max(.88,entry.roughness)*(1-clarity)+entry.roughness*clarity;entry.material.metalness=Math.min(.15,entry.metalness)*(1-clarity)+entry.metalness*clarity;}
  }
  function place(wrapper,item,frame,state){
    const {width:w,height:h}=state,shape=measure(frame.age,frame.reference),depth=frame.z,projection=(1100-depth)/1100;
    wrapper.position.set((frame.x-w/2)*projection,(h/2-frame.y)*projection,depth);
    wrapper.scale.setScalar(shape.width/Math.max(.001,item.size.x)*projection);
    const elapsed=Math.max(0,state.motionTime-(frame.since||0));
    const sway=state.reduced?0:Math.sin(elapsed*Math.PI/4+(frame.phase||0))*Math.PI/60*(1-state.clarity);
    const settle=state.reduced||!frame.foreground?0:Math.PI/12*Math.exp(-elapsed/1.8)*(1-state.clarity);
    wrapper.rotation.set(-state.tiltX*Math.PI/180,state.tiltY*Math.PI/180+settle+sway,sway*.35);
  }
  function update(state){
    if(!api.ready||!state?.show||document.hidden){hide();return;}
    const {width:w,height:h}=state;
    if(lastSize!==`${w}:${h}`){lastSize=`${w}:${h}`;renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<=700?1.5:2));renderer.setSize(w,h,false);backgroundRenderer.setPixelRatio(.4);backgroundRenderer.setSize(w,h,false);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(h/2200));camera.aspect=w/h;camera.updateProjectionMatrix();}
    subject.clear();backgroundRoot.clear();currentAge=null;api.bounds=null;
    for(const frame of state.items){
      if(frame.age==='83'&&!state.ending)continue;
      const item=cache.get(frame.age);if(!item){enqueue(frame.age,true);continue;}
      if(frame.foreground){
        const effect=frame.effect||{},strength=effect.strength??0,progress=effect.morphProgress||0;
        const target=effect.morphTarget&&cache.get(effect.morphTarget);
        const sourcePresence=target?(state.reduced?1-progress:1-smooth(0,.45,progress)):1;
        const targetPresence=target?(state.reduced?progress:smooth(.55,1,progress)):0;
        const sourceAmount=Math.max((effect.dissolve||0)*strength,(1-sourcePresence)*strength*1.01);
        subject.add(item.wrapper);place(item.wrapper,item,frame,state);materialState(item,state.clarity,sourceAmount);
        if(target){
          const next={...frame,age:effect.morphTarget};
          subject.add(target.wrapper);place(target.wrapper,target,next,state);materialState(target,state.clarity,1-(targetPresence*strength));
          if(!state.reduced&&strength>.001&&progress>0&&progress<1){
            const particles=(entry,pose,opacity,dispersion)=>{if(opacity<.001)return;subject.add(entry.points);place(entry.points,entry,pose,state);entry.points.material.uniforms.opacity.value=opacity*strength*.7;entry.points.material.uniforms.dispersion.value=dispersion;entry.points.material.uniforms.pixelRatio.value=Math.min(devicePixelRatio||1,2);};
            particles(item,frame,smooth(0,.28,progress)*(1-smooth(.45,.65,progress)),smooth(.05,.5,progress));
            particles(target,next,smooth(.35,.55,progress)*(1-smooth(.75,1,progress)),1-smooth(.5,1,progress));
          }
        }
        if(effect.eraTarget&&strength>.001){
          const other=cache.get(effect.eraTarget);
          if(other){const ghostShape=measure(effect.eraTarget,frame.reference*.33),shape=measure(frame.age,frame.reference);const side=frame.x>w/2?-1:1;const ghostFrame={...frame,age:effect.eraTarget,x:Math.max(ghostShape.width/2+20,Math.min(w-ghostShape.width/2-20,frame.x+side*(shape.width*.65+70))),y:Math.max(70,frame.y-shape.height*.4-45),z:-430,reference:frame.reference*.33,foreground:false};backgroundRoot.add(other.ghost);place(other.ghost,other,ghostFrame,state);other.ghost.traverse(node=>{if(!node.isMesh)return;for(const material of Array.isArray(node.material)?node.material:[node.material]){material.transparent=true;material.opacity=strength*.9;material.depthWrite=false;}});}
        }
        currentAge=target&&progress>.5&&strength>.5?effect.morphTarget:frame.age;const shape=measure(currentAge,frame.reference);api.bounds={left:frame.x-shape.width/2,right:frame.x+shape.width/2,top:frame.y-shape.height/2,bottom:frame.y+shape.height/2};
      }
      else{backgroundRoot.add(item.background);place(item.background,item,frame,state);}
    }
    spot.position.set(state.light.x-w/2,h/2-state.light.y,620);spot.target.position.set(state.light.x-w/2,h/2-state.light.y,0);spot.color.setHex(state.clarity>.5?0xffedcf:0xe1e6ec);
    backgroundSpot.position.copy(spot.position);backgroundSpot.target.position.copy(spot.target.position);
    renderer.domElement.hidden=!subject.children.length;
    renderer.domElement.style.opacity=state.exposure??1;renderer.domElement.style.setProperty('--object-focus',`${state.reduced?.3:.3+2*(1-(state.focus??1))}px`);
    if(subject.children.length){renderer.render(world,camera);renders++;}else renderer.clear();
    backgroundRenderer.domElement.hidden=!backgroundRoot.children.length;
    backgroundRenderer.domElement.style.opacity=(state.backgroundExposure??1)*(1-state.clarity*.98)*.78;
    const backgroundKey=state.items.map(f=>f.foreground?`${f.effect?.eraTarget||''}:${Math.round((f.effect?.strength||0)*20)}`:f.age).join(',');
    if(backgroundRoot.children.length&&(state.motionTime-lastBackgroundDraw>.065||Math.hypot(state.light.x-lastBackgroundLight.x,state.light.y-lastBackgroundLight.y)>1||backgroundKey!==lastBackgroundKey)){backgroundRenderer.render(backgroundWorld,camera);lastBackgroundDraw=state.motionTime;lastBackgroundLight={...state.light};lastBackgroundKey=backgroundKey;}else if(!backgroundRoot.children.length)backgroundRenderer.clear();
    visible=true;
  }
  function hide(){api.bounds=null;currentAge=null;if(!renderer||!visible)return;visible=false;renderer.clear();backgroundRenderer.clear();renderer.domElement.hidden=true;backgroundRenderer.domElement.hidden=true;}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
})();
