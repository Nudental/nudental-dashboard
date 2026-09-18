"""Two legacy maintenance writes; no new workflow or job execution grant.

Goal administration follows the existing Super Admin Management boundary.
Backend-only EOD queue sync follows the existing privileged Sync action rule.
Ordinary EOD access is not authority to regenerate the shared queue.
"""
from api_identity import UserIdentity

GOAL='/v2/goals'
EOD_SYNC='/v2/eod/unscheduled-treatment/sync'
MAINTENANCE_WRITES=frozenset({GOAL,EOD_SYNC})


def is_maintenance_request(scope):
    # GET /goals belongs to the separate aggregate-read policy and validators.
    return scope.get('path') in MAINTENANCE_WRITES and scope.get('method')!='GET'


def maintenance_authorize(actor,scope):
    if (not isinstance(actor,UserIdentity) or not actor.all_offices
            or scope['method']!='POST' or scope['path'] not in MAINTENANCE_WRITES):
        return False
    if actor.role=='super_admin':return True
    if scope['path']==EOD_SYNC:
        return (actor.role=='admin' and 'admin.sync.view' in actor.permissions
                and 'admin.sync.view' not in actor.disabled_permissions)
    return False
