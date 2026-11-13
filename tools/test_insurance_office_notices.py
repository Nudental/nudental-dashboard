import unittest
from unittest.mock import Mock
from insurance_office_notices import deliver


class OfficeNotices(unittest.TestCase):
    def setUp(self):
        self.address = 'brick@thenudental.com'
        self.row = dict(id='example', kind='completed', recipient=self.address, draft_id=None)
        self.saved = []

    def test_saves_draft_before_send(self):
        responses = iter([{'draftId': 'draft_1'}, {'messageId': 'sent_1'}])
        def mail(*args):
            if args[:2] == ('drafts', 'send'):
                self.assertEqual(self.saved, [{'draft_id': 'draft_1'}])
            else:
                self.assertIn(self.address, args)
                self.assertIn('https://nudashboard.com/insurance-verify', args[-1])
            return next(responses)
        deliver(self.row, self.address, self.saved.append, mail)
        self.assertIn('sent_at', self.saved[-1])

    def test_already_delivered_draft(self):
        self.row['draft_id'] = 'draft_1'
        mail = Mock(return_value={'messages': [{'id': 'sent_1'}]})
        deliver(self.row, self.address, self.saved.append, mail)
        self.assertEqual(mail.call_count, 1)
        self.assertIn('sent_at', self.saved[-1])

    def test_directory_mismatch(self):
        mail = Mock()
        with self.assertRaises(ValueError):
            deliver(self.row, 'eatontown@thenudental.com', self.saved.append, mail)
        mail.assert_not_called()

    def test_ambiguous_send_reuses_same_draft(self):
        self.row['draft_id'] = 'draft_1'
        mail = Mock(side_effect=[{'messages': []}, TimeoutError()])
        with self.assertRaises(TimeoutError):
            deliver(self.row, self.address, self.saved.append, mail)
        self.assertEqual(mail.call_args.args, ('drafts', 'send', 'draft_1'))
        self.assertFalse(self.saved)


if __name__ == '__main__':
    unittest.main()
