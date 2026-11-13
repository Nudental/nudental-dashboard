import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import BoneTissueScanner from '../bone-and-tissue-inventory/components/BoneTissueScanner';

export default function AssignedInventory() {
  const {userProfile} = useAuth();
  const [offices,setOffices]=useState([]);
  const [selected,setSelected]=useState('');
  const [products,setProducts]=useState([]);
  const [providers,setProviders]=useState([]);
  const [scan,setScan]=useState(null);
  const [error,setError]=useState('');
  const [version,setVersion]=useState(0);
  const [ready,setReady]=useState(false);
  const office=offices.find(o=>o.id===selected);
  useEffect(()=>{
    let alive=true;
    supabase.rpc('my_inventory_scan_offices').then(({data,error})=>{
      if (!alive) return;
      setReady(true);
      if (error) setError('Office access could not load.');
      else {setOffices(data || []);setSelected(data?.[0]?.id || '');}
    });
    return ()=>{alive=false;};
  },[userProfile?.id]);
  useEffect(()=>{
    if(!selected) return;
    let alive=true;setProducts([]);setProviders([]);setError('');
    Promise.all([
      supabase.from('bone_tissue_stock').select('id,product_name,lot_number,expiration_date,current_stock').eq('office_id',selected).order('product_name'),
      supabase.from('providers').select('id,name').eq('is_active',true).order('name')
    ]).then(([stock,team])=>{
      if(!alive) return;
      if(stock.error || team.error) setError('The inventory or provider list could not load. Refresh to try again.');
      else {setProducts(stock.data || []);setProviders(team.data || []);}
    });
    return ()=>{alive=false;};
  },[selected,version]);
  async function save(form) {
    const movement={action:scan.mode,officeId:selected,identificationNumber:form.identification_number,lotNumber:form.lot_number,
      productName:form.product_name,boneType:form.bone_tissue_type,expirationDate:form.expiration_date,quantity:Number(form.quantity),
      providerId:form.provider_id,patientName:form.patient_name,patientChartNumber:form.patient_chart_number,procedureDate:form.procedure_date,
      scanMethod:form.scan_method,notes:form.notes};
    const {error}=await supabase.rpc('record_assigned_inventory_scan',{movement,request_id:scan.id});
    if(error) throw new Error(error.message);
  }
  return <section className="max-w-5xl mx-auto p-5 lg:p-9 text-foreground"><h1 className="text-2xl font-semibold">My Inventory Scans</h1>
    {error && <p role="alert">{error}</p>}
    {!ready ? <p>Loading your offices…</p> : !office ? <p>No dental-assistant scan assignment is active for this account.</p> : <>
    <div className="my-5 flex items-center gap-3"><label htmlFor="scan-office">Office</label>
    <select id="scan-office" className="border bg-card p-2 rounded" value={selected} onChange={e=>setSelected(e.target.value)}>{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
    <div className="flex gap-3 flex-wrap">{[['receive','Scan In · Receive stock'],['consume','Scan Out · Patient use']].map(([mode,label])=><button key={mode} className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={()=>setScan({mode,id:crypto.randomUUID()})}>{label}</button>)}</div>
    <h2 className="mt-7 font-semibold">Bone and tissue stock</h2>
    <table className="mt-2 w-full text-left"><thead><tr>{['Product','Lot','Expiration','On hand'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{products.map(item=><tr key={item.id} className="border-t"><td className="p-2">{item.product_name}</td><td>{item.lot_number}</td><td>{item.expiration_date}</td><td>{item.current_stock}</td></tr>)}</tbody></table>
    {!products.length && !error && <p className="mt-2">No stock records loaded for this office.</p>}
    {scan && <BoneTissueScanner mode={scan.mode} offices={[office]} assignedOffice={office} providers={providers} staff={[userProfile]} userId={userProfile.id} userName={userProfile.full_name} saveMovement={save} onSaved={()=>setVersion(n=>n+1)} onClose={()=>setScan(null)}/>}
    </>}</section>;
}

