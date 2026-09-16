const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser')),esbuild=require(path.join(deps,'node_modules/esbuild'));
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/supply/FulfillmentLogTab.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});const extract=name=>{const n=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name===name).init;return source.slice(n.start,n.end)};
const code=esbuild.transformSync('const STATUS_CONFIG='+extract('STATUS_CONFIG')+'; const FulfillmentLogTab='+extract('FulfillmentLogTab')+'; FulfillmentLogTab;',{loader:'jsx',jsxFactory:'React.createElement'}).code;
function render(role,status='pending',options={}){
 const record={id:'qa-receipt',office_id:'QA / Office A',item_name:'QA TEMP receipt',log_fulfillment_status:status,qty_supplied:2};
 const states=['records',[record],[],false,false,{},'','',options.open?record:null,options.mobile!==false];let i=0;
 const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat()})};
 return vm.runInNewContext(code,{React,useState:initial=>[i<states.length?states[i++]:initial,()=>{}],useEffect:()=>{},useCallback:fn=>fn,window:{innerWidth:800},supplyRequestService:{getOffices:()=>['QA / Office A']},Icon:'Icon',MobileReceiveSuppliesModal:'ReceiptModal',CreateFulfillmentModal:'CreateModal',FulfillmentImportTab:'ImportTab',FulfillmentSpendTab:'SpendTab'})({isAdmin:['admin','super_admin'].includes(role),isRCM:['regional_clinical_manager','super_admin'].includes(role)});
}
function nodes(n){if(!n||typeof n!=='object')return[];return[n,...(n.children||[]).flatMap(nodes)]}
const buttons=tree=>nodes(tree).filter(n=>n.type==='button'&&n.children.includes('Receive'));
for(const role of ['office_manager','regional_manager','staff','insurance_verifier','marketing'])test(role+' cannot open receipt writes from a readable row',()=>{for(const status of ['pending','partial','backordered']){const tree=render(role,status);assert.equal(buttons(tree).length,0);assert(nodes(tree).some(n=>n.type==='td'&&n.children.includes('QA TEMP receipt')))}});
for(const role of ['admin','super_admin','regional_clinical_manager'])test(role+' retains allowed pending and partial receipt actions',()=>{for(const status of ['pending','partial','backordered'])assert.equal(buttons(render(role,status)).length,1);for(const status of ['completed','cancelled'])assert.equal(buttons(render(role,status)).length,0)});
test('read-only roles cannot keep an already selected receipt form open',()=>{assert.equal(nodes(render('office_manager','pending',{open:true})).filter(n=>n.type==='ReceiptModal').length,0);assert.equal(nodes(render('super_admin','pending',{open:true})).filter(n=>n.type==='ReceiptModal').length,1)});
test('existing desktop layout does not gain a new receipt control',()=>{assert.equal(buttons(render('super_admin','pending',{mobile:false})).length,0)});
