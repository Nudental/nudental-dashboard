"""Verify Plaid's signed raw webhook before any existing dispatch can run.

Uses the installed PyJWT/cryptography libraries and the existing Plaid account.
No provider token, connection, business record or job configuration is changed.
"""
import asyncio
import hashlib
import hmac
import json
import re
import time


class WebhookFailure(Exception):
    def __init__(self, status=401):
        self.status = status
        super().__init__('Webhook verification failed')


def fetch_verification_key(key_id, origin, client_id, secret, *, session_factory=None):
    if origin not in {'https://production.plaid.com', 'https://sandbox.plaid.com'}:
        raise WebhookFailure(503)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', key_id) or not client_id or not secret:
        raise WebhookFailure(503)
    if session_factory is None:
        import requests
        session_factory = requests.Session
    try:
        with session_factory() as session:
            session.trust_env = False
            response = session.post(origin + '/webhook_verification_key/get',
                json={'client_id': client_id, 'secret': secret, 'key_id': key_id},
                timeout=(3, 10), allow_redirects=False)
            if response.status_code != 200 or len(response.content) > 65536:
                raise WebhookFailure(503)
            result = response.json()
            if not isinstance(result, dict) or not isinstance(result.get('key'), dict):
                raise WebhookFailure(503)
            return result['key']
    except WebhookFailure:
        raise
    except Exception:
        raise WebhookFailure(503) from None


def verify_signature(signed, body, load_key, *, now=None):
    import jwt
    current = time.time() if now is None else now
    if not isinstance(signed, str) or not 1 <= len(signed) <= 8192 or not isinstance(body, bytes) or len(body) > 1048576:
        raise WebhookFailure()
    try:
        header = jwt.get_unverified_header(signed)
        kid = header.get('kid')
        if (header.get('alg') != 'ES256' or header.get('crit') or header.get('b64') is False
                or not isinstance(kid, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', kid)):
            raise WebhookFailure()
    except WebhookFailure:
        raise
    except Exception:
        raise WebhookFailure() from None
    try:
        key = load_key(kid)
    except WebhookFailure:
        raise
    except Exception:
        raise WebhookFailure(503) from None
    try:
        if (not isinstance(key, dict) or key.get('kid') != kid or key.get('alg') != 'ES256'
                or key.get('kty') != 'EC' or key.get('crv') != 'P-256' or key.get('use') != 'sig'):
            raise WebhookFailure()
        expired = key.get('expired_at')
        if expired is not None and (type(expired) not in (int, float) or expired <= current):
            raise WebhookFailure()
        public_key = jwt.PyJWK.from_dict(key, algorithm='ES256').key
        claims = jwt.decode(signed, public_key, algorithms=['ES256'],
            options={'require': ['iat', 'request_body_sha256'], 'verify_iat': False, 'verify_aud': False})
        issued = claims.get('iat')
        digest = claims.get('request_body_sha256')
        if (type(issued) is not int or not current - 300 <= issued <= current + 30
                or not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest)
                or not hmac.compare_digest(digest, hashlib.sha256(body).hexdigest())):
            raise WebhookFailure()
    except WebhookFailure:
        raise
    except Exception:
        raise WebhookFailure() from None


async def verify_request(request, load_key, known_items):
    values = request.headers.getlist('plaid-verification')
    if len(values) != 1 or not values[0]:
        raise WebhookFailure()
    length = request.headers.get('content-length')
    if length and (not length.isdigit() or int(length) > 1048576):
        raise WebhookFailure(413)
    body = await request.body()
    await asyncio.to_thread(verify_signature, values[0], body, load_key)
    try:
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise WebhookFailure(400)
        kind, code = payload.get('webhook_type'), payload.get('webhook_code')
        can_dispatch = ((kind == 'TRANSACTIONS' and code in {'DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'})
                        or (kind == 'ITEM' and code in {'ERROR', 'ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION'}))
        if can_dispatch:
            items = await asyncio.to_thread(known_items)
            item_id = payload.get('item_id')
            if not isinstance(items, dict):
                raise WebhookFailure(503)
            if not isinstance(item_id, str) or item_id not in items:
                raise WebhookFailure(403)
    except WebhookFailure:
        raise
    except (ValueError, TypeError):
        raise WebhookFailure(400) from None
    except Exception:
        raise WebhookFailure(503) from None
