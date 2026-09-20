"""Independent synthetic acceptance fixtures; no doctor/patient financial rows."""
import unittest,copy,csv,io
from collection_contract import (canonical_events,daily_totals,reconcile_daily,calculate_provider,
    doctor_rate,compensation_cents,month_end_proposal,presentation_rows,export_csv,report_html)

def event(id,day,amount,provider='alias-a',office='office-a',eligible=True,**extra):
    return dict(source_system='synthetic-ledger',transaction_id='tx-'+id,application_event_id=id,
                provider_id=provider,report_location_id=office,applied_date=day,
                signed_cents=amount,collection_eligible=eligible,applied_date_verified=True,
                category_evidence='synthetic-category-contract',source_snapshot='2026-09-13T05:00:00Z',**extra)

def fixture():
    rows=[event('a','2026-08-01',-5_900_000),event('b','2026-08-30',-70_000),
          event('c','2026-08-31',-30_000,provider='alias-b',office='office-b'),
          event('d','2026-09-01',-8_000_000),event('e','2026-09-12',-100_000,office='office-b')]
    result=dict(provider_id='doctor-a',source_ids={'alias-a','alias-b'},allowed_offices={'office-a','office-b'},
                authorized_offices={'office-a','office-b'},policy_window=('2026-08-01','2026-09-30'),
                applied_window=('2026-08-30','2026-09-12'),gusto={'run_id':'synthetic-regular','period':['2026-08-31','2026-09-13'],'payday':'2026-09-18'},
                events=rows,daily_controls={('alias-a','office-a','2026-08-30'):-70_000,('alias-b','office-b','2026-08-31'):-30_000,
                                          ('alias-a','office-a','2026-09-01'):-8_000_000,('alias-a','office-b','2026-09-12'):-100_000},
                approved_monthly_scopes={'2026-08':{'cutoff':'2026-08-31','closed':True,'approval_reference':'synthetic-owner-20260920'},
                                         '2026-09':{'cutoff':'2026-09-12','closed':False,'approval_reference':'synthetic-owner-20260920'}},
                monthly_controls={'2026-08':{'cutoff':'2026-08-31','closed':True,'complete':True,'signed_collection_cents':-6_000_000,'evidence_reference':'independent-synthetic-august'},
                                  '2026-09':{'cutoff':'2026-09-12','closed':False,'complete':True,'signed_collection_cents':-8_100_000,'evidence_reference':'independent-synthetic-september','cutoff_policy_reference':'owner-period-end'}},
                source_snapshot='2026-09-13T05:00:00Z')
    for control in result['monthly_controls'].values():
        control.update(measure='Ledger.Collection',date_basis='Applied Date',source_provider_ids=['alias-a','alias-b'],office_ids=['office-a','office-b'])
    return result

