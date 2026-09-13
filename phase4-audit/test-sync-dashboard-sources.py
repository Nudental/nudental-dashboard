"""Execute only the actual Sync route with synthetic source/config fixtures."""
import ast,copy,datetime,json,os,pathlib,sys,types,unittest
from unittest.mock import patch
source=pathlib.Path(os.environ.get('NDASH_SYNC_SOURCE','/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')).read_text(encoding='utf-8')
fn=copy.deepcopy(next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='admin_sync_dashboard'));fn.decorator_list=[]
class HttpFailure(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail
ctx={'HTTPException':HttpFailure,'datetime':datetime.datetime,'timezone':datetime.timezone,'_load_supabase_config':lambda:{'project_url':'https://qa.invalid','secret_key':'synthetic-only'},'_sb_get_full':lambda path:[],'logger':types.SimpleNamespace(error=lambda *a:None)}
exec(compile(ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[])),'actual-sync-route','exec'),ctx)
def fixtures():
    states=[('success','fresh'),('failed','stale'),('running','running'),('not_instrumented','not_applicable'),('manual_only','not_applicable'),('awaiting_first_run','unknown'),('warning','approaching')]
    return [{'job_key':'qa-'+str(i),'job_name':'QA '+str(i),'source_system':'qa','job_trigger_type':'manual' if i==4 else 'scheduled','is_manual_only':i==4,'last_status':None if i in (3,4,5) else status,'effective_status':status,'freshness_status':freshness,'last_started_at':None if i in (3,4,5) else '2026-09-12T00:00:00Z','last_completed_at':'2026-09-12T00:00:03Z' if i in (0,1,6) else None,'last_duration_ms':3000 if i in (0,1,6) else None,'last_rows_read':12 if i==0 else None,'last_rows_inserted':7 if i==0 else None,'last_rows_updated':5 if i==0 else None,'last_rows_failed':0 if i==0 else None,'detail_log_table':'qa_log' if i==0 else None,'notes':'Synthetic QA notes'} for i,(status,freshness) in enumerate(states)]
def run(rows=None,status=206,total=None,registry_failure=False,invalid=False):
    rows=fixtures() if rows is None else rows;calls=[]
    def get(url,params,headers,timeout):
        calls.append((url,params,headers,timeout));is_jobs=url.endswith('/sync_job_latest');data=rows if is_jobs else [{'endpoint_key':'qa-endpoint','health_status':'healthy','notes':'Synthetic notes'}]
        code=503 if registry_failure and not is_jobs else status
        count=len(data) if total is None or not is_jobs else total
        return types.SimpleNamespace(status_code=code,headers={'content-range':'0-6/'+str(count)},json=lambda:{'invalid':True} if invalid else copy.deepcopy(data))
    with patch.dict(sys.modules,{'requests':types.SimpleNamespace(get=get)}):return ctx['admin_sync_dashboard'](),calls
class SyncSourcesTests(unittest.TestCase):
    def test_latest_view_restores_all_configured_jobs(self):self.assertEqual(len(run()[0]['jobs']),7)
    def test_only_current_status_sources_read(self):
        _,calls=run();self.assertEqual([c[0].rsplit('/',1)[-1] for c in calls],['sync_job_latest','api_endpoint_registry']);self.assertTrue(all(c[1]['limit']==500 and c[2]['Prefer']=='count=exact' and c[3]==20 for c in calls))
    def test_source_freshness_and_statuses_preserved(self):self.assertEqual([(j['status'],j['freshness_status']) for j in run()[0]['jobs']],[(j['effective_status'],j['freshness_status']) for j in fixtures()])
    def test_uninstrumented_and_warning_not_counted_as_failed(self):
        s=run()[0]['summary'];self.assertEqual((s['jobs_failed'],s['jobs_not_instrumented'],s['jobs_awaiting_first_run'],s['jobs_manual_only'],s['jobs_running'],s['jobs_healthy'],s['jobs_stale']),(1,1,1,1,1,1,1))
    def test_real_duration_counts_and_log_source_adapted(self):
        j=run()[0]['jobs'][0];self.assertEqual((j['duration_ms'],j['avg_duration_ms'],j['rows_processed'],j['rows_inserted'],j['rows_updated'],j['log_source']),(3000,3000,12,7,5,'qa_log'))
    def test_unknown_values_are_not_fabricated(self):
        j=run()[0]['jobs'][3];self.assertIsNone(j['rows_processed']);self.assertIsNone(j['last_success_at']);self.assertIsNone(j['last_failure_at']);self.assertIsNone(j['avg_duration_ms'])
    def test_success_and_failure_dates_only_for_matching_last_status(self):
        jobs=run()[0]['jobs'];self.assertIsNotNone(jobs[0]['last_success_at']);self.assertIsNotNone(jobs[1]['last_failure_at']);self.assertIsNone(jobs[6]['last_failure_at'])
    def test_registry_restored_and_legacy_envelope_preserved(self):
        data,_=run();self.assertEqual(len(data['api_endpoint_health']),1);self.assertEqual(data['legacy_sync_logs'],[])
    def test_200_and_206_supported(self):self.assertEqual(run(status=200)[0]['summary'],run(status=206)[0]['summary'])
    def test_empty_view_is_honestly_empty(self):
        data,_=run(rows=[]);self.assertEqual(data['summary']['jobs_total'],0);self.assertIsNone(data['summary']['last_successful_run'])
    def test_truncation_fails_closed(self):
        with self.assertRaises(HttpFailure) as e:run(total=600)
        self.assertEqual(e.exception.status_code,502)
    def test_missing_exact_count_fails_closed(self):
        with self.assertRaises(HttpFailure):run(total='*')
    def test_duplicate_job_keys_fail_closed(self):
        rows=fixtures();rows[1]['job_key']=rows[0]['job_key']
        with self.assertRaises(HttpFailure):run(rows=rows)
    def test_source_error_does_not_become_empty_success(self):
        for kwargs in [{'status':503},{'registry_failure':True},{'invalid':True}]:
            with self.subTest(kwargs=kwargs),self.assertRaises(HttpFailure) as e:run(**kwargs)
            self.assertEqual(e.exception.status_code,502)
if __name__=='__main__':unittest.main()
