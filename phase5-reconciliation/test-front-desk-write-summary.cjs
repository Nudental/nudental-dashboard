const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/FrontDeskInventoryTab.jsx'),'utf8');const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const component=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='FrontDeskInventoryTab').init;
function code(name){let n=find(component,n=>n.type==='VariableDeclarator'&&n.id.name===name).init;if(name==='loadData')n=n.arguments[0];return source.slice(n.start,n.end);}
function harness(fail=false,failSummary=false){let items=[{id:'qa',current_qty:5,min_required:5,status:'Low'}],summary={totalInStock:0,lowItems:1,criticalOutOfStock:0},fresh,reads=0,loadingChanges=0;const errors=[],toasts=[];
 let database=items.map(i=>({...i}));const status=q=>q===0?'Out of Stock':q<=5?'Low':'In Stock';
 const write=(id,values)=>{if(fail)throw Error('QA write denied');const row=database.find(r=>r.id===id);Object.assign(row,values);row.status=status(row.current_qty);return {...row};};
 const ctx=vm.createContext({selectedOffice:'QA / Office A',selectedMonth:'',selectedCategory:'All',selectedStatus:'All',search:'',setLoading(){loadingChanges++},setError:e=>{if(e)errors.push(e)},setItems:v=>items=typeof v==='function'?v(items):v,setSummary:v=>summary=v,showToast:t=>toasts.push(t),frontDeskInventoryService:{
 updateQty:async(id,qty)=>write(id,{current_qty:qty}),updateRow:async(id,updates)=>write(id,updates),insertRow:async row=>{if(fail)throw Error('QA write denied');const added={...row,id:'new',status:status(row.current_qty)};database.push(added);return added},
 fetchInventory:async()=>database.map(i=>({...i})),fetchSummary:async()=>{reads++;if(failSummary)throw Error('QA summary unavailable');fresh={totalInStock:database.filter(i=>i.status==='In Stock').length,lowItems:database.filter(i=>i.status==='Low').length,criticalOutOfStock:database.filter(i=>i.status==='Out of Stock').length};return fresh}
 }});for(const name of ['loadData','refreshSummary','handleQtySave','handleRowSave','handleAddRow'])ctx[name]=vm.runInContext('('+code(name)+')',ctx);
 return{ctx,errors,toasts,get loadingChanges(){return loadingChanges},get reads(){return reads},get summary(){return summary},get fresh(){return fresh},get items(){return items}};}
const cases=[['quantity','handleQtySave',['qa',6],{totalInStock:1,lowItems:0,criticalOutOfStock:0}],['row edit','handleRowSave',['qa',{current_qty:0}],{totalInStock:0,lowItems:0,criticalOutOfStock:1}],['creation','handleAddRow',[{item_name:'QA TEMP',current_qty:0,min_required:5}],{totalInStock:0,lowItems:1,criticalOutOfStock:1}]];
for(const [name,handler,args,expected] of cases){
 test(name+' refreshes authoritative counters after saving',async()=>{const h=harness();await h.ctx[handler](...args);assert.equal(h.reads,1);assert.equal(h.summary,h.fresh);assert.deepEqual(h.summary,expected);assert.equal(h.toasts.length,1);assert.equal(h.errors.length,0);});
 test(name+' failed write reports no success and does not refresh counters',async()=>{const h=harness(true);try{await h.ctx[handler](...args)}catch(e){assert.equal(handler,'handleAddRow');assert.match(e.message,/QA write denied/)}assert.equal(h.reads,0);assert.equal(h.toasts.length,0);assert.equal(h.summary.lowItems,1);assert.equal(h.items.length,1);});
 test(name+' preserves the open category without remounting loading content',async()=>{const h=harness();await h.ctx[handler](...args);assert.equal(h.loadingChanges,0);});
 test(name+' distinguishes saved data from a summary-read failure',async()=>{const h=harness(false,true);await h.ctx[handler](...args);assert.equal(h.toasts.length,1);assert.equal(h.errors.length,1);assert.match(h.errors[0],/Item saved, but the summary could not refresh/);assert.equal(h.loadingChanges,0);});
}