class AppliedCollectionAcceptance(unittest.TestCase):
    def test_separate_months_do_not_take_combined_tier(self):
        r=calculate_provider(**fixture());self.assertEqual(r['status'],'VERIFIED_ESTIMATE')
        self.assertEqual([m['automatic_percent'] for m in r['months']],[33,35])
        self.assertEqual([m['estimate_cents'] for m in r['months']],[33000,2835000])
        self.assertEqual(r['estimate_cents'],2868000)
    def test_no_gusto_money_input(self):
        f=fixture();a=calculate_provider(**f);f['gusto']['gross']=999999999
        self.assertEqual(a['estimate_cents'],calculate_provider(**f)['estimate_cents'])
    def test_exact_flat_tier_cent_boundaries(self):
        for cents,rate in [(0,32),(5_000_000,32),(5_000_001,33),(6_500_000,33),(6_500_001,34),(8_000_000,34),(8_000_001,35)]:
            with self.subTest(cents=cents):self.assertEqual(doctor_rate(cents),rate)
        self.assertEqual(compensation_cents(100_000,35),35_000)
    def test_rounding_once_per_month_and_signed_half_cent(self):
        self.assertEqual(compensation_cents(50,33),17);self.assertEqual(compensation_cents(-50,33),-17)
    def test_signed_reversal_nets_zero(self):
        rows=[event('original','2026-08-20',-49923),event('reverse','2026-08-20',49923)]
        self.assertEqual(daily_totals(canonical_events(rows,{'alias-a'}),'2026-08-20','2026-08-20'),{('alias-a','office-a','2026-08-20'):0})
    def test_collection_membership_not_all_adjustments(self):
        rows=[event('payment','2026-09-09',100000),event('offset','2026-09-09',-115500),event('writeoff','2026-09-09',-600000,eligible=False)]
        self.assertEqual(sum(daily_totals(canonical_events(rows,{'alias-a'}),'2026-09-09','2026-09-09').values()),-15500)
    def test_refund_reduces_earned_collection(self):
        rows=[event('paid','2026-09-10',-100000),event('refund','2026-09-10',30000)]
        self.assertEqual(-sum(daily_totals(rows,'2026-09-10','2026-09-10').values()),70000)
    def test_applied_date_never_uses_posting_date(self):
        row=event('old','2026-09-09',-12345,transaction_date='2026-08-01')
        self.assertEqual(sum(daily_totals([row],'2026-09-09','2026-09-09').values()),-12345)
        row['applied_date_verified']=False
        with self.assertRaisesRegex(ValueError,'Applied Date'):canonical_events([row],{'alias-a'})
    def test_unstable_or_missing_application_id_is_rejected(self):
        row=event('x','2026-08-01',-1);del row['application_event_id']
        with self.assertRaisesRegex(ValueError,'application_event_id'):canonical_events([row],{'alias-a'})
    def test_split_payment_and_duplicate_join(self):
        a=event('line-a','2026-08-20',-6000);b=event('line-b','2026-08-20',-4000,office='office-b');b['transaction_id']=a['transaction_id']
        out=canonical_events([a,b,dict(a)],{'alias-a'});self.assertEqual(len(out),2)
        self.assertEqual(sum(daily_totals(out,'2026-08-20','2026-08-20').values()),-10000)
    def test_conflicting_duplicate_fails(self):
        a=event('x','2026-08-01',-1);b={**a,'signed_cents':-2}
        with self.assertRaisesRegex(ValueError,'Conflicting'):canonical_events([a,b],{'alias-a'})
    def test_inactive_identity_is_not_removed(self):
        rows=canonical_events([event('old','2026-08-01',-1,is_active=False)],{'alias-a'})
        self.assertEqual(len(rows),1)
    def test_only_exact_identity_crosswalk(self):
        rows=canonical_events([event('x','2026-08-01',-1,provider='similar-name')],{'alias-a'})
        self.assertEqual(rows,[])
    def test_office_subtotals_and_aliases_are_counted_once(self):
        f=fixture();r=calculate_provider(**f);self.assertEqual(r['months'][0]['monthly_basis_cents'],6000000)
        f['events']+=copy.deepcopy(f['events']);self.assertEqual(calculate_provider(**f)['estimate_cents'],r['estimate_cents'])
    def test_narrow_office_permission_cannot_return_global_tier(self):
        f=fixture();f['authorized_offices']={'office-a'};r=calculate_provider(**f)
        self.assertEqual(r['status'],'INCOMPLETE_AUTHORIZED_SCOPE');self.assertNotIn('raw_hr_collection_cents',r)
        self.assertEqual(r['months'],[])
    def test_outside_office_rows_preserved_as_exceptions(self):
        f=fixture();f['events'].append(event('exception','2026-09-10',-123,office='office-c'))
        f['authorized_offices'].add('office-c')
        f['daily_controls'][('alias-a','office-c','2026-09-10')]=-123;r=calculate_provider(**f)
        self.assertEqual(r['exceptions'][0]['signed_cents'],-123)
        self.assertEqual(r['estimate_cents'],2868000)
    def test_policy_not_applied_to_unrelated_history(self):
        f=fixture();f['policy_window']=('2026-09-01','2026-09-30')
        with self.assertRaisesRegex(ValueError,'policy'):calculate_provider(**f)
    def test_monthly_scope_requires_policy_effective_dates(self):
        f=fixture();f['policy_window']=('2026-08-30','2026-09-30')
        with self.assertRaisesRegex(ValueError,'effective-date'):calculate_provider(**f)
    def test_two_fortnights_do_not_establish_monthly_basis(self):
        f=fixture();f['monthly_controls']={};r=calculate_provider(**f)
        self.assertIsNone(r['estimate_cents']);self.assertTrue(all(m['monthly_basis_cents'] is None for m in r['months']))
    def test_monthly_mismatch_is_not_fallback_to_period_amount(self):
        f=fixture();f['monthly_controls']['2026-08']['signed_collection_cents']=-1;r=calculate_provider(**f)
        self.assertIsNone(r['estimate_cents']);self.assertIsNone(r['months'][0]['automatic_percent'])
    def test_same_amount_wrong_measure_does_not_verify_month(self):
        f=fixture();f['monthly_controls']['2026-08']['measure']='Applied Payments'
        self.assertIsNone(calculate_provider(**f)['months'][0]['automatic_percent'])
    def test_monthly_control_must_match_provider_and_office_universe(self):
        for key,value in [('source_provider_ids',['alias-a']),('office_ids',['office-a']),('date_basis','Transaction Date')]:
            f=fixture();f['monthly_controls']['2026-08'][key]=value
            self.assertIsNone(calculate_provider(**f)['estimate_cents'])
    def test_valid_zero_retained(self):
        f=fixture();f['events'][0]['signed_cents']=100000;f['monthly_controls']['2026-08']['signed_collection_cents']=0
        r=calculate_provider(**f);self.assertEqual(r['months'][0]['monthly_basis_cents'],0);self.assertEqual(r['months'][0]['automatic_percent'],32)
    def test_incomplete_month_never_zero(self):
        f=fixture();f['monthly_controls']['2026-08']['complete']=False;r=calculate_provider(**f)
        self.assertIsNone(r['months'][0]['monthly_basis_cents']);self.assertIsNone(r['estimate_cents'])
    def test_open_cutoff_must_be_explicit(self):
        f=fixture();del f['monthly_controls']['2026-09']['cutoff_policy_reference']
        with self.assertRaisesRegex(ValueError,'cutoff policy'):calculate_provider(**f)
    def test_closed_month_uses_full_month(self):
        f=fixture();f['monthly_controls']['2026-08']['cutoff']='2026-08-30'
        with self.assertRaises(ValueError):calculate_provider(**f)
    def test_future_month_days_not_in_provisional_tier(self):
        f=fixture();f['events'].append(event('later','2026-09-30',-99999999));r=calculate_provider(**f)
        self.assertEqual(r['months'][1]['monthly_basis_cents'],8100000)
    def test_opposite_daily_errors_do_not_cancel(self):
        actual={('p','o','2026-08-01'):100,('p','o','2026-08-02'):-100}
        controls={k:0 for k in actual};self.assertEqual(len(reconcile_daily(actual,controls)),2)
    def test_period_mismatch_withholds_every_exported_estimate(self):
        f=fixture();f['daily_controls'][('alias-a','office-a','2026-08-30')]=-1
        r=calculate_provider(**f);self.assertIsNone(r['estimate_cents'])
        self.assertTrue(all(row['estimate_cents'] is None for row in presentation_rows(r)))
    def test_later_recalculation_does_not_mutate_original_snapshot(self):
        f=fixture();first=calculate_provider(**f);preserved=copy.deepcopy(first)
        f['gusto']['period'][0]='2026-09-01';f['monthly_controls']['2026-09']['cutoff']='2026-09-30'
        f['monthly_controls']['2026-09']['closed']=True;f['events'].append(event('later','2026-09-30',-100))
        f['approved_monthly_scopes']['2026-09']={'cutoff':'2026-09-30','closed':True,'approval_reference':'synthetic-later-month-end-review'}
        f['monthly_controls']['2026-09']['signed_collection_cents']=-8100100
        later=calculate_provider(**f);self.assertEqual(first,preserved);self.assertNotEqual(later['calculation_id'],first['calculation_id'])
    def test_uncontrolled_extra_rows_are_visible(self):
        self.assertEqual(len(reconcile_daily({('p','o','2026-08-01'):0},{})),1)
    def test_missing_collection_categories_block_estimate(self):
        f=fixture();del f['events'][0]['category_evidence'];self.assertIsNone(calculate_provider(**f)['estimate_cents'])
    def test_override_not_misrepresented_as_automatic_tier(self):
        f=fixture();f.update(override={'percent':34,'approval_reference':'synthetic-existing-override'},override_allowed=True)
        r=calculate_provider(**f);self.assertEqual(r['months'][0]['automatic_percent'],33);self.assertEqual(r['months'][0]['applied_percent'],34)
    def test_override_permissions_not_expanded(self):
        f=fixture();f['override']={'percent':34,'approval_reference':'x'}
        with self.assertRaisesRegex(ValueError,'authorization'):calculate_provider(**f)
    def test_negative_is_flagged_not_clamped_or_deducted(self):
        f=fixture();f['events'][1]['signed_cents']=70000;f['daily_controls'][('alias-a','office-a','2026-08-30')]=70000
        f['monthly_controls']['2026-08']['signed_collection_cents']=-5860000;r=calculate_provider(**f)
        self.assertTrue(r['negative_review_required']);self.assertEqual(r['months'][0]['estimate_cents'],-13200)
    def test_html_csv_detail_share_exact_result(self):
        r=calculate_provider(**fixture());rows=presentation_rows(r);parsed=list(csv.DictReader(io.StringIO(export_csv(r))))
        for expected,actual in zip(rows,parsed):
            self.assertEqual({k:'' if v is None else str(v) for k,v in expected.items()},actual)
        self.assertIn(str(rows[0]['estimate_cents']),report_html(r));self.assertIn(r['calculation_id'],report_html(r))
    def test_year_and_leap_month_boundaries(self):
        for start,end in [('2024-02-28','2024-03-01'),('2025-12-31','2026-01-01')]:
            f=fixture();f.update(events=[],daily_controls={},monthly_controls={},applied_window=(start,end),policy_window=('2024-01-01','2026-12-31'))
            from calendar import monthrange
            first_month=start[:7];y,m=map(int,first_month.split('-'))
            f['approved_monthly_scopes']={first_month:{'cutoff':f'{first_month}-{monthrange(y,m)[1]}','closed':True,'approval_reference':'synthetic-boundary'},
                                         end[:7]:{'cutoff':end,'closed':False,'approval_reference':'synthetic-boundary'}}
            self.assertEqual(len(calculate_provider(**f)['months']),2)
    def test_cents_do_not_accept_float_or_bool(self):
        for value in (False,1.2,'12'):
            with self.assertRaises(ValueError):doctor_rate(value)

    def test_evidence_cannot_silently_advance_approved_september_cutoff(self):
        f=fixture();f['monthly_controls']['2026-09']['cutoff']='2026-09-19'
        with self.assertRaisesRegex(ValueError,'approved cutoff'):calculate_provider(**f)
    def test_provisional_label_shared_by_all_candidate_surfaces(self):
        r=calculate_provider(**fixture());label='Provisional through September 12, 2026'
        self.assertEqual(r['months'][1]['basis_label'],label)
        self.assertEqual(presentation_rows(r)[1]['basis_label'],label)
        self.assertIn(label,export_csv(r));self.assertIn(label,report_html(r))
    def test_approved_scope_is_separate_from_source_report_refresh_time(self):
        f=fixture();f['monthly_controls']['2026-09'].update(report_generated_at='2026-09-20T00:59:04',report_data_as_of='2026-09-19T23:00:00')
        r=calculate_provider(**f);month=r['months'][1]
        self.assertEqual(month['cutoff'],'2026-09-12');self.assertEqual(month['report_generated_at'],'2026-09-20T00:59:04')
        self.assertEqual(month['report_data_as_of'],'2026-09-19T23:00:00')
    def test_missing_report_refresh_time_is_unknown_not_generation_time(self):
        f=fixture();f['monthly_controls']['2026-09']['report_generated_at']='2026-09-20T00:59:04'
        self.assertIsNone(calculate_provider(**f)['months'][1]['report_data_as_of'])
    def test_policy_cannot_be_inferred_from_evidence_alone(self):
        f=fixture();f['approved_monthly_scopes']={}
        with self.assertRaisesRegex(ValueError,'approved monthly scope'):calculate_provider(**f)
    def test_no_second_shift_in_payroll_or_calendar_month_boundaries(self):
        r=calculate_provider(**fixture())
        self.assertEqual(r['gusto']['period'],['2026-08-31','2026-09-13'])
        self.assertEqual(r['applied_window'],['2026-08-30','2026-09-12'])
        self.assertEqual([m['cutoff'] for m in r['months']],['2026-08-31','2026-09-12'])
    def test_approved_scope_snapshot_does_not_mutate_with_caller(self):
        f=fixture();r=calculate_provider(**f);f['approved_monthly_scopes']['2026-09']['cutoff']='2026-09-30'
        self.assertEqual(r['approved_monthly_scopes']['2026-09']['cutoff'],'2026-09-12')
    def test_policy_exception_cannot_leak_unauthorized_office_amount(self):
        f=fixture();f['events'].append(event('restricted','2026-09-10',-987654,office='restricted-office'))
        f['daily_controls'][('alias-a','restricted-office','2026-09-10')]=-987654
        r=calculate_provider(**f)
        self.assertEqual(r['status'],'INCOMPLETE_AUTHORIZED_SCOPE')
        self.assertNotIn('exceptions',r);self.assertNotIn('raw_hr_collection_cents',r)
        self.assertNotIn('reconciliation',r);self.assertEqual(r['months'],[])

