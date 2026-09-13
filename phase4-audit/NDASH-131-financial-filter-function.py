def financial_filter_options(
    startDate:  Optional[str] = Query(None),
    endDate:    Optional[str] = Query(None),
    locationId: Optional[str] = Query(None),
):
    import sqlite3 as _sqlite3
    from datetime import date as _date
    selected_locations = list(dict.fromkeys(value.strip() for value in (locationId or '').split(',') if value.strip()))
    if locationId and (not selected_locations or any(value not in VALID_LOCATION_IDS for value in selected_locations)):
        raise HTTPException(status_code=422, detail="Select valid office locations.")
    location_placeholders = ",".join("?" for _ in selected_locations)
    conn = _sqlite3.connect(RCM_DB_PATH)
    conn.row_factory = _sqlite3.Row
    try:
        today = _date.today().isoformat()
        first_of_month = _date.today().replace(day=1).isoformat()
        start = startDate or first_of_month
        end   = endDate   or today

        # ── 1. Offices ───────────────────────────────────────────────────────
        loc_rows = conn.execute(
            "SELECT id, name, city, state FROM locations WHERE id IN ({}) ORDER BY name"
            .format(",".join("?" * len(VALID_LOCATION_IDS))),
            tuple(VALID_LOCATION_IDS)
        ).fetchall()
        offices = [
            {"officeId": r["id"], "officeName": r["name"], "city": r["city"], "state": r["state"]}
            for r in loc_rows
        ]

        # ── 2. Providers ─────────────────────────────────────────────────────
        # Collect active providers with optional activity counts in date range
        prov_params: list = []
        prov_count_sql = """
            SELECT provider_id, COUNT(*) as cnt
            FROM procedures
            WHERE is_active = 1
              AND transaction_date >= ? AND transaction_date <= ?
              AND ledger_type = 'PatientProcedureLedger'
        """
        prov_params += [start, end]
        if selected_locations:
            prov_count_sql += " AND location_id IN (" + location_placeholders + ")"
            prov_params.extend(selected_locations)
        prov_count_sql += " GROUP BY provider_id"

        activity = {r["provider_id"]: r["cnt"]
                    for r in conn.execute(prov_count_sql, prov_params).fetchall()}

        prov_rows = conn.execute(
            "SELECT id, first_name, last_name, is_active, raw FROM providers ORDER BY last_name, first_name"
        ).fetchall()

        import json as _json

        providers = []
        for r in prov_rows:
            raw = _json.loads(r["raw"] or "{}")
            specialty   = (raw.get("specialty") or "").upper()
            short_name  = raw.get("shortName", "")
            first       = r["first_name"] or ""
            last        = r["last_name"]  or ""
            full_name   = f"{first} {last}".strip() if (first or last) else short_name

            # Skip blank system/location-named providers that have no person name
            # and are in VALID_LOCATION_IDS (house accounts)
            is_location_proxy = r["id"] in VALID_LOCATION_IDS or (
                not first and last in {
                    "NU Dental of Eatontown", "NU Dental Of Staten Island",
                    "NU Dental of Brick", "NU Dental of Barnegat"
                }
            )

            # Conversion/Missing → unattributed
            is_conversion = first == "Conversion" and last == "Missing"

            if is_location_proxy:
                prov_type = "house_unknown"
            elif is_conversion:
                prov_type = "unattributed"
            else:
                prov_type = SPECIALTY_TYPE_MAP.get(specialty, "unknown")

            cnt = activity.get(r["id"])

            providers.append({
                "providerId":   r["id"],
                "providerName": full_name,
                "isActive":     bool(r["is_active"]),
                "providerType": prov_type,
                "count":        cnt if cnt is not None else None,
            })

        # ── 3. Provider Types ─────────────────────────────────────────────────
        type_counts: dict = {}
        type_has_null: dict = {}
        for p in providers:
            pt = p["providerType"]
            if pt not in type_counts:
                type_counts[pt] = 0
                type_has_null[pt] = False
            if p["count"] is None:
                type_has_null[pt] = True
            else:
                type_counts[pt] += p["count"]

        # Ensure all canonical types present
        for canonical in ("doctor", "hygienist", "house_unknown", "unattributed", "unknown"):
            if canonical not in type_counts:
                type_counts[canonical] = 0
                type_has_null[canonical] = True

        provider_types = sorted(
            [
                {
                    "providerType": pt,
                    "count": None if type_has_null[pt] and type_counts[pt] == 0 else type_counts[pt],
                }
                for pt in type_counts
            ],
            key=lambda x: x["providerType"],
        )

        # ── 4. Payment Methods ────────────────────────────────────────────────
        CARD_TYPE_REF = [
            {"cardKey": "visa",       "cardLabel": "VISA",             "creditCardType": 1, "tagId": "14000000003510"},
            {"cardKey": "mastercard", "cardLabel": "MasterCard",       "creditCardType": 2, "tagId": "14000000003507"},
            {"cardKey": "amex",       "cardLabel": "American Express", "creditCardType": 3, "tagId": "14000000003501"},
            {"cardKey": "discover",   "cardLabel": "Discover",         "creditCardType": 4, "tagId": "14000000003505"},
        ]
        FINANCING_TAG_IDS = ("14000000003502", "14000000016197")

        _p_loc = ""
        _p_loc_args: list = []
        _i_loc = ""
        _i_loc_args: list = []
        if selected_locations:
            _p_loc = " AND location_id IN (" + location_placeholders + ")"
            _p_loc_args = selected_locations
            _i_loc = " AND COALESCE(claim_location_id, location_id) IN (" + location_placeholders + ")"
            _i_loc_args = selected_locations

        _dt = [start, end]

        # ── A. Credit Card (Payment + Rebill, creditCardType IS NOT NULL) ──────
        cc_card_rows = conn.execute(f"""
            SELECT json_extract(raw,'$.patientPaymentBilling.creditCardType') AS cc_type,
                   COUNT(*) AS cnt,
                   ABS(SUM(amount)) AS total
            FROM patient_payments
            WHERE is_active = 1
              AND ledger_type IN ('PatientProcedurePayment','PatientProcedurePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.creditCardType') IS NOT NULL
              {_p_loc}
            GROUP BY json_extract(raw,'$.patientPaymentBilling.creditCardType')
        """, _dt + _p_loc_args).fetchall()

        cc_by_type: dict = {}
        cc_total_count = 0
        cc_total_amount = 0.0
        for r in cc_card_rows:
            ct = r["cc_type"]
            cnt = r["cnt"] or 0
            amt = float(r["total"] or 0)
            cc_by_type[ct] = {"count": cnt, "amount": amt}
            cc_total_count  += cnt
            cc_total_amount += amt

        # ── B. Check Payments (PaymentOnly, checkNumber IS NOT NULL, no cc) ────
        chk_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt, ABS(SUM(amount)) AS total
            FROM patient_payments
            WHERE is_active = 1
              AND ledger_type = 'PatientProcedurePayment'
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.checkNumber') IS NOT NULL
              AND json_extract(raw,'$.patientPaymentBilling.creditCardType') IS NULL
              {_p_loc}
        """, _dt + _p_loc_args).fetchone()
        chk_count  = chk_row["cnt"] or 0
        chk_amount = float(chk_row["total"] or 0)

        # ── C. Patient Financing (PaymentOnly, no billing, paidAtVisit, financing tags) ─
        fin_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt, ABS(SUM(amount)) AS total
            FROM patient_payments
            WHERE is_active = 1
              AND ledger_type = 'PatientProcedurePayment'
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling') IS NULL
              AND json_extract(raw,'$.paidAtVisit') = 1
              AND json_extract(raw,'$.transactionTags.1.id') IN ('14000000003502','14000000016197')
              {_p_loc}
        """, _dt + _p_loc_args).fetchone()
        fin_count  = fin_row["cnt"] or 0
        fin_amount = float(fin_row["total"] or 0)

        # ── D. Cash (Payment+Rebill, no billing, paidAtVisit, NOT financing tags) ─
        cash_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt, ABS(SUM(amount)) AS total
            FROM patient_payments
            WHERE is_active = 1
              AND ledger_type IN ('PatientProcedurePayment','PatientProcedurePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling') IS NULL
              AND json_extract(raw,'$.paidAtVisit') = 1
              AND (json_extract(raw,'$.transactionTags.1.id') IS NULL
                   OR json_extract(raw,'$.transactionTags.1.id') NOT IN ('14000000003502','14000000016197'))
              {_p_loc}
        """, _dt + _p_loc_args).fetchone()
        cash_count  = cash_row["cnt"] or 0
        cash_amount = float(cash_row["total"] or 0)

        # ── Unclassified patient (no billing + paidAtVisit=0/NULL, or billing with no cc/check) ─
        pat_unclass_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt, ABS(SUM(amount)) AS total
            FROM patient_payments
            WHERE is_active = 1
              AND ledger_type IN ('PatientProcedurePayment','PatientProcedurePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.creditCardType') IS NULL
              AND json_extract(raw,'$.patientPaymentBilling.checkNumber') IS NULL
              AND NOT (
                    json_extract(raw,'$.patientPaymentBilling') IS NULL
                    AND json_extract(raw,'$.paidAtVisit') = 1
              )
              {_p_loc}
        """, _dt + _p_loc_args).fetchone()
        pat_unclass_count  = pat_unclass_row["cnt"] or 0
        pat_unclass_amount = float(pat_unclass_row["total"] or 0)

        # ── E. Insurance Check ────────────────────────────────────────────────
        ins_chk_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt,
                   COUNT(DISTINCT json_extract(raw,'$.patientPaymentBilling.checkNumber')) AS deposit_cnt,
                   ABS(SUM(amount)) AS total
            FROM insurance_payments
            WHERE is_active = 1
              AND ledger_type IN ('InsurancePayment','InsurancePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.checkNumber') IS NOT NULL
              {_i_loc}
        """, _dt + _i_loc_args).fetchone()
        ins_chk_count   = ins_chk_row["cnt"] or 0
        ins_chk_deposit = ins_chk_row["deposit_cnt"] or 0
        ins_chk_amount  = float(ins_chk_row["total"] or 0)

        # ── F. Insurance Credit Card ──────────────────────────────────────────
        ins_cc_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt, ABS(SUM(amount)) AS total
            FROM insurance_payments
            WHERE is_active = 1
              AND ledger_type IN ('InsurancePayment','InsurancePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.creditCardType') IS NOT NULL
              {_i_loc}
        """, _dt + _i_loc_args).fetchone()
        ins_cc_count  = ins_cc_row["cnt"] or 0
        ins_cc_amount = float(ins_cc_row["total"] or 0)

        # ── G. Insurance Electronic (EFT/ERA/DD pattern, no check, no cc) ───
        ins_eft_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt,
                   COUNT(DISTINCT json_extract(raw,'$.patientPaymentBilling.referenceNumber')) AS deposit_cnt,
                   ABS(SUM(amount)) AS total
            FROM insurance_payments
            WHERE is_active = 1
              AND ledger_type IN ('InsurancePayment','InsurancePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.checkNumber') IS NULL
              AND json_extract(raw,'$.patientPaymentBilling.creditCardType') IS NULL
              AND (
                    json_extract(raw,'$.patientPaymentBilling.referenceNumber') LIKE '%EFT%'
                 OR json_extract(raw,'$.patientPaymentBilling.referenceNumber') LIKE 'DD %'
                 OR (
                      json_extract(raw,'$.patientPaymentBilling.referenceNumber') IS NOT NULL
                      AND json_extract(raw,'$.patientPaymentBilling.referenceNumber') != ''
                      AND json_extract(raw,'$.patientPaymentBilling.referenceNumber') NOT LIKE '%NO PAY%'
                    )
              )
              {_i_loc}
        """, _dt + _i_loc_args).fetchone()
        ins_eft_count   = ins_eft_row["cnt"] or 0
        ins_eft_deposit = ins_eft_row["deposit_cnt"] or 0
        ins_eft_amount  = float(ins_eft_row["total"] or 0)

        # ── Insurance Unclassified (no check, no cc, no EFT/DD/ref pattern) ──
        ins_unclass_row = conn.execute(f"""
            SELECT COUNT(*) AS cnt, ABS(SUM(amount)) AS total
            FROM insurance_payments
            WHERE is_active = 1
              AND ledger_type IN ('InsurancePayment','InsurancePaymentRebill')
              AND amount < 0
              AND transaction_date >= ? AND transaction_date <= ?
              AND json_extract(raw,'$.patientPaymentBilling.checkNumber') IS NULL
              AND json_extract(raw,'$.patientPaymentBilling.creditCardType') IS NULL
              AND NOT (
                    json_extract(raw,'$.patientPaymentBilling.referenceNumber') LIKE '%EFT%'
                 OR json_extract(raw,'$.patientPaymentBilling.referenceNumber') LIKE 'DD %'
                 OR (
                      json_extract(raw,'$.patientPaymentBilling.referenceNumber') IS NOT NULL
                      AND json_extract(raw,'$.patientPaymentBilling.referenceNumber') != ''
                      AND json_extract(raw,'$.patientPaymentBilling.referenceNumber') NOT LIKE '%NO PAY%'
                    )
              )
              {_i_loc}
        """, _dt + _i_loc_args).fetchone()
        ins_unclass_count  = ins_unclass_row["cnt"] or 0
        ins_unclass_amount = float(ins_unclass_row["total"] or 0)

        total_unclassified_count  = pat_unclass_count  + ins_unclass_count
        total_unclassified_amount = pat_unclass_amount + ins_unclass_amount

        payment_methods = [
            {
                "methodKey":    "credit_card",
                "methodLabel":  "Credit Card Payments",
                "enabled":      True,
                "confidence":   "high",
                "source":       "patient_payments.raw.patientPaymentBilling.creditCardType",
                "count":        cc_total_count,
                "amount":       round(cc_total_amount, 2),
                "cardTypes": [
                    {
                        "cardKey":        m["cardKey"],
                        "cardLabel":      m["cardLabel"],
                        "creditCardType": m["creditCardType"],
                        "tagId":          m["tagId"],
                        "count":          cc_by_type.get(m["creditCardType"], {}).get("count", 0),
                        "amount":         round(cc_by_type.get(m["creditCardType"], {}).get("amount", 0.0), 2),
                    }
                    for m in CARD_TYPE_REF
                ],
            },
            {
                "methodKey":    "check",
                "methodLabel":  "Check Payments",
                "enabled":      True,
                "confidence":   "high",
                "source":       "patient_payments.raw.patientPaymentBilling.checkNumber",
                "count":        chk_count,
                "amount":       round(chk_amount, 2),
                "cardTypes":    [],
            },
            {
                "methodKey":    "cash",
                "methodLabel":  "Cash Payments",
                "enabled":      True,
                "confidence":   "medium",
                "source":       "patientPaymentBilling IS NULL, paidAtVisit=true, excluding financing tags",
                "count":        cash_count,
                "amount":       round(cash_amount, 2),
                "cardTypes":    [],
            },
            {
                "methodKey":    "insurance_check",
                "methodLabel":  "Insurance Check Payments",
                "enabled":      True,
                "confidence":   "high",
                "source":       "insurance_payments.raw.patientPaymentBilling.checkNumber",
                "count":        ins_chk_count,
                "depositCount": ins_chk_deposit,
                "amount":       round(ins_chk_amount, 2),
                "cardTypes":    [],
            },
            {
                "methodKey":    "insurance_credit_card",
                "methodLabel":  "Insurance Credit Card Payments",
                "enabled":      True,
                "confidence":   "medium",
                "source":       "insurance_payments.raw.patientPaymentBilling.creditCardType",
                "count":        ins_cc_count,
                "amount":       round(ins_cc_amount, 2),
                "cardTypes":    [],
            },
            {
                "methodKey":    "insurance_electronic",
                "methodLabel":  "Insurance Electronic Payments",
                "enabled":      True,
                "confidence":   "medium",
                "source":       "insurance_payments: no checkNumber, no creditCardType",
                "count":        ins_eft_count,
                "depositCount": ins_eft_deposit,
                "amount":       round(ins_eft_amount, 2),
                "cardTypes":    [],
            },
            {
                "methodKey":    "patient_financing",
                "methodLabel":  "Patient Financing Payments",
                "enabled":      True,
                "confidence":   "high",
                "source":       "patient_payments.raw.transactionTags.1.id IN ('14000000003502','14000000016197')",
                "count":        fin_count,
                "amount":       round(fin_amount, 2),
                "cardTypes":    [],
            },
            {
                "methodKey":    "electronic_transfer",
                "methodLabel":  "Electronic Transfer Payments",
                "enabled":      False,
                "confidence":   "low",
                "source":       None,
                "count":        None,
                "amount":       None,
                "reason":       "Patient ACH/EFT cannot be reliably classified from current Dentrix SQLite raw data.",
                "cardTypes":    [],
            },
            {
                "methodKey":    "unclassified",
                "methodLabel":  "Unclassified Payments",
                "enabled":      True,
                "confidence":   "low",
                "source":       "patient and insurance payments without reliable method indicators",
                "count":        total_unclassified_count,
                "amount":       round(total_unclassified_amount, 2),
                "reason":       "Payments without reliable method indicators.",
                "cardTypes":    [],
            },
        ]

        card_types = [
            {
                "cardKey":        c["cardKey"],
                "cardLabel":      c["cardLabel"],
                "creditCardType": c["creditCardType"],
                "tagId":          c["tagId"],
            }
            for c in CARD_TYPE_REF
        ]

        # ── 5. Collection Status ──────────────────────────────────────────────
        cs_params: list = [start, end]
        cs_loc_clause = ""
        if selected_locations:
            cs_loc_clause = " AND location_id IN (" + location_placeholders + ")"
            cs_params.extend(selected_locations)

        cs_rows = conn.execute(f"""
            SELECT
                json_extract(raw, '$.claimState')    as claim_state,
                json_extract(raw, '$.totalCharges')  as total_charges,
                COUNT(*) as cnt
            FROM insurance_claims
            WHERE service_date >= ? AND service_date <= ?
              {cs_loc_clause}
            GROUP BY claim_state
        """, cs_params).fetchall()

        cs_buckets: dict = {}
        for r in cs_rows:
            raw_state = (r["claim_state"] or "").upper()
            if raw_state in CLAIM_STATE_MAP:
                key, label = CLAIM_STATE_MAP[raw_state]
            else:
                key, label = "unknown", "Unknown"

            if key not in cs_buckets:
                cs_buckets[key] = {"statusKey": key, "statusLabel": label, "count": 0, "totalCharges": None}
            cs_buckets[key]["count"] += r["cnt"]

        # total_charges per bucket — re-query for sum
        cs_charges_rows = conn.execute(f"""
            SELECT
                json_extract(raw, '$.claimState')       as claim_state,
                SUM(CAST(json_extract(raw,'$.totalCharges') AS REAL)) as total_charges
            FROM insurance_claims
            WHERE service_date >= ? AND service_date <= ?
              {cs_loc_clause}
            GROUP BY claim_state
        """, cs_params).fetchall()

        for r in cs_charges_rows:
            raw_state = (r["claim_state"] or "").upper()
            key = CLAIM_STATE_MAP.get(raw_state, ("unknown", "Unknown"))[0]
            if key in cs_buckets and r["total_charges"] is not None:
                prev = cs_buckets[key]["totalCharges"]
                new  = round(float(r["total_charges"]), 2)
                cs_buckets[key]["totalCharges"] = new if prev is None else round(prev + new, 2)

        collection_statuses = sorted(cs_buckets.values(), key=lambda x: -x["count"])

        # ── 6. Service Categories (live — powered by patient_procedure_map) ──
        COVERAGE_THRESHOLD = 0.99  # 99% minimum to enable

        # Total procedure rows (all time)
        total_proc_count = conn.execute(
            "SELECT COUNT(*) FROM procedures"
        ).fetchone()[0] or 0

        # Mapped rows in patient_procedure_map (no errors, fully resolved)
        mapped_count = conn.execute(
            "SELECT COUNT(*) FROM patient_procedure_map "
            "WHERE error IS NULL AND practice_procedure_id IS NOT NULL"
        ).fetchone()[0] or 0

        # Active production procedure rows that have a confirmed CDT mapping
        # (join active prod rows to patient_procedure_map via patientProcedure.id in raw)
        active_cov_row = conn.execute("""
            SELECT
                COUNT(*) AS active_prod_total,
                SUM(CASE WHEN ppm.patient_procedure_id IS NOT NULL THEN 1 ELSE 0 END) AS active_prod_mapped
            FROM procedures p
            LEFT JOIN patient_procedure_map ppm
                ON json_extract(p.raw, '$.patientProcedure.id') = ppm.patient_procedure_id
               AND ppm.error IS NULL
               AND ppm.practice_procedure_id IS NOT NULL
            WHERE p.is_active = 1
              AND p.ledger_type IN ('PatientProcedureLedger','PatientProcedureLedgerRebill')
        """).fetchone()
        active_prod_count  = active_cov_row["active_prod_total"]  or 0
        active_prod_mapped = active_cov_row["active_prod_mapped"] or 0

        coverage_all    = round(mapped_count       / total_proc_count,  6) if total_proc_count  else 0.0
        coverage_active = round(active_prod_mapped / active_prod_count, 6) if active_prod_count else 0.0

        mapping_enabled = coverage_all >= COVERAGE_THRESHOLD

        if mapping_enabled:
            # Build category list from real mapped procedures
            # Scope to active production ledger rows only; respect locationId if provided
            cat_sql = """
                SELECT
                    COALESCE(ppm.normalized_service_category, 'Unknown / Unmapped') AS service_category,
                    COUNT(DISTINCT ppm.ada_code) AS ada_code_count,
                    COUNT(*) AS procedure_count
                FROM procedures p
                LEFT JOIN patient_procedure_map ppm
                    ON json_extract(p.raw, '$.patientProcedure.id') = ppm.patient_procedure_id
                WHERE p.is_active = 1
                  AND p.ledger_type IN ('PatientProcedureLedger','PatientProcedureLedgerRebill')
            """
            cat_params: list = []
            if selected_locations:
                cat_sql += " AND p.location_id IN (" + location_placeholders + ")"
                cat_params.extend(selected_locations)
            cat_sql += " GROUP BY service_category ORDER BY procedure_count DESC"

            cat_rows = conn.execute(cat_sql, tuple(cat_params)).fetchall()

            # CDT canonical sort order — matches normalize_category() ranges
            CDT_SORT_ORDER = [
                "Diagnostic / Exams",
                "Preventive / Hygiene",
                "Restorative",
                "Endodontics",
                "Periodontics",
                "Prosthodontics / Removable",
                "Maxillofacial Prosthetics",
                "Implants / Fixed Prosthodontics",
                "Prosthodontics / Fixed",
                "Oral Surgery",
                "Orthodontics",
                "Adjunctive / Misc",
                "Cosmetic",
                "Unknown / Unmapped",
            ]

            def _cat_sort_key(row_cat: str) -> int:
                try:
                    return CDT_SORT_ORDER.index(row_cat)
                except ValueError:
                    return len(CDT_SORT_ORDER)

            cat_list = sorted(
                [
                    {
                        "value":          r["service_category"],
                        "label":          r["service_category"],
                        "enabled":        True,
                        "procedureCount": r["procedure_count"],
                        "adaCodeCount":   r["ada_code_count"],
                    }
                    for r in cat_rows
                ],
                key=lambda x: _cat_sort_key(x["value"]),
            )

            service_categories = cat_list
            svc_cat_mapping = {
                "enabled":                  True,
                "coverageAllProcedures":    round(coverage_all * 100, 4),
                "coverageActiveProcedures": round(coverage_active * 100, 4),
                "mappedCount":              mapped_count,
                "totalProcedureCount":      total_proc_count,
                "activeProcedureCount":     active_prod_count,
                "activeMappedCount":        active_prod_mapped,
                "source":                   "patient_procedure_map + practice_procedures",
                "reason":                   None,
            }
            logger.info(
                "service_categories: enabled=True coverage_all=%.4f coverage_active=%.4f categories=%d",
                coverage_all, coverage_active, len(cat_list),
            )
        else:
            service_categories = []
            svc_cat_mapping = {
                "enabled":                  False,
                "coverageAllProcedures":    round(coverage_all * 100, 4),
                "coverageActiveProcedures": round(coverage_active * 100, 4),
                "mappedCount":              mapped_count,
                "totalProcedureCount":      total_proc_count,
                "activeProcedureCount":     active_prod_count,
                "activeMappedCount":        active_prod_mapped,
                "source":                   "patient_procedure_map + practice_procedures",
                "reason":                   (
                    f"Coverage {round(coverage_all * 100, 2)}% is below required threshold "
                    f"of {int(COVERAGE_THRESHOLD * 100)}%. "
                    "Run service_category_sync.py --map-patient-procedures to improve coverage."
                ),
            }
            logger.warning(
                "service_categories: disabled — coverage_all=%.4f below threshold=%.2f",
                coverage_all, COVERAGE_THRESHOLD,
            )

        # ── 7. Saved Analyses (internal feature, not Dentrix) ─────────────────
        saved_analyses = {
            "appFeature":    True,
            "dentrixSource": False,
            "enabled":       False,
            "reason": (
                "Saved Analyses is an internal dashboard feature and is not sourced from Dentrix. "
                "Storage/API not implemented yet."
            ),
        }

        return {
            "startDate":              start,
            "endDate":                end,
            "locationId":             locationId,
            "offices":                offices,
            "providers":              providers,
            "providerTypes":          provider_types,
            "paymentMethods":         payment_methods,
            "cardTypes":              card_types,
            "collectionStatuses":     collection_statuses,
            "serviceCategories":      service_categories,
            "serviceCategoryMapping": svc_cat_mapping,
            "savedAnalyses":          saved_analyses,
        }

    except Exception as e:
        logger.exception("Error in financial filter-options")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()