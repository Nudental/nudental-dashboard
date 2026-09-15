import unittest,zipfile,io,stat,json
import qa_deploy,qa_egress
class IsolationTests(unittest.TestCase):
    def archive(self,name='qa_launcher.py',mode=stat.S_IFREG|0o644):
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w') as z:
            info=zipfile.ZipInfo(name);info.external_attr=mode<<16;z.writestr(info,'# synthetic QA launcher')
        return data.getvalue()
    def test_regular_release(self):
        z,m=qa_deploy.validated_members(self.archive());self.assertEqual(len(m),1);z.close()
    def test_unsafe_archives_denied(self):
        for name in ('../qa_launcher.py','/qa_launcher.py','a/../../qa_launcher.py','a\\qa_launcher.py','C:/qa_launcher.py','./qa_launcher.py','.env.qa'):
            with self.subTest(name=name),self.assertRaises(ValueError):qa_deploy.validated_members(self.archive(name))
    def test_links_and_devices_denied(self):
        for mode in (stat.S_IFLNK|0o777,stat.S_IFCHR|0o666,stat.S_IFBLK|0o666,stat.S_IFIFO|0o666):
            with self.subTest(mode=mode),self.assertRaises(ValueError):qa_deploy.validated_members(self.archive(mode=mode))
    def test_missing_launcher_denied(self):
        with self.assertRaises(ValueError):qa_deploy.validated_members(self.archive('other.py'))
    def config(self):return {'project_ref':qa_deploy.PROJECT,'supabase_url':qa_egress.ORIGIN,'publishable_key':'sb_publishable_synthetic','secret_key':'sb_secret_synthetic','api_key':'synthetic-qa-key-'*3}
    def test_qa_config_accepted(self):self.assertEqual(json.loads(qa_deploy.validated_config(json.dumps(self.config())))['project_ref'],qa_deploy.PROJECT)
    def test_other_project_and_injected_config_denied(self):
        for change in ({'project_ref':'siwtadgdqtvxoztnxzhx'},{'supabase_url':'https://api.nudashboard.com'},{'api_key':'x\nROOT=value'},{'secret_key':'wrong'},{'extra':'field'}):
            with self.subTest(change=change),self.assertRaises(ValueError):qa_deploy.validated_config(json.dumps(self.config()|change))
    def test_expected_supabase_paths(self):
        for path in ('/auth/v1/user','/rest/v1/tasks?select=id&limit=2','/storage/v1/object/qa/test.txt'):
            with self.subTest(path=path):self.assertTrue(qa_egress.allowed_path(path))
    def test_external_and_escaped_paths_denied(self):
        for path in ('https://api.nudashboard.com/','//other.example/rest/v1/','/functions/v1/send-email','/rest/v1/../auth','/rest/v1/%2e%2e/auth','/rest/v1/a%5cb','/rest/v1/a%0db','/rest/v1/a#b','/admin','/rest/v1/x/./y'):
            with self.subTest(path=path):self.assertFalse(qa_egress.allowed_path(path))
if __name__=='__main__':unittest.main()
