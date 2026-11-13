import { amount, exportRows } from './invoiceMath';

export function buildInvoiceWorkbook(XLSX, rows, totals, office, format) {
  const records=exportRows(rows).map(row=>({...row,'Report office filter':office||'All offices'}));
  const summaries=Object.entries(totals).map(([currency,s])=>Object.fromEntries([['Currency',currency],...Object.entries(s).map(([k,v])=>[k,amount(v)])]));
  const book=XLSX.utils.book_new();
  if(format==='csv') {
    const safe=v=>typeof v==='string' && /^\s*[=+@-]/.test(v)?"'"+v:v;
    const table=[Object.keys(records[0]),...records.map(r=>Object.values(r).map(safe)),[],['Totals by currency'],Object.keys(summaries[0]||{}),...summaries.map(Object.values)];
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(table),'Invoices');
  } else {
    XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(records),'Invoices');
    XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(summaries),'Totals');
  }
  return book;
}
