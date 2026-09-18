from dataclasses import replace
from types import SimpleNamespace
import unittest
from api_identity import AccessFailure, UserIdentity, JobIdentity
from api_compensation_policy import *

USER = UserIdentity('11111111-1111-4111-8111-111111111111', 'super_admin', None,
    frozenset(), True, frozenset(), 'verified@example.invalid')
ALLOWED = frozenset({'verified@example.invalid'})


class CompensationPolicyTests(unittest.TestCase):
    def test_existing_allowlist_uses_verified_account(self):
        self.assertTrue(has_compensation_access(USER, ALLOWED))
        self.assertTrue(has_compensation_access(replace(USER,email=' VERIFIED@EXAMPLE.INVALID '), ALLOWED))
        self.assertFalse(has_compensation_access(replace(USER,email='other@example.invalid'), ALLOWED))
        self.assertFalse(has_compensation_access(replace(USER,email=''), ALLOWED))

    def test_view_permission_and_global_report_scope_both_required(self):
        for role in ['admin','regional_manager','office_manager','staff','insurance_verifier']:
            actor=replace(USER,role=role)
            self.assertFalse(has_compensation_access(actor, ALLOWED))
            actor=replace(actor,permissions=frozenset({COMPENSATION_PERMISSION}))
            self.assertTrue(has_compensation_access(actor, ALLOWED))
            self.assertFalse(has_compensation_access(replace(actor,all_offices=False), ALLOWED))

    def test_access_check_reports_only_own_current_permission(self):
        actor=replace(USER,role='staff')
        self.assertTrue(compensation_authorize(actor,{'path':ACCESS_PATH,'method':'GET'},ALLOWED))
        self.assertFalse(has_compensation_access(actor,ALLOWED))

    def test_job_and_unknown_identity_denied(self):
        for actor in [None, JobIdentity('validator',frozenset(),frozenset(),True)]:
            for path,method in [(ACCESS_PATH,'GET'),(REPORT_PATH,'GET'),(SEND_PATH,'POST')]:
                self.assertFalse(compensation_authorize(actor,{'path':path,'method':method},ALLOWED))

    def test_method_and_path_exact(self):
        for path,method in [(ACCESS_PATH,'POST'),(REPORT_PATH,'POST'),(SEND_PATH,'GET'),('/health','GET')]:
            self.assertFalse(compensation_authorize(USER,{'path':path,'method':method},ALLOWED))

    def test_handler_defence_requires_boundary_actor(self):
        request=SimpleNamespace(state=SimpleNamespace(),scope={'path':REPORT_PATH,'method':'GET'})
        with self.assertRaises(AccessFailure):verified_compensation_actor(request,ALLOWED)

if __name__=='__main__':unittest.main()
