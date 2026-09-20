"""Synthetic continuity controls: expected cents are independently specified."""
from test_compensation_ledger import load,row,ledger,policy,store
from unittest.mock import patch
from pathlib import Path
from copy import deepcopy
import unittest,tempfile,json,csv,io,sqlite3
runtime=load('compensation_runtime');views=load('compensation_views')

OFFICES={'21':'QA Office A','22':'QA Office B'}
PERSON={'id':'qa-doctor','name':'QA Doctor','source_ids':['11'],'offices':['21'],'effective_start':'2026-08-01','effective_end':'2026-09-30'}

def configuration():
    d=policy.initial_document([PERSON],OFFICES);d.update(recorded_at='2026-09-20T12:00:00Z',recorded_by='qa-administrator')
    return {'version':policy.digest(d),'document':d}

def fixture(start,end,payday,events=None):
    if events is None:
        entries=[('1',-40000,'2026-09-05'),('2',-20000,'2026-09-15'),('3',-10000,'2026-09-28'),('4',-30000,'2026-10-05'),('5',1000,'2026-10-06'),('6',-25000,'2026-10-12')]
        events=[row(i,a,when=d+' 12:00:00') for i,a,d in entries]
    scopes=ledger.monthly_scopes(start,end,payday)
    source={'records':{r['id']:r for r in events},'charges':{'91':{'provider':{'id':'11'}}},'categories':{'1':{'allocation':'COLLECTION'}},
        'snapshot':{'applied_scope':[min(s['start'] for s in scopes.values()),max(s['cutoff'] for s in scopes.values())],'complete':True,'sha256':'synthetic-source','read_as_of':payday+'T12:00:00Z','retrieved_at':payday+'T12:00:01Z'}}
    g={'run_id':'qa-'+payday,'payday':payday,'pay_period_start':str(ledger.date.fromisoformat(start)+ledger.timedelta(days=1)),'pay_period_end':str(ledger.date.fromisoformat(end)+ledger.timedelta(days=1))}
    return source,g

