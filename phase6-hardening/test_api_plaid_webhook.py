"""Signed synthetic webhook contracts; no provider calls, processes or email."""
import ast
import hashlib
import json
import os
from pathlib import Path
from types import SimpleNamespace
import time
import unittest
from unittest.mock import patch
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI, Request, HTTPException
from fastapi.testclient import TestClient
from api_plaid_webhook import WebhookFailure, fetch_verification_key, verify_signature


class SignedFixtures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private=ec.generate_private_key(ec.SECP256R1())
        cls.jwk=json.loads(jwt.algorithms.ECAlgorithm.to_jwk(cls.private.public_key()))
        cls.jwk.update(kid='synthetic-key',alg='ES256',use='sig',expired_at=None)

    def setUp(self):
        self.now=int(time.time());self.lookups=[]
        self.body=b'{"webhook_type":"TRANSACTIONS","webhook_code":"DEFAULT_UPDATE","item_id":"synthetic-item","new_transactions":0}'

    def signed(self,body=None,claims=None,headers=None,private=None):
        data={'iat':self.now,'request_body_sha256':hashlib.sha256(self.body if body is None else body).hexdigest()}
        if claims is not None:data=claims
        return jwt.encode(data,private or self.private,algorithm='ES256',headers=headers or {'kid':'synthetic-key'})

    def lookup(self,kid):
        self.lookups.append(kid);return self.jwk

    def reject(self,token,body=None,load_key=None,status=401):
        with self.assertRaises(WebhookFailure) as e:
            verify_signature(token,self.body if body is None else body,load_key or self.lookup,now=self.now)
        self.assertEqual(e.exception.status,status)


class WebhookSignatureTests(SignedFixtures):
    def test_valid_es256_raw_body(self):
        verify_signature(self.signed(),self.body,self.lookup,now=self.now)
        self.assertEqual(self.lookups,['synthetic-key'])

    def test_raw_body_tamper_or_whitespace_change_denied(self):
        for body in [self.body+b' ',self.body.replace(b'0',b'1'),b'{}']:
            self.reject(self.signed(),body)

    def test_wrong_signing_key_rejected(self):
        self.reject(self.signed(private=ec.generate_private_key(ec.SECP256R1())))

    def test_embedded_attacker_key_does_not_replace_provider_key(self):
        private=ec.generate_private_key(ec.SECP256R1())
        other=json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
        self.reject(self.signed(private=private,headers={'kid':'synthetic-key','jwk':other}))

    def test_algorithm_confusion_rejected_before_key_fetch(self):
        for alg,key in [('none',None),('HS256','synthetic-key-not-a-secret')]:
            token=jwt.encode({'iat':self.now},key,algorithm=alg,headers={'kid':'synthetic-key'})
            self.reject(token)
        self.assertFalse(self.lookups)

    def test_malformed_or_oversize_header_rejected_without_fetch(self):
        for token in ['', 'not.jwt', 'x'*8193]:self.reject(token)
        self.assertFalse(self.lookups)

    def test_missing_or_invalid_kid_rejected_before_fetch(self):
        for headers in [{'typ':'JWT'},{'kid':'../bad'},{'kid':123},{'kid':'x'*129}]:
            # PyJWT itself rejects non-string kid, as does the production decoder.
            if headers.get('kid')==123:continue
            self.reject(self.signed(headers=headers))
        self.assertFalse(self.lookups)

    def test_unsupported_critical_header_rejected(self):
        self.reject(self.signed(headers={'kid':'synthetic-key','crit':['unexpected']}))
        self.assertFalse(self.lookups)

    def test_stale_future_and_noninteger_issued_at_rejected(self):
        digest=hashlib.sha256(self.body).hexdigest()
        for value in [self.now-301,self.now+31,str(self.now),True,None]:
            self.reject(self.signed(claims={'iat':value,'request_body_sha256':digest}))

    def test_required_claims_and_hash_format(self):
        for claims in [{},{'iat':self.now},{'request_body_sha256':'0'*64},{'iat':self.now,'request_body_sha256':'x'*64},{'iat':self.now,'request_body_sha256':7}]:
            self.reject(self.signed(claims=claims))

    def test_oversize_body_rejected_before_fetch(self):
        self.reject(self.signed(),b'x'*1048577);self.assertFalse(self.lookups)

    def test_jwk_metadata_mismatch_rejected(self):
        for key,value in [('kid','other'),('alg','HS256'),('kty','RSA'),('crv','P-384'),('use','enc'),('expired_at',self.now-1),('expired_at','bad')]:
            self.reject(self.signed(),load_key=lambda kid,k=key,v=value:{**self.jwk,k:v})

    def test_provider_lookup_failure_is_sanitized(self):
        def unavailable(kid):raise RuntimeError('private-provider-detail')
        self.reject(self.signed(),load_key=unavailable,status=503)


