const assert=require('node:assert/strict'),path=require('node:path'),test=require('node:test'),Module=require('node:module');
const root=path.join(__dirname,'../recovered-frontend'), ui=path.join(root,'src/pages/purchasing-records');
const build=require(path.join(root,'node_modules/esbuild'));
const XLSX=require(path.join(root,'node_modules/xlsx'));
function fromSource(file) {
 const code=build.buildSync({entryPoints:[path.join(ui,file)],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
 const m=new Module(file,module);m._compile(code,file);return m.exports;
}
const {invoiceFacts}=fromSource('invoiceMath.js'),{buildInvoiceWorkbook}=fromSource('invoiceExport.js');
const invoice={id:'a',vendor:'QA Supplies',number:'TEST',office:'Shared',currency:'USD',subtotal:1000,tax:0,fees:0,due_day:'2026-11-12',splits:[{office:'Brick',amount:600},{office:'Barnegat',amount:400}],items:[{key:'boxes',ordered:10}],evidence:'qa-source'};
const pay={kind:'Payment',confidence:'Confirmed',reconciled:false,allocations:[{invoice_id:'a',amount:600},{invoice_id:'b',amount:50}]};
const credit={kind:'Credit',confidence:'Confirmed',allocations:[{invoice_id:'a',amount:400}]};
const receipt={invoice_id:'a',item_key:'boxes',received:6,cancelled:0};
test('partial payment and independent delivery',()=>{const f=invoiceFacts(invoice,[pay],[receipt],'','2026-11-13');assert.deepEqual([f.total,f.balance,f.confirmed,f.bank,f.openItems,f.days,f.status],[100000,40000,60000,0,4,-1,'Partially paid']);});
test('credit closes the balance without adding paid cash or stock',()=>{const f=invoiceFacts(invoice,[pay,credit],[receipt,{...receipt,received:0,cancelled:4}]);assert.deepEqual([f.balance,f.paid,f.credits,f.openItems],[0,60000,40000,0]);});
test('office allocation is additive to the cent and reported payments stay separate',()=>{const p={...pay,confidence:'Reported',allocations:[{invoice_id:'a',amount:0.03}]};const all=invoiceFacts(invoice,[p],[]);const f=['Brick','Barnegat'].map(o=>invoiceFacts(invoice,[p],[],o));for(const k of ['total','balance','reported','confirmed','bank'])assert.equal(f[0][k]+f[1][k],all[k]);assert.equal(all.confirmed,0);assert.equal(all.reported,3);});
for(const kind of ['xlsx','csv'])test(kind+' export round trip includes source and separated totals',()=>{
 const f=invoiceFacts(invoice,[pay,credit],[receipt]),book=buildInvoiceWorkbook(XLSX,[{i:invoice,f}],{USD:{invoiced:100000,confirmed:60000,credits:40000,balance:0}},'',kind);
 const bytes=XLSX.write(book,{type:'buffer',bookType:kind});const actual=XLSX.read(bytes,{type:'buffer'});const table=XLSX.utils.sheet_to_json(actual.Sheets[actual.SheetNames[0]]);
 assert.equal(table[0]['Source evidence'],'qa-source');assert.equal(Number(table[0]['Confirmed payments']),600);assert.equal(Number(table[0].Credits),400);
 if(kind==='xlsx')assert.equal(XLSX.utils.sheet_to_json(actual.Sheets.Totals)[0].balance,0);else assert.match(bytes.toString(),/Totals by currency/);
});
