const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(runtime,'node_modules/@babel/parser')),esbuild=require(path.join(runtime,'node_modules/esbuild')),React=require(path.join(runtime,'node_modules/react'));
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/supply/FulfillmentLogTab.jsx'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const chunks=['STATUS_CONFIG','CreateFulfillmentModal'].map(name=>{const n=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);return'const '+source.slice(n.start,n.end)+';'}).join('\n');
const code=esbuild.transformSync(chunks+'\nmodule.exports=CreateFulfillmentModal;',{loader:'jsx',format:'cjs'}).code;
const id='12345678-1234-4234-8234-123456789abc',people=[{id,full_name:'QA / Receiver'}];
function harness(){const values=[],writes=[];let index=0,saved=0;const module={exports:{}};
 vm.runInNewContext(code,{module,React,Icon:()=>null,useAuth:()=>({userProfile:{id}}),useEffect:()=>{},useState(initial){const i=index++;if(!(i in values))values[i]=Array.isArray(initial)?people:initial;return[values[i],value=>values[i]=typeof value==='function'?value(values[i]):value]},supplyRequestService:{getOffices:()=>['QA / Office A'],createFulfillmentLog:async value=>{writes.push(value)}}});
 function nodes(tree,out=[]){if(!tree||typeof tree!=='object')return out;if(Array.isArray(tree)){tree.forEach(n=>nodes(n,out));return out}out.push(tree);nodes(tree.props?.children,out);return out}
 return{writes,get saved(){return saved},render(){index=0;return nodes(module.exports({onClose(){},onSaved(){saved++},departments:[]}))}};
}
test('Received By uses labeled names with UUID option values',()=>{const h=harness(),nodes=h.render(),select=nodes.find(n=>n.type==='select'&&n.props.id==='fulfillment-received-by');assert.ok(select);assert.ok(nodes.some(n=>n.type==='label'&&n.props.htmlFor==='fulfillment-received-by'));assert.ok(nodes.some(n=>n.type==='option'&&n.props.value===id&&n.props.children==='QA / Receiver'))});
for(const selected of [id,''])test('saving '+(selected?'selected':'unrecorded')+' recipient submits its identifier',async()=>{const h=harness();let nodes=h.render();nodes.find(n=>n.type==='select'&&n.props.children?.[0]?.props?.children==='Select Office').props.onChange({target:{value:'QA / Office A'}});nodes.find(n=>n.type==='input'&&n.props.placeholder==='Item name...').props.onChange({target:{value:'QA TEMP'}});nodes=h.render();const recipient=nodes.find(n=>n.type==='select'&&n.props.id==='fulfillment-received-by');assert.ok(recipient);recipient.props.onChange({target:{value:selected}});nodes=h.render();await nodes.find(n=>n.type==='button'&&n.props.children==='Create Fulfillment Record').props.onClick();assert.equal(h.writes.length,1);assert.equal(h.writes[0].received_by,selected);assert.equal(h.saved,1)});
const service=fs.readFileSync(path.join(root,'src/services/supplyRequestService.js'),'utf8');
const method=find(parser.parse(service,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='fetchFulfillmentRecipients');
function queryHarness(error=false,empty=false){
 assert.ok(method,'recipient lookup is available');const calls=[];
 const context={supabase:{from(table){
  calls.push(['from',table]);return {
   select(fields){calls.push(['select',fields]);return this},
   eq(k,v){calls.push(['eq',k,v]);return this},
   order(k){calls.push(['order',k]);return Promise.resolve(error?{error:Error('QA denied')}:{data:empty?null:people})}
  };
 }}};
 vm.runInNewContext('this.load=({'+service.slice(method.start,method.end)+'}).fetchFulfillmentRecipients;',context);return{load:context.load,calls};
}
test('recipient lookup reads only minimal active approved profile fields',async()=>{const h=queryHarness();assert.equal(await h.load(),people);assert.deepEqual(h.calls,[['from','user_profiles'],['select','id, full_name'],['eq','is_active',true],['eq','is_approved',true],['eq','status','Active'],['order','full_name']])});
test('recipient lookup propagates permission failures',async()=>{await assert.rejects(queryHarness(true).load(),/QA denied/)});
test('no available recipients keeps the optional selector empty',async()=>{assert.equal((await queryHarness(false,true).load()).length,0)});
