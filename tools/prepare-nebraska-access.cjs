const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const live=path.resolve(root,'../live-source');
const grants=["workflow.patient_followup.view","workflow.office_calls.view","workflow.huddle.view","huddle:view","huddle:edit","workflow.eod.view","workflow.tasks.view","workflow.insurance.view","workflow.insurance.submit","workflow.insurance.assign","workflow.insurance.complete","workflow.insurance.cancel","workflow.insurance.email_office","workflow.insurance.mark_uploaded","workflow.insurance.upload_to_dentrix","resources.directory.view","finance.rcm.view","finance.rcm.claims.view","finance.rcm.payment.view","finance.rcm.adjustment.view","finance.rcm.dashboard.view","finance.rcm.ar_aging.view","finance.rcm.daily_comparison.view","finance.rcm.eassist_daily.view"];
const id='5c29c9cc-6db1-4368-9bc6-ff058f32dc20';
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('Expected unique source '+a.slice(0,60));return s.replace(a,b);}
let identity=fs.readFileSync(path.join(live,'api_identity.py'),'utf8').replace(/\r\n/g,'\n');
const allow='NAMED_INSURANCE_COORDINATOR = '+JSON.stringify(id)+'\nCOORDINATOR_GRANTS = frozenset('+JSON.stringify(grants)+')\n\n';
identity=replaceOnce(identity,'class UserResolver:',allow+'class UserResolver:');
identity=replaceOnce(identity,"            named_payroll = []","            named_coordinator = []\n            if user_id == NAMED_INSURANCE_COORDINATOR and profile['role'] == 'staff':\n                named_coordinator = self._get(session, '/rest/v1/staff_workflow_grants', params={\n                    'user_id': 'eq.' + user_id, 'select': 'permission'})\n            named_payroll = []");
identity=replaceOnce(identity,'        email = user.get(\'email\')',"        if not isinstance(named_coordinator, list):\n            raise AccessFailure(503)\n        for row in named_coordinator:\n            if not isinstance(row, dict) or not isinstance(row.get('permission'), str):\n                raise AccessFailure(503)\n            key = row['permission']\n            if key in COORDINATOR_GRANTS:\n                enabled.add(key)\n                disabled.discard(key)\n        email = user.get('email')");
for(const f of ['phase6-hardening/api_identity.py','recovered-backend/templates/middleware/api_identity.py.in']) fs.writeFileSync(path.join(root,f),identity);
fs.writeFileSync(path.join(live,'api_identity.candidate.py'),identity);
let manifest=JSON.parse(fs.readFileSync(path.join(root,'recovered-backend/source-manifest.json'),'utf8'));
const row=manifest.find(x=>x.source_file==='middleware/api_identity.py');
const hash=crypto.createHash('sha256').update(identity).digest('hex');
row.sha256=row.template_sha256=hash;row.bytes=Buffer.byteLength(identity);
fs.writeFileSync(path.join(root,'recovered-backend/source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
let viewer=fs.readFileSync(path.join(live,'viewer.py'),'utf8').replace(/\r\n/g,'\n');
const helper=`def insurance_coordinator_scope(actor, directory, request):
    """Exact named capabilities; never promote this account to an owner/manager."""
    if actor.id != '${id}' or actor.role != 'staff':
        return set()
    path, method = request.url.path, request.method
    followup = ('workflow.patient_followup.view' in actor.permissions and (
        (method == 'GET' and path == '/social-growth/followups')
        or (method == 'GET' and re.fullmatch(r'/social-growth/followups/[a-f0-9]{32}/voicemail', path))
        or (method == 'POST' and re.fullmatch(r'/social-growth/followups/[a-f0-9]{32}', path))))
    calls = method == 'POST' and path == '/social-growth/office-calls' and 'workflow.office_calls.view' in actor.permissions
    if not (followup or calls):
        return set()
    return {office for office in LOCATIONS if office in directory['offices']
        and (actor.all_offices or directory['offices'][office]['office_id'] in actor.assigned_offices)}

`;
viewer=replaceOnce(viewer,'def allowed(request,selected,owner_only=False):',helper+'def allowed(request,selected,owner_only=False):');
viewer=replaceOnce(viewer,"    request.state.can_review_calls=bool(is_owner or is_call_manager)\n    if owner_only and not request.state.can_review_calls:raise HTTPException(403,'Office Calls access required.')\n    directory=config()",
"    directory=config()\n    coordinator_offices=insurance_coordinator_scope(actor,directory,request)\n    request.state.can_review_ziva=bool(is_owner or is_call_manager)\n    request.state.can_review_calls=bool(is_owner or is_call_manager or (coordinator_offices and 'workflow.office_calls.view' in actor.permissions))\n    coordinator_calls=bool(coordinator_offices and request.method=='POST' and request.url.path=='/social-growth/office-calls')\n    if owner_only and not (request.state.can_review_ziva or coordinator_calls):raise HTTPException(403,'Office Calls access required.')");
viewer=replaceOnce(viewer,"    if actor.email.lower() in (recipient('brick','Executive'),recipient('brick','Marketing Manager')):",
"    if coordinator_offices:\n        offices=coordinator_offices\n    elif actor.email.lower() in (recipient('brick','Executive'),recipient('brick','Marketing Manager')):");
viewer=replaceOnce(viewer,"        data['ziva']=ziva_report(db,body['start'],body['end'],units,body.get('phone',''))",
"        data['ziva']=ziva_report(db,body['start'],body['end'],units,body.get('phone',''))\n        data['can_review_ziva']=getattr(request.state,'can_review_ziva',False)");
fs.writeFileSync(path.join(live,'viewer.candidate.py'),viewer);
let outbound=fs.readFileSync(path.join(live,'outbound.js'),'utf8').replace(/\r\n/g,'\n');
outbound=replaceOnce(outbound,'showZiva(data.ziva);','showZiva(data.ziva,data.can_review_ziva === true);');
outbound=replaceOnce(outbound,'function showZiva(report) {','function showZiva(report, canReview) {');
outbound=replaceOnce(outbound,"  const controls=document.createElement('div');controls.className='actions';",
"  if(!canReview)continue;\n  const controls=document.createElement('div');controls.className='actions';");
fs.writeFileSync(path.join(live,'outbound.candidate.js'),outbound);
console.log(JSON.stringify({identity_sha256:hash,grant_count:grants.length}));

