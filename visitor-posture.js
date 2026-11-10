/* Local landmark diagnostics only. No ending, speech, or artwork state is changed here. */
(() => {
  const HOLD=1500, CONFIDENCE=.45, HYSTERESIS=.08;
  let threshold=.45,mode='off',model=null,generation=0,lastRun=-Infinity,interval=200,inferences=0,elapsed=0,simulation=false,lastSimulation=-Infinity;
  let posture='unknown',candidate=null,candidateSince=0,lastValid=-Infinity,lastSample=-Infinity,metrics=null,reason='未启用摄像头';
  const api=window.VisitorPosture={start,stop,due,detect,status,setThreshold,simulateSit};
  function resetEvidence(){posture='unknown';candidate=null;candidateSince=0;lastValid=-Infinity;lastSample=-Infinity;metrics=null;}
  function stop(){generation++;try{model?.model?.dispose?.();}catch{}model=null;mode='off';simulation=false;inferences=0;elapsed=0;lastRun=-Infinity;resetEvidence();reason='未启用摄像头';}
  async function start(ml5){
    stop();const token=generation;mode='loading';reason='姿态模型加载中';
    let pending;const timeout=setTimeout(()=>{if(token===generation){stop();mode='unavailable';reason='姿态模型加载超时';}},25000);
    try{
      pending=ml5.bodyPose('MoveNet',{modelType:'SINGLEPOSE_LIGHTNING',enableSmoothing:true});model=pending;await pending.ready;
      if(token!==generation){pending.model?.dispose?.();return;}clearTimeout(timeout);mode='camera';reason='等待髋部和膝盖';
    }catch{clearTimeout(timeout);if(token===generation){stop();mode='unavailable';reason='姿态检测不可用';}}
  }
  function setThreshold(value){threshold=Math.max(.15,Math.min(.85,Number(value)||.45));candidate=null;candidateSince=0;}
  function due(now){return mode==='camera'&&!simulation&&now-lastRun>=interval;}
  async function detect(input){
    if(!due(performance.now()))return;const token=generation,start=performance.now();lastRun=start;
    try{const poses=await model.detect(input);if(token!==generation)return;const end=performance.now();inferences++;elapsed+=end-start;interval=end-start>90?333:200;if(!simulation)accept(poses,input.width,input.height,end);}
    catch{if(token!==generation)return;mode='unavailable';reason='姿态推理失败';resetEvidence();}
  }
  function accept(poses,width,height,now){
    const pose=poses?.[0],points=pose?.keypoints||[],pairs=[];
    for(const side of ['left','right']){
      const get=part=>points.find(p=>p.name===side+'_'+part),shoulder=get('shoulder'),hip=get('hip'),knee=get('knee');
      if(![shoulder,hip,knee].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.confidence??p.score??0)>=CONFIDENCE&&p.x>=0&&p.x<width&&p.y>=0&&p.y<height*.98))continue;
      const torso=Math.hypot(hip.x-shoulder.x,hip.y-shoulder.y);
      if(torso<12||hip.y<=shoulder.y)continue;
      pairs.push({hip:hip.y,knee:knee.y,ratio:(knee.y-hip.y)/torso,confidence:Math.min(shoulder.confidence??shoulder.score,hip.confidence??hip.score,knee.confidence??knee.score)});
    }
    if(!pairs.length){metrics=null;candidate=null;reason='髋部或膝盖不清楚，请让肩、髋、膝都入镜';if(now-lastValid>1000)posture='unknown';lastSample=now;return;}
    const mean=key=>pairs.reduce((n,p)=>n+p[key],0)/pairs.length;
    metrics={hip:mean('hip'),knee:mean('knee'),ratio:mean('ratio'),confidence:mean('confidence'),sides:pairs.length,width,height};
    if(pairs.length===2&&Math.abs(pairs[0].ratio-pairs[1].ratio)>.5){candidate=null;reason='两侧关键点不一致';if(now-lastValid>1000)posture='unknown';lastSample=now;return;}
    lastValid=now;reason=simulation?'模拟关键点（非摄像头结果）':pairs.length===1?'单侧关键点有效':'双侧关键点有效';
    const next=metrics.ratio<threshold-HYSTERESIS?'sitting':metrics.ratio>threshold+HYSTERESIS?'standing':null;
    if(now-lastSample>750)candidate=null;lastSample=now;
    if(!next||next===posture){candidate=null;return;}
    if(candidate!==next){candidate=next;candidateSince=now;return;}
    if(now-candidateSince>=HOLD){posture=next;candidate=null;}
  }
  function simulateSit(){simulation=!simulation;resetEvidence();lastSimulation=-Infinity;reason=simulation?'模拟关键点（非摄像头结果）':mode==='camera'?'等待髋部和膝盖':'未启用摄像头';}
  function status(){
    const now=performance.now();
    if(simulation&&now-lastSimulation>=200){lastSimulation=now;accept([{keypoints:['left','right'].flatMap((side,i)=>[{name:side+'_shoulder',x:120+i*80,y:50,confidence:1},{name:side+'_hip',x:120+i*80,y:135,confidence:1},{name:side+'_knee',x:100+i*120,y:139,confidence:1}])}],320,240,now);}
    if(!simulation&&mode==='camera'&&now-lastValid>1000){posture='unknown';candidate=null;}
    return{mode:simulation?'simulation':mode,posture,candidate,pending:candidate?Math.min(1,(now-candidateSince)/HOLD):0,threshold,metrics,reason,inferences,meanMs:inferences?elapsed/inferences:0,hz:1000/interval};
  }
  addEventListener('pagehide',stop);
})();