class ContinuityTests(unittest.TestCase):
    def setUp(self):self.offices=patch.object(runtime,'OFFICES',OFFICES);self.offices.start();self.addCleanup(self.offices.stop)
    def calculate(self,start,end,payday,events=None,config=None):
        s,g=fixture(start,end,payday,events);return runtime.calculate_snapshot(s,start,end,g,configuration=config or configuration())
    def test_one_continuing_policy_covers_all_three_october_runs(self):
        c=configuration();version=c['version']
        cases=[('2026-09-13','2026-09-26','2026-10-02',[(7000000,2000000,34,680000)]),
               ('2026-09-27','2026-10-10','2026-10-16',[(7000000,1000000,34,340000),(2900000,2900000,32,928000)]),
               ('2026-10-11','2026-10-24','2026-10-30',[(5400000,2500000,33,825000)])]
        for first,last,payday,expected in cases:
            r=self.calculate(first,last,payday,config=c);months=r['doctors'][0]['months']
            self.assertEqual([(m['monthly_basis_cents'],m['period_collection_cents'],m['applied_percent'],m['estimate_cents']) for m in months],expected)
            self.assertEqual(r['policy']['version'],version);self.assertEqual(r['status'],'READY_FOR_HR_REVIEW')
            self.assertEqual(r['independent_hr_status'],'NOT_AUTOMATICALLY_CERTIFIED')
    def test_no_calendar_expiration_next_year(self):
        c=configuration();p=policy.policy_for_period(c['document']['doctors'][0],'2027-01-01','2027-02-28',c['version'])
        self.assertEqual(p['offices'],['21']);self.assertIsNone(p['office_rules'][-1]['effective_end'])
    def test_year_rollover_and_leap_month(self):
        r=ledger.monthly_scopes('2026-12-27','2027-01-09','2027-01-15')
        self.assertEqual([x['cutoff'] for x in r.values()],['2026-12-31','2027-01-09'])
        r=ledger.monthly_scopes('2028-02-27','2028-03-11','2028-03-17')
        self.assertEqual([x['cutoff'] for x in r.values()],['2028-02-29','2028-03-11'])
    def test_early_processed_run_does_not_invent_completed_month(self):
        r=ledger.monthly_scopes('2026-09-13','2026-09-26','2026-10-02','2026-09-29')
        self.assertEqual(r['2026-09']['cutoff'],'2026-09-26');self.assertFalse(r['2026-09']['closed'])
    def test_september_cutoff_never_advances_with_today(self):
        for asof in ['2026-09-20','2026-10-20','2027-01-01']:
            r=ledger.monthly_scopes('2026-08-30','2026-09-12','2026-09-18',asof)
            self.assertEqual(r['2026-09']['cutoff'],'2026-09-12')
    def test_mid_period_rule_changes_are_applied_per_date_not_home_office(self):
        c=configuration();rules=c['document']['doctors'][0]['office_rules'];rules[-1]['effective_end']='2026-10-04'
        rules.append(dict(rules[-1],effective_start='2026-10-05',effective_end=None,offices=['22']))
        events=[row('1',-100,when='2026-10-03 12:00:00',office='21'),row('2',-99,when='2026-10-03 12:00:00',office='22'),row('3',-300,when='2026-10-07 12:00:00',office='22'),row('4',-75,when='2026-10-07 12:00:00',office='21')]
        r=self.calculate('2026-09-27','2026-10-10','2026-10-16',events,c)['doctors'][0]
        self.assertEqual(r['eligible_period_cents'],40000);self.assertEqual(r['estimate_cents'],12800)
        self.assertEqual(len(r['monthly_exceptions']),2);self.assertEqual(len(r['exceptions']),2)
    def test_unknown_doctor_is_named_and_known_results_are_not_a_complete_total(self):
        s,g=fixture('2026-10-11','2026-10-24','2026-10-30');s['records']['7']=row('7',-99,when='2026-10-15 12:00:00',charge='92');s['charges']['92']={'provider':{'id':'99'}}
        r=runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration())
        self.assertFalse(r['complete_doctor_scope']);self.assertEqual(r['doctors'][0]['estimate_cents'],825000)
        self.assertEqual(r['exceptions'][0]['provider_id'],'99');self.assertEqual(r['status'],'NEEDS_REVIEW')
    def test_native_hygienist_type_is_separate_and_not_name_inferred(self):
        s,g=fixture('2026-10-11','2026-10-24','2026-10-30');s['records']['7']=row('7',-99,when='2026-10-15 12:00:00',charge='92');s['charges']['92']={'provider':{'id':'99'}};s['provider_catalog']={'99':{'specialty':'HYGIENIST','name':'QA <not a guessed doctor>'}}
        r=runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration());self.assertTrue(r['complete_doctor_scope'])
    def test_incomplete_source_is_not_zero(self):
        s,g=fixture('2026-10-11','2026-10-24','2026-10-30');s['snapshot']['complete']=False
        with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration())
    def test_genuine_empty_pages_allow_true_zero_for_approved_doctors(self):
        r=self.calculate('2026-10-11','2026-10-24','2026-10-30',[])
        self.assertEqual(r['doctors'][0]['estimate_cents'],0);self.assertEqual(r['status'],'READY_FOR_HR_REVIEW')
    def test_policy_gap_does_not_invent_zero_for_missing_person(self):
        c=configuration();c['document']['doctors'][0]['office_rules']=c['document']['doctors'][0]['office_rules'][:1]
        r=self.calculate('2026-10-11','2026-10-24','2026-10-30',config=c)
        self.assertEqual(r['doctors'],[]);self.assertFalse(r['complete_doctor_scope']);self.assertIn('QA Doctor',r['exceptions'][0]['reason'])
    def test_exact_cent_thresholds_preserved(self):
        self.assertEqual([ledger.doctor_rate(v) for v in [5000000,5000001,6500000,6500001,8000000,8000001]],[32,33,33,34,34,35])
    def test_reports_share_policy_source_dates_rates_and_calculation_ids(self):
        r=self.calculate('2026-09-27','2026-10-10','2026-10-16');r['job_id']='a'*32
        lines=list(csv.DictReader(io.StringIO(views.report_csv(r))));html=views.report_html(r);payload=views.prepared_payload(r)
        self.assertEqual([x['Estimate'] for x in lines],['3,400.00','9,280.00'])
        for line in lines:
            self.assertIn(line['Calculation ID'],html);self.assertEqual(line['Policy version'],r['policy']['version']);self.assertEqual(line['Snapshot ID'],r['job_id'])
        self.assertEqual(payload['calculations'],r['doctors']);self.assertFalse(payload['delivery_performed'])
    def test_duplicate_derived_groups_are_rejected(self):
        s,g=fixture('2026-10-11','2026-10-24','2026-10-30');events=ledger.reconstruct(s['records'],s['charges'],s['categories'],'2026-10-01','2026-10-24')
        with patch.object(runtime,'reconstruct',return_value=events+[events[0]]),self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration())
    def test_runtime_checker_rejects_corrupted_amounts_cutoffs_tiers_and_ids(self):
        for field,value in [('estimate_cents',1),('automatic_percent',35),('cutoff','2026-10-25'),('monthly_basis_cents',1)]:
            result=self.calculate('2026-10-11','2026-10-24','2026-10-30');result['doctors'][0]['months'][0][field]=value
            with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.check_result(result)
    def test_source_cutoff_uses_new_york_day_and_rejects_unknown_timezone(self):
        self.assertEqual(runtime.source_day('2026-10-01T02:00:00Z'),'2026-09-30')
        with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.source_day('2026-10-01T02:00:00')

