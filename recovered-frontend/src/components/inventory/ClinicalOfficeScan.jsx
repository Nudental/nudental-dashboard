import React, { useState, useEffect, useRef } from 'react';
import PackageDetails from './PackageDetails';
import PackageCamera from './PackageCamera';
import {parsePackage} from './packageCode';
import {decodePackage} from './packageDecoder';
import { supabase } from '../../lib/supabase';

const fieldClass = 'w-full rounded-lg border border-border bg-background p-2 text-sm';
const secondary = 'rounded-lg border border-border px-3 py-2 text-sm font-semibold';
const primary = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';
const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const emptyItem = {identifier:'', lot:'', expiry:'', product:'', type:'', system:'',platform:'',sku:'',quantity:1, notes:'', method:'manual',gtin:'',serial:'',manufactured:'',diameter:'',length:'',surface:'',collar:'',manufacturer:'',size:'',volume:'',volumeUnit:'',particleSize:'',donor:'',sterility:'',supplier:'',orderReference:'',unitCost:'',detailsConfirmed:false};

function Field({label,children}) { return <label className="block text-sm font-medium">{label}{children}</label>; }

async function rpc(name,args={}) {
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw new Error(error.message);
  return data;
}

function ScanForm({office,kind,mode,onSaved,onClose,userName,onLock,onReceipt}) {
  const [item,setItem]=useState(emptyItem), [raw,setRaw]=useState(''), [camera,setCamera]=useState(false);
  const [busy,setBusy]=useState(''), [error,setError]=useState(''),[stock,setStock]=useState(undefined);
  const [patient,setPatient]=useState({first:'',last:'',dob:'',date:localDate()}),[visits,setVisits]=useState(null),[selected,setSelected]=useState('');
  const [prior,setPrior]=useState(null),[confirmExtra,setConfirmExtra]=useState(false),[receipt,setReceipt]=useState(null);
  const [requestId]=useState(()=>crypto.randomUUID()),active=useRef(true),lock=useRef(false);
  const consume=mode==='consume',implant=kind==='implant';
  useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
  function edit(key,value){setItem(s=>({...s,[key]:value,detailsConfirmed:key==='detailsConfirmed'?value:false,...(['identifier','lot'].includes(key)?{catalogLabel:'',catalogSource:''}:{})}));setError('');if(['identifier','lot'].includes(key)){setStock(undefined);setPrior(null);setConfirmExtra(false);}}
  function identity(key,value){setPatient(p=>({...p,[key]:value}));setSelected('');setVisits(null);setError('');setPrior(null);setConfirmExtra(false);}
  async function run(label,work){
    if(lock.current)return;lock.current=true;onLock(true);setBusy(label);setError('');
    try {await work();}catch(e){if(active.current)setError(e.message||'Please try again.');}
    finally {lock.current=false;if(active.current){setBusy('');onLock(false);}}
  }
  async function lookupStock(next){
      const result=await rpc('clinical_scan_stock',{target:office.id,kind,identifier:next.identifier.trim(),lot:next.lot.trim()});
      if(!active.current)return;
      if(result.length>1)throw new Error('More than one lot matches. Enter both the item ID and lot.');
      if(result[0]){
        const details=await rpc('clinical_scan_package_details',{target:office.id,kind,stock_id:result[0].id});
        if(!active.current)return;
        setItem(v=>{
          const filled={...v};
          for(const [key,value] of Object.entries(details||{}))if(!filled[key] && value!==null)filled[key]=value;
          filled.expiry=filled.expiry||result[0].expiry||'';
          return filled;
        });
      }
      setStock(result[0]||null);
  }
  function readStock(next){return run('Looking up the lot…',()=>lookupStock(next));}
  async function acceptCode(code,method){
    const parsed=parsePackage(code);
    if(kind!=='implant' && parsed.catalogSource)throw new Error('This is an implant package. Choose Implants before scanning it.');
    const next={...emptyItem,...parsed,method,rawCode:String(code)};
    if(!active.current)return;
    setItem(next);setRaw('');setPrior(null);setConfirmExtra(false);
    await lookupStock(next);
  }
  function scan(code,method){
    setCamera(false);
    return run('Reading the package…',async()=>{setStock(undefined);setItem(emptyItem);await acceptCode(code,method);});
  }
  function photo(file){
    if(!file)return;
    setCamera(false);
    return run('Reading the label photo…',async()=>{
      setStock(undefined);setItem(emptyItem);
      if(file.size>25*1024*1024)throw new Error('Choose a label photo smaller than 25 MB.');
      const code=await decodePackage(file);
      if(!code)throw new Error('No readable barcode found. Take a sharp, straight-on photo of the whole square code, or enter the details from the label.');
      await acceptCode(code,'photo');
    });
  }
  async function lookup(){
    await run('Checking Dentrix Ascend…',async()=>{
      setSelected('');setVisits(null);setPrior(null);setConfirmExtra(false);
      const {data,error}=await supabase.functions.invoke('clinical-inventory-visit',{body:{office:office.id,...patient}});
      if(error){let reason;try{reason=await error.context.json();}catch{}throw new Error(reason?.message||'Dentrix could not be reached. Try again.');}
      if(!active.current)return;
      setVisits(data.visits||[]);
    });
  }
  function save(){
    return run('Saving…',async()=>{
      const movement={office:office.id,category:kind,action:mode,...item,quantity:Number(item.quantity),
        ...(consume?{confirmation:selected,priorUnits:confirmExtra?prior:0}:{})};
      try {
        const result=await rpc('record_clinical_office_scan_v2',{movement,request_id:requestId});
        if(active.current){setReceipt(result);onReceipt(true);setCamera(false);}
      } catch(e) {
        const hit=e.message.match(/Already recorded for this visit and lot: (\d+) unit/);
        if(hit){setPrior(Number(hit[1]));setConfirmExtra(false);}
        throw e;
      }
    });
  }
  const input=(key,label,type='text')=><Field label={label}><input className={fieldClass} type={type} value={item[key]} onChange={e=>edit(key,e.target.value)} /></Field>;
  const usable=Boolean(item.identifier.trim()||item.lot.trim()) && Number.isInteger(+item.quantity) && +item.quantity>=1 && +item.quantity<=1000;
  const detailsReady=consume || (item.detailsConfirmed && item.product.trim() && item.sku.trim() && item.lot.trim() && item.expiry &&
    (implant?(item.system.trim()&&item.platform.trim()&&item.diameter.trim()&&item.length.trim()):
      (item.type&&item.manufacturer.trim()&&(item.size.trim()||(+item.volume>0&&item.volumeUnit)))));
  if(receipt)return <div role="status" className="space-y-3"><h3 className="font-semibold">{consume?'Patient use recorded':'Delivery received'}</h3>
    <p>{office.name} · {receipt.quantity} {receipt.quantity===1?'unit':'units'} {consume?'used':'received'} · {receipt.onHand} on hand</p>
    <button className={primary} onClick={()=>{onSaved?.();onClose?.();}}>Done</button></div>;
  return <fieldset disabled={!!busy} className="space-y-4">
    <div className="flex flex-wrap items-end gap-2"><Field label="Scan or enter package barcode"><input className={fieldClass} autoFocus={window.matchMedia('(pointer:fine)').matches} autoComplete="off" autoCapitalize="off" spellCheck={false} value={raw} onChange={e=>setRaw(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter'&&raw.trim()){e.preventDefault();scan(raw,'scanner');}}}/></Field>
      <button className={secondary} disabled={!raw.trim()} onClick={()=>scan(raw,'scanner')}>Read code</button>
      <button className={secondary} onClick={()=>setCamera(v=>!v)}>Use camera</button></div>
    <div className="flex flex-wrap gap-2">
      <label className={secondary}>Take label photo<input type="file" className="sr-only" aria-label="Take label photo" accept="image/*" capture="environment" onChange={e=>{const file=e.target.files?.[0];e.target.value='';photo(file);}}/></label>
      <label className={secondary}>Choose label photo<input type="file" className="sr-only" aria-label="Choose label photo" accept="image/*" onChange={e=>{const file=e.target.files?.[0];e.target.value='';photo(file);}}/></label>
    </div>
    <p className="text-sm text-muted-foreground">Scan the square DataMatrix on the package. A handheld scanner must support 2D DataMatrix. Photos are read on this device.</p>
    {camera && <PackageCamera onScan={code=>scan(code,'camera')} onExit={()=>setCamera(false)}/>}
    {item.codeType&&<div role="status" className="rounded-lg border p-3 text-sm space-y-1"><p>Barcode read · Product ID (GTIN): {item.gtin||'not included'} · Lot: {item.lot||'not included'} · Expires: {item.expiry||'not included'}</p>
      {item.catalogLabel&&<p>{item.catalogLabel} · REF {item.sku}. Matched by product ID; confirm against the label.</p>}</div>}
    <div className="grid gap-3 sm:grid-cols-2">{input('identifier','Item ID / GTIN or serial')}{input('lot','Lot number')}</div>
    <button className={secondary} disabled={!(item.identifier.trim()||item.lot.trim())} onClick={()=>readStock(item)}>Check stock in {office.name}</button>
    {stock!==undefined && <p role="status">{stock?(stock.label||'Matching lot')+' · '+stock.on_hand+' on hand in '+office.name:'No matching lot in '+office.name+'.'}</p>}
    {!consume && <section className="space-y-3 border-t pt-3"><h3 className="font-semibold">Confirm package details</h3>
      <p className="text-sm">Complete the required product and size fields from the label. Leave optional details blank when they are not printed.</p>
      <div className="grid gap-3 sm:grid-cols-2">{input('product',implant?'Implant manufacturer *':'Product name *')}{input('sku','Reference / SKU *')}
      {implant?<>{input('system','Implant system *')}{input('platform','Platform (include unit) *')}{input('diameter','Diameter (include unit) *')}{input('length','Length (include unit) *')}{input('surface','Surface (if printed)')}{input('collar','Healing collar size (if printed)')}</>:
        <><Field label="Material *"><select className={fieldClass} value={item.type} onChange={e=>edit('type',e.target.value)}><option value="">Choose material</option>{['Bone','Tissue','Membrane','PRF'].map(s=><option key={s}>{s}</option>)}</select></Field>
        {input('manufacturer','Manufacturer / tissue bank *')}{input('size','Dimensions / size (include units)')}{input('volume','Volume / weight per package','number')}
        <Field label="Volume / weight unit"><select className={fieldClass} value={item.volumeUnit} onChange={e=>edit('volumeUnit',e.target.value)}><option value="">Choose unit</option>{['cc','mL','g','mg'].map(s=><option key={s}>{s}</option>)}</select></Field>
        {input('particleSize','Particle size / range (if printed)')}{input('donor','Donor / tissue ID (if printed)')}
        <p className="text-xs text-muted-foreground">Enter dimensions or volume/weight with its unit. A donor ID is separate from the lot number.</p></>}
      {input('gtin','Product ID / GTIN (if printed)')}{input('serial','Serial number (if printed)')}{input('manufactured','Manufacture date (if printed)','date')}{input('sterility','Sterilization / processing (if printed)')}
      {input('supplier','Supplier (optional)')}{input('orderReference','Order / invoice reference (optional)')}{input('unitCost','Cost per received package (optional)','number')}
      </div>
    </section>}
    <div className="grid gap-3 sm:grid-cols-2">{input('quantity',consume?'Quantity used':'Quantity received (confirm count)','number')}{!consume&&input('expiry','Expiration *','date')}</div>
    {consume&&stock&&<PackageDetails details={item}/>}
    {consume && <section className="space-y-3 border-t pt-3"><h3 className="font-semibold">Find the treating visit</h3><div className="grid gap-3 sm:grid-cols-2">
      {[['first','Patient first name','text'],['last','Patient last name','text'],['dob','Date of birth','date'],['date','Service date','date']].map(([k,l,t])=><Field key={k} label={l}><input type={t} className={fieldClass} autoComplete="off" value={patient[k]} onChange={e=>identity(k,e.target.value)}/></Field>)}</div>
      <button className={secondary} disabled={!patient.first.trim()||!patient.last.trim()||!patient.dob||!patient.date} onClick={lookup}>Find visit in Dentrix Ascend</button>
      {visits?.length===0&&<p role="status">No matching visit. Check the patient, date and treating office.</p>}
      {visits?.length>0&&<fieldset><legend>Confirm the patient and treating visit</legend>{visits.map(v=><label key={v.confirmation} className="block border rounded-lg p-3 my-1">
        <input type="radio" name="ascend-visit" checked={selected===v.confirmation} onChange={()=>{setSelected(v.confirmation);setPrior(null);setConfirmExtra(false);}}/> {v.patientName} · {v.date} · {new Date(v.start).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})} · {v.providerName}{v.chartNumber?' · Chart '+v.chartNumber:''}{v.procedureLabel?' · '+v.procedureLabel:' · Appointment provider'}{v.site?' · Site '+v.site:''}</label>)}</fieldset>}
    </section>}
    {input('notes','Notes (optional)')}
    {!consume&&<label className="block text-sm"><input type="checkbox" checked={item.detailsConfirmed} onChange={e=>edit('detailsConfirmed',e.target.checked)}/> I checked the product, size, lot, expiration and quantity against the package label.</label>}
    {prior!==null&&<label className="block"><input type="checkbox" checked={confirmExtra} onChange={e=>setConfirmExtra(e.target.checked)}/> I verified that this is an additional use beyond the {prior} already recorded.</label>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}{busy&&<p role="status">{busy}</p>}
    <button className={primary} disabled={!usable||!detailsReady||stock===undefined||(consume?(!stock||!selected||+item.quantity>stock.on_hand||(prior!==null&&!confirmExtra)):(!stock&&(!item.product.trim()||(!implant&&!item.type))))} onClick={save}>
      {consume?'Record patient use':'Receive stock'} · {office.name}</button>
    <p className="text-xs text-muted-foreground">A product and lot code can repeat on multiple packages. Confirm the office and actual quantity; reading a code does not save stock.</p>
    <p className="text-xs text-muted-foreground">Recorded under {userName||'your personal portal login'}.</p></fieldset>;
}

