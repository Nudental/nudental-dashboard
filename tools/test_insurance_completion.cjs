const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const esbuild=require(path.join(root,'node_modules/esbuild'));
function load(file,mocks={}) {
  const output=esbuild.buildSync({entryPoints:[path.join(root,file)],bundle:true,platform:'node',format:'cjs',write:false,external:Object.keys(mocks)}).outputFiles[0].text;
  const module={exports:{}};vm.runInNewContext(output,{module,exports:module.exports,require:name=>name in mocks?mocks[name]:require(name),console,Date,setTimeout,clearTimeout});return module.exports;
}
const validation=load('src/services/insuranceCompletionValidation.js');
const rules=validation.completionRules;
function put(data,key,value) {const parts=key.split('.');if(parts.length===1)data[key]=value;else(data[parts[0]]||={})[parts[1]]=value;}
function completeFixture() {
  const d={};for(const r of rules)put(d,r.path,r.type==='number'? (r.max===130?26:50):r.type==='boolean'?true:r.type==='date'?'2026-11-19':r.type==='enum'?r.options[0]:r.type==='checkboxes'?{preventive:true,basic:true,major:true}:'Carrier confirmed answer');
  Object.assign(d,{patient_name:'Synthetic Audit',subscriber_name:'Synthetic Subscriber',insurance_name:'TEST ONLY',insurance_phone:'2025550100',member_id:'NOT-A-REAL-MEMBER',employee_initials:'QA',ref_number:'TEST-REF',office:'Eatontown'});return d;
}
const fixture=completeFixture();
test('fully answered breakdown is accepted',()=>assert.equal(validation.validateInsuranceCompletion(fixture).length,0));
test('every applicable answer is required; blank and whitespace cannot pass',()=>{
  for(const rule of rules)for(const value of [null,'',' \t\n ']){
    const d=structuredClone(fixture);put(d,rule.path,value);
    assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path===rule.path),`${rule.path}: ${JSON.stringify(value)}`);
  }
});
test('every required type accepts an explicitly recorded unavailable answer',()=>{
  for(const rule of rules)for(const answer of ['NA','N/A','Unavailable','Not provided','Carrier would not provide this detail']) {
    const d=structuredClone(fixture);put(d,rule.path,null);d.form_data={not_applicable:{[rule.path]:answer}};
    assert.equal(validation.validateInsuranceCompletion(d).some(e=>e.path===rule.path),false,rule.path+' '+answer);
  }
});
test('unavailable metadata must be nonblank text and cannot hide invalid numbers',()=>{
  for(const answer of ['', '  ', true, 0, {}, []]){
    const d=structuredClone(fixture);d.yearly_max=null;d.form_data={not_applicable:{yearly_max:answer}};
    assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path==='yearly_max'));
  }
  const d=structuredClone(fixture);d.pct_prev=101;d.form_data={not_applicable:{pct_prev:'NA'}};
  assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path==='pct_prev'));
});
test('text answers NA and unavailable are accepted directly',()=>{
  const d=structuredClone(fixture);for(const r of rules.filter(r=>r.type==='text'))put(d,r.path,'NA');assert.equal(validation.validateInsuranceCompletion(d).length,0);
});
test('zero coverage and No are answers; nonapplicable dependent questions are skipped',()=>{
  const d=structuredClone(fixture);for(const r of rules){if(r.type==='number')put(d,r.path,0);if(r.type==='boolean')put(d,r.path,false);}
  for(const r of rules.filter(r=>r.when))put(d,r.path,null);
  assert.equal(validation.validateInsuranceCompletion(d).length,0);
});
test('negative, out-of-range, invalid dates and inconsistent amounts are rejected',()=>{
  for(const [key,value] of [['pct_prev',-1],['pct_prev',101],['deductible',-1],['yearly_max',Infinity],['yearly_max',true],['dep_age_limit',25.5],['patient_dob','2026-02-30'],['remaining_max',51],['individual_deductible_remaining',51],['term_date','2020-01-01']]) {
    const d=structuredClone(fixture);put(d,key,value);assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path===key),key);
  }
});
test('completion service rejects missing answers before any database call, while draft stays writable',async()=>{
  let writes=0;const db={from:()=>{writes++;const q={select:()=>q,eq:()=>q,insert:()=>q,update:()=>q,single:async()=>({data:{id:'fixture',status:'draft'},error:null})};return q;}};
  const service=load('src/services/insuranceVerifyService.js',{'../lib/supabase':{supabase:db}});
  await assert.rejects(service.completeVerification('v','r',{},{}),/required insurance information/);assert.equal(writes,0);
  await service.createVerification('r',{},{});assert.ok(writes>0);
});
test('both completion buttons are disabled for missing answers and enabled for full or NA answers',()=>{
  const source=fs.readFileSync(path.join(root,'src/pages/insurance-verify/components/InsuranceVerificationForm.jsx'),'utf8');
  const parser=require(path.join(root,'node_modules/@babel/parser'));const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});const buttons=[];let handler;
  function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='handleComplete')handler=n.init;
    if(n.type==='JSXElement'&&n.openingElement.name.name==='button'&&n.children.some(c=>c.type==='JSXText'&&c.value.trim()==='Mark Completed')&&n.openingElement.attributes.some(a=>a.name?.name==='disabled'&&a.value?.expression?.type==='LogicalExpression'))buttons.push(n);
    for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);
  }walk(ast);assert.equal(buttons.length,2);
  for(const b of buttons){const expr=b.openingElement.attributes.find(a=>a.name?.name==='disabled').value.expression;const code=source.slice(expr.start,expr.end);
    for(const count of [0,1,10])assert.equal(vm.runInNewContext(code,{completing:false,saving:false,completionErrors:Array(count)}),count>0);
  }
  let actions=0;const invoke=vm.runInNewContext('('+source.slice(handler.start,handler.end)+')',{isReadOnly:false,formData:{},validateInsuranceCompletion:validation.validateInsuranceCompletion,setShowCompleteModal:()=>{},reviewSection:()=>{},toastError:()=>{},setCompleting:()=>actions++});
  return invoke().then(()=>assert.equal(actions,0));
});
// The same fixture drives the transaction-isolated database tests and PDF check.
if(process.env.INSURANCE_FIXTURE_OUTPUT) fs.writeFileSync(process.env.INSURANCE_FIXTURE_OUTPUT,JSON.stringify(fixture,null,2));