class KeyTransportTests(unittest.TestCase):
    def session(self,status=200):
        calls=[]
        class Session:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def post(self,url,**kwargs):
                calls.append((url,kwargs,self.trust_env))
                return SimpleNamespace(status_code=status,content=b'{}',json=lambda:{'key':{'kid':'synthetic-key'}})
        return Session,calls

    def test_key_request_uses_only_existing_origin_and_no_redirect(self):
        session,calls=self.session()
        result=fetch_verification_key('synthetic-key','https://production.plaid.com','synthetic-client','synthetic-secret',session_factory=session)
        self.assertEqual(result,{'kid':'synthetic-key'})
        self.assertEqual(calls[0][0],'https://production.plaid.com/webhook_verification_key/get')
        self.assertEqual(calls[0][1]['json'],{'client_id':'synthetic-client','secret':'synthetic-secret','key_id':'synthetic-key'})
        self.assertFalse(calls[0][1]['allow_redirects']);self.assertFalse(calls[0][2])
        self.assertEqual(calls[0][1]['timeout'],(3,10))

    def test_wrong_origin_denied_before_sending_credentials(self):
        session,calls=self.session()
        for url in ['http://production.plaid.com','https://production.plaid.com.evil.invalid','https://other.invalid']:
            with self.assertRaises(WebhookFailure):fetch_verification_key('synthetic-key',url,'c','s',session_factory=session)
        self.assertFalse(calls)

    def test_provider_error_or_redirect_fails_closed(self):
        for status in [302,400,401,500]:
            session,calls=self.session(status)
            with self.assertRaises(WebhookFailure) as e:fetch_verification_key('synthetic-key','https://production.plaid.com','c','s',session_factory=session)
            self.assertEqual(e.exception.status,503)


class WebhookRouteTests(SignedFixtures):
    def setUp(self):
        super().setUp()
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
        node=next(n for n in tree.body if isinstance(n,ast.AsyncFunctionDef) and n.name=='plaid_webhook');node.decorator_list=[]
        ns=dict(Request=Request,HTTPException=HTTPException,PLAID_BASE_URL='https://production.plaid.com',PLAID_CLIENT_ID='synthetic-client',PLAID_PRODUCTION_SECRET='synthetic-secret',
                logger=SimpleNamespace(info=lambda *a:None,error=lambda *a:None,warning=lambda *a:None),
                load_plaid_tokens=lambda **kwargs:{'synthetic-item':{'institution_name':'Synthetic'}})
        exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-plaid-webhook','exec'),ns)
        app=FastAPI();app.add_api_route('/plaid/webhook',ns['plaid_webhook'],methods=['POST'])
        self.client=self.enterContext(TestClient(app))
        self.key=self.enterContext(patch('api_plaid_webhook.fetch_verification_key',side_effect=lambda *a,**k:self.lookup(a[0])))
        self.process=self.enterContext(patch('subprocess.Popen'))

    def post(self,body=None,signed=None,extra_headers=None):
        body=self.body if body is None else body
        headers={'Content-Type':'application/json',**(extra_headers or {})}
        if signed is not None:headers['Plaid-Verification']=signed
        return self.client.post('/plaid/webhook',content=body,headers=headers)

    def test_unsigned_original_attack_denied_before_dispatch_or_key_lookup(self):
        self.assertEqual(self.post().status_code,401);self.process.assert_not_called();self.key.assert_not_called()

    def test_invalid_signature_or_body_denied_before_dispatch(self):
        for signed in ['malformed',self.signed(private=ec.generate_private_key(ec.SECP256R1()))]:
            self.assertEqual(self.post(signed=signed).status_code,401)
        self.assertEqual(self.post(body=self.body+b' ',signed=self.signed()).status_code,401)
        self.process.assert_not_called()

    def test_valid_existing_item_keeps_original_transaction_dispatch(self):
        r=self.post(signed=self.signed())
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['status'],'sync_triggered')
        self.assertEqual(self.process.call_count,1)

    def test_signed_other_account_item_cannot_trigger_dispatch(self):
        body=self.body.replace(b'synthetic-item',b'other-item')
        self.assertEqual(self.post(body=body,signed=self.signed(body=body)).status_code,403)
        self.process.assert_not_called()

    def test_valid_item_alert_uses_only_intercepted_existing_dispatch(self):
        body=b'{"webhook_type":"ITEM","webhook_code":"ITEM_LOGIN_REQUIRED","item_id":"synthetic-item"}'
        r=self.post(body=body,signed=self.signed(body=body))
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()['status'],'alert_sent')
        self.assertEqual(self.process.call_count,1)

    def test_oversize_declared_body_denied_before_provider_lookup(self):
        r=self.post(signed=self.signed(),extra_headers={'Content-Length':'1048577'})
        self.assertEqual(r.status_code,413);self.process.assert_not_called();self.key.assert_not_called()

    def test_signed_nonobject_or_invalid_json_rejected(self):
        for body in [b'[]',b'invalid-json']:
            self.assertEqual(self.post(body=body,signed=self.signed(body=body)).status_code,400)
        self.process.assert_not_called()

    def test_duplicate_verification_headers_denied(self):
        r=self.client.post('/plaid/webhook',content=self.body,headers=[('Plaid-Verification',self.signed()),('Plaid-Verification',self.signed())])
        self.assertEqual(r.status_code,401);self.process.assert_not_called();self.key.assert_not_called()

    def test_valid_informational_message_remains_nonexecuting(self):
        body=b'{"webhook_type":"TRANSACTIONS","webhook_code":"TRANSACTIONS_REMOVED"}'
        r=self.post(body=body,signed=self.signed(body=body))
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()['status'],'received');self.process.assert_not_called()

if __name__=='__main__':unittest.main()
