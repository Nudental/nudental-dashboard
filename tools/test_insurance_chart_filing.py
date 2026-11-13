import unittest
from unittest.mock import Mock
from insurance_chart_filing import NeedsReview, lookup, process


class ChartFiling(unittest.TestCase):
    def setUp(self):
        self.job = {'state':'pending','verification_id':'v','request_id':'r'}
        self.r = dict(id='r',verification_id='v',patient_first_name='Test',patient_last_name='Record',
                      patient_dob='1990-01-01',office_name='Brick')
        self.v = dict(id='v',request_id='r',status='completed',patient_name='Test Record',
                      patient_dob='1990-01-01',completed_at='2026-11-14T03:59:00+00:00')
        self.p = dict(id='123',firstName='Test',lastName='Record',dateOfBirth='1990-01-01',
                      patientStatus='ACTIVE',preferredLocation={'id':'14000000000435'})
        self.doc = dict(id='doc',name='Insurance Breakdown 2026-11-13 v',
                        ownerPatient={'id':'123'},mimeType='PDF')
        self.client = Mock()
        self.change = Mock(return_value=True)
        self.pdf = lambda v,r: b'%PDF-fake'
    def run_job(self):
        process(self.job,self.client,lambda j:(self.v,self.r),self.change,self.pdf)
    def test_matching_chart_and_receipt(self):
        self.client.get.side_effect = [(200,{'data':[self.p]},0),(200,{'data':self.doc},0)]
        self.client.post.return_value=(201,{'data':self.doc},0)
        self.run_job()
        self.assertEqual(self.change.call_args.args,('sending','filed',{'document_id':'doc'}))
        data=self.client.post.call_args.kwargs['json_body']
        self.assertEqual(data['ownerPatient'],{'id':'123'})
        self.assertEqual(data['userDefinedDate'],'2026-11-13')
        self.assertEqual(data['mimeType'],'PDF')
    def test_wrong_owner_on_readback(self):
        self.client.get.side_effect = [(200,{'data':[self.p]},0),(200,{'data':dict(self.doc,ownerPatient={'id':'wrong'})},0)]
        self.client.post.return_value=(201,{'data':self.doc},0)
        self.run_job()
        self.assertEqual(self.change.call_args.args[1],'confirming')
    def test_holds_uncertain_matches(self):
        for candidates in ([],[self.p,self.p],[dict(self.p,patientStatus='INACTIVE')],
                           [dict(self.p,preferredLocation={'id':'other'})],[dict(self.p,dateOfBirth='1990-01-02')]):
            self.client.get.return_value=(200,{'data':candidates},0)
            with self.assertRaises(NeedsReview):self.run_job()
        self.client.post.assert_not_called()
    def test_two_workers_only_one_can_send(self):
        self.change.return_value=False
        self.client.get.return_value=(200,{'data':[self.p]},0)
        self.run_job()
        self.client.post.assert_not_called()
    def test_lost_acknowledgment_recovers_without_another_post(self):
        self.job.update(state='sending',patient_id='123',filename=self.doc['name'],document_id=None)
        self.client.get.side_effect=[(200,{'data':[self.doc]},0),(200,{'data':self.doc},0)]
        self.run_job()
        self.assertEqual(self.change.call_args.args,('sending','filed',{'document_id':'doc'}))
        self.client.post.assert_not_called()


if __name__ == '__main__':
    unittest.main()
