def admin_sync_dashboard():
    """Read current job instrumentation and endpoint reachability without executing jobs."""
    import requests

    def read_status_rows(table, fields, key_field):
        cfg = _load_supabase_config()
        response = requests.get(
            cfg['project_url'].rstrip('/') + '/rest/v1/' + table,
            params={'select': fields, 'order': key_field, 'limit': 500},
            headers={'apikey': cfg['secret_key'], 'Authorization': 'Bearer ' + cfg['secret_key'], 'Prefer': 'count=exact'},
            timeout=20,
        )
        if response.status_code not in (200, 206):
            raise ValueError('Status source is unavailable')
        rows = response.json()
        total = response.headers.get('content-range', '').rsplit('/', 1)[-1]
        if not isinstance(rows, list) or not total.isdigit() or int(total) != len(rows) or len(rows) > 500:
            raise ValueError('Status source returned incomplete results')
        keys = [row.get(key_field) for row in rows if isinstance(row, dict)]
        if len(keys) != len(rows) or any(not key for key in keys) or len(set(keys)) != len(keys):
            raise ValueError('Status source returned invalid rows')
        return rows

    try:
        raw_jobs = read_status_rows(
            'sync_job_latest',
            'job_key,job_name,source_system,job_trigger_type,schedule_description,is_manual_only,'
            'detail_log_table,notes,last_status,last_started_at,last_completed_at,last_duration_ms,'
            'last_rows_read,last_rows_inserted,last_rows_updated,last_rows_failed,freshness_status,effective_status',
            'job_key',
        )
        jobs = []
        for row in raw_jobs:
            status = row.get('effective_status') or row.get('last_status') or 'unknown'
            jobs.append({
                'job_key': row['job_key'],
                'job_name': row.get('job_name') or row['job_key'],
                'source_system': row.get('source_system'),
                'trigger_type': row.get('job_trigger_type'),
                'schedule_description': row.get('schedule_description'),
                'is_manual_only': bool(row.get('is_manual_only')),
                'status': status,
                'freshness_status': row.get('freshness_status') or 'unknown',
                'last_started_at': row.get('last_started_at'),
                'last_completed_at': row.get('last_completed_at'),
                'last_success_at': row.get('last_completed_at') if row.get('last_status') in ('success', 'completed') else None,
                'last_failure_at': row.get('last_completed_at') if row.get('last_status') in ('failed', 'error') else None,
                'duration_ms': row.get('last_duration_ms'),
                'avg_duration_ms': row.get('last_duration_ms'),
                'rows_processed': row.get('last_rows_read'),
                'rows_read': row.get('last_rows_read'),
                'rows_inserted': row.get('last_rows_inserted'),
                'rows_updated': row.get('last_rows_updated'),
                'rows_failed': row.get('last_rows_failed'),
                'log_source': row.get('detail_log_table') or ('sync_job_runs' if row.get('last_started_at') else None),
                'notes': row.get('notes'),
            })
        summary = {
            'jobs_total': len(jobs),
            'jobs_with_reliable_last_run': sum(bool(j['last_completed_at']) for j in jobs),
            'jobs_awaiting_first_run': sum(j['status'] == 'awaiting_first_run' for j in jobs),
            'jobs_manual_only': sum(j['is_manual_only'] for j in jobs),
            'jobs_not_instrumented': sum(j['status'] == 'not_instrumented' for j in jobs),
            'jobs_healthy': sum(j['status'] in ('success', 'completed') and j['freshness_status'] == 'fresh' for j in jobs),
            'jobs_stale': sum(j['freshness_status'] == 'stale' for j in jobs),
            'jobs_failed': sum(j['status'] in ('failed', 'error') for j in jobs),
            'jobs_running': sum(j['status'] == 'running' for j in jobs),
            'last_successful_run': max((j['last_success_at'] for j in jobs if j['last_success_at']), default=None),
        }
        api_health = read_status_rows(
            'api_endpoint_registry',
            'endpoint_key,description,health_status,is_active,last_tested_at,last_success_at,last_error_at,last_error_message,notes',
            'endpoint_key',
        )
        return {
            'summary': summary,
            'jobs': jobs,
            'api_endpoint_health': api_health,
            # The UI already reads the existing data_sync_logs history separately.
            'legacy_sync_logs': [],
            'generated_at': datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        raise HTTPException(502, 'Sync status sources could not be read completely. Please retry.') from None
