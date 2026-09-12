"""Exercise the actual report route with synthetic HTTP/config fixtures only."""
import ast,copy,io,json,os,pathlib,sys,types,unittest,urllib.parse
from unittest.mock import patch
source=pathlib.Path(os.environ.get('NDASH_EASSIST_SOURCE','/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')).read_text()
fn=copy.deepcopy(next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='eassist_daily_reports'));fn.decorator_list=[];fn.returns=None
for a in fn.args.args:a.annotation=None
fn.args.defaults=[ast.Constant(None) for _ in fn.args.defaults]
class HttpFailure(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail
ctx={'json':json,'HTTPException':HttpFailure};exec(compile(ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[])),'actual-eassist-route','exec'),ctx)
fixtures=[{'id':'qa-1','report_date':'2026-08-31','parser_status':'success','parser_confidence':1,'office_canonical':'QA','validation_status':'pending','daily_production':123.45},{'id':'qa-2','report_date':'2026-08-30','parser_status':'partial','parser_confidence':.5,'office_canonical':'QA','validation_status':'pending'},{'id':'qa-3','report_date':'2026-08-29','parser_status':'missing','parser_confidence':None,'office_canonical':'QA','validation_status':'pending'},{'id':'qa-4','report_date':'2026-08-28','parser_status':'success','parser_confidence':0,'office_canonical':'QA','validation_status':'pending'}]
def run(data=None,page=1,size=2,fail_summary=False,**filters):
    data=copy.deepcopy(fixtures if data is None else data);calls=[]
    def get(url,headers,timeout):
        q=urllib.parse.parse_qs(urllib.parse.urlsplit(url).query);calls.append(q);summary=q.get('select')!=['*']
        if summary and fail_summary:return types.SimpleNamespace(status_code=503,text='Synthetic unavailable',headers={},json=lambda:[])
        start=int(q.get('offset',['0'])[0]);limit=int(q.get('limit',['500'])[0]);rows=data[start:start+limit]
        if summary:
            assert q['select']==['parser_status,parser_confidence,report_date'];rows=[{k:r.get(k) for k in q['select'][0].split(',')} for r in rows]
        return types.SimpleNamespace(status_code=200,text='',headers={'content-range':f'{start}-{start+len(rows)-1}/{len(data)}'},json=lambda:copy.deepcopy(rows))
    fake=types.SimpleNamespace(get=get)
    with patch.dict(sys.modules,{'requests':fake}),patch('builtins.open',return_value=io.StringIO(json.dumps({'project_url':'https://qa.invalid','secret_key':'synthetic-only'}))):
        result=ctx['eassist_daily_reports'](page=page,pageSize=size,**filters)
    return result,calls
class SummaryTests(unittest.TestCase):
    def test_status_counts_cover_full_filtered_scope(self):
        result,_=run();self.assertEqual([result['summary'].get(k) for k in ['success_count','partial_count','missing_count']],[2,1,1])
    def test_latest_date_does_not_change_on_later_page(self):
        first,_=run();last,_=run(page=2);self.assertEqual(first['summary'].get('latest_report_date'),'2026-08-31');self.assertEqual(last['summary'].get('latest_report_date'),'2026-08-31')
    def test_confidence_averages_valid_full_scope_values_including_zero(self):
        data=fixtures+[dict(fixtures[0],parser_confidence='not-a-number'),dict(fixtures[0],parser_confidence=float('inf'))];result,_=run(data);self.assertAlmostEqual(result['summary'].get('avg_confidence',-1),.5)
    def test_summary_preserves_all_existing_filter_constraints(self):
        _,calls=run(startDate='2026-08-01',endDate='2026-08-31',office='QA',parseStatus='missing',validationStatus='pending');summaries=[c for c in calls if c.get('select')!=['*']];self.assertTrue(summaries)
        for q in summaries:
            self.assertEqual(q['report_date'],['gte.2026-08-01','lte.2026-08-31']);self.assertEqual(q['office_canonical'],['eq.QA']);self.assertEqual(q['parser_status'],['eq.missing']);self.assertEqual(q['validation_status'],['eq.pending'])
    def test_summary_crosses_projection_page_boundary(self):
        data=[dict(fixtures[0],id=f'qa-{i}') for i in range(501)];result,calls=run(data);self.assertEqual(result['summary'].get('success_count'),501);self.assertEqual(len([c for c in calls if c.get('select')!=['*']]),2)
    def test_page_rows_metadata_and_totals_preserved(self):
        result,_=run(page=2);self.assertEqual(result['data'],fixtures[2:]);self.assertEqual(result['summary']['returned'],2);self.assertEqual(result['summary']['total'],4);self.assertEqual(result['pagination'],{'page':2,'pageSize':2,'total':4});self.assertEqual(result['_source'],'eassist_email_report')
    def test_summary_failure_is_not_reported_as_a_partial_success(self):
        with self.assertRaises(HttpFailure) as error:run(fail_summary=True)
        self.assertEqual(error.exception.status_code,502)
if __name__=='__main__':unittest.main()
