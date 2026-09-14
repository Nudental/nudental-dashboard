import tempfile
import unittest
from pathlib import Path
from runtime_policy import RuntimePolicy, BoundaryViolation, DISABLED_SUBSYSTEMS


class RuntimePolicyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = dict(NUDASHBOARD_ENV='qa', QA_EXECUTION_MODE='mock',
            QA_SUPABASE_PROJECT_REF='abcdefghijklmnopqrst',
            SUPABASE_URL='https://abcdefghijklmnopqrst.supabase.co',
            QA_API_ORIGIN='https://nudashboard-qa-api.nuholdingllc.com',
            QA_STATE_ROOT=self.temp.name, OTP_FORCE_DRY_RUN='true',
            OTP_EMAIL_DRY_RUN='true', SUPABASE_SERVICE_ROLE_KEY='synthetic-only',
            NUDASHBOARD_API_KEY='synthetic-only')
        self.policy = RuntimePolicy.from_environment(self.env)

    def test_valid_config(self):
        self.assertEqual(self.policy.project_ref, 'abcdefghijklmnopqrst')

    def test_missing_and_production_modes_are_rejected(self):
        for mode in ('', 'production', 'staging', 'QA'):
            with self.subTest(mode=mode), self.assertRaises(BoundaryViolation):
                RuntimePolicy.from_environment({**self.env, 'NUDASHBOARD_ENV': mode})

    def test_live_execution_is_rejected(self):
        for mode in ('', 'live', 'sandbox', 'production'):
            with self.subTest(mode=mode), self.assertRaises(BoundaryViolation):
                RuntimePolicy.from_environment({**self.env, 'QA_EXECUTION_MODE': mode})

    def test_existing_products_cannot_be_reused(self):
        for ref in ('siwtadgdqtvxoztnxzhx', 'loozjtlmpaenwckushwu'):
            with self.subTest(ref=ref), self.assertRaises(BoundaryViolation):
                RuntimePolicy.from_environment({**self.env, 'QA_SUPABASE_PROJECT_REF': ref,
                    'SUPABASE_URL': f'https://{ref}.supabase.co'})

    def test_incomplete_or_mismatched_config(self):
        for key in self.env:
            broken = dict(self.env)
            del broken[key]
            with self.subTest(key=key), self.assertRaises(BoundaryViolation):
                RuntimePolicy.from_environment(broken)
        with self.assertRaises(BoundaryViolation):
            RuntimePolicy.from_environment({**self.env, 'SUPABASE_URL': 'https://zyxwvutsrqponmlkjihgf.supabase.co'})

    def test_background_execution_cannot_be_enabled(self):
        for key in DISABLED_SUBSYSTEMS:
            for value in ('true', '1', 'yes', 'unexpected'):
                with self.subTest(key=key, value=value), self.assertRaises(BoundaryViolation):
                    RuntimePolicy.from_environment({**self.env, key: value})

    def test_otp_never_sends(self):
        for key in ('OTP_FORCE_DRY_RUN', 'OTP_EMAIL_DRY_RUN'):
            with self.subTest(key=key), self.assertRaises(BoundaryViolation):
                RuntimePolicy.from_environment({**self.env, key: 'false'})

    def test_qa_supabase_reads_and_writes_are_allowed(self):
        for path in ('/rest/v1/tasks?select=id', '/auth/v1/user', '/storage/v1/object/qa/file.txt'):
            self.assertTrue(self.policy.allow_url(self.policy.database_origin + path))

    def test_other_projects_and_operational_destinations_are_rejected(self):
        for url in ('https://siwtadgdqtvxoztnxzhx.supabase.co/rest/v1/expenses',
                    'https://loozjtlmpaenwckushwu.supabase.co/rest/v1/tasks',
                    'https://api.nudashboard.com/health', 'https://prod.hs1api.com/ascend-gateway/api',
                    'https://api.gusto.com/v1/payrolls', 'https://production.plaid.com/transactions/sync',
                    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                    'http://127.0.0.1:8001/health', 'http://169.254.169.254/latest/meta-data'):
            with self.subTest(url=url), self.assertRaises(BoundaryViolation):
                self.policy.allow_url(url)

    def test_url_confusion_does_not_bypass_boundary(self):
        host = 'abcdefghijklmnopqrst.supabase.co'
        for url in (f'https://{host}.evil.test/rest/v1/a', f'https://{host}@evil.test/rest/v1/a',
                    f'https://secret@{host}/rest/v1/a', f'http://{host}/rest/v1/a',
                    f'https://{host}:444/rest/v1/a', f'https://{host}/functions/v1/execute',
                    f'https://{host}/rest/v1/a#secret', f'https://{host}/rest/v1/a\n',
                    f'https://{host}/rest/v1/a\\x'):
            with self.subTest(url=url), self.assertRaises(BoundaryViolation):
                self.policy.allow_url(url)

    def test_credentials_never_appear_in_rejections(self):
        value = 'https://private:do-not-display@example.test'
        with self.assertRaises(BoundaryViolation) as error:
            RuntimePolicy.from_environment({**self.env, 'SUPABASE_URL': value})
        self.assertNotIn('do-not-display', str(error.exception))

    def test_writes_cannot_escape_state_directory(self):
        self.assertTrue(self.policy.allow_file(Path(self.temp.name) / 'fixtures.db', writing=True))
        with self.assertRaises(BoundaryViolation):
            self.policy.allow_file(Path(self.temp.name) / '..' / 'other.db', writing=True)

    def test_symlink_writes_cannot_escape(self):
        with tempfile.TemporaryDirectory() as outside:
            link = Path(self.temp.name) / 'escape'
            try:
                link.symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest('Host does not allow symlink creation; Linux runtime verification required')
            with self.assertRaises(BoundaryViolation):
                self.policy.allow_file(link / 'record.db', writing=True)

    def test_process_execution_is_blocked(self):
        for command in (['gog', 'gmail', 'send'], ['/bin/sh', '-c', 'anything'], ['plaid_sync.py']):
            with self.subTest(command=command), self.assertRaises(BoundaryViolation):
                self.policy.allow_process(command)


if __name__ == '__main__':
    unittest.main()
