"""Report privacy and office-level reconciliation; synthetic records only."""
import unittest,json,re
from copy import deepcopy
import test_compensation_runtime as runtime_fixtures
import test_compensation_ledger as ledger_fixtures
from test_compensation_runtime import views,runtime

class DoctorReportTests(unittest.TestCase):
    def result(self):
        fixture=ledger_fixtures.CalculationTests();fixture.setUp();r=fixture.result()
        return {'doctors':[r], 'gusto':{'payday':'2026-09-18','pay_period_start':'2026-08-31','pay_period_end':'2026-09-13'},
                'office_names':{'21':'North office','22':'South office'},'applied_window':r['applied_window'],
                'source_snapshot':r['source_snapshot'],'exceptions':[], 'unmapped_report_identities':[], 'complete_doctor_scope':True}
    def test_office_period_totals_and_separate_monthly_bases_are_in_report(self):
        r=self.result();html=views.report_html(r)
        office_table=html.split('<h3>Collections by office</h3>',1)[1].split('</table>',1)[0]
        self.assertIn('North office</td><td class="amount">$100.00',office_table)
        self.assertIn('South office</td><td class="amount">$200.00',office_table)
        self.assertIn('Combined total</td><td class="amount">$300.00',office_table)
        self.assertIn('$100.00 × 33%',html);self.assertIn('$200.00 × 32%',html)
        self.assertIn('$97.00',html);self.assertIn('$60,100.00',html)
    def test_single_provider_exports_do_not_disclose_other_provider_exceptions(self):
        r=self.result();other=deepcopy(r['doctors'][0]);other.update(provider_id='other',provider_name='Private Other Doctor');r['doctors'].append(other)
        r['exceptions']=[{'provider_id':'other','provider_name':'Private Other Doctor','period':['a','b'],'reason':'private review','action':'private action'}]
        r['unmapped_report_identities']=[{'provider_id':'private-source'}]
        original=json.dumps(r,sort_keys=True);selected=views.provider_result(r,'doctor')
        for exported in [views.report_html(selected),views.report_csv(selected),json.dumps(views.prepared_payload(selected))]:
            self.assertNotIn('Private Other Doctor',exported);self.assertNotIn('private-source',exported);self.assertNotIn('private review',exported)
        self.assertEqual(original,json.dumps(r,sort_keys=True))
        with self.assertRaises(ValueError):views.provider_result(r,'not-a-doctor')
    def test_zero_office_and_negative_collections_remain_explicit(self):
        r=self.result();r['doctors'][0]['office_ids'].append('23');r['office_names']['23']='Zero office'
        self.assertIn('Zero office</td><td class="amount">$0.00',views.report_html(r))
        r['doctors'][0]['negative_review_required']=True
        self.assertIn('does not authorize a deduction',views.report_html(r))
    def test_manual_override_and_saved_input_remain_unchanged(self):
        r=runtime_fixtures.RuntimeTests().result();before=deepcopy(r);changed=runtime.reprice(r,'qa-doctor',35,'qa')
        html=views.report_html(changed)
        self.assertIn('35%',html);self.assertIn('Manual rate override (automatic tier: 32%)',html)
        self.assertEqual(r,before)
