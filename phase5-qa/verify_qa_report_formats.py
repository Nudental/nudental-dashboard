"""Live synthetic XLSX/PDF readback, scope and audit checks; no provider access."""
import argparse
import hashlib
import http.client
import io
import json
from pathlib import Path
import re
from uuid import UUID
import zipfile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
from hosted_client import HostedQa, PROJECT

ORIGIN='https://nudashboard-qa.pages.dev'
SOURCE='QA / SYNTHETIC patient-flow fixtures v1; no provider connection'
B='873fd448-c507-5a1d-aebe-4b22278b3a28'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--connection',type=Path,required=True)
    args=parser.parse_args()
    config=json.loads(args.connection.read_text());api=HostedQa(config)
    identity=json.loads((args.connection.parent/'identities.private.json').read_text())
    assert identity['project_ref']==PROJECT
    actors=identity['actors'];tokens={}
    root=args.connection.parent.parent
    output=root/'qa-report-formats-live-20260915.json';assert not output.exists()
    downloads=root/'qa-report-format-downloads-20260915';downloads.mkdir(exist_ok=True)
    report={'project_ref':PROJECT,'production_connected':False,'browser_save_verified':False,
            'results':[],'downloads':[],'audit_ids':[],'permission_restore_required':False}
    permission='/rest/v1/role_permissions?id=eq.49f7aa4e-cf4a-4367-96ca-989debdbf1e3'
    def save():output.write_text(json.dumps(report,indent=2))
    def check(name,passed):
        report['results'].append({'test':name,'pass':bool(passed)});save();assert passed,name
    def request(role,fmt='pdf',changes=None):
        headers={'Content-Type':'application/json','Origin':ORIGIN,'X-API-Key':config['api_key']}
        if role:
            if role not in tokens:
                actor=actors[role];assert actor['email'].endswith('@nudashboard.example.test')
                tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                    body={'email':actor['email'],'password':actor['password']})['access_token']
            headers['Authorization']='Bearer '+tokens[role]
        body={'report_type':'patient_flow','export_format':fmt,'date_range_start':'2026-09-01',
              'date_range_end':'2026-09-15','office_filter':'all',**(changes or {})}
        conn=http.client.HTTPSConnection('nudashboard-qa-api.nuholdingllc.com',timeout=30)
        try:
            conn.request('POST','/v2/reports/export',body=json.dumps(body).encode(),headers=headers)
            response=conn.getresponse();raw=response.read(250001);assert len(raw)<=250000
            return response.status,{k.lower():v for k,v in response.getheaders()},raw
        finally:conn.close()
    def export(name,role,fmt,changes=None):
        status,headers,raw=request(role,fmt,changes)
        check(name+' HTTP success',status==200)
        aid=str(UUID(headers['x-audit-id']));report['audit_ids'].append(aid);save()
        match=re.search(r'filename="([^"]+)"',headers.get('content-disposition',''));assert match
        filename=match[1]
        assert filename.startswith('QA_nu_reports_patient_flow_') and filename.endswith('.'+fmt)
        assert len(filename)<200 and not any(char in filename for char in '/\\:')
        target=downloads/(str(len(report['downloads']))+'-'+filename)
        assert target.parent.resolve()==downloads.resolve()
        record={'file':target.name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'cleanup':False}
        report['downloads'].append(record);save()
        with target.open('xb') as stream:stream.write(raw)
        check(name+' saved file integrity',target.read_bytes()==raw)
        if fmt=='pdf':
            reader=PdfReader(target);text='\n'.join(page.extract_text() for page in reader.pages)
            check(name+' valid PDF',len(reader.pages)==1 and not reader.is_encrypted and headers['content-type'].startswith('application/pdf'))
            values=text.splitlines()
        else:
            with zipfile.ZipFile(target) as book:
                assert sum(item.file_size for item in book.infolist())<3000000
                check(name+' valid XLSX without external links or macros',book.testzip() is None and
                      not any('externalLinks' in path or 'vbaProject' in path for path in book.namelist()))
                ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                strings=[''.join(item.itertext()) for item in ET.fromstring(book.read('xl/sharedStrings.xml'))]
                values=[]
                for row in ET.fromstring(book.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row',ns):
                    cells=[]
                    for cell in row.findall('s:c',ns):
                        value=cell.findtext('s:v','',ns)
                        cells.append(strings[int(value)] if cell.get('t')=='s' else value)
                    if cells and cells[0]=='QA / Office A':check(name+' exact Office A values',cells[:5]==['QA / Office A','3','6','12','6'])
                    values.extend(cells)
                text='\n'.join(strings)
        check(name+' synthetic title and provenance','QA / SYNTHETIC Patient Flow' in text and SOURCE in text and 'Dentrix Ascend SQLite' not in text)
        check(name+' office and total scope','QA / Office A' in text and
              (('QA / Office B' in text and '132' in values) if role=='admin' else ('QA / Office B' not in text and '12' in values)))
        if changes and changes.get('date_range_end')=='2026-11-01':check(name+' monthly range readback','Sep 2026' in text and 'Nov 2026' in text)
        exposed={part.strip().lower() for part in headers.get('access-control-expose-headers','').split(',')}
        check(name+' download headers',headers.get('x-qa-synthetic')=='true' and headers.get('x-nudental-environment')=='qa'
              and headers.get('access-control-allow-origin')==ORIGIN and {'content-disposition','x-audit-id','x-row-count'}.issubset(exposed))
        audit=api.request('/rest/v1/report_export_audit_log?id=eq.'+aid+'&select=id,user_id,user_role,export_format,source_notes,metadata,phi_flag')
        locations=['qa-location-a','qa-location-b'] if role=='admin' else ['qa-location-a']
        check(name+' persisted audit',len(audit)==1 and audit[0]['user_id']==actors[role]['id'] and audit[0]['user_role']==role
              and audit[0]['export_format']==fmt and audit[0]['source_notes']==SOURCE and audit[0]['metadata']['qa_locations']==locations and audit[0]['phi_flag'] is False)
        target.unlink();record['cleanup']=True;save()
    original=api.request(permission+'&select=role,permission,enabled')
    assert original==[{'role':'office_manager','permission':'resources.reports.individual_export','enabled':False}]
    try:
        for fmt in ('xlsx','pdf'):
            for role in (None,'staff','office_manager'):
                check(fmt+' denies '+str(role),request(role,fmt)[0]==(401 if role is None else 403))
            check(fmt+' rejects unreviewed report',request('admin',fmt,{'report_type':'expense_breakdown'})[0]==503)
            export('admin all '+fmt,'admin',fmt)
        report['permission_restore_required']=True;save()
        api.request(permission+'&enabled=eq.false',method='PATCH',body={'enabled':True})
        check('temporary QA permission persisted',api.request(permission+'&select=enabled')==[{'enabled':True}])
        for fmt in ('xlsx','pdf'):
            check(fmt+' other office denied',request('office_manager',fmt,{'office_filter':[B]})[0]==403)
            check(fmt+' forged identity denied',request('office_manager',fmt,{'user_role':'admin'})[0]==403)
            export('manager own '+fmt,'office_manager',fmt)
            export('manager monthly '+fmt,'office_manager',fmt,{'date_range_end':'2026-11-01'})
            export('manager repeat '+fmt,'office_manager',fmt)
        check('one unique audit for each explicit download',len(report['audit_ids'])==len(set(report['audit_ids']))==8)
    finally:
        if report['permission_restore_required']:
            api.request(permission,method='PATCH',body={'enabled':False})
            report['permission_restore_required']=api.request(permission+'&select=enabled')!=[{'enabled':False}]
            save();assert not report['permission_restore_required'],'QA permission restoration requires attention'
        for record in report['downloads']:
            target=downloads/record['file'];assert target.parent.resolve()==downloads.resolve()
            if target.exists():target.unlink()
            record['cleanup']=not target.exists()
        save()
    check('permission revoked for both formats',all(request('office_manager',fmt)[0]==403 for fmt in ('xlsx','pdf')))
    check('temporary downloads cleaned',all(record['cleanup'] for record in report['downloads']))
    report['passed']=sum(row['pass'] for row in report['results']);save()
    print(json.dumps({'checks':len(report['results']),'passed':report['passed'],'audits_retained':len(report['audit_ids']),
                      'permission_restored':not report['permission_restore_required'],'downloads_cleaned':True,'browser_save_verified':False}))


if __name__=='__main__':main()
