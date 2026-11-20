const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/config/navConfig.js'),'utf8').replaceAll('export ','');
const c={};vm.createContext(c);vm.runInContext(src+'\nthis.groups=NAV_GROUPS;this.visible=isNavItemVisible;',c);
const all=c.groups.flatMap(g=>g.children), profile={role:'staff',id:'5c29c9cc-6db1-4368-9bc6-ff058f32dc20',job_title:'Insurance Coordinator'};
const grants=new Set(["workflow.patient_followup.view","workflow.office_calls.view","workflow.huddle.view","huddle:view","huddle:edit","workflow.eod.view","workflow.tasks.view","workflow.insurance.view","workflow.insurance.submit","workflow.insurance.assign","workflow.insurance.complete","workflow.insurance.cancel","workflow.insurance.email_office","workflow.insurance.mark_uploaded","workflow.insurance.upload_to_dentrix","resources.directory.view","finance.rcm.view","finance.rcm.claims.view","finance.rcm.payment.view","finance.rcm.adjustment.view","finance.rcm.dashboard.view","finance.rcm.ar_aging.view","finance.rcm.daily_comparison.view","finance.rcm.eassist_daily.view"]);
for(const id of ['staff-office-scorecard','patient-follow-up','office-calls','morning-huddle','insurance-verify','eod-report','team-assignments','staff-directory','rcm']){
 const item=all.find(x=>x.id===id);assert(item,id);assert(c.visible(item,profile,k=>grants.has(k)),id);
}
for(const id of ['office-texts','internal-campaigns','payroll','overview','front-desk-approvals']){
 const item=all.find(x=>x.id===id);assert(!c.visible(item,profile,k=>grants.has(k)),id);
}
for(const id of ['patient-follow-up','office-calls']){
 const item=all.find(x=>x.id===id);assert(!c.visible(item,profile,()=>false),id+' no grant');
}
console.log('Navigation: intended 9 areas visible; 5 unrelated areas denied; revoked grants deny access.');

