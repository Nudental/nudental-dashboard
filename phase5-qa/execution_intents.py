"""Durable QA-only operational adapter; records simulations, never invokes a provider.

Application authentication and authorization must occur before this adapter.
Only explicitly registered synthetic fixture IDs can be used. This module is
not a replacement for ordinary writes to the cloned application database.
"""
import hashlib
import json
from pathlib import Path
import sqlite3
from contextlib import contextmanager
from uuid import uuid4
from runtime_policy import BoundaryViolation

OPERATIONS = frozenset({
    'payroll.run', 'compensation.update', 'payment.post', 'claim.submit',
    'insurance.submit', 'schedule.update', 'outreach.send', 'report.deliver',
    'purchase.submit', 'bank.sync',
})


class IntentConflict(ValueError):
    pass


class ExecutionIntents:
    def __init__(self, policy):
        self.policy = policy
        self.path = policy.state_root / 'qa-execution-intents.sqlite3'
        policy.allow_file(self.path, writing=True)
        policy.state_root.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS fixtures (
                    fixture_id TEXT PRIMARY KEY,
                    label TEXT NOT NULL CHECK(label LIKE 'QA / %')
                );
                CREATE TABLE IF NOT EXISTS intents (
                    id TEXT PRIMARY KEY, actor_id TEXT NOT NULL,
                    operation TEXT NOT NULL, fixture_id TEXT NOT NULL REFERENCES fixtures,
                    idempotency_key TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
                    state TEXT NOT NULL CHECK(state IN ('simulated','cancelled')),
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                    UNIQUE(actor_id, idempotency_key)
                );
                CREATE TABLE IF NOT EXISTS intent_audit (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    intent_id TEXT NOT NULL REFERENCES intents,
                    actor_id TEXT NOT NULL, action TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                );
            ''')

    @contextmanager
    def connect(self):
        self.policy.allow_file(self.path, writing=True)
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys = ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def register_fixture(self, fixture_id, label):
        self._identifier(fixture_id)
        if not isinstance(label, str) or not label.startswith('QA / ') or len(label) > 120:
            raise BoundaryViolation('Only labeled synthetic fixtures can be registered')
        with self.connect() as db:
            row = db.execute('SELECT label FROM fixtures WHERE fixture_id=?', (fixture_id,)).fetchone()
            if row and row['label'] != label:
                raise IntentConflict('Fixture label differs from its registered value')
            db.execute('INSERT OR IGNORE INTO fixtures VALUES (?, ?)', (fixture_id, label))

    @staticmethod
    def _identifier(value):
        if not isinstance(value, str) or not value or len(value) > 160:
            raise BoundaryViolation('A bounded QA identifier is required')

    def simulate(self, *, actor_id, operation, fixture_id, idempotency_key, payload):
        for value in (actor_id, fixture_id, idempotency_key):
            self._identifier(value)
        if operation not in OPERATIONS:
            raise BoundaryViolation('This operation has no reviewed QA adapter')
        if not isinstance(payload, dict) or payload.get('qa_fixture') is not True:
            raise BoundaryViolation('An explicitly synthetic payload is required')
        raw = json.dumps(payload, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
        if len(raw) > 16384:
            raise BoundaryViolation('QA payload is too large')
        digest = hashlib.sha256(raw).hexdigest()
        # Persist only the payload hash: no message body, credential or account data.
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT 1 FROM fixtures WHERE fixture_id=?', (fixture_id,)).fetchone():
                raise BoundaryViolation('Unregistered records cannot reach a QA adapter')
            prior = db.execute('SELECT * FROM intents WHERE actor_id=? AND idempotency_key=?',
                               (actor_id, idempotency_key)).fetchone()
            if prior:
                if (prior['operation'], prior['fixture_id'], prior['payload_sha256']) != (operation, fixture_id, digest):
                    raise IntentConflict('Idempotency key was already used for different input')
                return {**dict(prior), 'duplicate': True, 'external_action_performed': False}
            intent_id = str(uuid4())
            db.execute('INSERT INTO intents(id,actor_id,operation,fixture_id,idempotency_key,payload_sha256,state) '
                       "VALUES (?,?,?,?,?,?,'simulated')", (intent_id, actor_id, operation, fixture_id, idempotency_key, digest))
            db.execute("INSERT INTO intent_audit(intent_id,actor_id,action) VALUES (?,?,'simulated')", (intent_id, actor_id))
            row = db.execute('SELECT * FROM intents WHERE id=?', (intent_id,)).fetchone()
            return {**dict(row), 'duplicate': False, 'external_action_performed': False}

    def read(self, *, actor_id, intent_id):
        with self.connect() as db:
            row = db.execute('SELECT * FROM intents WHERE id=? AND actor_id=?', (intent_id, actor_id)).fetchone()
            if not row:
                raise BoundaryViolation('QA intent is unavailable to this actor')
            return dict(row)

    def cancel(self, *, actor_id, intent_id):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT state FROM intents WHERE id=? AND actor_id=?', (intent_id, actor_id)).fetchone()
            if not row:
                raise BoundaryViolation('QA intent is unavailable to this actor')
            if row['state'] != 'cancelled':
                db.execute("UPDATE intents SET state='cancelled' WHERE id=?", (intent_id,))
                db.execute("INSERT INTO intent_audit(intent_id,actor_id,action) VALUES (?,?,'cancelled')", (intent_id, actor_id))
        return self.read(actor_id=actor_id, intent_id=intent_id)

    def history(self, *, actor_id, intent_id):
        self.read(actor_id=actor_id, intent_id=intent_id)
        with self.connect() as db:
            return [dict(r) for r in db.execute('SELECT action,created_at FROM intent_audit WHERE intent_id=? ORDER BY sequence', (intent_id,))]
