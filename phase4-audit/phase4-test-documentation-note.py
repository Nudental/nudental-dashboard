import ast,os,pathlib,unittest
path=pathlib.Path(os.environ['NDASH_DOC_SOURCE']);tree=ast.parse(path.read_text())
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_adjustments_review')
projections=[n for n in ast.walk(fn) if isinstance(n,ast.Dict) and any(isinstance(k,ast.Constant) and k.value=='triggered_flag_labels' for k in n.keys)]
assert len(projections)==1
projection=compile(ast.Expression(projections[0]),'<actual documentation projection>','eval')
def project(note):
    p={k:'QA fixture' for k in ['adjustment_id','patient_id','patient_name','office','adjustment_category_label','transaction_date','entry_date','online_user_name']}
    p.update(note=note,signed_amount=-12.5,approval_evidence_status='evidence_missing',review_flags=['approval_evidence_missing'],review_flag_labels=['Approval Evidence Missing'])
    return eval(projection,{'p':p,'matching':['approval_evidence_missing'],'doc_flag_set':{'approval_evidence_missing'}})
class DocumentationProjection(unittest.TestCase):
    def test_existing_note_survives_projection(self):self.assertEqual(project('Harmless synthetic QA note').get('note'),'Harmless synthetic QA note')
    def test_absent_note_is_explicit_null(self):
        result=project(None);self.assertIn('note',result);self.assertIsNone(result['note'])
    def test_amount_and_review_evidence_are_preserved(self):
        result=project('QA');self.assertEqual(result['amount'],-12.5);self.assertEqual(result['triggered_flags'],['approval_evidence_missing']);self.assertEqual(result['triggered_flag_labels'],['Approval Evidence Missing']);self.assertEqual(result['approval_evidence_status'],'evidence_missing')
if __name__=='__main__':unittest.main()
