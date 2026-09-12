"""Actual ingestion route with synthetic paginated HTTP responses; no real logs."""
import ast,copy,io,json,os,pathlib,sys,types,unittest
from unittest.mock import patch
source=pathlib.Path(os.environ.get('NDASH_INGEST_SOURCE','/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')).read_text()
fn=copy.deepcopy(next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='eassist_ingest_status'));fn.decorator_list=[]
class HttpFailure(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail
ctx={'json':json,'HTTPException':HttpFailure};exec(compile(ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[])),'actual-ingest-status-route','exec'),ctx)
def run(status=206):
    run_rows=[{'id':'qa-run','run_started_at':'2026-09-11T12:00:00Z','status':'success'}]
    missing=[{'office_canonical':'QA-A','report_date':'2026-09-11','parser_status':'missing'}]
    recent=[{'office_canonical':'QA-A','report_date':'2026-09-11','parser_status':'missing'},{'office_canonical':'QA-B','report_date':'2026-09-11','parser_status':'partial'},{'office_canonical':'QA-A','report_date':'2026-09-10','parser_status':'success'}]
    def get(url,headers,timeout):
        if 'eassist_ingest_log?' in url:rows=run_rows;total=272
        elif 'eassist_daily_reports_staging?' in url:rows=[{'id':'qa-stage'}];total=1 if 'duplicate_status=' in url else 4
        elif 'parser_status=eq.missing' in url:rows=missing;total=1
        else:rows=recent;total=306
        return types.SimpleNamespace(status_code=status,headers={'content-range':f'0-{len(rows)-1}/{total}'},json=lambda:copy.deepcopy(rows))
    with patch.dict(sys.modules,{'requests':types.SimpleNamespace(get=get)}),patch('builtins.open',return_value=io.StringIO(json.dumps({'project_url':'https://qa.invalid','secret_key':'synthetic-only'}))):return ctx['eassist_ingest_status']()
class IngestPaginationTests(unittest.TestCase):
    def test_partial_content_preserves_latest_runs(self):self.assertEqual(len(run()['latestRuns']),1)
    def test_partial_content_preserves_missing_report_coverage(self):self.assertEqual(run()['coverage']['missingCount'],1)
    def test_partial_content_preserves_latest_report_per_office(self):
        reports=run()['latestReportByOffice'];self.assertEqual(len(reports),2);self.assertEqual(reports['QA-A']['report_date'],'2026-09-11')
    def test_complete_responses_are_unchanged(self):
        result=run(200);self.assertEqual(len(result['latestRuns']),1);self.assertEqual(result['coverage']['missingCount'],1);self.assertEqual(len(result['latestReportByOffice']),2)
    def test_staging_counts_and_source_metadata_preserved(self):
        result=run();self.assertEqual(result['staging'],{'stagedCount':4,'conflictCount':1});self.assertEqual(result['_source'],'eassist_email_report');self.assertEqual(result['coverage']['expectedOffices'],['Barnegat','Brick','Eatontown'])
    def test_existing_non_success_fallback_is_not_treated_as_success(self):
        result=run(503);self.assertEqual(result['latestRuns'],[]);self.assertEqual(result['coverage']['missingReports'],[]);self.assertEqual(result['latestReportByOffice'],{})
if __name__=='__main__':unittest.main()
