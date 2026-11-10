/* Only mask pixels enter the artwork. Camera frames never leave this device. */
(() => {
  const VERSION='1.2.1', W=160, H=120, INTERVAL=1000/12, DELAY=500;
  const canvas=document.createElement('canvas');canvas.id='visitor-silhouette';canvas.width=220;canvas.height=340;canvas.setAttribute('aria-hidden','true');canvas.hidden=true;document.querySelector('#space').append(canvas);
  const ctx=canvas.getContext('2d'),mask=document.createElement('canvas'),scratch=document.createElement('canvas'),input=document.createElement('canvas');mask.width=scratch.width=W;mask.height=scratch.height=H;input.width=320;input.height=240;
  const ink=mask.getContext('2d'),sample=scratch.getContext('2d',{willReadFrequently:true}),capture=input.getContext('2d');
  let stream=null,video=null,model=null,session=0,timer=null,frames=[],previous=null,shown=null,lastDraw=0,detected=false,movement=0,mode='generic',loading=false,processed=0,inferenceHz=0,lastInference=0;
  const fallback=document.createElement('canvas');fallback.width=W;fallback.height=H;const shape=fallback.getContext('2d');
  shape.fillStyle='#fff';shape.beginPath();shape.ellipse(80,24,12,15,0,0,Math.PI*2);shape.fill();shape.beginPath();shape.moveTo(70,37);shape.bezierCurveTo(56,40,54,53,49,78);shape.quadraticCurveTo(48,85,54,83);shape.lineTo(64,57);shape.lineTo(65,86);shape.lineTo(63,117);shape.lineTo(74,117);shape.lineTo(80,86);shape.lineTo(85,117);shape.lineTo(97,117);shape.lineTo(94,84);shape.lineTo(95,57);shape.lineTo(105,83);shape.quadraticCurveTo(111,86,110,78);shape.bezierCurveTo(106,52,103,40,90,37);shape.closePath();shape.fill();
  const fallbackAlpha=shape.getImageData(0,0,W,H).data.filter((_,i)=>i%4===3);
  const api=window.VisitorSilhouette={attach,update,stop,hit:(x,y)=>{const a=mode==='camera'?shown?.alpha:fallbackAlpha;return !!a&&a[Math.max(0,Math.min(H-1,Math.floor(y*H)))*W+Math.max(0,Math.min(W-1,Math.floor((1-x)*W)))]>40;},status:()=>({mode,loading,detected,movement,delay:DELAY,rate:12,inferences:processed,inferenceHz})};
  let libraryPromise;
  function library(){return libraryPromise||=(async()=>{if(window.ml5)return window.ml5;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`https://cdn.jsdelivr.net/npm/ml5@${VERSION}/dist/ml5.min.js`;script.onload=resolve;script.onerror=reject;document.head.append(script);});return window.ml5;})();}
  function closeStream(){stream?.getTracks().forEach(t=>t.stop());stream=null;if(video){video.pause();video.srcObject=null;}video=null;capture.clearRect(0,0,320,240);sample.clearRect(0,0,W,H);}
  function stop(){window.VisitorPosture?.stop();session++;clearTimeout(timer);closeStream();frames=[];previous=null;shown=null;detected=false;loading=false;mode='generic';processed=0;inferenceHz=0;lastInference=0;try{model?.model?.dispose?.();}catch{}model=null;}
  async function attach(cameraStream){
    stop();stream=cameraStream;const token=session;mode='loading';loading=true;
    const fail=()=>{if(token!==session)return;stop();mode='unavailable';};
    const timeout=setTimeout(fail,25000);cameraStream.getVideoTracks?.().forEach(track=>track.addEventListener('ended',fail,{once:true}));
    try{
      video=document.createElement('video');video.width=320;video.height=240;video.muted=true;video.autoplay=true;video.playsInline=true;video.srcObject=stream;await video.play();
      const ml5=await library();if(token!==session)return;
      const pending=ml5.bodySegmentation('SelfieSegmentation',{modelType:'general',maskType:'person'});model=pending;await pending.ready;
      if(token!==session){pending.model?.dispose?.();return;}clearTimeout(timeout);loading=false;mode='camera';window.VisitorPosture?.start(ml5);
      const loop=async()=>{
        if(token!==session)return;const start=performance.now();let poseCost=0;
        if(!document.hidden&&video?.readyState>=2){
          try{capture.drawImage(video,0,0,320,240);const result=await model.detect(input);if(token!==session)return;accept(result,performance.now());if(window.VisitorPosture?.due(performance.now())){const poseStart=performance.now();await window.VisitorPosture.detect(input);poseCost=performance.now()-poseStart;if(token!==session)return;}}
          catch{fail();return;}
        }
        if(token===session)timer=setTimeout(loop,Math.max(0,(poseCost>90?125:INTERVAL)-(performance.now()-start)));
      };loop();
    }catch{clearTimeout(timeout);fail();}
  }
  function accept(result,now){
    processed++;if(lastInference)inferenceHz=1000/(now-lastInference);lastInference=now;
    // Official ml5 person display mask: opaque background, transparent person.
    const image=result.maskImageData;
    const alpha=new Uint8ClampedArray(W*H);
    if(image){const temporary=document.createElement('canvas');temporary.width=image.width;temporary.height=image.height;temporary.getContext('2d').putImageData(image,0,0);sample.clearRect(0,0,W,H);sample.drawImage(temporary,0,0,W,H);const pixels=sample.getImageData(0,0,W,H).data;for(let i=0;i<alpha.length;i++)alpha[i]=255-pixels[i*4+3];}
    let sum=0,difference=0;for(let i=0;i<alpha.length;i++){sum+=alpha[i];if(previous)difference+=Math.abs(alpha[i]-previous[i]);}
    detected=sum/(W*H*255)>.015;const motion=previous?Math.min(1,difference/(W*H*255)*9):0;previous=alpha;
    frames.push({at:now,alpha,detected,motion});while(frames.length>12)frames.shift();
  }
  function paint(alpha,motion,now,reduced){
    const image=ink.createImageData(W,H),pixels=image.data;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,a=alpha[i]/255;if(a<.05)continue;const around=Math.min(alpha[y*W+Math.max(0,x-2)],alpha[y*W+Math.min(W-1,x+2)],alpha[Math.max(0,y-2)*W+x],alpha[Math.min(H-1,y+2)*W+x])/255;const edge=Math.max(0,a-around);const shade=19+edge*65;pixels[i*4]=shade*.93;pixels[i*4+1]=shade;pixels[i*4+2]=shade*1.04;pixels[i*4+3]=a*255;}
    ink.putImageData(image,0,0);ctx.clearRect(0,0,220,340);ctx.save();ctx.translate(220,0);ctx.scale(-1,1);ctx.filter=`blur(${4+motion*10}px)`;ctx.drawImage(mask,0,0,220,340);ctx.restore();
    // Disintegration follows mask movement, never face pixels or facial features.
    if(motion>.08){for(let i=0;i<7;i++){const y=(i*47+(reduced?0:Math.floor(now/200)*13))%340;ctx.clearRect(0,y,220,1+motion*5);}}
  }
  function update(state){
    canvas.hidden=!state.visible;if(!state.visible)return;
    const now=performance.now();while(frames.length&&frames[0].at<=now-DELAY)shown=frames.shift();
    const camera=mode==='camera',alpha=camera?(shown?.alpha||new Uint8ClampedArray(W*H)):fallbackAlpha;movement=camera?(shown?.motion||0):.015;
    if(now-lastDraw>=INTERVAL){paint(alpha,movement,now,state.reduced);lastDraw=now;}
    const depth=-240,p=(1100-depth)/1100,sway=state.reduced?0:Math.sin(state.time*.24)*7;
    canvas.style.width=state.width*p+'px';canvas.style.height=state.height*p+'px';canvas.style.opacity=state.opacity;
    canvas.style.left=`calc(50% + ${(state.x-state.viewportWidth/2)*p}px)`;canvas.style.top=`calc(50% + ${(state.y-state.viewportHeight/2)*p}px)`;
    canvas.style.transform=`translate(-50%,-50%) translateZ(${depth}px) rotateX(${-state.tiltX}deg) rotateY(${state.tiltY}deg) translate(${sway}px,${state.reduced?0:Math.cos(state.time*.21)*5}px)`;
  }
  addEventListener('pagehide',stop);
})();
