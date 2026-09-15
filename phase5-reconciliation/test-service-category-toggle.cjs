const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend'),'node_modules/@babel/parser'));
const root=path.join(__dirname,'../recovered-frontend/src/pages/management');
const source=fs.readFileSync(path.join(root,'ServiceCategoriesManagement.jsx'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
let handler;
function visit(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id.name==='handleToggleActive')handler=node.init;for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}}
visit(ast);assert.ok(handler);
function setup({denied=false}={}){
 const updates=[],saving=[],errors=[];let reloads=0;
 const toggle=vm.runInNewContext('('+source.slice(handler.start,handler.end)+')',{
  serviceCategoriesService:{async toggleActive(id,isActive){assert.equal(id,'qa-temporary-category');if(denied)throw new Error('permission denied');updates.push({id,is_active:isActive})}},
  setSaving:v=>saving.push(v),setError:v=>errors.push(v),loadData:async()=>reloads++
 });return{toggle,updates,saving,errors,reloads:()=>reloads};
}
test('Service-category deactivation consumes the table ID and false target state',async()=>{
 const c=setup();await c.toggle('qa-temporary-category',false);assert.deepEqual(c.updates,[{id:'qa-temporary-category',is_active:false}]);assert.equal(c.reloads(),1);assert.deepEqual(c.saving,[true,false]);assert.deepEqual(c.errors,[]);
});
test('Service-category activation consumes the table ID and true target state',async()=>{
 const c=setup();await c.toggle('qa-temporary-category',true);assert.deepEqual(c.updates,[{id:'qa-temporary-category',is_active:true}]);assert.equal(c.reloads(),1);
});
test('Rejected service-category status change reports the error and does not reload as success',async()=>{
 const c=setup({denied:true});await c.toggle('qa-temporary-category',false);assert.deepEqual(c.updates,[]);assert.deepEqual(c.errors,['permission denied']);assert.equal(c.reloads(),0);assert.deepEqual(c.saving,[true,false]);
});
