import React,{useState,useEffect} from 'react';
import PackageDetails,{packageSize} from './PackageDetails';
import {supabase} from '../../lib/supabase';

export default function ClinicalGraftScans({usage=false,officeId,refresh}) {
  const [rows,setRows]=useState([]),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    let q=usage?supabase.from('bone_tissue_usage_log').select('id,office_name,product_name,lot_number,patient_name,provider_name,procedure_date,quantity_used,staff_name')
      .not('clinical_scan_id','is',null).order('created_at',{ascending:false}):
      supabase.from('bone_tissue_stock').select('id,office_name,product_name,lot_number,current_stock,expiration_date,package_details').order('office_name').order('product_name');
    if(officeId)q=q.eq('office_id',officeId);
    q.limit(100).then(({data,error})=>{if(active){setRows((data||[]).map(row=>({...row,packageSize:packageSize(row.package_details)})));setError(Boolean(error));}});
    return ()=>{active=false;};
  },[usage,officeId,refresh]);
  if(error)return <p role="alert">Scanned lots could not be loaded.</p>;
  if(!rows.length)return null;
  const cols=usage?[['procedure_date','Date'],['office_name','Office'],['product_name','Product'],['lot_number','Lot'],['patient_name','Patient'],['provider_name','Provider'],['quantity_used','Units used'],['staff_name','Scanned by']]:
    [['office_name','Office'],['product_name','Product'],['lot_number','Lot'],['packageSize','Size / volume'],['package_details','Package details'],['expiration_date','Expiration'],['current_stock','On hand']];
  return <section className="my-4"><h3 className="font-semibold">{usage?'Most recent scanned patient uses':'Scanned graft stock by office and lot'}</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{cols.map(([key,label])=><th className="p-2" key={key}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr className="border-t" key={row.id}>{cols.map(([key])=><td className="p-2" key={key}>{key==='package_details'?<PackageDetails details={row.package_details}/>:row[key]??'—'}</td>)}</tr>)}</tbody></table></div></section>;
}
