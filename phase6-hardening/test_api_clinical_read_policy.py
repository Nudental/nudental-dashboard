"""Patient/directory reads: actual handlers and service method, synthetic data."""
import ast,json,os,unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Optional,List
from unittest.mock import patch
from fastapi import FastAPI,Query,HTTPException
from fastapi.testclient import TestClient
from api_identity import AccessFailure,UserIdentity,JobIdentity
from api_access_runtime import ClinicalReadBoundary
from api_clinical_read_policy import clinical_read_authorize,read_office_scope,PATIENT_SUMMARY,APPOINTMENT_SUMMARY,DEMOGRAPHICS

OWN='22222222-2222-4222-8222-222222222222';OTHER='33333333-3333-4333-8333-333333333333'
MAP={OWN:'111',OTHER:'222'}
USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',OWN,frozenset({OWN}),False,frozenset({'performance.kpis.main.view'}))


def scope(path=PATIENT_SUMMARY,query='locationId=111',method='GET'):
    return {'path':path,'method':method,'query_string':query.encode()}


class ClinicalPolicyTests(unittest.TestCase):
    def test_actual_child_grants_authorize_aggregate_not_raw_records(self):
        for key in ['performance.kpis.main.view','performance.operations.trends.view','resources.reports.pl_summary.view','performance:office_view','dashboard:executive_overview','performance.operations.marketing.view']:
            actor=replace(USER,permissions=frozenset({key}))
            self.assertTrue(clinical_read_authorize(actor,scope(),MAP),key)
            self.assertFalse(clinical_read_authorize(actor,scope('/v2/patients'),MAP),key)
        self.assertTrue(clinical_read_authorize(USER,scope(APPOINTMENT_SUMMARY),MAP))

    def test_false_grants_override_legacy_fallback(self):
        actor=replace(USER,role='regional_manager',all_offices=True,permissions=frozenset(),disabled_permissions=frozenset({'reports:financial_view','performance:office_view','analytics:financial_view'}))
        self.assertFalse(clinical_read_authorize(actor,scope(query=''),MAP))
        self.assertTrue(clinical_read_authorize(replace(actor,disabled_permissions=frozenset()),scope(query=''),MAP))
        actor=replace(USER,permissions=frozenset({'dashboard:executive_overview'}),disabled_permissions=frozenset({'dashboard:executive_overview'}))
        self.assertFalse(clinical_read_authorize(actor,scope(),MAP))

    def test_financial_parent_needs_existing_child(self):
        actor=replace(USER,permissions=frozenset({'finance.finance.view'}))
        self.assertFalse(clinical_read_authorize(actor,scope(),MAP))
        self.assertTrue(clinical_read_authorize(replace(actor,permissions=actor.permissions|{'finance.finance.analytics.view'}),scope(),MAP))

    def test_demographics_has_exact_services_or_super_admin_consumer(self):
        self.assertFalse(clinical_read_authorize(USER,scope(DEMOGRAPHICS),MAP))
        actor=replace(USER,permissions=frozenset({'performance.operations.services.view'}))
        self.assertTrue(clinical_read_authorize(actor,scope(DEMOGRAPHICS),MAP))
        self.assertFalse(clinical_read_authorize(actor,scope(DEMOGRAPHICS,'locationId=222'),MAP))

    def test_scope_requires_real_filter_and_rejects_aliases_conflicts_duplicates_unknown(self):
        for query in ['', 'office=111','location_id=111','officeId=unknown','locationId=222','officeId='+OTHER,
            'locationId=111&locationId=222','officeId='+OWN+'&locationId=222','locationId=','locationId=111,222']:
            self.assertFalse(clinical_read_authorize(USER,scope(query=query),MAP),query)
        for query in ['locationId=111','officeId='+OWN,'locationId='+OWN,'officeId=111','officeId='+OWN+'&locationId=111']:
            self.assertTrue(clinical_read_authorize(USER,scope(query=query),MAP),query)

    def test_multi_office_lists_are_allowed_only_for_summary_and_assigned_offices(self):
        actor=replace(USER,assigned_offices=frozenset({OWN,OTHER}))
        for path in [PATIENT_SUMMARY,APPOINTMENT_SUMMARY]:
            self.assertTrue(clinical_read_authorize(actor,scope(path,'locationId=111,222'),MAP))
            self.assertTrue(clinical_read_authorize(actor,scope(path,'officeId='+OWN+','+OTHER),MAP))
        self.assertFalse(read_office_scope(actor,scope(query='locationId=111,222'),MAP,multiple=False))

    def test_all_office_scope_keeps_global_but_does_not_accept_unknown_filters(self):
        actor=replace(USER,all_offices=True)
        self.assertTrue(clinical_read_authorize(actor,scope(query=''),MAP))
        self.assertTrue(clinical_read_authorize(actor,scope(query='locationId=222'),MAP))
        self.assertFalse(clinical_read_authorize(actor,scope(query='locationId=unknown'),MAP))

    def test_unfiltered_legacy_details_require_global_admin_or_existing_admin_page(self):
        for path in ['/v2/patients','/v2/appointments','/v2/providers/synthetic/schedule']:
            self.assertFalse(clinical_read_authorize(USER,scope(path),MAP))
            self.assertFalse(clinical_read_authorize(replace(USER,permissions=frozenset({'admin.sync.view'})),scope(path),MAP))
            self.assertTrue(clinical_read_authorize(replace(USER,role='admin',all_offices=True),scope(path),MAP))

    def test_jobs_writes_and_unreviewed_paths_are_not_granted(self):
        actor=replace(USER,role='super_admin',all_offices=True)
        job=JobIdentity('synthetic',frozenset({('GET',PATIENT_SUMMARY)}),frozenset(),True)
        self.assertFalse(clinical_read_authorize(job,scope(),MAP))
        self.assertFalse(clinical_read_authorize(actor,scope(method='POST'),MAP))
        self.assertFalse(clinical_read_authorize(actor,scope('/v2/production/summary'),MAP))