class PersistenceTests(unittest.TestCase):
    def test_policy_updates_preserve_old_versions_and_reject_stale_or_historical_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'rules';version=policy.approve(policy.initial_document([PERSON],OFFICES),root=root)
            original=policy.load(root);changed=deepcopy(original['document']);changed['change_effective_date']='2099-01-01'
            rules=changed['doctors'][0]['office_rules'];rules[-1]['effective_end']='2098-12-31'
            rules.append(dict(rules[-1],effective_start='2099-01-01',effective_end=None,offices=['22']))
            second=policy.approve(changed,expected_version=version,root=root)
            self.assertNotEqual(second,version);self.assertEqual(json.loads((root/(version+'.json')).read_text()),original['document'])
            with self.assertRaises(ValueError):policy.approve(changed,expected_version=version,root=root)
            changed['doctors'][0]['office_rules'][0]['offices']=['22']
            with self.assertRaises(ValueError):policy.approve(changed,expected_version=second,root=root)
    def test_approved_configuration_is_versioned_and_integrity_checked(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'rules';doc=policy.initial_document([PERSON],OFFICES);version=policy.approve(doc,root=root)
            self.assertEqual(policy.load(root)['version'],version)
            path=root/(version+'.json');path.write_text(path.read_text().replace('QA Doctor','Changed'))
            with self.assertRaises(ledger.IncompleteCollectionEvidence):policy.load(root)
    def test_ambiguous_overlapping_rules_rejected(self):
        d=configuration()['document'];d['doctors'][0]['office_rules'][-1]['effective_start']='2026-09-30'
        with self.assertRaises(ledger.IncompleteCollectionEvidence):policy.validate(d)
    def test_identity_cannot_belong_to_two_people(self):
        d=configuration()['document'];d['doctors'].append(dict(d['doctors'][0],id='different-person'))
        with self.assertRaises(ledger.IncompleteCollectionEvidence):policy.validate(d)
    def test_snapshots_survive_restart_are_actor_bound_and_immutable(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(runtime,'OFFICES',OFFICES):
            st=store.SnapshotStore(Path(folder)/'snapshots');s,g=fixture('2026-10-11','2026-10-24','2026-10-30');r=runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration())
            st.put('a'*32,'qa-user',r);second=store.SnapshotStore(st.root)
            self.assertEqual(second.get('a'*32,'qa-user'),r)
            with self.assertRaises(KeyError):second.get('a'*32,'other-user')
            with self.assertRaises(sqlite3.IntegrityError):second.put('a'*32,'qa-user',r)
            self.assertEqual(len(second.history('qa-user',g['run_id'],*r['applied_window'])['calculations']),1)
            self.assertEqual(second.history('other-user',g['run_id'],*r['applied_window'])['calculations'],[])
    def test_historical_files_are_not_silently_replaced_by_new_revision(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(runtime,'OFFICES',OFFICES):
            st=store.SnapshotStore(Path(folder)/'snapshots');s,g=fixture('2026-10-11','2026-10-24','2026-10-30');first=runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration());st.put('a'*32,'qa-user',first)
            s['records']['6']['amount']=-26000;s['records']['6']['distributions'][0]['appliedAmount']=26000;s['snapshot']['sha256']='synthetic-revised-source'
            later=runtime.calculate_snapshot(s,'2026-10-11','2026-10-24',g,configuration=configuration());st.put('b'*32,'qa-user',later)
            self.assertEqual(st.get('a'*32,'qa-user')['doctors'][0]['estimate_cents'],825000);self.assertEqual(st.get('b'*32,'qa-user')['doctors'][0]['estimate_cents'],858000)
            self.assertNotEqual(first['doctors'][0]['calculation_id'],later['doctors'][0]['calculation_id'])

if __name__=='__main__':unittest.main()
