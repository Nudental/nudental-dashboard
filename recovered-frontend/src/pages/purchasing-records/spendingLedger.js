import { asCents, invoiceFacts } from './invoiceMath.js';

const normalize = value => String(value || '').trim().toLowerCase();
const isSupply = category => /suppl|consumabl|implant|graft|bone|tissue|membrane|steriliz|endodont|restorative|printing|cleaning|front desk|housekeep|reception|patient check|general office|surgical material/i.test(category || '');
const fields = ['gross','credited','paidReported','paidConfirmed','bank','balance','unknown','missing','lines'];

export function spendingRows(data) {
  const rows = [];
  const covered = new Map();
  const held = new Map();
  const invoiceLinks = new Map();
  const link = (id,p) => {
    if (!invoiceLinks.has(id)) invoiceLinks.set(id,[]);
    invoiceLinks.get(id).push(p);
  };
  const key = p => p.source + '/' + p.id;
  const refs = new Map();
  const fulfillments = new Map();
  const invoices = data.invoices.filter(i=>!i.voided);
  for (const i of invoices) {
    for (const ref of new Set([i.order_ref,i.number].map(normalize).filter(Boolean))) {
      if (!refs.has(ref)) refs.set(ref,[]);
      refs.get(ref).push(i);
    }
    for (const line of i.items) if (line.fulfillment_id) {
      if (!fulfillments.has(line.fulfillment_id)) fulfillments.set(line.fulfillment_id,new Set());
      fulfillments.get(line.fulfillment_id).add(i.id);
    }
  }
  const groupOrders = new Set(data.purchases.filter(p=>p.source==='Amazon order line' && p.reference)
    .map(p=>[p.office_name,normalize(p.reference),p.currency].join('|')));
  const referenceGroups = new Map();
  for (const p of data.purchases) {
    if (p.source==='Placed Amazon order' && groupOrders.has([p.office_name,normalize(p.reference),p.currency].join('|'))) {
      covered.set(key(p),'Detailed Amazon order lines'); continue;
    }
    const direct = p.source==='Supply fulfillment' && fulfillments.get(p.id);
    if (direct) {
      for (const id of direct) link(id,p);
      if(direct.size===1) covered.set(key(p),'Invoice item');
      else held.set(key(p),'Linked to several invoices');
      continue;
    }
    if (!p.reference) continue;
    const hits=(refs.get(normalize(p.reference)) || []).filter(i=>i.currency===p.currency &&
      (normalize(i.vendor)===normalize(p.vendor) || (p.source.includes('Amazon') && /amazon/i.test(i.vendor))) &&
      (i.office===p.office_name || i.splits.some(s=>s.office===p.office_name)));
    if (hits.length===1) {
      const id=hits[0].id;
      if (!referenceGroups.has(id)) referenceGroups.set(id,[]);
      referenceGroups.get(id).push(p);
    } else if (hits.length>1) held.set(key(p),'Reference matches several invoices');
  }
  for (const i of invoices) {
    const candidates=referenceGroups.get(i.id)||[];
    const gross=asCents(i.subtotal)+asCents(i.tax)+asCents(i.fees);
    const match=candidates.length && candidates.every(p=>p.amount!=null) &&
      candidates.reduce((sum,p)=>sum+asCents(p.amount),0)===gross;
    for(const p of candidates) {
      if(match) {covered.set(key(p),'Invoice reference and total');link(i.id,p);}
      else held.set(key(p),'Purchase and invoice share a reference but amounts need review');
    }
    const linked=invoiceLinks.get(i.id)||[];
    const supply=isSupply(i.category) || linked.length>0 || (!i.category && i.items.length>0);
    const other=/rent|lease|payroll|software|telecom|license|insurance|utilities|subscription|service fee/i.test(i.category||'');
    if(!supply && other) continue;
    const parts=i.office==='Shared'?i.splits:[{office:i.office||'Unassigned'}];
    for (const part of parts) {
      const f=invoiceFacts(i,data.events,[],part.office);
      rows.push({id:i.id,source:'Invoice',office:part.office,shared:i.office==='Shared',vendor:i.vendor,
        day:i.invoice_day,category:i.category || 'Unclassified supplies',currency:i.currency,reference:i.number||i.order_ref,
        item:i.description || i.items.map(x=>x.item).join(', ') || 'Vendor invoice',evidence:i.evidence,
        gross:f.total,credited:f.credits,paidReported:f.reported,paidConfirmed:f.confirmed,bank:f.bank,balance:f.balance,
        status:f.status,issue:supply?'':'Confirm whether this invoice covers supplies',links:linked,
        payments:data.events.filter(e=>e.allocations.some(a=>a.invoice_id===i.id)),splits:i.splits});
    }
  }
  for (const p of data.purchases) {
    if(covered.has(key(p))) continue;
    const value=p.amount==null?null:asCents(p.amount);
    const credit=value!=null && value<0;
    rows.push({id:p.id,source:p.source,office:p.office_name||'Unassigned',vendor:p.vendor||'Vendor unknown',
      day:p.purchased,category:p.category || 'Unclassified supplies',currency:p.currency,item:p.item,
      reference:p.reference,evidence:p.evidence,status:p.order_status||p.status||'Purchase recorded',qty:p.quantity,received:p.received,
      gross:value==null?null:Math.max(0,value),credited:credit?-value:0,paidReported:0,paidConfirmed:0,bank:0,
      balance:null,issue:held.get(key(p)) || (p.source==='Placed Amazon order'?'Estimated order amount':null)});
  }
  return rows;
}

export function totals(rows) {
  const t=Object.fromEntries(fields.map(k=>[k,0]));
  for (const row of rows) {
    if (row.issue) continue;
    t.lines++;
    for (const key of ['gross','credited','paidReported','paidConfirmed','bank','balance']) t[key]+=row[key]||0;
    if(row.balance==null)t.unknown++;
    if(row.gross==null)t.missing++;
  }
  return t;
}

export function unappliedEvents(events) {
  return events.map(e=>({...e,remaining:asCents(e.amount)-e.allocations.reduce((s,a)=>s+asCents(a.amount),0)})).filter(e=>e.remaining>0);
}
