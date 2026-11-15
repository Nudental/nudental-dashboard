import { supabase } from '../../lib/supabase';
const pageSize = 50;
async function page(number, office) {
  const {data,error} = await supabase.rpc('purchasing_records',{section:'Inventory',at_office:office || null,term:'',page_no:number});
  if (error) throw error;
  if (!Array.isArray(data?.rows) || !Number.isSafeInteger(data.count)) throw new Error('Incomplete stock response');
  return data;
}
async function byIds(table, fields, ids) {
  const results=[];
  const unique=[...new Set(ids.filter(Boolean))];
  for(let start=0; start<unique.length; start+=50) {
    const {data,error}=await supabase.from(table).select(fields).in('id',unique.slice(start,start+50));
    if(error) throw error;
    results.push(...(data || []));
  }
  return results;
}
async function stockDetails(rows) {
  const details=new Map(), warnings=[];
  const ids=kind=>rows.filter(r=>r.kind===kind).map(r=>r.id);
  const implants=ids('Implants'), clinical=ids('Clinical supply');
  await Promise.all([
    (async()=>{
      if(!implants.length) return;
      try {
        const records=await byIds('implant_inventory','id,length_label,diameter_label,platform_size_name,identification_number',implants);
        records.forEach(r=>details.set('Implants/'+r.id,{...r,identifier:r.identification_number}));
        if(records.length!==implants.length) warnings.push('Some implant dimensions are unavailable.');
      } catch {warnings.push('Implant dimensions could not be loaded.');}
    })(),
    (async()=>{
      if(!clinical.length) return;
      try {
        const stocks=await byIds('office_supply_inventory','id,item_id,vendor_id,brand,sku',clinical);
        const catalog=await byIds('supply_items','id,description,brand,sku,vendor_id',stocks.map(r=>r.item_id)).catch(()=>{warnings.push('Some catalog descriptions are unavailable.');return [];});
        const items=new Map(catalog.map(i=>[i.id,i]));
        const vendors=await byIds('supply_vendors','id,name',[...stocks,...catalog].map(x=>x.vendor_id)).catch(()=>{warnings.push('Some vendor names are unavailable.');return [];});
        const names=new Map(vendors.map(v=>[v.id,v.name]));
        for (const r of stocks) {
          const item=items.get(r.item_id);
          details.set('Clinical supply/'+r.id,{description:item?.description,brand:r.brand||item?.brand,sku:r.sku||item?.sku,vendor:names.get(r.vendor_id||item?.vendor_id)});
        }
      } catch {warnings.push('Some clinical specifications and vendor names are unavailable.');}
    })()
  ]);
  return {details,warnings};
}
export async function loadStock(office, cancelled=()=>false) {
  const first=await page(0,office);
  const rows=[...first.rows];
  const pages=Math.ceil(first.count/pageSize);
  for (let offset=1; offset<pages; offset+=4) {
    if(cancelled()) return null;
    const next=await Promise.all(Array.from({length:Math.min(4,pages-offset)},(_,i)=>page(offset+i,office)));
    if(next.some(p=>p.count!==first.count)) throw new Error('Stock changed during loading. Refresh to see current quantities.');
    next.forEach(p=>rows.push(...p.rows));
  }
  if(rows.length!==first.count || new Set(rows.map(r=>r.kind+'/'+r.id)).size!==first.count)
    throw new Error('Stock changed during loading. Refresh to see current quantities.');
  if(cancelled()) return null;
  return {rows,...await stockDetails(rows)};
}
