'use strict';
// Pure validation only. Ascend interaction must use the observed browser UI.
// Never print payloads, screenshots, names, DOBs or member IDs from this module.
const LOCATION = Object.freeze({Barnegat:'14000000000434',Brick:'14000000000435',Eatontown:'14000000000433','Staten Island':'14000000000432'});
const norm = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US') : '';
const unavailable = value => value == null || (typeof value==='string' && (!value.trim() || /^(n\/?a|not applicable|unknown|unavailable|not available|pending)(\b|\s|:)/i.test(value.trim())));
const date = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const id = value => typeof value==='string' && value===value.trim() && !unavailable(value) && /^[A-Za-z0-9][A-Za-z0-9 ./-]{0,79}$/.test(value);
const numeric = (v,max=Infinity) => (typeof v==='number' || typeof v==='string' && /^\d+(\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v)>=0 && Number(v)<=max;

function planClarifications(source) {
  const f=source.form_data||{}, na=f.not_applicable||{}, reasons=[];
  const extra=key=>Object.hasOwn(na,'form_data.'+key)?null:f[key];
  const fee={status:extra('ascend_fee_schedule_status'),name:extra('ascend_fee_schedule_name'),confirmed_by:extra('ascend_fee_schedule_confirmed_by')};
  if(fee.status!=='Confirmed with office'||unavailable(fee.name)||unavailable(fee.confirmed_by)) reasons.push('FEE_SCHEDULE_MAPPING_REQUIRED');
  const ages={};
  for(const [key,status] of [['dep_age_limit','dependent_age_status'],['student_age_limit','student_age_status']]) {
    const answer=extra(status), raw=Object.hasOwn(na,key)?null:source[key];
    ages[key]={status:answer,limit:null};
    if(answer==='Age limit applies') {
      if(unavailable(raw)||!numeric(raw,130)||Number(raw)<1||!Number.isInteger(Number(raw))) reasons.push('AGE_LIMIT_AMBIGUOUS');
      else ages[key].limit=Number(raw);
    } else if(!['Not available','No age limit confirmed'].includes(answer)) reasons.push('AGE_LIMIT_AMBIGUOUS');
  }
  const local={status:extra('local_d7953_1_status'),carrier_code:null,coverage_pct:null,frequency:null};
  if(local.status==='Not covered')local.coverage_pct=0;
  else if(local.status==='Covered separately') {
    local.carrier_code=extra('local_d7953_1_carrier_code');local.coverage_pct=extra('local_d7953_1_pct');local.frequency=extra('local_d7953_1_frequency');
    if(!/^D\d{4}$/.test(local.carrier_code||'')||unavailable(local.coverage_pct)||!numeric(local.coverage_pct,100)||unavailable(local.frequency))reasons.push('LOCAL_CODE_MAPPING_REQUIRED');
  } else reasons.push('LOCAL_CODE_MAPPING_REQUIRED');
  // These are field-level notes, not prerequisites for copying the rest of the
  // completed form. Never turn an unavailable optional mapping into a job hold.
  return {STATUS:'READY_FOR_BROWSER',review_required:reasons.length>0,reasons:[...new Set(reasons)],fee_schedule:fee,ages,local_d7953_1:local};
}

function decideBenefitEntry({source_value,ascend_value,exact_field_available}) {
  if(unavailable(source_value))return {action:'LEAVE_UNCHANGED',value:null,discrepancy:false,record_source_note:true};
  const discrepancy=!unavailable(ascend_value)&&String(source_value)!==String(ascend_value);
  if(exact_field_available!==true)return {action:'RECORD_SOURCE_NOTE',value:source_value,discrepancy,record_source_note:true};
  return {action:'COPY_FORM_VALUE',value:source_value,discrepancy,record_source_note:false};
}

function fromForm(verification, request) {
  const f=verification.form_data||{}, na=f.not_applicable||{};
  const value=(key)=>Object.hasOwn(na,key) ? null : verification[key];
  const extra=key=>Object.hasOwn(na,'form_data.'+key) ? null : f[key];
  return {
    request_id:request.id, verification_id:verification.id, source_status:verification.status,
    source_request_id:verification.request_id, request_verification_id:request.verification_id,
    request_status:request.status, office_name:request.office_name, office_id:request.office_id,
    location_id:LOCATION[request.office_name], source_office:verification.office,
    patient_first_name:request.patient_first_name, patient_last_name:request.patient_last_name,
    patient_dob:value('patient_dob'), request_patient_dob:request.patient_dob,
    source_patient_name:value('patient_name'), chart_number:request.ascend_chart_number||null,
    subscriber_relationship:extra('subscriber_relationship'), subscriber_full_name:value('subscriber_name'),
    subscriber_dob:value('subscriber_dob'), carrier_name:value('insurance_name'), payer_id:value('payor_id'),
    group_number:value('group_number'), group_name:value('employer_group_name'), subscriber_id:value('member_id'),
    effective_date:value('eff_date'), termination_date:value('term_date'),
    coverage_order:extra('coverage_order'), coverage_status:extra('coverage_status'),
    coverage_details:{annual_max:value('yearly_max'),deductible:value('deductible'),preventive_pct:value('pct_prev'),basic_pct:value('pct_basic'),major_pct:value('pct_major')},
    plan_clarifications:planClarifications(verification),
    // Retain the full form in memory for item-by-item entry, including limitations.
    source:verification
  };
}

function validate(p,today) {
  const issues=[]; const add=(field,code)=>issues.push({field,code});
  for (const field of ['patient_first_name','patient_last_name','carrier_name','group_name'])
    if(typeof p[field]!=='string'||unavailable(p[field])||/[\x00-\x1f]/.test(p[field])) add(field,'MISSING_OR_INVALID');
  for(const field of ['payer_id','group_number','subscriber_id']) if(!id(p[field]))add(field,'MISSING_OR_INVALID_IDENTIFIER');
  for(const field of ['patient_dob','effective_date']) if(!date(p[field]))add(field,'INVALID_DATE');
  if(!date(today))throw new Error('An explicit local YYYY-MM-DD date is required');
  if(date(p.patient_dob)&&p.patient_dob>today)add('patient_dob','FUTURE_DOB');
  if(date(p.effective_date)&&p.effective_date>today)add('effective_date','NOT_YET_EFFECTIVE');
  if(!LOCATION[p.office_name]||p.location_id!==LOCATION[p.office_name])add('office_name','OFFICE_MAPPING_REQUIRED');
  if(p.source_office&&norm(p.source_office)!==norm(p.office_name))add('office_name','SOURCE_CONFLICT');
  if(!['Self','Spouse','Child','Other'].includes(p.subscriber_relationship))add('subscriber_relationship','MISSING_OR_INVALID');
  const subName=p.subscriber_full_name || [p.subscriber_first_name,p.subscriber_last_name].filter(Boolean).join(' ');
  if(p.subscriber_relationship!=='Self') {
    if(unavailable(subName))add('subscriber_name','MISSING_OR_INVALID');
    if(!date(p.subscriber_dob)||p.subscriber_dob>today)add('subscriber_dob','INVALID_DATE');
  } else {
    if(!unavailable(subName)&&norm(subName)!==norm(p.patient_first_name+' '+p.patient_last_name))add('subscriber_name','SELF_CONFLICT');
    if(p.subscriber_dob&&p.subscriber_dob!==p.patient_dob)add('subscriber_dob','SELF_CONFLICT');
  }
  if(!['Primary','Secondary','Tertiary'].includes(p.coverage_order))add('coverage_order','MISSING_OR_INVALID');
  if(p.coverage_status!=='Active')add('coverage_status','ACTIVE_COVERAGE_UNCONFIRMED');
  if(p.termination_date && (!date(p.termination_date)||p.termination_date<=today))add('termination_date','TERMINATED_OR_INVALID');
  for(const [field,v] of Object.entries(p.coverage_details||{})) {
    if(unavailable(v))continue; // Unknown stays unknown, never zero.
    if(!numeric(v,field.endsWith('_pct')?100:Infinity))add('coverage_details.'+field,'INVALID_NUMBER');
  }
  if(p.source_status!==undefined) {
    if(p.source_status!=='completed'||p.request_status==='cancelled')add('source_status','NOT_ELIGIBLE');
    if(p.source_request_id!==p.request_id||p.request_verification_id!==p.verification_id)add('request_id','SOURCE_LINK_CONFLICT');
    if(norm(p.source_patient_name)!==norm(p.patient_first_name+' '+p.patient_last_name)||p.request_patient_dob!==p.patient_dob)add('patient','SOURCE_CONFLICT');
  }
  return {STATUS:issues.length?'NEEDS_HUMAN_REVIEW':'READY_FOR_BROWSER',issues,warnings:p.plan_clarifications?.reasons||[]};
}

function matchPatient(p, rows, complete) {
  if(!complete)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'INCOMPLETE_SEARCH'};
  const matches=rows.filter(r=>norm(r.first_name)===norm(p.patient_first_name)&&norm(r.last_name)===norm(p.patient_last_name)&&r.dob===p.patient_dob);
  if(matches.length!==1)return {STATUS:'ERROR_PATIENT_NOT_FOUND_OR_DUPLICATE'};
  const row=matches[0];
  if(!row.patient_id||(p.chart_number&&norm(row.chart_number)!==norm(p.chart_number))||row.location_id!==p.location_id)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'CHART_OR_OFFICE_MISMATCH'};
  return {STATUS:'MATCHED',PATIENT_ID:row.patient_id};
}

