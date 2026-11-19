import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
from insurance_review_notices import deliver_review, next_delivery, run_reviews


def date(value):
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


class ReviewNotices(unittest.TestCase):
    def setUp(self):
        self.now = date('2026-11-19T15:00:00')
        self.row = dict(id='review-example', recipient='frontdesk@example.com', draft_id=None)
        self.target = dict(email=self.row['recipient'], office_name='Brick', request_id='00000000-0000-0000-0000-000000000001')
        self.destination = Mock(return_value=self.target)
        self.save = Mock()
        self.mail = Mock(side_effect=[{'draftId': 'draft_1'}, {'messageId': 'message_1'}])

    def deliver(self, clock=None):
        return deliver_review(self.row, self.destination, self.save, self.mail, clock or (lambda: self.now))

    def test_eastern_window_and_dst(self):
        for before, expected in [
            ('2026-11-19T13:44:59','2026-11-19T13:45:00'),
            ('2026-11-19T13:45:00','2026-11-19T13:45:00'),
            ('2026-11-20T01:59:59','2026-11-20T01:59:59'),
            ('2026-11-20T02:00:00','2026-11-20T13:45:00'),
            ('2026-07-19T12:44:59','2026-07-19T12:45:00'),
            ('2026-07-20T01:00:00','2026-07-20T12:45:00'),
            ('2026-11-01T01:00:00','2026-11-01T13:45:00'),
            ('2026-03-08T02:00:00','2026-03-08T12:45:00'),
        ]:
            with self.subTest(before=before):
                self.assertEqual(next_delivery(date(before)),date(expected))

    def test_after_hours_does_not_touch_gmail(self):
        self.now=date('2026-11-19T10:00:00')
        self.assertEqual(self.deliver(),'held')
        self.mail.assert_not_called()
        self.assertIn('retry_at',self.save.call_args.args[0])

    def test_save_before_send_and_safe_content(self):
        def mail(*args):
            if args[:2]==('drafts','create'):
                self.assertEqual(args[3],self.row['recipient'])
                self.assertIn('?request='+self.target['request_id'],args[-1])
                self.assertIn('Brick',args[-1])
                return {'draftId':'draft_1'}
            self.assertEqual(self.save.call_args.args[0],{'draft_id':'draft_1'})
            return {'messageId':'message_1'}
        self.mail=Mock(side_effect=mail)
        self.assertEqual(self.deliver(),'sent')
        self.assertEqual(self.destination.call_count,2)
        self.assertIn('sent_at',self.save.call_args.args[0])

    def test_resolved_or_removed_recipient_is_cancelled(self):
        for target in [None,{**self.target,'email':'another@example.com'}]:
            self.destination.return_value=target
            self.assertEqual(self.deliver(),'cancelled')
        self.mail.assert_not_called()

    def test_resolution_between_draft_and_send(self):
        self.destination.side_effect=[self.target,None]
        self.assertEqual(self.deliver(),'cancelled')
        self.assertEqual(self.mail.call_count,1)

    def test_9pm_boundary_after_draft(self):
        times=iter([date('2026-11-20T01:59:59'),date('2026-11-20T02:00:00')])
        self.assertEqual(self.deliver(lambda:next(times)),'held')
        self.assertEqual(self.mail.call_count,1)

    def test_sent_recovery_does_not_resend(self):
        self.row['draft_id']='draft_1'
        self.mail=Mock(return_value={'messages':[{'id':'already_sent'}]})
        self.assertEqual(self.deliver(),'sent')
        self.assertEqual(self.mail.call_count,1)

    def test_uncertain_send_reuses_persisted_draft(self):
        self.row['draft_id']='draft_1'
        self.mail=Mock(side_effect=[{'messages':[]},TimeoutError()])
        with self.assertRaises(TimeoutError):self.deliver()
        self.assertEqual(self.mail.call_args.args,('drafts','send','draft_1'))
        self.save.assert_not_called()

    def test_invalid_draft_reference_cannot_send(self):
        self.mail=Mock(return_value={'id':'bad reference'})
        with self.assertRaises(ValueError):self.deliver()
        self.assertEqual(self.mail.call_count,1)

    def test_worker_reads_review_queue_independently(self):
        session=Mock()
        session.get.return_value.json.return_value=[]
        self.assertEqual(run_reviews(session,'https://example.invalid',self.mail),0)
        self.assertIn('/insurance_review_notices',session.get.call_args.args[0])
        self.mail.assert_not_called()


if __name__=='__main__':unittest.main()