export default function ClinicalOfficeScan({kind,mode,assignedOffice,onClose,onSaved,userName}) {
  const [offices,setOffices]=useState(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[version,setVersion]=useState(0),[category,setCategory]=useState(kind);
  useEffect(()=>{let active=true;rpc('clinical_scan_offices').then(data=>{if(active)setOffices(data);}).catch(()=>{if(active)setError('Your office assignments could not load.');});return()=>{active=false;};},[version]);
  const [locked,setLocked]=useState(false),[saved,setSaved]=useState(false);
  const close=()=>{if(saved)onSaved?.();onClose?.();};
  const options=(offices||[]).filter(o=>!assignedOffice||o.id===assignedOffice.id),office=options.find(o=>o.id===selected);
  return <div style={{zIndex:350}} className="fixed inset-0 flex items-center justify-center bg-black/50 p-3"><section role="dialog" aria-modal="true" aria-label="Clinical inventory scan" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-card p-5 text-foreground shadow-xl">
    <header className="flex justify-between items-start gap-3 mb-4"><h2 className="text-xl font-bold">{mode==='receive'?'Receive delivery':'Consume for patient use'}</h2>
    <button className={secondary} disabled={locked} onClick={close} aria-label="Close inventory scan">Close</button></header>
    {error?<p role="alert">{error} <button onClick={()=>{setError('');setVersion(v=>v+1);}}>Retry</button></p>:!offices?<p>Loading your offices…</p>:!options.length?<p>No clinical scan office is assigned to your login.</p>:
    <><Field label={mode==='receive'?'Receiving office':'Treating office'}><select className={fieldClass} disabled={locked||saved} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose office</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
    {kind==='choose'&&<Field label="Inventory"><select className={fieldClass} disabled={locked||saved} value={category} onChange={e=>setCategory(e.target.value)}><option value="choose">Choose inventory</option><option value="implant">Implants</option><option value="graft">Bone, tissue or membrane</option></select></Field>}
    {office&&category!=='choose'&&<div className="mt-4"><ScanForm key={office.id+category} kind={category} office={office} mode={mode} onSaved={onSaved} onClose={onClose} userName={userName} onLock={setLocked} onReceipt={setSaved}/></div>}</>}</section></div>;
}