class MonthEndAcceptance(unittest.TestCase):
    def proposal(self,entries=None,**extra):
        return month_end_proposal(final_collection_cents=6000000,paid_entries=entries,month='2026-08',provider_id='doctor-a',complete=True,**extra)
    def test_no_paid_baseline_does_not_invent_trueup(self):
        self.assertIsNone(self.proposal()['proposed_adjustment_cents'])
    def test_reprice_and_subtract_actual_verified_paid(self):
        paid={'provider_id':'doctor-a','earning_month':'2026-08','verified':True,'payment_reference':'paid-1','compensation_cents':1900000}
        r=self.proposal([paid,dict(paid)]);self.assertEqual(r['proposed_adjustment_cents'],80000)
        self.assertFalse(r['included_in_period_estimate']);self.assertTrue(r['requires_hr_approval'])
    def test_wrong_provider_month_unverified_or_gusto_total_rejected(self):
        for row in [{'provider_id':'other'},{'earning_month':'2026-09'},{'verified':False},{'compensation_cents':None}]:
            p={'provider_id':'doctor-a','earning_month':'2026-08','verified':True,'payment_reference':'paid-1','compensation_cents':1900000,**row}
            with self.assertRaises(ValueError):self.proposal([p])
    def test_conflicting_paid_id_not_counted_twice(self):
        p={'provider_id':'doctor-a','earning_month':'2026-08','verified':True,'payment_reference':'paid-1','compensation_cents':1900000}
        with self.assertRaises(ValueError):self.proposal([p,{**p,'compensation_cents':1}])

if __name__=='__main__':unittest.main()
