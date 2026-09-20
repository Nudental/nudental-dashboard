import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import ProviderCompensationNew from '../../../recovered-frontend/src/pages/payroll/components/ProviderCompensationNew.jsx';
import './style.css';
const NativeDate=Date;
globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:['2026-10-31T12:00:00-04:00']));} static now(){return new NativeDate('2026-10-31T12:00:00-04:00').getTime();}};
const originalFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,init)=>{const u=new URL(input instanceof Request?input.url:input,location.origin);if(u.origin!==location.origin)throw Error('Synthetic QA blocks external requests');return originalFetch(input,init);};
function App(){const [visible,setVisible]=useState(true),[notice,setNotice]=useState('Only October 2 is initially imported. No real data or credentials.');return <main><aside><h1>SYNTHETIC QA — isolated payroll progression</h1><p>{notice}</p>{[1,2,3].map(n=><button key={n} onClick={async()=>{await fetch('/qa/import/'+n,{method:'POST'});setNotice('Imported fixture stage '+n+'. Click the actual Refresh button below. Same build and policy.');}}>Import stage {n}</button>)}{['normal','incomplete','unknown','zero','revision','bad-category'].map(mode=><button key={mode} onClick={async()=>{await fetch('/qa/scenario/'+mode,{method:'POST'});setNotice('Synthetic source: '+mode+'. Refresh below.');}}>{mode}</button>)}<button onClick={()=>setVisible(v=>!v)}>Switch QA tab</button></aside>{visible?<ProviderCompensationNew/>:<p>Other synthetic QA tab; compensation unmounted.</p>}</main>}
createRoot(document.getElementById('root')).render(<App/>);
