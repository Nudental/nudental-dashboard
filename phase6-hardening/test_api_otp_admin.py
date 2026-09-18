"""Current-account admin checks; no real OTP, device, config or mail mutation."""
import ast
import asyncio
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
import unittest

ACTIVE={'id':'synthetic-user','role':'super_admin','is_active':True,'is_approved':True,'status':'Active'}
HELPERS={'_get_user_profile','_is_active_approved','_is_admin_or_super','_is_super_admin'}
ROUTES={'revoke_trusted_device','list_trusted_devices','get_otp_config','update_otp_config'}

class HttpFailure(Exception):
    def __init__(self,status_code,detail):self.status_code=status_code

class OTPAdminTests(unittest.TestCase):
    def setUp(self):
        self.effects=[];self.profile=dict(ACTIVE)
        def get(url,**kwargs):
            self.effects.append(('get',url,kwargs))
            return SimpleNamespace(status_code=200,json=lambda: [self.profile] if 'user_profiles' in url else [])
        def patch(url,**kwargs):
            self.effects.append(('patch',url,kwargs))
            return SimpleNamespace(status_code=200,json=lambda:[{'id':'synthetic-device'}])
        self.ns=dict(Optional=Optional,Request=object,Body=lambda default=None,**kwargs:default,
            HTTPException=HttpFailure,http_requests=SimpleNamespace(get=get,patch=patch),
            _sb_url=lambda table:'https://synthetic.invalid/rest/'+table,_sb_headers=lambda:{},
            _get_user_from_request=lambda request:{'id':ACTIVE['id']},_get_client_ip=lambda request:'synthetic',
            _now_iso=lambda:'2099-01-01T00:00:00Z',_get_otp_config=lambda:{'otp_enabled':True},
            _audit_log=lambda *args:self.effects.append(('audit',args)))
        self.load(os.environ.get('NDASH_OTP_TEMPLATE') or str(Path(__file__).parent.parent/'recovered-backend/templates/middleware/otp_auth.py.in'))

    def load(self,path):
        tree=ast.parse(Path(path).read_text())
        for node in tree.body:
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name in HELPERS|ROUTES:
                node.decorator_list=[]
                exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-otp-admin-source','exec'),self.ns)

    def run_route(self,name,**kwargs):
        return asyncio.run(self.ns[name](SimpleNamespace(),**kwargs))

    def assert_rejected_without_effect(self,name,**kwargs):
        self.effects=[]
        with self.assertRaises(HttpFailure) as e:self.run_route(name,**kwargs)
        self.assertEqual(e.exception.status_code,403)
        self.assertEqual([e[0] for e in self.effects],['get'])

    def test_original_helper_reproduces_inactive_admin_privilege(self):
        source=Path(os.environ['NDASH_OTP_BASELINE']).read_text()
        node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='_is_admin_or_super')
        ns={};exec(compile(ast.Module(body=[node],type_ignores=[]),'old-otp-helper','exec'),ns)
        self.assertTrue(ns['_is_admin_or_super']({**ACTIVE,'is_active':False}))

    def test_current_active_profile_columns_requested(self):
        self.ns['_get_user_profile'](ACTIVE['id'])
        params=self.effects[0][2]['params']
        self.assertTrue({'is_active','is_approved','status'} <= set(params['select'].split(',')))
        self.assertEqual(params['id'],'eq.'+ACTIVE['id'])

    def test_inactive_unapproved_or_nonactive_admin_cannot_read_config(self):
        for field,value in [('is_active',False),('is_active',1),('is_approved',False),('is_approved',None),('status','Inactive'),('status',None)]:
            self.profile={**ACTIVE,field:value}
            self.assert_rejected_without_effect('get_otp_config')

    def test_disabled_super_cannot_change_config(self):
        self.profile={**ACTIVE,'is_active':False}
        self.assert_rejected_without_effect('update_otp_config',config_update={'otp_enabled':False})

    def test_disabled_admin_cannot_read_other_users_devices(self):
        self.profile={**ACTIVE,'is_approved':False}
        self.assert_rejected_without_effect('list_trusted_devices',target_user_id='someone-else')

    def test_disabled_admin_cannot_revoke_other_users_devices(self):
        self.profile={**ACTIVE,'status':'Inactive'}
        self.assert_rejected_without_effect('revoke_trusted_device',target_user_id='someone-else',revoke_all=True)

    def test_disabled_admin_single_device_revoke_is_restricted_to_own_identity(self):
        self.profile={**ACTIVE,'status':'Inactive'}
        self.run_route('revoke_trusted_device',device_id='synthetic-device')
        target=next(e[1] for e in self.effects if e[0]=='patch')
        self.assertIn('&user_id=eq.'+ACTIVE['id'],target)

    def test_active_admin_read_and_super_only_update_boundary_preserved(self):
        self.profile={**ACTIVE,'role':'admin'}
        self.assertEqual(self.run_route('get_otp_config'),{'otp_enabled':True})
        self.assert_rejected_without_effect('update_otp_config',config_update={'otp_enabled':False})

    def test_active_super_passes_role_check_before_invalid_config_validation(self):
        with self.assertRaises(HttpFailure) as e:self.run_route('update_otp_config',config_update={'invalid':True})
        self.assertEqual(e.exception.status_code,400)
        self.assertEqual([e[0] for e in self.effects],['get'])

    def test_active_admin_device_management_is_preserved(self):
        self.profile={**ACTIVE,'role':'admin'}
        self.assertEqual(self.run_route('list_trusted_devices',target_user_id='someone-else'),[])
        self.assertEqual(self.effects[-1][2]['params']['user_id'],'eq.someone-else')

    def test_missing_or_wrong_role_never_granted(self):
        for profile in [None,{}, {**ACTIVE,'role':'staff'},{**ACTIVE,'role':'regional_manager'}]:
            self.assertFalse(self.ns['_is_admin_or_super'](profile))
            self.assertFalse(self.ns['_is_super_admin'](profile))

if __name__=='__main__':unittest.main()
