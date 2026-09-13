def get_patients_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        location_id: Optional[str] = None,
    ) -> dict:
        key = _cache_key("patients_summary", start_date, end_date, location_id)
        cached = _cache_get(key)
        if cached is not None:
            return cached

        start = start_date or _month_start()
        end = end_date or _today()
        location_ids = list(dict.fromkeys(location_id.split(','))) if location_id else []
        location_placeholders = ','.join('?' for _ in location_ids)

        # New patient = patient whose earliest appointment falls within the date range
        # (Dentrix API returns NO creation date for patients, so we use first appointment)
        if _db_has_data("appointments"):
            sql = """
                SELECT COUNT(*) as cnt FROM (
                    SELECT patient_id, MIN(substr(start_time, 1, 10)) as first_appt
                    FROM appointments
                    WHERE patient_id IS NOT NULL
            """
            params_list: list = []
            if location_id:
                sql += " AND location_id IN (" + location_placeholders + ")"
                params_list.extend(location_ids)
            sql += """
                    GROUP BY patient_id
                    HAVING first_appt >= ? AND first_appt <= ?
                )
            """
            params_list.extend([start, end])
            rows = _db_query(sql, tuple(params_list))
            new_patients = rows[0]["cnt"] if rows else 0
        else:
            new_patients = 0

        # Unique patients = distinct patients who had any procedure in the date range
        unique_patients = 0
        if _db_has_data("procedures"):
            sql2 = "SELECT COUNT(DISTINCT patient_id) as cnt FROM procedures WHERE patient_id IS NOT NULL AND transaction_date >= ? AND transaction_date <= ? AND is_active = 1"
            params2: list = [start, end]
            if location_id:
                sql2 += " AND location_id IN (" + location_placeholders + ")"
                params2.extend(location_ids)
            rows2 = _db_query(sql2, tuple(params2))
            unique_patients = rows2[0]["cnt"] if rows2 else 0

        result = {
            "startDate": start,
            "endDate": end,
            "newPatients": new_patients,
            "uniquePatients": unique_patients,
            "activePatients": unique_patients,
            "source": "sqlite" if _db_has_data("appointments") else "unavailable",
            "method": "first_appointment_date",
        }
        _cache_set(key, result, ttl=60)
        return result

def get_appointments_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        location_id: Optional[str] = None,
    ) -> dict:
        """Return appointment counts by status for a date range."""
        key = _cache_key("appt_summary", start_date, end_date, location_id)
        cached = _cache_get(key)
        if cached is not None:
            return cached

        start = start_date or _month_start()
        end = end_date or _today()
        location_ids = list(dict.fromkeys(location_id.split(','))) if location_id else []
        location_placeholders = ','.join('?' for _ in location_ids)

        result = {
            "startDate": start,
            "endDate": end,
            "totalScheduled": 0,
            "completed": 0,
            "broken": 0,
            "noShow": 0,
            "cancelled": 0,
            "cancelledByOffice": 0,
            "brokenAppointments": 0,
            "locationId": location_id,
            "source": "sqlite",
        }

        if not _db_has_data("appointments"):
            result["source"] = "unavailable"
            _cache_set(key, result, ttl=60)
            return result

        sql = """
            SELECT status, COUNT(*) as cnt
            FROM appointments
            WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
        """
        params_list: list = [start, end]
        if location_id:
            sql += " AND location_id IN (" + location_placeholders + ")"
            params_list.extend(location_ids)
        sql += " GROUP BY status"

        rows = _db_query(sql, tuple(params_list))
        status_counts: Dict[str, int] = {r["status"]: r["cnt"] for r in rows}

        completed = status_counts.get("COMPLETED", 0) + status_counts.get("CHAIR", 0)
        broken = status_counts.get("BROKEN", 0)
        no_show = status_counts.get("NO_SHOW", 0)
        cancelled = status_counts.get("CANCELLEDBYPATIENT", 0) + status_counts.get("CANCELLED", 0)
        cancelled_by_office = status_counts.get("CANCELLEDBYOFFICE", 0)
        total = sum(status_counts.values())

        # ── clinicalDays: days with at least one delivered appointment ────────
        days_sql = """
            SELECT COUNT(DISTINCT substr(start_time, 1, 10)) AS clinical_days
            FROM appointments
            WHERE status IN ('COMPLETED', 'CHAIR')
              AND substr(start_time, 1, 10) >= ?
              AND substr(start_time, 1, 10) <= ?
        """
        days_params: list = [start, end]
        if location_id:
            days_sql += " AND location_id IN (" + location_placeholders + ")"
            days_params.extend(location_ids)

        days_rows = _db_query(days_sql, tuple(days_params))
        clinical_days = int(days_rows[0]["clinical_days"]) if days_rows else 0

        visits_per_day = round(completed / clinical_days, 2) if clinical_days > 0 else None

        result.update({
            "totalScheduled": total,
            "completed": completed,
            "broken": broken,
            "noShow": no_show,
            "cancelled": cancelled,
            "cancelledByOffice": cancelled_by_office,
            "brokenAppointments": broken + no_show,  # combined metric used by frontend
            "clinicalDays":  clinical_days,
            "visitsPerDay":  visits_per_day,
        })
        _cache_set(key, result, ttl=60)
        return result
