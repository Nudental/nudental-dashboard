// ─── Gusto Type Definitions ───────────────────────────────────────────────────
// All interfaces match the gusto_ Supabase table schemas exactly.

/**
 * @typedef {Object} GustoEmployee
 * @property {string} id
 * @property {number|null} analytics_id
 * @property {string|null} first_name
 * @property {string|null} last_name
 * @property {string|null} preferred_first_name
 * @property {string|null} legal_first_name
 * @property {string|null} middle_initial
 * @property {string|null} email
 * @property {string|null} birthday
 * @property {string|null} gender
 * @property {string|null} hire_date
 * @property {string|null} termination_date
 * @property {'active'|'terminated'|string|null} status
 * @property {'full_time'|'part_time'|string|null} employment_type
 * @property {string|null} pay_frequency
 * @property {string|null} payment_method
 * @property {string|null} work_state
 * @property {string|null} pay_schedule_id
 * @property {string|null} department_id
 * @property {boolean|null} benefits_eligible
 * @property {boolean|null} benefits_enrolled
 * @property {boolean|null} is_fulltime
 * @property {string|null} gusto_employee_id
 * @property {string|null} company_id
 * @property {string} imported_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} GustoPayrollRun
 * @property {string} id
 * @property {number|null} analytics_id
 * @property {string|null} pay_period_start
 * @property {string|null} pay_period_end
 * @property {string|null} check_date
 * @property {string|null} debit_date
 * @property {number|null} total_net_pay
 * @property {number|null} total_payable_tax
 * @property {number|null} total_tax
 * @property {number|null} total_debit_amount
 * @property {number|null} total_reimbursement
 * @property {boolean|null} off_cycle
 * @property {string|null} off_cycle_reason
 * @property {boolean|null} processed
 * @property {boolean|null} reversed
 * @property {boolean|null} needs_reprocessing
 * @property {number|null} items_processed
 * @property {string|null} run_by_user_name
 * @property {boolean|null} fast_ach
 * @property {string|null} pay_schedule_name
 * @property {string[]|null} employee_ids
 * @property {string} imported_at
 */

/**
 * @typedef {Object} GustoContractorPayment
 * @property {string} id
 * @property {string|null} contractor_id
 * @property {string|null} contractor_name
 * @property {string|null} contractor_display_name
 * @property {string|null} payment_method
 * @property {string|null} check_date
 * @property {boolean|null} funded
 * @property {boolean|null} cancelled
 * @property {number|null} hours_worked
 * @property {number|null} hourly_rate
 * @property {number|null} wage
 * @property {number|null} bonus
 * @property {number|null} reimbursement
 * @property {number|null} total_amount
 * @property {string|null} wage_type
 * @property {string|null} memo
 */

/**
 * @typedef {Object} GustoBenefitPlan
 * @property {string} id
 * @property {string|null} plan_name
 * @property {number|null} benefit_type
 * @property {string|null} benefit_category
 * @property {boolean|null} active
 * @property {string|null} carrier_name
 * @property {number|null} renewal_month
 */

/**
 * @typedef {Object} GustoEnrollment
 * @property {string} id
 * @property {string} employee_id
 * @property {string} benefit_plan_id
 * @property {number|null} employee_deduction
 * @property {number|null} company_contribution
 * @property {boolean|null} active
 */

/**
 * @typedef {Object} GustoPaySchedule
 * @property {string} id
 * @property {string|null} pay_period_type
 * @property {string|null} schedule_name
 * @property {string|null} schedule_label
 * @property {string|null} pay_frequency_description
 * @property {boolean|null} auto_pilot
 * @property {string|null} next_auto_pilot_date
 * @property {Object[]|null} ineligible_employees
 */

/**
 * @typedef {Object} GustoImportLog
 * @property {number} id
 * @property {string} import_type
 * @property {string} status
 * @property {number|null} records_attempted
 * @property {number|null} records_inserted
 * @property {number|null} records_updated
 * @property {number|null} records_failed
 * @property {Object|null} error_details
 * @property {string|null} imported_by_name
 * @property {string} started_at
 * @property {string|null} completed_at
 * @property {number|null} duration_seconds
 */

/**
 * @typedef {Object} GustoCrosswalk
 * @property {number} id
 * @property {string} gusto_employee_id
 * @property {string|null} dentrix_provider_id
 * @property {string|null} dentrix_provider_name
 * @property {string|null} office_id
 * @property {string|null} role_classification
 * @property {string} mapping_status
 * @property {string|null} mapping_confidence
 * @property {string|null} match_method
 * @property {boolean} active
 * @property {boolean} manual_override
 * @property {string|null} notes
 * @property {string|null} mapped_by
 * @property {string|null} mapped_at
 */

/**
 * @typedef {Object} GustoComparisonResult
 * @property {number} id
 * @property {string|null} gusto_employee_id
 * @property {string|null} dentrix_provider_id
 * @property {string|null} office_id
 * @property {string|null} pay_period_start
 * @property {string|null} pay_period_end
 * @property {number|null} dentrix_gross_production
 * @property {number|null} dentrix_collections
 * @property {number|null} dentrix_calculated_payout
 * @property {number|null} gusto_net_pay
 * @property {number|null} variance_amount
 * @property {number|null} variance_percentage
 * @property {string|null} notes
 */

export const GUSTO_PERMISSIONS = {
  canViewGusto:             ['super_admin'],
  canImportGusto:           ['super_admin'],
  canEditMappings:          ['super_admin'],
  canExportGusto:           ['super_admin'],
  canViewComparison:        ['super_admin'],
  canEditComparisonNotes:   ['super_admin'],
  canExcludeFromComparison: ['super_admin'],
  canReprocessImport:       ['super_admin'],
  canViewGustoReadOnly:     ['admin'],
  canExportGustoReadOnly:   ['admin'],
  canViewGustoStandard:     [],
};

/**
 * Check if a role has a specific Gusto permission
 * @param {string} role
 * @param {keyof typeof GUSTO_PERMISSIONS} permission
 * @returns {boolean}
 */
export function hasGustoPermission(role, permission) {
  const allowed = GUSTO_PERMISSIONS?.[permission] || [];
  return allowed?.includes(role);
}

/**
 * Check if role can view any Gusto data
 * @param {string} role
 * @returns {boolean}
 */
export function canViewGustoData(role) {
  return role === 'super_admin' || role === 'admin';
}
