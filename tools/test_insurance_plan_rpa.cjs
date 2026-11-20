'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,fromForm,matchPatient,decidePolicy,decideGroup,planClarifications,decideBenefitEntry}=require('./insurance_plan_rpa.cjs');
const p={patient_first_name:'Example',patient_last_name:'Only',patient_dob:'1980-01-01',office_name:'Eatontown',location_id:'14000000000433',subscriber_relationship:'Self',subscriber_full_name:'Example Only',subscriber_dob:'1980-01-01',carrier_name:'Fixture Carrier',payer_id:'00123',group_number:'00045',group_name:'Fixture Group',subscriber_id:'000678A',effective_date:'2026-01-01',coverage_order:'Primary',coverage_status:'Active',coverage_details:{annual_max:1500,deductible:0,preventive_pct:100,basic_pct:80,major_pct:50}};
const v=x=>validate({...p,...x},'2026-11-20');
test('preserves zero benefit and identifiers with leading zeroes',()=>{assert.equal(v({}).STATUS,'READY_FOR_BROWSER');assert.equal(p.subscriber_id,'000678A');});
test('missing, NA and numeric identifiers stop entry',()=>{for(const bad of [null,'NA','N/A - not provided',123,' 00123'])assert.equal(v({payer_id:bad}).STATUS,'NEEDS_HUMAN_REVIEW');});
test('invalid or future dates stop entry',()=>{for(const bad of ['2026-02-30','11/20/2026','2027-01-01'])assert.equal(v({effective_date:bad}).STATUS,'NEEDS_HUMAN_REVIEW');});
test('non-self requires subscriber demographics and explicit relationship',()=>{assert.equal(v({subscriber_relationship:'Spouse',subscriber_full_name:null}).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(v({subscriber_relationship:null}).STATUS,'NEEDS_HUMAN_REVIEW');});
test('self demographics must agree',()=>assert.equal(v({subscriber_full_name:'Different Person'}).STATUS,'NEEDS_HUMAN_REVIEW'));
test('office mismatch, inactive and unknown order stop',()=>{for(const x of [{location_id:'wrong'},{source_office:'Brick'},{coverage_status:'Terminated'},{coverage_order:null}])assert.equal(v(x).STATUS,'NEEDS_HUMAN_REVIEW');});
test('NA optional benefits remain unknown and invalid percentages stop',()=>{assert.equal(v({coverage_details:{annual_max:null,major_pct:'NA'}}).STATUS,'READY_FOR_BROWSER');for(const b of [101,-1,'eighty'])assert.equal(v({coverage_details:{major_pct:b}}).STATUS,'NEEDS_HUMAN_REVIEW');});
test('NA form override wins over a stale numeric value; no fallback to request member',()=>{const f=fromForm({id:'v',request_id:'r',member_id:null,yearly_max:100,form_data:{not_applicable:{yearly_max:'NA'}}},{id:'r',verification_id:'v',member_id:'DO-NOT-USE'});assert.equal(f.coverage_details.annual_max,null);assert.equal(f.subscriber_id,null);});
test('source patient and linkage conflicts are held',()=>assert.equal(v({source_status:'completed',request_status:'completed',source_request_id:'r1',request_id:'r2',request_verification_id:'v',verification_id:'v',source_patient_name:'Someone Else',request_patient_dob:p.patient_dob}).STATUS,'NEEDS_HUMAN_REVIEW'));
const patient={first_name:p.patient_first_name,last_name:p.patient_last_name,dob:p.patient_dob,patient_id:'1',location_id:p.location_id};
test('no match or duplicate name and DOB never creates a patient',()=>{for(const rows of [[],[patient,patient]])assert.equal(matchPatient(p,rows,true).STATUS,'ERROR_PATIENT_NOT_FOUND_OR_DUPLICATE');});
test('truncated search and wrong chart or office stop',()=>{assert.equal(matchPatient(p,[patient],false).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(matchPatient({...p,chart_number:'CHART'},[patient],true).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(matchPatient(p,[{...patient,location_id:'other'}],true).STATUS,'NEEDS_HUMAN_REVIEW');});
const policy={...p,active:true,plan_id:'42'};
test('exact existing policy is verified, never reattached',()=>assert.equal(decidePolicy(p,[policy],true).STATUS,'VERIFY_EXISTING'));
test('conflicting occupied primary or duplicate policy stops',()=>{for(const rows of [[{...policy,carrier_name:'Other'}],[policy,policy],[{...policy,group_number:'other'}]])assert.equal(decidePolicy(p,rows,true).STATUS,'NEEDS_HUMAN_REVIEW');});
test('reuse exact group; ambiguous group never duplicated',()=>{assert.equal(decideGroup(p,[policy],true).STATUS,'USE_EXISTING_GROUP');assert.equal(decideGroup(p,[policy,policy],true).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(decideGroup(p,[{...policy,payer_id:'wrong'}],true).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(decideGroup(p,[],false).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(decideGroup(p,[],true).STATUS,'CREATE_GROUP_ALLOWED');});
test('carrier name variants with same payer cannot create duplicates',()=>{const alias={...policy,carrier_name:'Fixture Carrier Inc'};assert.equal(decideGroup(p,[alias],true).STATUS,'NEEDS_HUMAN_REVIEW');assert.equal(decidePolicy(p,[alias],true).STATUS,'NEEDS_HUMAN_REVIEW');});

test('an exact historical policy is held rather than attached again',()=>assert.equal(decidePolicy(p,[{...policy,active:false}],true).STATUS,'NEEDS_HUMAN_REVIEW'));

test('existing coverage in another order is not attached a second time',()=>assert.equal(decidePolicy(p,[{...policy,coverage_order:'Secondary'}],true).STATUS,'NEEDS_HUMAN_REVIEW'));

test('an unrelated primary policy cannot be replaced or duplicated',()=>assert.equal(decidePolicy(p,[{...policy,carrier_name:'Different Carrier',payer_id:'54321',subscriber_id:'OTHER'}],true).STATUS,'NEEDS_HUMAN_REVIEW'));

const clarified={dep_age_limit:0,student_age_limit:0,oral_surgery:{bone_graft_pct:80},form_data:{ascend_fee_schedule_status:'Confirmed with office',ascend_fee_schedule_name:'Fixture office PPO',ascend_fee_schedule_confirmed_by:'Fixture reviewer',dependent_age_status:'Not available',student_age_status:'No age limit confirmed',local_d7953_1_status:'Not covered',local_d7953_1_pct:80}};
test('unavailable ages and local not-covered status override stale numbers without inheriting parent-code coverage',()=>{
 const r=planClarifications(clarified);assert.equal(r.STATUS,'READY_FOR_BROWSER');assert.equal(r.ages.dep_age_limit.limit,null);assert.equal(r.ages.student_age_limit.limit,null);assert.equal(r.local_d7953_1.coverage_pct,0);
});
test('PPO wording alone never chooses an office fee schedule',()=>{
 const r=planClarifications({...clarified,fee_schedule:'PPO',form_data:{...clarified.form_data,ascend_fee_schedule_status:'Office review needed'}});assert.ok(r.reasons.includes('FEE_SCHEDULE_MAPPING_REQUIRED'));
});
test('local coverage and age limits require exact confirmed answers',()=>{
 const r=planClarifications({...clarified,form_data:{...clarified.form_data,dependent_age_status:'Age limit applies',local_d7953_1_status:'Covered separately'}});assert.ok(r.reasons.includes('AGE_LIMIT_AMBIGUOUS'));assert.ok(r.reasons.includes('LOCAL_CODE_MAPPING_REQUIRED'));
});
test('legacy zeros and unavailable mapping overrides are noted without inventing values',()=>{
 assert.ok(planClarifications({dep_age_limit:0}).reasons.includes('AGE_LIMIT_AMBIGUOUS'));
 const r=planClarifications({...clarified,form_data:{...clarified.form_data,not_applicable:{'form_data.ascend_fee_schedule_name':'NA'}}});assert.equal(r.fee_schedule.name,null);assert.ok(r.reasons.includes('FEE_SCHEDULE_MAPPING_REQUIRED'));
});

test('missing optional clarification fields do not block completed-form transcription',()=>{
 const result=v({source_status:'completed',request_status:'completed',source_request_id:'r',request_id:'r',request_verification_id:'v',verification_id:'v',source_patient_name:'Example Only',request_patient_dob:p.patient_dob,plan_clarifications:planClarifications({})});
 assert.equal(result.STATUS,'READY_FOR_BROWSER');assert.equal(result.issues.length,0);assert.ok(result.warnings.includes('FEE_SCHEDULE_MAPPING_REQUIRED'));
});

test('a supplied benefit replaces a differing value while retaining a discrepancy signal',()=>{
 const result=decideBenefitEntry({source_value:1500,ascend_value:1000,exact_field_available:true});
 assert.equal(result.action,'COPY_FORM_VALUE');assert.equal(result.value,1500);assert.equal(result.discrepancy,true);
});

test('zero and false are supplied answers; NA never overwrites an existing benefit',()=>{
 for(const value of [0,false])assert.equal(decideBenefitEntry({source_value:value,ascend_value:50,exact_field_available:true}).value,value);
 for(const value of [null,'','NA','Not available'])assert.equal(decideBenefitEntry({source_value:value,ascend_value:1500,exact_field_available:true}).action,'LEAVE_UNCHANGED');
});

test('unsupported or unclear field mappings preserve the exact source in a note',()=>{
 const result=decideBenefitEntry({source_value:'1/LT per tooth',ascend_value:'1/60M',exact_field_available:false});
 assert.equal(result.action,'RECORD_SOURCE_NOTE');assert.equal(result.value,'1/LT per tooth');assert.equal(result.discrepancy,true);
});
