"""Refresh saved doctor reports that are at least 72 hours old. Run on the payroll host."""
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

INTERVAL = timedelta(days=3)


def run_due(store, request_report, get_result, now):
    failed = 0
    for payday, start, end in store.saved_periods():
        period = 'compensation-' + payday
        try:
            saved = store.saved_report(period, start, end)
            if saved is None or now - datetime.fromisoformat(saved['saved_at']) < INTERVAL:
                continue
            job = request_report(period, start, end)
            result = get_result(job)
            if not result or not result['source_snapshot'].get('complete'):
                raise ValueError('Incomplete refresh')
            logging.info('Refreshed payday %s, %d doctor rows', payday, len(result['doctors']))
        except Exception as error:
            # Each period can retry independently. Do not log source records.
            logging.error('Payday %s refresh failed (%s); previous calculation retained', payday, type(error).__name__)
            failed += 1
    return failed


if __name__ == '__main__':
    from time import sleep
    middleware = Path.home() / '.openclaw/workspace/ascend_api/middleware'
    sys.path.insert(0, str(middleware))
    os.chdir(middleware)
    from compensation_runtime import JOBS, request_calculation
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    actor = SimpleNamespace(id='scheduled-doctor-report-refresh')
    def request(period, start, end):
        return request_calculation(actor, None, start, end, period, uuid4().hex)
    def wait_for_result(key):
        while True:
            result = JOBS.result(key, actor.id)
            if result is not None:
                return result
            sleep(2)
    sys.exit(bool(run_due(JOBS.store, request, wait_for_result, datetime.now(timezone.utc))))

