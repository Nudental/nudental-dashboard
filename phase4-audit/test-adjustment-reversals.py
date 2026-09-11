"""Extract real read methods; test only an isolated in-memory synthetic database."""
import ast,os,pathlib,sqlite3,types,unittest
SOURCE=pathlib.Path(os.environ['NDASH_ASCEND_SERVICE'])
tree=ast.parse(SOURCE.read_text(encoding='utf-8'))
methods={n.name:n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name in ('get_production_summary','get_adjustments_summary')}
assert len(methods)==2

class AdjustmentReversalTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
  self.db.execute('CREATE TABLE adjustments(amount REAL, transaction_date TEXT, is_active INT, ledger_type TEXT, location_id TEXT, provider_id TEXT)')
  self.db.execute('CREATE TABLE procedures(amount REAL, entry_date TEXT, is_active INT, ledger_type TEXT, location_id TEXT, provider_id TEXT)')
  rows=[(-100,'PatientCreditAdjustment'),(-20,'PatientCreditAdjustmentRebill'),(30,'PatientCreditAdjustmentCancellation'),(25,'PatientChargeAdjustment'),(5,'PatientChargeAdjustmentRebill'),(-7,'PatientChargeAdjustmentCancellation'),(8,'InsuranceRefundAdjustment'),(2,'InsuranceRefundAdjustmentRebill')]
  self.db.executemany('INSERT INTO adjustments VALUES(?, ?, 1, ?, ?, ?)',[(v,'2026-01-15',t,'qa-office','qa-provider') for v,t in rows])
  self.db.execute("INSERT INTO procedures VALUES(500,'2026-01-15T12:00:00',1,'PatientProcedureLedger','qa-office','qa-provider')")
  self.ns={'Optional':__import__('typing').Optional,'_cache_key':lambda *x:x,'_cache_get':lambda *x:None,'_cache_set':lambda *x,**k:None,'_month_start':lambda:'2026-01-01','_today':lambda:'2026-01-31','_db_has_data':lambda _:True,'_db_query':lambda sql,params=():[dict(r) for r in self.db.execute(sql,params)]}
  for method in methods.values():exec(compile(ast.Module(body=[method],type_ignores=[]),str(SOURCE),'exec'),self.ns)
 def tearDown(self):self.db.close()
 def summary(self,office='qa-office',start='2026-01-01',end='2026-01-31'):
  return self.ns['get_adjustments_summary'](None,start,end,office)
 def test_credit_reversal_nets_writeoffs(self):
  data=self.summary();self.assertEqual(data['writeOffs'],-90);self.assertEqual(data['writeOffsCount'],3)
 def test_charge_reversal_nets_charges(self):
  data=self.summary();self.assertEqual(data['chargeAdjustments'],23);self.assertEqual(data['chargeAdjustmentsCount'],3)
 def test_matches_existing_production_rule(self):
  prod=self.ns['get_production_summary'](None,'2026-01-01','2026-01-31','qa-office')
  data=self.summary();self.assertEqual(data['totalProductionAdjustments'],prod['adjustments']);self.assertEqual(prod['netProduction'],433)
 def test_insurance_refunds_stay_separate(self):
  data=self.summary();self.assertEqual(data['insuranceAdjustments'],10);self.assertEqual(data['totalNetAdjustments'],data['totalProductionAdjustments']+10);self.assertEqual(data['insuranceRefundsCount'],2)
 def test_voided_count_is_retained(self):self.assertEqual(self.summary()['voidedCount'],2)
 def test_office_date_active_scopes(self):
  self.db.executemany('INSERT INTO adjustments VALUES(?,?,?,?,?,?)',[(9999,'2026-01-15',1,'PatientCreditAdjustmentCancellation','other-office','qa-provider'),(9999,'2025-12-31',1,'PatientCreditAdjustmentCancellation','qa-office','qa-provider'),(9999,'2026-02-01',1,'PatientCreditAdjustmentCancellation','qa-office','qa-provider'),(9999,'2026-01-15',0,'PatientCreditAdjustmentCancellation','qa-office','qa-provider')])
  self.assertEqual(self.summary()['totalProductionAdjustments'],-67)
  self.assertEqual(self.summary(office='missing')['totalProductionAdjustments'],0)
 def test_unavailable_dataset_remains_unavailable(self):
  self.ns['_db_has_data']=lambda _:False
  self.assertEqual(self.summary()['source'],'unavailable');self.assertNotIn('totalProductionAdjustments',self.summary())

if __name__=='__main__':unittest.main()
