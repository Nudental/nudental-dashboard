import React,{useState,useEffect} from 'react';
import PackageDetails,{packageSize} from '../../components/inventory/PackageDetails';
import {useAuth} from '../../contexts/AuthContext';
import {supabase} from '../../lib/supabase';
import ClinicalOfficeScan from '../../components/inventory/ClinicalOfficeScan';

export default function AssignedInventory(){
  const {userProfile}=useAuth();
  const [offices,setOffices]=useState(null),[selected,setSelected]=useState(''),[scan,setScan]=useState(null);
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[version,setVersion]=useState(0);
  useEffect(()=>{let active=true;supabase.rpc('clinical_scan_offices').then(({data,error})=>{if(active){setOffices(data||[]);if(error)setError('Your office assignments could not load.');}});return()=>{active=false;};},[userProfile?.id]);
  useEffect(()=>{let active=true;setRows([]);if(selected)supabase.from('bone_tissue_stock').select('id,product_name,lot_number,expiration_date,current_stock,package_details').eq('office_id',selected).order('product_name').then(({data,error})=>{if(active){setRows((data||[]).map(row=>({...row,packageSize:packageSize(row.package_details)})));setError(error?'Stock could not load.':'');}});return()=>{active=false;};},[selected,version]);
  return <section className="max-w-5xl mx-auto p-5 lg:p-9"><h1 className="text-2xl font-semibold">My Inventory Scans</h1>
    {error&&<p role="alert">{error}</p>}{!offices?<p>Loading your offices…</p>:!offices.length?<p>No clinical inventory office is assigned to your login.</p>:<>
    <div className="flex gap-3 my-5">{[['receive','Receive stock'],['consume','Consume for patient use']].map(([mode,label])=><button key={mode} className="bg-primary text-primary-foreground rounded px-4 py-2" onClick={()=>setScan(mode)}>{label}</button>)}</div>
    <h2 className="mt-7 font-semibold">Bone and tissue stock</h2><label>Office <select className="border rounded p-2" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose office</option>{offices.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
    {selected&&<table className="my-2 w-full text-left"><thead><tr>{['Product','Size / volume','Lot','Expiration','On hand','Package details'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{['product_name','packageSize','lot_number','expiration_date','current_stock','package_details'].map(k=><td key={k}>{k==='package_details'?<PackageDetails details={row.package_details}/>:row[k]??'—'}</td>)}</tr>)}</tbody></table>}
    {scan&&<ClinicalOfficeScan kind="choose" mode={scan} userName={userProfile?.full_name} onSaved={()=>setVersion(v=>v+1)} onClose={()=>setScan(null)}/>}</>}</section>;
}
