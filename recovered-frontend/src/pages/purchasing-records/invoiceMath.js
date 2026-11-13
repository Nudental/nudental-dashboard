export const asCents = value => Math.round(Number(value || 0) * 100);
export const amount = cents => Number((cents / 100).toFixed(2));
export const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York' }).format(new Date());

export function invoiceFacts(i, events, receipts, office = '', today = todayET()) {
  const parts = i.office === 'Shared' ? i.splits : [{office:i.office,amount:Number(i.subtotal)+Number(i.tax)+Number(i.fees)}];
  const gross = asCents(i.subtotal)+asCents(i.tax)+asCents(i.fees);
  // Allocate cents deterministically across office shares without introducing rounding gain or loss.
  function share(cents) {
    if (!office || office==='Shared' || i.office!=='Shared') return cents;
    if (!gross) return 0;
    const shares = parts.map(p => {
      const raw = cents * asCents(p.amount) / gross;
      return {office:p.office,base:Math.floor(raw),rem:raw%1};
    }).sort((a,b)=>b.rem-a.rem || a.office.localeCompare(b.office));
    const extra = cents-shares.reduce((sum,r)=>sum+r.base,0);
    shares.forEach((r,n)=>{if(n<extra)r.base++;});
    return shares.find(r=>r.office===office)?.base || 0;
  }
  const totals={reported:0,confirmed:0,bank:0,credits:0};
  for(const event of events) {
    const link=event.allocations.find(a=>a.invoice_id===i.id);
    if(!link) continue;
    const cents=share(asCents(link.amount));
    if(event.kind==='Credit')totals.credits+=cents;
    else {
      if(event.confidence==='Confirmed') totals.confirmed+=cents; else totals.reported+=cents;
      if(event.reconciled)totals.bank+=cents;
    }
  }
  const total=share(gross);
  const paid=totals.confirmed+totals.reported;
  const balance=total-paid-totals.credits;
  const openItems=i.items.reduce((sum,item)=>{
    const delivered=receipts.filter(r=>r.invoice_id===i.id && r.item_key===item.key).reduce((v,r)=>v+r.received+r.cancelled,0);
    return sum+Number(item.ordered)-delivered;
  },0);
  const days=i.due_day ? Math.round((Date.parse(i.due_day+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000):null;
  const status=i.voided?'Voided':balance<0?'Overapplied':balance===0?(paid===0?'Covered by credit':totals.reported?'Reported paid':'Payment confirmed'):(paid>0?'Partially paid':'Pending');
  return {total,paid,balance,...totals,days,openItems,status,parts};
}

export function exportRows(rows) {
  return rows.map(({i,f})=>({
    Business:'NU Dental', Office:i.office, Vendor:i.vendor, Invoice:i.number || '', Order:i.order_ref || '',
    Category:i.category || '', 'Invoice date':i.invoice_day || '', Due:i.due_day || '', Currency:i.currency,
    'Invoice or selected office amount':amount(f.total), 'Reported payments':amount(f.reported),
    'Confirmed payments':amount(f.confirmed), 'Bank reconciled (included in confirmed)':amount(f.bank),
    Credits:amount(f.credits), Balance:amount(f.balance), 'Payment status':f.status, Approval:i.approval,
    'Source evidence':i.evidence || '', 'Approval evidence':i.approval_source || '', 'Reference ID':i.id,
  }));
}

