import concurrent.futures
import tempfile
import unittest
from pathlib import Path
from execution_intents import ExecutionIntents, IntentConflict, OPERATIONS
from runtime_policy import RuntimePolicy, BoundaryViolation


class ExecutionIntentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.policy = RuntimePolicy('abcdefghijklmnopqrst', 'https://abcdefghijklmnopqrst.supabase.co', Path(self.tmp.name))
        self.store = ExecutionIntents(self.policy)
        self.store.register_fixture('qa-fixture-1', 'QA / Disposable operational fixture')
        self.arguments = dict(actor_id='qa-actor-1', operation='claim.submit', fixture_id='qa-fixture-1',
                              idempotency_key='test-key-1', payload={'qa_fixture': True, 'amount': 123})

    def test_each_sensitive_adapter_is_simulation_only(self):
        for op in OPERATIONS:
            with self.subTest(operation=op):
                row = self.store.simulate(**{**self.arguments, 'operation': op, 'idempotency_key': op})
                self.assertEqual(row['state'], 'simulated')
                self.assertFalse(row['external_action_performed'])

    def test_persists_after_store_is_reopened(self):
        row = self.store.simulate(**self.arguments)
        fresh = ExecutionIntents(self.policy)
        read = fresh.read(actor_id='qa-actor-1', intent_id=row['id'])
        self.assertEqual(read['payload_sha256'], row['payload_sha256'])
        self.assertEqual(read['state'], 'simulated')

    def test_retry_does_not_duplicate_execution_or_audit(self):
        first = self.store.simulate(**self.arguments)
        second = self.store.simulate(**self.arguments)
        self.assertEqual(first['id'], second['id'])
        self.assertTrue(second['duplicate'])
        self.assertEqual(len(self.store.history(actor_id='qa-actor-1', intent_id=first['id'])), 1)

    def test_concurrent_retries_create_one_intent(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            rows = list(pool.map(lambda _: self.store.simulate(**self.arguments), range(12)))
        self.assertEqual(len({r['id'] for r in rows}), 1)
        self.assertEqual(sum(not r['duplicate'] for r in rows), 1)

    def test_key_reuse_with_different_input_is_rejected(self):
        self.store.simulate(**self.arguments)
        for change in ({'operation': 'payroll.run'}, {'payload': {'qa_fixture': True, 'amount': 999}}):
            with self.subTest(change=change), self.assertRaises(IntentConflict):
                self.store.simulate(**{**self.arguments, **change})

    def test_unknown_records_and_operations_are_rejected(self):
        for change in ({'fixture_id': 'not-registered'}, {'operation': 'unknown'}, {'payload': {'amount': 123}}):
            with self.subTest(change=change), self.assertRaises(BoundaryViolation):
                self.store.simulate(**{**self.arguments, **change})

    def test_registry_requires_clear_qa_label(self):
        with self.assertRaises(BoundaryViolation):
            self.store.register_fixture('another', 'Unlabeled record')

    def test_idempotency_keys_are_separate_for_distinct_actors(self):
        first = self.store.simulate(**self.arguments)
        second = self.store.simulate(**{**self.arguments, 'actor_id': 'qa-actor-2'})
        self.assertNotEqual(first['id'], second['id'])

    def test_cross_actor_read_cancel_and_history_are_rejected(self):
        row = self.store.simulate(**self.arguments)
        for method in (self.store.read, self.store.cancel, self.store.history):
            with self.subTest(method=method.__name__), self.assertRaises(BoundaryViolation):
                method(actor_id='qa-actor-2', intent_id=row['id'])

    def test_cancel_is_persistent_and_idempotent(self):
        row = self.store.simulate(**self.arguments)
        for _ in range(2):
            self.assertEqual(self.store.cancel(actor_id='qa-actor-1', intent_id=row['id'])['state'], 'cancelled')
        self.assertEqual([r['action'] for r in self.store.history(actor_id='qa-actor-1', intent_id=row['id'])], ['simulated', 'cancelled'])
        retry = self.store.simulate(**self.arguments)
        self.assertEqual(retry['state'], 'cancelled')
        self.assertEqual(retry['id'], row['id'])

    def test_payload_is_not_persisted(self):
        marker = 'synthetic-body-must-not-be-stored'
        self.store.simulate(**{**self.arguments, 'payload': {'qa_fixture': True, 'body': marker}})
        self.assertNotIn(marker.encode(), self.store.path.read_bytes())

    def test_cancel_does_not_delete_audit_history(self):
        row = self.store.simulate(**self.arguments)
        self.store.cancel(actor_id='qa-actor-1', intent_id=row['id'])
        fresh = ExecutionIntents(self.policy)
        self.assertEqual(len(fresh.history(actor_id='qa-actor-1', intent_id=row['id'])), 2)


if __name__ == '__main__':
    unittest.main()
