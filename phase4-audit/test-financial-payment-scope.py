"""Exercise the actual summary reader against an isolated synthetic SQLite fixture."""
import ast,hashlib,json,logging,os,pathlib,sqlite3,tempfile,unittest
from typing import Optional
from unittest.mock import patch

HERE=pathlib.Path(__file__).resolve().parent
CANDIDATE=pathlib.Path(os.environ.get('NDASH_FINANCIAL_SOURCE',HERE/'NDASH-131-financial-filter-function.py'))
BASELINE=pathlib.Path(os.environ.get('NDASH_FINANCIAL_BASELINE',HERE.parents[1]/'ndash131-backend/financial-filter-options.before.py'))
class HTTPException(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code;super().__init__(detail)

def load(path,database):
    text=path.read_text(encoding='utf-8');tree=ast.parse(text)
    node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='financial_filter_options')
    node.decorator_list=[]
    env={'Optional':Optional,'Query':lambda x:x,'HTTPException':HTTPException,'RCM_DB_PATH':str(database),'VALID_LOCATION_IDS':{'100','200','300'},'SPECIALTY_TYPE_MAP':{'GENERAL':'doctor'},'CLAIM_STATE_MAP':{'OPEN':('open','Open')},'logger':logging.getLogger('synthetic-financial-scope')}
    exec(compile(ast.Module(body=[node],type_ignores=[]),str(path),'exec'),env)
    return env['financial_filter_options']

class ScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.database=pathlib.Path(cls.temp.name)/'synthetic-qa.sqlite'
        conn=sqlite3.connect(cls.database)
        conn.executescript('''
          CREATE TABLE locations(id TEXT,name TEXT,city TEXT,state TEXT);
          CREATE TABLE providers(id TEXT,first_name TEXT,last_name TEXT,is_active INTEGER,raw TEXT);
          CREATE TABLE procedures(provider_id TEXT,is_active INTEGER,transaction_date TEXT,ledger_type TEXT,location_id TEXT,raw TEXT);
          CREATE TABLE patient_payments(is_active INTEGER,ledger_type TEXT,amount REAL,transaction_date TEXT,location_id TEXT,raw TEXT);
          CREATE TABLE insurance_payments(is_active INTEGER,ledger_type TEXT,amount REAL,transaction_date TEXT,claim_location_id TEXT,location_id TEXT,raw TEXT);
          CREATE TABLE insurance_claims(service_date TEXT,location_id TEXT,raw TEXT);
          CREATE TABLE patient_procedure_map(error TEXT,practice_procedure_id TEXT,patient_procedure_id TEXT,normalized_service_category TEXT,ada_code TEXT);
        ''')
        for index,loc in enumerate(['100','200','300'],1):
            conn.execute('INSERT INTO locations VALUES(?,?,?,?)',(loc,'QA '+loc,'QA','QA'))
            conn.execute('INSERT INTO providers VALUES(?,?,?,?,?)',('qa-provider-'+loc,'QA',loc,1,json.dumps({'specialty':'GENERAL'})))
            for i in range(index):
                proc='qa-proc-'+loc+'-'+str(i)
                conn.execute('INSERT INTO procedures VALUES(?,?,?,?,?,?)',('qa-provider-'+loc,1,'2026-01-10','PatientProcedureLedger',loc,json.dumps({'patientProcedure':{'id':proc}})))
                conn.execute('INSERT INTO patient_procedure_map VALUES(?,?,?,?,?)',(None,proc,proc,'Diagnostic / Exams','D0120'))
            conn.execute('INSERT INTO insurance_claims VALUES(?,?,?)',('2026-01-10',loc,json.dumps({'claimState':'OPEN','totalCharges':100*index})))
            patient_rows=[
                (10*index,{'patientPaymentBilling':{'creditCardType':1}}),
                (5*index,{'patientPaymentBilling':{'checkNumber':'QA-PATIENT-'+loc}}),
                (3*index,{'paidAtVisit':True}),
                (7*index,{'patientPaymentBilling':{},'transactionTags':{'1':{'id':'14000000003502'}}}),
                (2*index,{'patientPaymentBilling':{}}),
            ]
            for amount,raw in patient_rows:conn.execute('INSERT INTO patient_payments VALUES(?,?,?,?,?,?)',(1,'PatientProcedurePayment',-amount,'2026-01-10',loc,json.dumps(raw)))
            insurance_rows=[
                (20*index,{'patientPaymentBilling':{'checkNumber':'QA-SHARED-CHECK'}}),
                (11*index,{'patientPaymentBilling':{'creditCardType':2}}),
                (13*index,{'patientPaymentBilling':{'referenceNumber':'EFT-QA-SHARED'}}),
                (17*index,{'patientPaymentBilling':{}}),
            ]
            for amount,raw in insurance_rows:conn.execute('INSERT INTO insurance_payments VALUES(?,?,?,?,?,?,?)',(1,'InsurancePayment',-amount,'2026-01-10',None,loc,json.dumps(raw)))
        # An insurance payment is attributed to its claim office, not the fallback office.
        conn.execute('INSERT INTO insurance_payments VALUES(?,?,?,?,?,?,?)',(1,'InsurancePayment',-9,'2026-01-10','200','300',json.dumps({'patientPaymentBilling':{'checkNumber':'QA-CLAIM-OFFICE'}})))
        for active,amount,day in [(0,-1000,'2026-01-10'),(1,1000,'2026-01-10'),(1,-1000,'2025-01-10')]:
            conn.execute('INSERT INTO patient_payments VALUES(?,?,?,?,?,?)',(active,'PatientProcedurePayment',amount,day,'100',json.dumps({'patientPaymentBilling':{'creditCardType':1}})))
        conn.commit();conn.close()
        cls.before=hashlib.sha256(cls.database.read_bytes()).hexdigest()
        cls.candidate=staticmethod(load(CANDIDATE,cls.database));cls.baseline=staticmethod(load(BASELINE,cls.database))
        cls.connect=sqlite3.connect

    @classmethod
    def tearDownClass(cls):
        assert hashlib.sha256(cls.database.read_bytes()).hexdigest()==cls.before
        cls.temp.cleanup()

    def read(self,scope=None,old=False,start='2026-01-01',end='2026-06-30'):
        def readonly(_path,*args,**kwargs):
            self.assertEqual(str(_path),str(self.database))
            c=self.connect(self.database.as_uri()+'?mode=ro',uri=True);c.execute('PRAGMA query_only=ON');return c
        with patch('sqlite3.connect',readonly):return (self.baseline if old else self.candidate)(start,end,scope)

    @staticmethod
    def methods(response):return {row['methodKey']:row for row in response['paymentMethods']}

    def test_previous_multi_scope_reproduces_all_office_leak(self):
        self.assertEqual(self.methods(self.read('100,200',old=True)),self.methods(self.read(None,old=True)))
        self.assertNotEqual(self.methods(self.read('100,200')),self.methods(self.read(None)))

    def test_combined_amounts_counts_and_nested_cards_exclude_third_office(self):
        m=self.methods(self.read('100,200'))
        self.assertEqual((m['credit_card']['count'],m['credit_card']['amount']),(2,30))
        self.assertEqual((m['credit_card']['cardTypes'][0]['count'],m['credit_card']['cardTypes'][0]['amount']),(2,30))
        self.assertEqual(m['check']['amount'],15);self.assertEqual(m['cash']['amount'],9)
        self.assertEqual(m['insurance_credit_card']['amount'],33)

    def test_deposit_counts_are_distinct_across_selected_offices(self):
        m=self.methods(self.read('100,200'))
        self.assertEqual((m['insurance_electronic']['count'],m['insurance_electronic']['depositCount']),(2,1))
        self.assertEqual((m['insurance_check']['count'],m['insurance_check']['depositCount'],m['insurance_check']['amount']),(3,2,69))
        self.assertGreater(sum(self.methods(self.read(loc))['insurance_electronic']['depositCount'] for loc in ['100','200']),m['insurance_electronic']['depositCount'])

    def test_single_and_all_response_contracts_remain_exact(self):
        for scope in [None,'','100','200','300']:
            with self.subTest(scope=scope):self.assertEqual(self.read(scope),self.read(scope,old=True))

    def test_duplicate_ids_do_not_duplicate_values(self):
        self.assertEqual(self.methods(self.read('100,200,100')),self.methods(self.read('100,200')))

    def test_unknown_or_malformed_scope_fails_before_database_access(self):
        for scope in ['missing','100,missing',' ',"100'); DELETE FROM patient_payments; --"]:
            with self.subTest(scope=scope),patch('sqlite3.connect',side_effect=AssertionError('Database must not open')):
                with self.assertRaises(HTTPException) as caught:self.candidate('2026-01-01','2026-06-30',scope)
                self.assertEqual(caught.exception.status_code,422)

    def test_period_filters_and_legitimate_empty_results(self):
        m=self.methods(self.read('100,200',start='2020-01-01',end='2020-01-31'))
        self.assertEqual(m['credit_card']['count'],0);self.assertEqual(m['credit_card']['amount'],0)
        self.assertIsNone(m['electronic_transfer']['amount']);self.assertFalse(m['electronic_transfer']['enabled'])

    def test_claims_provider_activity_and_category_scope_use_same_selected_ids(self):
        result=self.read('100,200')
        self.assertEqual(sum(p['count'] or 0 for p in result['providers']),3)
        self.assertEqual(sum(s['count'] for s in result['collectionStatuses']),2)
        self.assertEqual(sum(c['procedureCount'] for c in result['serviceCategories']),3)

if __name__=='__main__':unittest.main()
