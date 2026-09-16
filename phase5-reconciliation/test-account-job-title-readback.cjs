const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser'));
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r}}
const auth=fs.readFileSync(path.join(root,'src/contexts/AuthContext.jsx'),'utf8');
const fields=find(parser.parse(auth,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='PROFILE_GATE_FIELDS').init.value.split(',').map(x=>x.trim());
const source=fs.readFileSync(path.join(root,'src/pages/account-settings/index.jsx'),'utf8');
const effect=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='CallExpression'&&n.callee.name==='useEffect'&&source.slice(n.start,n.end).includes('setOverviewForm')).arguments[0];
function readback(record){let form;const userProfile=Object.fromEntries(fields.map(k=>[k,record[k]]));vm.runInNewContext('('+source.slice(effect.start,effect.end)+')()',{userProfile,setOverviewForm:x=>{form=x}});return form}
for(const role of ['staff','super_admin'])test('Saved '+role+' job title survives the reload projection',()=>assert.equal(readback({role,job_title:'QA TEMP Account Title'}).job_title,'QA TEMP Account Title'));
test('Cleared job title and unchanged name/phone remain readable',()=>{const row=readback({full_name:'QA / Staff',phone_number:'5550100',job_title:''});assert.equal(row.job_title,'');assert.equal(row.full_name,'QA / Staff');assert.equal(row.phone_number,'5550100')});
