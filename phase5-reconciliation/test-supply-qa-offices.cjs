const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'../phase5-qa/synthetic-role-fixtures.json'),'utf8'));
const production=['Nu Dental of Eatontown','Nu Dental of Brick','Nu Dental of Barnegat','Nu Dental of Staten Island'];
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
for(const name of ['supplyRequestService','frontDeskInventoryService']){
 const source=fs.readFileSync(path.join(root,'src/services',name+'.js'),'utf8');
 const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
 const offices=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='OFFICES').init;
 const getter=find(ast,n=>n.type==='ObjectProperty'&&n.key.name==='getOffices').value;
 for(const mode of [true,false,undefined])test(name+' office options '+(mode===true?'QA':mode===false?'production':'default'),()=>{
  const context=vm.createContext({dashboardEnvironment:{isQa:mode}});
  vm.runInContext('const OFFICES='+source.slice(offices.start,offices.end)+'; this.getOffices=('+source.slice(getter.start,getter.end)+');',context);
  const result=context.getOffices();assert.deepEqual(Array.from(result),mode===true?fixtures.offices.map(o=>o.name):production);
  assert.equal(context.getOffices(),result,'Shared options remain stable across renders');
 });
}
