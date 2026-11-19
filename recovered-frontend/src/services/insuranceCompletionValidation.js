import rules from '../config/insuranceCompletionRules.json';
import planEntryFields from '../config/insurancePlanEntryFields.json';

export const completionRules = [...rules, ...planEntryFields.map(({key, ...field}) => ({...field, path: 'form_data.' + key}))];
const valueAt = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);
const blank = value => value == null || (typeof value === 'string' && value.trim() === '');

export function completionRuleApplies(rule, data) {
  if (!rule.when) return true;
  return rule.when.some(condition => {
    const value = valueAt(data, condition.path);
    return condition.eq !== undefined ? value === condition.eq : !blank(value) && Number(value) > condition.gt;
  });
}

export function validateInsuranceCompletion(data = {}) {
  const errors = [];
  for (const rule of completionRules) {
    if (!completionRuleApplies(rule, data)) continue;
    const value = valueAt(data, rule.path);
    const exception = data.form_data?.not_applicable?.[rule.path];
    // A recorded unavailable answer is different from leaving a required item blank.
    if (blank(value) && typeof exception === 'string' && exception.trim().length > 0) continue;
    let valid = !blank(value);
    if (valid && rule.type === 'text') valid = typeof value === 'string';
    if (valid && rule.type === 'boolean') valid = typeof value === 'boolean';
    if (valid && rule.type === 'number') valid = ['string','number'].includes(typeof value) && /^\d+(\.\d+)?$/.test(String(value).trim()) && Number.isFinite(Number(value)) && Number(value) >= 0 && (rule.max == null || Number(value) <= rule.max) && (!rule.integer || Number.isInteger(Number(value)));
    if (valid && rule.type === 'date') valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
    if (valid && rule.type === 'enum') valid = rule.options.includes(value);
    if (valid && rule.type === 'checkboxes') valid = ['preventive','basic','major'].some(key => value?.[key] === true);
    if (!valid) errors.push({ ...rule, message: `${rule.label}: ${rule.type === 'number' ? (rule.max === 100 ? 'enter 0–100%' : 'enter a non-negative number') : rule.type === 'boolean' ? 'select Yes or No' : 'answer required'}, or record NA / unavailable below.` });
  }
  for (const [left,right,label,section] of [['remaining_max','yearly_max','Remaining maximum cannot exceed yearly maximum','C'],['individual_deductible_remaining','deductible','Remaining deductible cannot exceed the deductible','C']]) {
    if (![data[left],data[right]].some(blank) && Number.isFinite(Number(data[left])) && Number.isFinite(Number(data[right])) && Number(data[left]) > Number(data[right])) errors.push({path:left,label,section,message:label+'.'});
  }
  if (data.term_date && data.eff_date && data.term_date < data.eff_date) errors.push({path:'term_date',label:'Term date',section:'B',message:'Term date cannot precede effective date.'});
  const familyRemaining = data.form_data?.family_deductible_remaining;
  if (![familyRemaining, data.family_deductible].some(blank) && Number.isFinite(Number(familyRemaining)) && Number.isFinite(Number(data.family_deductible)) && Number(familyRemaining) > Number(data.family_deductible)) errors.push({path:'form_data.family_deductible_remaining',label:'Family deductible remaining',section:'C',message:'Remaining family deductible cannot exceed the family deductible.'});
  return errors;
}

export function assertInsuranceComplete(data) {
  const errors = validateInsuranceCompletion(data);
  if (errors.length) throw new Error('Complete the required insurance information: ' + errors.map(e => e.message).join(' '));
}