function decidePolicy(p, rows, complete) {
  if(!complete)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'INCOMPLETE_POLICY_LIST'};
  const same=rows.filter(r=>(norm(r.carrier_name)===norm(p.carrier_name)||r.payer_id===p.payer_id)&&r.subscriber_id===p.subscriber_id);
  if(same.length>1)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'DUPLICATE_POLICY'};
  if(same.length===1) {
    const r=same[0];
    if(!r.plan_id||norm(r.carrier_name)!==norm(p.carrier_name)||r.payer_id!==p.payer_id||r.active!==true||r.group_number!==p.group_number||r.coverage_order!==p.coverage_order||r.subscriber_relationship!==p.subscriber_relationship||r.effective_date!==p.effective_date)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'EXISTING_POLICY_CONFLICT'};
    return {STATUS:'VERIFY_EXISTING',PLAN_ATTACHED:r.plan_id};
  }
  if(rows.some(r=>r.active&&r.coverage_order===p.coverage_order))return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'COVERAGE_ORDER_OCCUPIED'};
  return {STATUS:'FIND_GROUP_PLAN'};
}

function decideGroup(p, rows, complete) {
  if(!complete)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'INCOMPLETE_GROUP_SEARCH'};
  const same=rows.filter(r=>(norm(r.carrier_name)===norm(p.carrier_name)||r.payer_id===p.payer_id)&&r.group_number===p.group_number);
  if(same.length>1)return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'DUPLICATE_GROUP'};
  if(same.length===1) {
    if(!same[0].plan_id||norm(same[0].carrier_name)!==norm(p.carrier_name)||same[0].payer_id!==p.payer_id||norm(same[0].group_name)!==norm(p.group_name))return {STATUS:'NEEDS_HUMAN_REVIEW',reason:'GROUP_CONFLICT'};
    return {STATUS:'USE_EXISTING_GROUP',PLAN_ATTACHED:same[0].plan_id};
  }
  return {STATUS:'CREATE_GROUP_ALLOWED'};
}
module.exports={LOCATION,norm,unavailable,fromForm,validate,matchPatient,decidePolicy,decideGroup,planClarifications,decideBenefitEntry};
