"""Real protected route, synthetic calculation only; no provider or payroll write."""
from unittest.mock import patch
from test_api_compensation_framework import CompensationFrameworkTests
from api_compensation_policy import REPORT_PATH
from compensation_runtime import JOBS

class LedgerEndpointTests(CompensationFrameworkTests):
    def setUp(self):
        super().setUp()
        for route in self.client.app.routes:
            if getattr(route,'path',None)==REPORT_PATH:
                route.endpoint.__globals__['_sb_get_full']=lambda *a,**k:self.fail('Snapshot read must not refetch Gusto or call providers')
        self.params.update(format='ledger-json',runId='synthetic-run',calculationSnapshot='synthetic-snapshot')
        self.result={'gusto':{'run_id':'synthetic-run'},'applied_window':['2099-01-01','2099-01-01'],
                     'doctors':[{'provider_id':'synthetic'}],'source_snapshot':{'complete':True}}
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

# Inherited tests have different setup requirements and run in their original
# retained suite. Remove them only from this derived fixture's discovery.
for name in CompensationFrameworkTests.__dict__:
    if name.startswith('test_') and name not in LedgerEndpointTests.__dict__:
        setattr(LedgerEndpointTests,name,None)

del CompensationFrameworkTests
