"""Real protected route, synthetic calculation only; no provider or payroll write."""
from unittest.mock import patch
from test_api_compensation_framework import CompensationFrameworkTests
from api_compensation_policy import REPORT_PATH
from compensation_runtime import JOBS,calculate_snapshot,POLICIES,OFFICES
from compensation_policy import initial_document,digest

class LedgerEndpointTests(CompensationFrameworkTests):
    def setUp(self):
        super().setUp()
        for route in self.client.app.routes:
            if getattr(route,'path',None)==REPORT_PATH:
                route.endpoint.__globals__['_sb_get_full']=lambda *a,**k:self.fail('Snapshot read must not refetch Gusto or call providers')
        self.params.update(format='ledger-json',runId='synthetic-run',calculationSnapshot='synthetic-snapshot')
        doc=initial_document(POLICIES,OFFICES);doc.update(recorded_at='2099-01-08T12:00:00Z',recorded_by='qa')
        self.policy={'version':digest(doc),'document':doc}
        source={'records':{},'charges':{},'categories':{},'snapshot':{'complete':True,'sha256':'synthetic','applied_scope':['2099-01-01','2099-01-01'],'read_as_of':'2099-01-08T12:00:00Z','retrieved_at':'2099-01-08T12:00:01Z'}}
        self.result=calculate_snapshot(source,'2099-01-01','2099-01-01',{'run_id':'synthetic-run','payday':'2099-01-08'},configuration=self.policy)
        self.params.pop('providerId',None)
    # Only the modern-mode tests below use this fixture; the retained parent
    # class remains responsible for legacy and pre-gate regression checks.
    def test_modern_mode_rejects_missing_invalid_and_scoped_job_identity(self):
        with patch.object(JOBS,'result') as read:
            for token in [None,'invalid','ndjob_'+'a'*43]:self.assertEqual(self.call(token=token).status_code,401)
            read.assert_not_called()
    def test_modern_mode_rejects_unlisted_staff_and_partial_office_access(self):
        with patch.object(JOBS,'result') as read:
            for token in ['unlisted','staff','office']:self.assertEqual(self.call(token=token).status_code,403)
            read.assert_not_called()
    def test_modern_mode_uses_verified_actor_and_no_store(self):
        with patch.object(JOBS,'result',return_value=self.result) as read:
            response=self.call(token='verified')
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.headers['cache-control'],'private, no-store')
            self.assertEqual(read.call_args.args[0],'synthetic-snapshot')
            self.assertNotEqual(read.call_args.args[1],self.params['userEmail'])
    def test_expired_or_other_actor_snapshot_is_not_recalculated(self):
        with patch.object(JOBS,'result',side_effect=KeyError()):self.assertEqual(self.call(token='verified').status_code,410)
    def test_snapshot_cannot_be_substituted_for_another_run(self):
        with patch.object(JOBS,'result',return_value=self.result):
            response=self.call(token='verified',params={**self.params,'runId':'another-run'})
            self.assertEqual(response.status_code,422)
    def test_pending_snapshot_does_not_return_previous_values(self):
        with patch.object(JOBS,'result',return_value=None):
            response=self.call(token='verified');self.assertEqual(response.status_code,202)
            self.assertNotIn('doctors',response.json())
    def test_policy_format_preserves_human_and_all_office_boundary(self):
        with patch('compensation_endpoint.load_policy',return_value=self.policy) as read:
            params={**self.params,'format':'ledger-policy'}
            for token,status in [(None,401),('invalid',401),('staff',403),('office',403)]:
                self.assertEqual(self.call(token=token,params=params).status_code,status)
            read.assert_not_called()
            response=self.call(token='verified',params=params)
            self.assertEqual(response.status_code,200);self.assertEqual(response.json()['version'],self.policy['version'])
    def test_history_is_scoped_to_authenticated_actor_and_period(self):
        with patch.object(JOBS.store,'history',return_value={'calculations':[]}) as read:
            params={**self.params,'format':'ledger-history'}
            for token in ['office','unlisted']:self.assertEqual(self.call(token=token,params=params).status_code,403)
            read.assert_not_called()
            self.assertEqual(self.call(token='verified',params=params).status_code,200)
            self.assertNotEqual(read.call_args.args[0],self.params['userEmail'])
            self.assertEqual(read.call_args.args[1:],('synthetic-run','2099-01-01','2099-01-01'))
    def test_inconsistent_saved_calculation_is_withheld(self):
        self.result['doctors'][0]['estimate_cents']=1
        with patch.object(JOBS,'result',return_value=self.result):self.assertEqual(self.call(token='verified').status_code,422)

# Inherited tests have different setup requirements and run in their original
# retained suite. Remove them only from this derived fixture's discovery.
for name in CompensationFrameworkTests.__dict__:
    if name.startswith('test_') and name not in LedgerEndpointTests.__dict__:
        setattr(LedgerEndpointTests,name,None)

del CompensationFrameworkTests
