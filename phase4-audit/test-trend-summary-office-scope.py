"""Exercise actual summary readers against an in-memory, synthetic, read-only fixture."""
import json,os,pathlib,sqlite3,types,typing,unittest

ROOT=pathlib.Path(__file__).parent
BASE=json.loads(pathlib.Path(os.environ['NDASH148_BASELINE']).read_text())
MODE=os.environ.get('NDASH148_BEFORE')=='1'
SERVICE='\n\n'.join(BASE['ascend_service.py'].values()) if MODE else (ROOT/'NDASH-148-summary-service.py').read_text()
ROUTES='\n\n'.join(BASE['main_candidate.py'].values()) if MODE else (ROOT/'NDASH-148-summary-routes.py').read_text()

class HTTPException(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail

class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
        self.db.executescript('CREATE TABLE appointments(patient_id TEXT,location_id TEXT,start_time TEXT,status TEXT); CREATE TABLE procedures(patient_id TEXT,location_id TEXT,transaction_date TEXT,is_active INTEGER);')
        rows=[('p1','one','2026-07-10','COMPLETED'),('p1','two','2026-08-03','COMPLETED'),('p2','one','2026-08-05','COMPLETED'),('p2','two','2026-08-06','CHAIR'),('p3','three','2026-08-07','BROKEN'),('p4','one','2026-08-08','NO_SHOW'),('p5','one','2026-09-02','BROKEN'),(None,'one','2026-08-09','CANCELLEDBYOFFICE'),('p2','two','2026-08-05','BROKEN')]
        rows.append(('p2','two','2026-08-05','COMPLETED'))
        self.db.executemany('INSERT INTO appointments VALUES (?,?,?,?)',rows)
        rows=[('p1','two','2026-08-03',1),('p2','one','2026-08-05',1),('p2','two','2026-08-06',1),('p3','three','2026-08-07',1),('p4','one','2026-08-08',1),('p6','one','2026-08-08',0),('p7','one','2026-09-02',1)]
        self.db.executemany('INSERT INTO procedures VALUES (?,?,?,?)',rows);self.db.commit()
        self.db.set_authorizer(lambda action,*args:sqlite3.SQLITE_OK if action in (sqlite3.SQLITE_SELECT,sqlite3.SQLITE_READ,sqlite3.SQLITE_FUNCTION,sqlite3.SQLITE_RECURSIVE) else sqlite3.SQLITE_DENY)
        self.calls=[];self.cache={}
        def query(sql,params):self.calls.append((sql,params));return [dict(row) for row in self.db.execute(sql,params)]
        self.env={'Optional':typing.Optional,'_cache_key':lambda *args:args,'_cache_get':lambda key:self.cache.get(key),'_cache_set':lambda key,value,ttl:self.cache.__setitem__(key,value),'_month_start':lambda:'2026-08-01','_today':lambda:'2026-08-31','_db_has_data':lambda table:True,'_db_query':query}
        exec(SERVICE,self.env)
        self.service=types.SimpleNamespace()
        for name in BASE['ascend_service.py']:setattr(self.service,name,types.MethodType(self.env[name],self.service))
        env={'Optional':typing.Optional,'Query':lambda value:value,'HTTPException':HTTPException,'logger':types.SimpleNamespace(exception=lambda *args:None),'get_service':lambda:self.service,'VALID_LOCATION_IDS':{'one','two','three','four'},'resolve_location_id':lambda officeId=None,locationId=None:{'uuid1':'one','uuid2':'two'}.get(officeId or locationId,officeId or locationId)}
        exec(ROUTES,env);self.routes=env
    def tearDown(self):self.db.close()
    def read(self,name,scope=None,office=None):return self.routes[name]('2026-08-01','2026-08-31',scope,office)
    def test_selected_patients_distinct_and_earliest_date(self):
        row=self.read('patients_summary','one,two');self.assertEqual(row['newPatients'],2);self.assertEqual(row['uniquePatients'],3);self.assertEqual(row['activePatients'],3)
        self.assertEqual(sum(self.read('patients_summary',x)['newPatients'] for x in ['one','two']),4)
    def test_selected_appointment_statuses_and_distinct_clinical_days(self):
        row=self.read('appointments_summary','one,two');self.assertEqual(row['totalScheduled'],7);self.assertEqual(row['completed'],4);self.assertEqual(row['broken'],1);self.assertEqual(row['noShow'],1);self.assertEqual(row['brokenAppointments'],2);self.assertEqual(row['cancelledByOffice'],1);self.assertEqual(row['clinicalDays'],3);self.assertEqual(row['visitsPerDay'],1.33)
        self.assertEqual(sum(self.read('appointments_summary',x)['clinicalDays'] for x in ['one','two']),4)
    def test_all_and_single_complete_response_parity(self):
        old_env=dict(self.env);exec('\n\n'.join(BASE['ascend_service.py'].values()),old_env)
        for name,method in [('patients_summary','get_patients_summary'),('appointments_summary','get_appointments_summary')]:
            for scope in [None,'one','two','three']:
                self.cache.clear();expected=old_env[method](self.service,'2026-08-01','2026-08-31',scope);self.cache.clear();self.assertEqual(self.read(name,scope),expected)
    def test_duplicates_and_uuid_aliases(self):
        for name in ['patients_summary','appointments_summary']:
            self.assertEqual(self.read(name,'one,two'),self.read(name,'uuid1, uuid2,uuid1'))
            self.assertEqual(self.read(name,'one,two'),self.read(name,'three','uuid1,uuid2'))
    def test_invalid_scope_rejected_before_any_database_read(self):
        for name in ['patients_summary','appointments_summary']:
            for scope in ['one,missing','one,,two',"one,two') OR 1=1 --",' ']:
                self.calls.clear()
                with self.assertRaises(HTTPException) as caught:self.read(name,scope)
                self.assertEqual(caught.exception.status_code,422);self.assertEqual(self.calls,[])
    def test_date_bounds_and_source_fields_preserved(self):
        for name in ['patients_summary','appointments_summary']:
            row=self.read(name,'one,two');self.assertEqual(row['startDate'],'2026-08-01');self.assertEqual(row['endDate'],'2026-08-31');self.assertEqual(row['source'],'sqlite')
        self.assertEqual(self.read('patients_summary','four')['newPatients'],0)
        self.assertEqual(self.read('appointments_summary','four')['brokenAppointments'],0)
    def test_unavailable_source_and_cache_preserved(self):
        self.env['_db_has_data']=lambda table:False
        for name in ['patients_summary','appointments_summary']:
            row=self.read(name,'one,two');self.assertEqual(row['source'],'unavailable');self.assertEqual(self.read(name,'one,two'),row)
        self.assertEqual(self.calls,[])
    def test_fixture_rejects_writes(self):
        with self.assertRaises(sqlite3.DatabaseError):self.db.execute('DELETE FROM appointments')

if __name__=='__main__':unittest.main()
