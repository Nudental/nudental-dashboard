"""Positive CSV/audit/scope checks on the fixed QA API; no provider or delivery."""
import argparse
import csv
import hashlib
import http.client
import io
import json
from pathlib import Path
import re
from hosted_client import HostedQa, PROJECT

API_HOST = 'nudashboard-qa-api.nuholdingllc.com'
QA_ORIGIN = 'https://nudashboard-qa.pages.dev'
A, B = '9219b493-5765-5da0-939f-221c7f9944d9', '873fd448-c507-5a1d-aebe-4b22278b3a28'
SOURCE_NOTE = 'QA / SYNTHETIC patient-flow fixtures v1; no provider connection'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.connection.read_text())
    api = HostedQa(config)
    identity = json.loads((args.connection.parent/'identities.private.json').read_text())
    assert identity['project_ref'] == PROJECT
    actors, tokens = identity['actors'], {}
    fixture = json.loads((Path(__file__).parent/'synthetic-role-fixtures.json').read_text())
    roles = {actor['fixture_key']: actor['role'] for actor in fixture['actors']}
    root = args.connection.parent.parent
    output = root/'qa-report-export-live-20260915.json'
    assert not output.exists(), 'Preserve earlier verification evidence'
    download_root = root/'qa-report-downloads-20260915'
    download_root.mkdir(exist_ok=True)
    report = {'project_ref': PROJECT, 'production_connected': False, 'results': [],
              'downloads': [], 'audit_ids': [], 'permission_restore_required': False}
    permission_path = '/rest/v1/role_permissions?id=eq.49f7aa4e-cf4a-4367-96ca-989debdbf1e3'

    def save(): output.write_text(json.dumps(report, indent=2), encoding='utf8')
    def check(name, passed):
        report['results'].append({'test': name, 'pass': bool(passed)})
        save()
        assert passed, name
    def token(role):
        if role not in tokens:
            actor=actors[role]
            assert actor['email'].endswith('@nudashboard.example.test')
            tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                body={'email':actor['email'],'password':actor['password']})['access_token']
        return tokens[role]
    def request(role='admin', changes=None, key=True, method='POST', path='/v2/reports/export'):
        body={'report_type':'patient_flow','export_format':'csv','date_range_start':'2026-09-01',
              'date_range_end':'2026-09-15','office_filter':'all'}
        headers={'Content-Type':'application/json','Origin':QA_ORIGIN,
                 'User-Agent':'NuDental-QA-Report-Verification/1.0'}
        if key:headers['X-API-Key']=config['api_key']
        if role:
            headers['Authorization']='Bearer '+('QA-invalid-token' if role=='invalid' else token(role))
            if role!='invalid':
                actor=actors[role]
                body.update(user_id=actor['id'],user_role=roles[role],user_email=actor['email'])
        body.update(changes or {})
        conn=http.client.HTTPSConnection(API_HOST,timeout=30)
        try:
            conn.request(method,path,body=json.dumps(body).encode() if method=='POST' else None,headers=headers)
            response=conn.getresponse();raw=response.read(250001)
            assert len(raw)<=250000
            return response.status,{k.lower():v for k,v in response.getheaders()},raw
        finally:conn.close()

    def export(name,role,changes,offices,scheduled):
        status,headers,raw=request(role,changes)
        if status!=200:
            report['unexpected_export']={'test':name,'status':status,'content_type':headers.get('content-type')}
            save()
        check(name+' successful CSV response',status==200 and headers.get('content-type','').startswith('text/csv'))
        text=raw.decode('utf-8-sig')
        rows=list(csv.DictReader(io.StringIO('\n'.join(line for line in text.splitlines() if not line.startswith('#')))))
        actual=[row for row in rows if row.get('Office') in ('QA / Office A','QA / Office B','TOTAL')]
        check(name+' scoped fixture totals',[row['Office'] for row in actual]==offices and [row['Total Scheduled'] for row in actual]==scheduled)
        check(name+' explicit QA label',SOURCE_NOTE in text and headers.get('x-qa-synthetic')=='true' and headers.get('x-nudental-environment')=='qa')
        exposed={value.strip().lower() for value in headers.get('access-control-expose-headers','').split(',')}
        check(name+' browser download metadata exposed',{'content-disposition','x-audit-id','x-row-count'}.issubset(exposed) and headers.get('access-control-allow-origin')==QA_ORIGIN)
        aid=headers['x-audit-id'];report['audit_ids'].append(aid)
        audit=api.request('/rest/v1/report_export_audit_log?id=eq.'+aid+'&select=id,user_id,user_role,user_email,office_filter,source_notes,metadata,row_counts,phi_flag')
        expected_locations=['qa-location-'+letter.lower() for letter in ('A','B') if 'QA / Office '+letter in offices]
        check(name+' persisted audit identity and scope',len(audit)==1 and audit[0]['user_id']==actors[role]['id'] and audit[0]['user_role']==roles[role] and audit[0]['user_email']==actors[role]['email'] and audit[0]['source_notes']==SOURCE_NOTE and audit[0]['metadata']['qa_locations']==expected_locations and audit[0]['phi_flag'] is False)
        match=re.search(r'filename="([^"]+)"',headers.get('content-disposition',''))
        assert match
        filename=match[1]
        assert filename.startswith('QA_nu_reports_patient_flow_') and not any(c in filename for c in '/\\:') and len(filename)<200
        target=download_root/(str(len(report['downloads']))+'-'+filename)
        assert target.parent.resolve()==download_root.resolve()
        record={'file':target.name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'cleanup':False}
        report['downloads'].append(record);save()
        with target.open('xb') as file:file.write(raw)
        check(name+' downloaded file readback',hashlib.sha256(target.read_bytes()).hexdigest()==record['sha256'])
        target.unlink();record['cleanup']=not target.exists();save()
        return rows

    original=api.request(permission_path+'&select=id,role,permission,enabled')
    assert original==[{'id':'49f7aa4e-cf4a-4367-96ca-989debdbf1e3','role':'office_manager','permission':'resources.reports.individual_export','enabled':False}]
    report['original_permission']=original[0];save()
    try:
        status,_,raw=request(None,method='GET',path='/health');health=json.loads(raw)
        check('isolated three-route QA API healthy',status==200 and health['project_ref']==PROJECT and health['reviewed_route_methods']==3 and health['internet_sockets_blocked'] and health['external_execution']=='disabled' and health['product_api_ready'] is False)
        for name,role,change,status in [
            ('missing session',None,{},401),('invalid session','invalid',{},401),
            ('ordinary staff denied','staff',{},403),('manager permission disabled','office_manager',{},403),
            ('forged admin identity denied','admin',{'user_role':'super_admin'},403),
            ('unreviewed report type denied','admin',{'report_type':'expense_breakdown'},503),
        ]:check(name,request(role,change)[0]==status)
        check('original API key remains required',request('admin',key=False)[0]==422)
        export('admin all offices','admin',{},['QA / Office A','QA / Office B','TOTAL'],['12','120','132'])
        export('admin single office','admin',{'office_filter':[A]},['QA / Office A'],['12'])
        report['permission_restore_required']=True;save()
        api.request(permission_path+'&enabled=eq.false',method='PATCH',body={'enabled':True})
        check('temporary QA permission persisted',api.request(permission_path+'&select=enabled')==[{'enabled':True}])
        export('manager assigned office','office_manager',{},['QA / Office A'],['12'])
        check('manager other-office request denied',request('office_manager',{'office_filter':[B]})[0]==403)
        check('manager forged reviewer identity denied',request('office_manager',{'user_id':actors['admin']['id'],'user_role':'admin'})[0]==403)
        rows=export('manager monthly trend','office_manager',{'date_range_end':'2026-11-01'},['QA / Office A'],['12'])
        check('monthly trend stays within assigned office',next(row for row in rows if row.get('Office')=='Sep 2026')['Total Scheduled']=='12')
        export('manager repeat download','office_manager',{},['QA / Office A'],['12'])
        check('one distinct audit per deliberate download',len(report['audit_ids'])==len(set(report['audit_ids']))==5)
    finally:
        if report['permission_restore_required']:
            api.request(permission_path,method='PATCH',body={'enabled':False})
            restored=api.request(permission_path+'&select=enabled')==[{'enabled':False}]
            report['permission_restore_required']=not restored;save()
            assert restored,'QA export permission restoration requires attention'
        for record in report['downloads']:
            target=download_root/record['file']
            assert target.parent.resolve()==download_root.resolve()
            if target.exists():target.unlink()
            record['cleanup']=not target.exists()
        save()
    check('temporary export permission revoked',request('office_manager')[0]==403)
    check('temporary downloads cleaned',all(record['cleanup'] for record in report['downloads']))
    report['passed']=sum(row['pass'] for row in report['results']);save()
    print(json.dumps({'checks':len(report['results']),'passed':report['passed'],
        'audit_records_retained':len(report['audit_ids']),'permission_restored':not report['permission_restore_required'],
        'download_cleanup':all(row['cleanup'] for row in report['downloads']),'browser_file_save_verified':False,'production_connected':False}))


if __name__=='__main__':main()
