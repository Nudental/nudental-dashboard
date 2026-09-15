const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/pending-approvals/index.jsx'),'utf8');
const tree=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const conditions=[];
function visit(n){
 if(!n||typeof n!=='object')return;
 if(n.type==='JSXExpressionContainer'&&n.expression.type==='LogicalExpression'&&n.expression.operator==='&&'){
  const condition=source.slice(n.expression.left.start,n.expression.left.end);
  if(condition.startsWith('!isApiSyncedRow(reviewEntry)')&&condition.includes('includes(reviewEntry?.status)'))conditions.push(condition);
 }
 for(const value of Object.values(n))visit(value);
}
visit(tree);assert.equal(conditions.length,2,'Expected separate note and action guards');
for(const [i,condition] of conditions.entries()){
 for(const status of ['pending','pending_review','pending_reapproval'])test(`review ${i?'actions':'note'} available for ${status}`,()=>{
  assert.equal(vm.runInNewContext(condition,{reviewEntry:{status},isApiSyncedRow:()=>false}),true);
 });
 for(const status of ['approved','rejected','draft','rejected_after_approval'])test(`review ${i?'actions':'note'} remains hidden for ${status}`,()=>{
  assert.equal(vm.runInNewContext(condition,{reviewEntry:{status},isApiSyncedRow:()=>false}),false);
 });
 test(`API-synced record cannot gain review ${i?'actions':'note'}`,()=>{
  assert.equal(vm.runInNewContext(condition,{reviewEntry:{status:'pending_reapproval'},isApiSyncedRow:()=>true}),false);
 });
}
