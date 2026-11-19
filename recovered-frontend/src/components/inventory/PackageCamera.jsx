
import React, {useEffect,useRef,useState} from 'react';
import {decodePackage,loadPackageReader} from './packageDecoder';

export default function PackageCamera({onScan,onExit}) {
  const video=useRef(null),scanRef=useRef(onScan),trackRef=useRef(null);
  scanRef.current=onScan;
  const [error,setError]=useState(''),[status,setStatus]=useState('Starting camera…');
  const [cameras,setCameras]=useState([]),[device,setDevice]=useState(''),[torch,setTorch]=useState(false),[canTorch,setCanTorch]=useState(false);
  useEffect(()=>{
    let closed=false,stream,timer,found=false;
    setError('');setStatus('Starting camera…');setTorch(false);setCanTorch(false);
    const stop=()=>stream?.getTracks().forEach(track=>track.stop());
    const start=async()=>{
      try {
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable. Open the portal directly in Safari or Chrome, or choose a label photo.');
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(device?{deviceId:{exact:device}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080}}});
        if(closed){stop();return;}
        const track=stream.getVideoTracks()[0];trackRef.current=track;
        const capabilities=track.getCapabilities?.()||{};
        setCanTorch(Boolean(capabilities.torch));
        if(capabilities.focusMode?.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
        if(closed){stop();return;}
        video.current.srcObject=stream;await video.current.play();
        navigator.mediaDevices.enumerateDevices().then(devices=>{if(!closed)setCameras(devices.filter(d=>d.kind==='videoinput'));}).catch(()=>{});
        await loadPackageReader();
        if(closed){stop();return;}
        setStatus('Ready. Aim at the entire square DataMatrix or other package barcode.');
        const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
        const tick=async()=>{
          if(closed||found)return;
          const v=video.current;
          if(v?.readyState>=2 && v.videoWidth) {
            const scale=Math.min(1,1920/Math.max(v.videoWidth,v.videoHeight));
            canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);
            context.drawImage(v,0,0,canvas.width,canvas.height);
            try {
              const code=await decodePackage(context.getImageData(0,0,canvas.width,canvas.height));
              if(!closed&&code){found=true;stop();scanRef.current(code);return;}
            }catch(e){if(!closed)setError(e.message||'Could not read this frame. Try a label photo.');}
          }
          if(!closed)timer=setTimeout(tick,300);
        };
        tick();
      } catch(e) {
        stop();
        if(!closed){setStatus('');setError(e.name==='NotAllowedError'?'Camera permission is blocked. Allow camera access for this portal in your browser settings, then reopen the camera. You can also choose a label photo.':e.name==='NotFoundError'?'No camera found. Choose a label photo or use a 2D barcode scanner.':e.message||'Camera unavailable. Choose a label photo or use a 2D barcode scanner.');}
      }
    };
    start();
    return()=>{closed=true;clearTimeout(timer);stop();trackRef.current=null;};
  },[device]);
  async function toggleTorch(){
    try {await trackRef.current?.applyConstraints({advanced:[{torch:!torch}]});setTorch(v=>!v);}catch{setError('The camera light is unavailable. Use brighter room lighting.');}
  }
  return <div className="space-y-2">
    <video ref={video} autoPlay muted playsInline className="w-full rounded-lg bg-black" style={{maxHeight:'50vh',objectFit:'contain'}} aria-label="Package scanner camera"/>
    {status&&<p role="status" className="text-sm">{status}</p>}
    <p className="text-sm">Rotate the vial so the whole square code faces the camera. Keep it in focus with bright, indirect light; move back slightly if it looks blurry.</p>
    {cameras.length>1&&<label className="block text-sm">Camera<select className="w-full rounded-lg border p-2 text-foreground bg-background" value={device} onChange={e=>setDevice(e.target.value)}><option value="">Automatic rear camera</option>{cameras.map((c,i)=><option key={c.deviceId} value={c.deviceId}>{c.label||'Camera '+(i+1)}</option>)}</select></label>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="flex gap-2">{canTorch&&<button type="button" className="rounded-lg border px-3 py-2" onClick={toggleTorch}>Turn light {torch?'off':'on'}</button>}<button type="button" className="rounded-lg border px-3 py-2" onClick={onExit}>Close camera</button></div>
  </div>;
}
