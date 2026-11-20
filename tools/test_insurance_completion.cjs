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
  Object.assign(d,{patient_name:'Synthetic Audit',subscriber_name:'Synthetic Subscriber',insurance_name:'TEST ONLY',insurance_phone:'2025550100',member_id:'NOT-A-REAL-MEMBER',employee_initials:'QA',ref_number:'TEST-REF',office:'Eatontown'});d.form_data.deductible_structure='Separate by category';d.form_data.local_d7953_1_status='Covered separately';return d;
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
  d.form_data.deductible_structure='No deductible';
  d.form_data.dependent_age_status='Not available';d.form_data.student_age_status='Not available';d.form_data.local_d7953_1_status='Not covered';d.form_data.ascend_fee_schedule_status='Office review needed';
  for(const r of rules.filter(r=>r.when))put(d,r.path,null);
  assert.equal(validation.validateInsuranceCompletion(d).length,0);
});

test('unknown age cannot be encoded as a zero cutoff, and no age limit is a separate answer',()=>{
  for(const [key,status] of [['dep_age_limit','dependent_age_status'],['student_age_limit','student_age_status']]) {
    const d=structuredClone(fixture);d[key]=0;
    assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path===key));
    d[key]=null;d.form_data[status]='Not available';assert.equal(validation.validateInsuranceCompletion(d).length,0);
    d.form_data[status]='No age limit confirmed';assert.equal(validation.validateInsuranceCompletion(d).length,0);
    d.form_data[status]='Age limit applies';assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path===key));
  }
});

test('local code coverage is separate and office mapping may be referred for review',()=>{
  const d=structuredClone(fixture);d.form_data.local_d7953_1_pct=101;
  assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path==='form_data.local_d7953_1_pct'));
  d.form_data.local_d7953_1_status='Not covered';d.form_data.ascend_fee_schedule_status='Office review needed';
  for(const key of ['local_d7953_1_carrier_code','local_d7953_1_pct','local_d7953_1_frequency','ascend_fee_schedule_name','ascend_fee_schedule_confirmed_by'])d.form_data[key]=null;
  assert.equal(validation.validateInsuranceCompletion(d).length,0);
  d.form_data.local_d7953_1_status='Covered separately';assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path==='form_data.local_d7953_1_carrier_code'));
});

test('discrepancy view selects the latest comparison while preserving the original',()=>{
  const view=load('src/pages/insurance-verify/components/InsurancePlanDiscrepancies.jsx',{'react':{}});
  const rows=[{id:'original',created_at:'2026-11-19',event_type:'insurance_plan_discrepancy_log',metadata:{discrepancies:[]}},
    {id:'resolution',created_at:'2026-11-20',event_type:'insurance_plan_discrepancy_resolution',metadata:{discrepancies:[]}},
    {id:'unrelated',created_at:'2026-11-21',event_type:'other',metadata:{discrepancies:[]}}];
  assert.equal(view.latestDiscrepancyLog(rows).id,'resolution');assert.equal(rows[0].id,'original');
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

test('family remaining amount and separate deductibles need explicit answers, including NA',()=>{
  const d=structuredClone(fixture);d.form_data.family_deductible_remaining=51;
  assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path==='form_data.family_deductible_remaining'));
  d.form_data.family_deductible_remaining=0;d.form_data.deductible_details='';
  assert.ok(validation.validateInsuranceCompletion(d).some(e=>e.path==='form_data.deductible_details'));
  d.form_data.not_applicable={'form_data.deductible_details':'Carrier would not provide category amounts'};
  assert.equal(validation.validateInsuranceCompletion(d).length,0);
});

test('draft round trip preserves confirmed plan fields, zero balances, and unavailable explanations',async()=>{
  let captured;const db={from:table=>{const q={select:()=>q,insert:row=>{if(table==='insurance_verifications')captured=row;return q;},single:async()=>({data:{id:'fixture',status:'draft'},error:null})};return q;}};
  const service=load('src/services/insuranceVerifyService.js',{'../lib/supabase':{supabase:db}});
  const d=structuredClone(fixture);d.form_data.subscriber_relationship='Spouse';d.form_data.family_deductible_remaining=0;d.form_data.renewal_month=null;d.form_data.not_applicable={'form_data.renewal_month':'Not provided'};
  await service.createVerification('r',d,{});
  assert.equal(captured.form_data.subscriber_relationship,'Spouse');assert.equal(captured.form_data.family_deductible_remaining,0);
  assert.equal(captured.form_data.not_applicable['form_data.renewal_month'],'Not provided');
  assert.equal(captured.group_number,d.group_number);
});
test('switching a plan answer to unavailable clears the value; entering an answer clears unavailable metadata',()=>{
  const source=fs.readFileSync(path.join(root,'src/pages/insurance-verify/components/InsuranceVerificationForm.jsx'),'utf8');
  const parser=require(path.join(root,'node_modules/@babel/parser'));const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});let unavailable,update;
  function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='setException')unavailable=n.init;
    if(n.type==='VariableDeclarator'&&n.id?.name==='update'&&source.slice(n.start,n.end).includes("['form_data.' + field.key]"))update=n.init;
    for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);
  }walk(ast);assert.ok(unavailable);assert.ok(update);
  let state={form_data:{subscriber_relationship:'Self',renewal_month:'January',not_applicable:{}}};
  const context={isReadOnly:false,field:{key:'subscriber_relationship'},planEntryFields:require('../recovered-frontend/src/config/insurancePlanEntryFields.json'),completionRuleApplies:validation.completionRuleApplies,setFormData:fn=>{state=fn(state)}};
  vm.runInNewContext('('+source.slice(unavailable.start,unavailable.end)+')',context)('form_data.subscriber_relationship','Carrier could not confirm');
  assert.equal(state.form_data.subscriber_relationship,null);assert.equal(state.form_data.renewal_month,'January');
  assert.equal(state.form_data.not_applicable['form_data.subscriber_relationship'],'Carrier could not confirm');
  const enter=vm.runInNewContext('('+source.slice(update.start,update.end)+')',context);
  enter({target:{value:'Spouse'}});assert.equal(state.form_data.subscriber_relationship,'Spouse');
  assert.equal(state.form_data.not_applicable['form_data.subscriber_relationship'],undefined);
  context.field={key:'local_d7953_1_status'};state.form_data.local_d7953_1_pct=80;state.form_data.local_d7953_1_carrier_code='D7953';
  enter({target:{value:'Not covered'}});assert.equal(state.form_data.local_d7953_1_pct,null);assert.equal(state.form_data.local_d7953_1_carrier_code,null);
  context.field={key:'dependent_age_status'};state.dep_age_limit=26;
  enter({target:{value:'Not available'}});assert.equal(state.dep_age_limit,null);assert.equal(state.form_data.not_applicable.dep_age_limit,'Not available');
  enter({target:{value:'Age limit applies'}});assert.equal(state.dep_age_limit,null);assert.equal(state.form_data.not_applicable.dep_age_limit,undefined);
  context.field={key:'subscriber_relationship'};
  context.isReadOnly=true;enter({target:{value:'Self'}});assert.equal(state.form_data.subscriber_relationship,'Spouse');
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
