import unittest
from qa_access import ApiAccess, ReviewedRoutes, OFFICE_LOCATIONS

A, B = OFFICE_LOCATIONS


def actor(role='office_manager', offices=(A,), **permissions):
    values = {'workflow.eod.view': True, **permissions}
    return ApiAccess('00000000-0000-4000-8000-000000000001', role, A,
                     tuple(values.items()), frozenset(offices), role == 'super_admin')


class ScopeTests(unittest.TestCase):
    def check(self, query='', who=None, method='GET', path='/v2/daily-entries'):
        scope = {'method': method, 'path': path, 'query_string': query.encode()}
        result = ReviewedRoutes()(who or actor(), scope)
        return result, scope['query_string'].decode()

    def test_missing_scope_is_bound_to_the_only_assigned_office(self):
        allowed, query = self.check('status=pending')
        self.assertTrue(allowed)
        self.assertIn('officeId=' + A, query)
        self.assertIn('status=pending', query)

    def test_other_office_uuid_and_location_alias_are_denied(self):
        for query in ('officeId=' + B, 'locationId=qa-location-b',
                      'officeId=' + A + '&locationId=qa-location-b',
                      'officeId=' + A + '&officeId=' + B):
            with self.subTest(query=query):
                self.assertFalse(self.check(query)[0])

    def test_own_office_and_matching_aliases_are_allowed(self):
        for query in ('officeId=' + A, 'locationId=qa-location-a',
                      'officeId=' + A + '&locationId=qa-location-a'):
            self.assertTrue(self.check(query)[0])

    def test_uuid_in_location_alias_cannot_drop_the_backend_office_filter(self):
        for query in ('locationId=' + A, 'officeId=qa-location-a'):
            allowed, normalized = self.check(query)
            self.assertTrue(allowed)
            self.assertEqual(normalized, 'officeId=' + A)

    def test_unassigned_or_ambiguous_offices_cannot_read_everything(self):
        self.assertFalse(self.check(who=actor(offices=()))[0])
        self.assertFalse(self.check(who=actor(offices=(A, B)))[0])
        self.assertTrue(self.check('officeId=' + B, who=actor(offices=(A, B)))[0])

    def test_blank_unknown_and_duplicate_selectors_fail_closed(self):
        for query in ('officeId=', 'locationId=all', 'officeId=unknown',
                      'officeId=' + A + '&officeId=' + A, 'locationId=qa-location-a%00'):
            self.assertFalse(self.check(query)[0])

    def test_permission_is_required_even_for_an_assigned_office(self):
        self.assertFalse(self.check('officeId=' + A,
            who=actor('staff', **{'workflow.eod.view': False}))[0])

    def test_unreviewed_routes_and_methods_are_denied_even_for_super_admin(self):
        for method, path in (('POST', '/v2/daily-entries'), ('GET', '/v2/daily-entries/'),
                             ('GET', '/amazon/orders/sync'), ('POST', '/mcp'),
                             ('GET', '/v2/payroll/summary'), ('GET', '/docs')):
            self.assertFalse(self.check(who=actor('super_admin'), method=method, path=path)[0])

    def test_global_access_still_rejects_conflicting_and_unknown_offices(self):
        self.assertTrue(self.check(who=actor('super_admin'))[0])
        self.assertTrue(self.check('officeId=' + B, who=actor('super_admin'))[0])
        self.assertFalse(self.check('officeId=' + A + '&locationId=qa-location-b', who=actor('super_admin'))[0])
        self.assertFalse(self.check('officeId=unknown', who=actor('super_admin'))[0])

    def test_explicit_false_overrides_frontend_role_defaults(self):
        self.assertTrue(actor('admin').allows('inventory:view'))
        self.assertFalse(actor('admin', **{'inventory:view': False}).allows('inventory:view'))
        self.assertFalse(actor('admin').allows('dashboard:executive_overview'))
        self.assertFalse(actor('regional_manager', **{'view_reports': False}).allows('view_reports'))


if __name__ == '__main__':
    unittest.main()