class PatientServiceTests(unittest.TestCase):
    def setUp(self):
        self.cache={};self.fetches=[];self.db=False;self.queries=[]
        self.items=[{'id':'synthetic-foreign','location':{'id':'222'}},{'id':'synthetic-own','location':{'id':111}},
            {'id':'synthetic-missing'},{'id':'synthetic-own-2','location':{'id':'111'}}]
        self.ns={'Optional':Optional,'List':List,'json':json,'_cache_key':lambda *a:a,'_cache_get':self.cache.get,
            '_cache_set':lambda key,value,**kw:self.cache.__setitem__(key,value),'_db_has_data':lambda table:self.db,
            '_db_query':self.query,'_fetch_all_pages':self.fetch}
        tree=ast.parse(Path(os.environ['NDASH_CLINICAL_SERVICE']).read_text())
        for node in ast.walk(tree):
            if isinstance(node,ast.FunctionDef) and node.name in {'get_patients','_map_patient'}:
                exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-patient-service','exec'),self.ns)
        self.service=SimpleNamespace(_map_patient=lambda row:self.ns['_map_patient'](None,row))

    def fetch(self,*args,**kw):self.fetches.append((args,kw));return self.items
    def query(self,sql,params):
        self.queries.append((sql,params));return [{'raw':json.dumps(self.items[1])}]
    def get(self,office='111',limit=100):return self.ns['get_patients'](self.service,'2026-01-01','2026-01-02',office,limit)

    def test_actual_fallback_filters_numeric_string_and_missing_offices(self):
        self.assertEqual([r['id'] for r in self.get()],['synthetic-own','synthetic-own-2'])
        self.assertEqual(self.fetches[0][0],('/v1/patients',))

    def test_filter_runs_before_response_limit_and_cache_contains_only_selected_office(self):
        rows=self.get(limit=1);self.assertEqual([r['id'] for r in rows],['synthetic-own'])
        self.assertEqual(self.get(limit=1),rows);self.assertEqual(len(self.fetches),1)
        self.assertTrue(all(str(r['locationId'])=='111' for r in self.cache[next(iter(self.cache))]))

    def test_all_office_behavior_and_separate_scope_cache_remain(self):
        self.assertEqual(len(self.get(None)),4)
        self.assertEqual(len(self.get('111')),2)
        self.assertEqual([r['id'] for r in self.get('222')],['synthetic-foreign'])
        self.assertEqual(len(self.cache),3)

    def test_sqlite_path_preserves_existing_query_parameters(self):
        self.db=True;rows=self.get(limit=7)
        self.assertEqual(len(rows),1);self.assertFalse(self.fetches)
        self.assertEqual(self.queries[0][1],('2026-01-01','2026-01-02','111'))
        self.assertIn('AND location_id = ?',self.queries[0][0]);self.assertTrue(self.queries[0][0].endswith('LIMIT 7'))


