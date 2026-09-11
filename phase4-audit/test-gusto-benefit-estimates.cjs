const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
function read(file){const text=fs.readFileSync(path.join(root,file),'utf8');return {text,ast:parser.parse(text,{sourceType:'module',plugins:['jsx']})}}
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r}return null}
const card=read('src/components/payroll/gusto/benefits/GustoBenefits.jsx'),hook=read('src/hooks/gusto/useGustoSummaryTotals.js');
function expression(doc,name,env){const n=find(doc.ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);assert.ok(n,name);return vm.runInNewContext(doc.text.slice(n.init.start,n.init.end),env)}
function monthlyCard(value){return expression(card,'monthlyCompCost',{stats:{compContrib:value}})}
function overview(values){return expression(hook,'benefitsCostMonth',{benefits:values.map(company_contribution=>({company_contribution}))})}
test('biweekly company contributions annualize to 26 checks in plan cards',()=>{assert.equal(monthlyCard(625)*12,16250)});
test('plan monthly estimate is one twelfth of yearly cost',()=>{assert.equal(monthlyCard(120).toFixed(2),'260.00')});
test('overview converts per-paycheck enrollment totals to monthly estimate',()=>{assert.equal(overview(['500','125']).toFixed(2),'1354.17')});
test('overview and cards agree for multiple active enrollments',()=>{assert.equal(overview(['100','20']),monthlyCard(120))});
test('empty and zero contributions have zero estimates',()=>{assert.equal(overview([]),0);assert.equal(monthlyCard(0),0)});
test('small decimal contributions preserve annual precision before formatting',()=>{assert.equal((monthlyCard(1.23)*12).toFixed(2),'31.98');assert.equal(overview(['1.23']).toFixed(2),'2.67')});
