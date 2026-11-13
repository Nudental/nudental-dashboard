from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from refresh_doctor_reports import run_due

class RefreshCadenceTests(unittest.TestCase):
    def test_only_due_periods_run_and_failure_does_not_block_later_periods(self):
        now=datetime(2026,11,13,14,tzinfo=timezone.utc)
        store=Mock()
        store.saved_periods.return_value=[('2026-11-13','a','b'),('2026-10-30','c','d'),('2026-10-16','e','f')]
        store.saved_report.side_effect=[{'saved_at':(now-timedelta(hours=h)).isoformat()} for h in (71,72,80)]
        request=Mock(side_effect=['job1','job2'])
        result=Mock(side_effect=[RuntimeError('read failed'),{'source_snapshot':{'complete':True},'doctors':[]}])
        with self.assertLogs(level='ERROR'):
            self.assertEqual(run_due(store,request,result,now),1)
        self.assertEqual(request.call_count,2)
        self.assertEqual(result.call_count,2)

