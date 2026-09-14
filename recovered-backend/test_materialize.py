import ast,hashlib,json,tempfile,unittest
from pathlib import Path
from materialize import prepare,materialize

class MaterializerTests(unittest.TestCase):
    def setUp(self):
        self.workspace=Path(__file__).resolve().parents[1]
        self.temp=tempfile.TemporaryDirectory(prefix='qa-materializer-',dir=self.workspace)
        self.folder=Path(self.temp.name).resolve()
        assert self.folder.is_relative_to(self.workspace)
        self.source=self.folder/'source';self.source.mkdir()
        self.template=self.source/'templates/middleware/main_candidate.py.in'
        self.template.parent.mkdir(parents=True)
        self.code=b'VALUE = __NUDASHBOARD_CONFIG_LITERAL_001__\n'
        self.template.write_bytes(self.code)
        self.record={'source_file':'middleware/main_candidate.py','sha256':hashlib.sha256(b'VALUE = "qa-only"\n').hexdigest(),'template_sha256':hashlib.sha256(self.code).hexdigest()}
        self.rows=[{'file':'middleware/main_candidate.py','marker':'__NUDASHBOARD_CONFIG_LITERAL_001__','kind':'python_literal','literal_type':'str'},self.record]
        self.save_manifest()
        self.values={'__NUDASHBOARD_CONFIG_LITERAL_001__':{'kind':'python_literal','literal':'"qa-only"'}}
        self.valuefile=self.folder/'values.private.json'
        self.valuefile.write_text(json.dumps(self.values))
    def save_manifest(self):
        (self.source/'source-manifest.json').write_text(json.dumps(self.rows))
    def tearDown(self):
        # Cleanup is restricted to this test's verified workspace directory.
        assert self.folder.resolve().is_relative_to(self.workspace)
        self.temp.cleanup()
    def test_exact_round_trip(self):
        out=prepare(self.source,self.values,True)
        self.assertEqual(out[Path('middleware/main_candidate.py')],b'VALUE = "qa-only"\n')
    def test_render_to_new_private_directory(self):
        target=self.folder/'output'
        self.assertEqual(materialize(self.source,self.valuefile,target,True),1)
        self.assertEqual((target/'middleware/main_candidate.py').read_bytes(),b'VALUE = "qa-only"\n')
    def test_missing_slot_rejected(self):
        with self.assertRaisesRegex(ValueError,'incomplete'):prepare(self.source,{})
    def test_unexpected_slot_rejected(self):
        self.values['EXTRA']={}
        with self.assertRaisesRegex(ValueError,'unexpected'):prepare(self.source,self.values)
    def test_code_expression_rejected_without_execution(self):
        self.values['__NUDASHBOARD_CONFIG_LITERAL_001__']['literal']='__import__("os").system("echo forbidden")'
        with self.assertRaisesRegex(ValueError,'code expressions'):prepare(self.source,self.values)
    def test_email_text_cannot_inject_code(self):
        self.rows[0]['kind']='email_text';self.save_manifest()
        self.values['__NUDASHBOARD_CONFIG_LITERAL_001__']={'kind':'email_text','text':'qa@example.invalid"; dangerous()'}
        with self.assertRaisesRegex(ValueError,'email-text'):prepare(self.source,self.values)
    def test_template_changes_require_review(self):
        self.template.write_bytes(self.code+b'# change\n')
        with self.assertRaisesRegex(ValueError,'hash changed'):prepare(self.source,self.values)
    def test_preserved_hash_rejects_different_configuration(self):
        self.values['__NUDASHBOARD_CONFIG_LITERAL_001__']['literal']='"different-qa-value"'
        with self.assertRaisesRegex(ValueError,'preserved production'):prepare(self.source,self.values,True)
    def test_parent_path_rejected(self):
        self.record['source_file']='../outside.py';self.save_manifest()
        with self.assertRaisesRegex(ValueError,'Unsafe source path'):prepare(self.source,self.values)
    def test_existing_output_not_overwritten(self):
        target=self.folder/'output';target.mkdir();(target/'keep.txt').write_text('keep')
        with self.assertRaisesRegex(ValueError,'already exists'):materialize(self.source,self.valuefile,target)
        self.assertEqual((target/'keep.txt').read_text(),'keep')
    def test_invalid_source_never_creates_output(self):
        broken=b'VALUE = (__NUDASHBOARD_CONFIG_LITERAL_001__\n'
        self.template.write_bytes(broken);self.record['template_sha256']=hashlib.sha256(broken).hexdigest();self.save_manifest();target=self.folder/'output'
        with self.assertRaisesRegex(ValueError,'valid Python'):materialize(self.source,self.valuefile,target)
        self.assertFalse(target.exists())
    def test_slot_kind_cannot_change_expression_context(self):
        self.values['__NUDASHBOARD_CONFIG_LITERAL_001__']={'kind':'email_text','text':'qa@example.invalid'}
        with self.assertRaisesRegex(ValueError,'slot type'):prepare(self.source,self.values)
    def test_literal_type_preserved(self):
        self.values['__NUDASHBOARD_CONFIG_LITERAL_001__']['literal']='123'
        with self.assertRaisesRegex(ValueError,'literal type'):prepare(self.source,self.values)

if __name__=='__main__':unittest.main()
