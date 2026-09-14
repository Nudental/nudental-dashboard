import json
from pathlib import Path
import unittest


class SyntheticRoleFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = json.loads((Path(__file__).parent / 'synthetic-role-fixtures.json').read_text(encoding='utf8'))

    def test_only_supported_roles(self):
        self.assertEqual({a['role'] for a in self.fixtures['actors']},
            {'staff','admin','super_admin','office_manager','regional_clinical_manager',
             'regional_manager','insurance_verifier','marketing'})

    def test_identities_are_labeled_and_non_deliverable(self):
        for actor in self.fixtures['actors']:
            self.assertTrue(actor['full_name'].startswith('QA / '))
            self.assertTrue(actor['email'].startswith('qa-'))
            self.assertTrue(actor['email'].endswith('@nudashboard.example.test'))
            self.assertNotIn('password', actor)
            self.assertNotIn('access_token', actor)
        self.assertEqual(len({a['email'] for a in self.fixtures['actors']}), 12)

    def test_office_boundary_has_two_distinct_managers_and_staff(self):
        actors = {a['fixture_key']: a for a in self.fixtures['actors']}
        for role in ('office_manager','staff'):
            self.assertNotEqual(actors[role]['office_id'], actors[role+'_b']['office_id'])
            self.assertFalse(actors[role]['all_offices'])
            self.assertFalse(actors[role+'_b']['all_offices'])

    def test_profile_gate_has_disabled_and_unapproved_cases(self):
        actors = {a['fixture_key']: a for a in self.fixtures['actors']}
        self.assertFalse(actors['inactive_staff']['is_active'])
        self.assertFalse(actors['unapproved_staff']['is_approved'])

    def test_provider_data_is_synthetic_without_fake_provider_login_role(self):
        for provider in self.fixtures['providers']:
            self.assertEqual(provider['provider_type'], 'doctor')
            self.assertTrue(provider['name'].startswith('QA / '))
            self.assertNotIn('npi', provider)
            self.assertNotIn('license_number', provider)

    def test_permission_seed_is_complete_unique_configuration(self):
        rows = self.fixtures['role_permissions']
        roles = {a['role'] for a in self.fixtures['actors']}
        self.assertEqual(len(rows), 8*138)
        self.assertEqual(len({(p['role'],p['permission']) for p in rows}), len(rows))
        self.assertTrue(all(p['role'] in roles and isinstance(p['enabled'], bool) for p in rows))

    def test_fixture_preparation_does_not_claim_live_provisioning(self):
        self.assertFalse(self.fixtures['provisioned'])


if __name__ == '__main__':
    unittest.main()