class ClinicalFrameworkTests(unittest.TestCase):
    def setUp(self):
        self.calls=[]
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='admin':return replace(USER,role='admin',all_offices=True,permissions=frozenset())
                if token=='staff':return replace(USER,role='staff',permissions=frozenset())
                raise AccessFailure(401)
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        def read(kind,*args):self.calls.append((kind,args));return {'synthetic':True,'args':args}
        svc=SimpleNamespace(get_patients=lambda *a: [read('patients',*a)],get_offices=lambda:[read('offices')],
            get_providers=lambda:[read('providers')],get_provider_schedule=lambda *a:read('schedule',*a),
            get_patients_summary=lambda *a:read('patient_summary',*a),get_appointments_summary=lambda *a:read('appointment_summary',*a),
            get_appointments=lambda *a:[read('appointments',*a)])
        ns={'Optional':Optional,'Query':Query,'HTTPException':HTTPException,'OFFICE_UUID_TO_LOCATION_ID':MAP,
            'VALID_LOCATION_IDS':set(MAP.values()),'get_service':lambda:svc,'logger':SimpleNamespace(exception=lambda *a:None)}
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text());names={'resolve_location_id','list_offices','list_providers','get_provider_schedule','list_patients','patients_summary','appointments_summary','list_appointments'}
        for node in tree.body:
            if isinstance(node,ast.FunctionDef) and node.name in names:
                node.decorator_list=[];exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-clinical-route','exec'),ns)
        app=FastAPI()
        for name,path in [('list_offices','/v2/offices'),('list_providers','/v2/providers'),('get_provider_schedule','/v2/providers/{provider_id}/schedule'),
            ('list_patients','/v2/patients'),('patients_summary',PATIENT_SUMMARY),('appointments_summary',APPOINTMENT_SUMMARY),('list_appointments','/v2/appointments')]:
            app.add_api_route(path,ns[name],methods=['GET'])
        app.add_middleware(ClinicalReadBoundary,office_to_location=MAP,users=Users())
        self.client=self.enterContext(TestClient(app))

    def call(self,path=PATIENT_SUMMARY,query='locationId=111',token='verified'):
        return self.client.get(path+'?'+query,headers={} if token is None else {'Authorization':'Bearer '+token})

    def test_invalid_missing_and_office_denials_precede_all_service_reads(self):
        for token,code in [(None,401),('invalid',401),('staff',403),('ndjob_'+'a'*43,401)]:
            self.assertEqual(self.call(token=token).status_code,code)
        self.assertEqual(self.call(query='locationId=222').status_code,403)
        self.assertFalse(self.calls)

    def test_actual_summary_handlers_resolve_authorized_numeric_or_uuid_office(self):
        for path in [PATIENT_SUMMARY,APPOINTMENT_SUMMARY]:
            for query in ['officeId='+OWN,'locationId=111','locationId='+OWN]:
                r=self.call(path,query);self.assertEqual(r.status_code,200,r.text)
                self.assertEqual(self.calls[-1][1][-1],'111')

    def test_professional_reference_metadata_retains_active_signed_in_picker_access(self):
        for path in ['/v2/offices','/v2/providers']:
            self.assertEqual(self.call(path,'','staff').status_code,200)
            self.assertEqual(self.call(path,'',None).status_code,401)

    def test_legacy_detail_handlers_remain_available_only_with_reviewed_admin_scope(self):
        for path in ['/v2/patients','/v2/appointments','/v2/providers/synthetic/schedule']:
            self.assertEqual(self.call(path,token='verified').status_code,403)
            r=self.call(path,token='admin');self.assertEqual(r.status_code,200,r.text)

if __name__=='__main__':unittest.main()
