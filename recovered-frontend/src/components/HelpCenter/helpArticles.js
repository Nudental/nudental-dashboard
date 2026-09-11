const HELP_ARTICLES = [
  // ─── EXECUTIVE OVERVIEW ───────────────────────────────────────────────────
  {
    id: 1,
    tab: "Executive Overview",
    title: "How to use the Executive Overview",
    keywords: ["overview","executive","home","kpi","production","collections","pending","sparkline","goals","morning","dentrix","verified"],
    content: "The Executive Overview is your home dashboard. KPI cards at the top show Production, Collections, New Patients, and Pending Approvals for the selected office and date range. Cards marked 'Verified by Dentrix Ascend' are sourced directly from the Dentrix/FastAPI pipeline. Check Pending Approvals first — entries not yet approved are excluded from KPI totals. Use the office selector and date range to focus on a specific location or period. The Month-End Forecast projects end-of-month totals based on current pace — it is a projection, not a committed figure."
  },
  {
    id: 2,
    tab: "Executive Overview",
    title: "What does 'Verified by Dentrix Ascend' mean?",
    keywords: ["verified","dentrix","ascend","badge","data source","trusted","fastapi","pipeline","source of truth"],
    content: "The 'Verified by Dentrix Ascend' badge on a KPI card means the data was pulled directly from the Dentrix/FastAPI data pipeline and has not been manually overridden. This is the source of truth for clinical production and collections data. If a card does not show this badge, the data may be from a manual entry or a pending import. Always prefer Dentrix-verified data for reporting and decision-making."
  },
  // ─── FILTERS ──────────────────────────────────────────────────────────────
  {
    id: 3,
    tab: "General",
    title: "How to use date filters and office selector",
    keywords: ["filter","date","range","office","selector","barnegat","brick","eatontown","staten island","period","preset","ytd","global filter bar"],
    content: "Use the date range picker in the header to set the time period for dashboard data. Quick presets: This Month, Last Month, This Quarter, YTD. Use the office selector to filter data to a specific location (Barnegat, Brick, Eatontown, Staten Island) or select All Offices for aggregated data. If numbers look wrong, always check the date range and office filter first — this is the most common cause of unexpected results. Office Managers are locked to their assigned office and cannot switch."
  },
  // ─── KPIs ─────────────────────────────────────────────────────────────────
  {
    id: 4,
    tab: "KPIs",
    title: "How to read KPI cards and metrics",
    keywords: ["kpi","card","metric","arrow","trend","sparkline","production","collections","new patients","no show","acceptance","ar","aging","cdt","hygiene","treatment acceptance"],
    content: "Each KPI card shows the metric name, current value, a trend arrow (up = improving), and a sparkline. Production = total billable treatment. Collections = actual cash received. New Patients = first-time patients. Treatment Acceptance is value-based (dollar amount of accepted plans) where available. Hygiene CDT metrics use live backend-mapped CDT code buckets — these reflect actual procedure codes submitted. A '—' on a KPI card means the value was not returned by Dentrix — it is NOT zero. Data is sourced from verified Dentrix/FastAPI pipelines."
  },
  // ─── REGIONAL MANAGER vs FINANCE RCM ─────────────────────────────────────
  {
    id: 5,
    tab: "Regional Manager",
    title: "Regional Manager vs Finance RCM — what is the difference?",
    keywords: ["regional manager","rcm","revenue cycle","supply","request","approval","difference","sidebar","finance","rcm-dashboard","supply request"],
    content: "These are two different pages:\n\n• Regional Manager (sidebar) = Supply Request Approval Queue at /rcm-dashboard. This is where Regional Clinical Managers approve or reject supply requests from all offices. It uses Supabase supply_request_batches and urgent_supply_requests tables. Approve/reject actions write to Supabase. Check Urgent Requests first.\n\n• Finance → RCM = Revenue Cycle Management at /rcm. This shows claims, AR aging, patient balances, and collections health from Dentrix/FastAPI.\n\nThe sidebar label 'Regional Manager' routes to supply request approvals — NOT financial RCM."
  },
  // ─── MORNING HUDDLE ───────────────────────────────────────────────────────
  {
    id: 6,
    tab: "Morning Huddle",
    title: "How to submit a Morning Huddle",
    keywords: ["morning","huddle","submit","start","day","patient","plan","draft","checklist","provider","previous open day"],
    content: "Every morning before patients arrive: 1) Go to Morning Huddle. 2) Select your Office and Provider name. 3) Enter Patient Count (scheduled for today) and Production Goal. 4) Complete the checklist. 5) Click Submit. Status changes from Draft to Submitted. Admins approve in Workflow Approvals Queue. View past huddles in the History tab. If a previous day was missed, use 'Previous Open Day' to submit retroactively. Do not submit estimated numbers — use actual scheduled patient count and production goal from Dentrix."
  },
  // ─── EOD REPORT ───────────────────────────────────────────────────────────
  {
    id: 7,
    tab: "EOD Report",
    title: "How to submit an EOD Report",
    keywords: ["eod","end of day","daily entry","production","collections","submit","evening","close","dentrix","closeout","attestation"],
    content: "At end of day: 1) Go to Daily Entry Form. 2) Select your Office and Provider. 3) Complete the attestation checklist (Step 1). 4) Enter actual Production and Collections from your Dentrix closeout report. 5) Add expenses and notes (Step 2). 6) Click Submit. Your entry shows as Pending until an admin approves it. Approved entries update the KPI dashboard. Auto-save runs every 30 seconds. Do not submit estimated numbers — use actual Dentrix closeout figures."
  },
  // ─── PENDING APPROVALS ────────────────────────────────────────────────────
  {
    id: 8,
    tab: "Pending Approvals",
    title: "How to use the EOD Approval Queue",
    keywords: ["pending","approvals","approve","red","count","review","reject","admin","eod","dentrix api synced","human submission"],
    content: "EOD Approval Queue shows all submitted End-of-Day reports awaiting review. 'Dentrix API Synced' rows (purple) came from the automated pipeline — focus on 'Human Submission' rows first. Approve correct entries or reject with a reason — rejected entries are returned to the submitter by email. Goal: end each day at zero pending approvals so all data is current. If Pending Approvals count is above 0, some data is not yet counted in KPIs."
  },
  // ─── MANUAL ENTRY ─────────────────────────────────────────────────────────
  {
    id: 9,
    tab: "Admin",
    title: "Manual Entry — exception-only, last resort",
    keywords: ["manual","entry","production","exception","admin","data","correction","warning","audit","last resort","ucr","adjustment"],
    content: "⚠️ Manual Production Entry is an EXCEPTION-ONLY tool — last resort only. Use ONLY when Dentrix Ascend API does not provide UCR fee or production adjustment data for a specific period. NOT for routine production correction. Does NOT overwrite Dentrix/FastAPI verified data. All entries require confirmation and are logged in the audit trail. Manual entries are clearly labeled in reports. Consult with Dr. G or Yabezy before using. 'Apply to Analytics' must be used explicitly to include manual entries in reporting."
  },
  // ─── SOURCE NOT RECORDED ──────────────────────────────────────────────────
  {
    id: 10,
    tab: "Finance",
    title: "What does 'Source Not Recorded' mean in Transaction Audit?",
    keywords: ["source not recorded","transaction audit","submitted_by","null","api sync","human submission","badge","source badge"],
    content: "'Source Not Recorded' in Transaction Audit means the submitted_by field is null for that row. This is NORMAL for API-synced rows — the automated Dentrix pipeline does not always populate the submitted_by field. It does NOT mean the data is bad or suspicious. Compare with 'Dentrix API Synced' (purple badge) = automated pipeline row, and 'Human Submission' = manually entered row. Source Not Recorded is expected behavior for API sync rows."
  },
  // ─── DENTRIX API SYNCED vs HUMAN SUBMISSION ───────────────────────────────
  {
    id: 11,
    tab: "Finance",
    title: "Dentrix API Synced vs Human Submission — source badges explained",
    keywords: ["dentrix api synced","human submission","source badge","purple","transaction audit","pending approvals","eod","source"],
    content: "Source badges appear in Transaction Audit and EOD Approval Queue:\n\n• Dentrix API Synced (purple badge): Row came from the automated Dentrix/FastAPI pipeline. These typically do not need manual approval.\n\n• Human Submission: Row was manually entered by a staff member. Focus on these in the approval queue.\n\n• Source Not Recorded: submitted_by field is null — normal for API sync rows, NOT bad data.\n\nWhen reviewing the approval queue, prioritize Human Submission rows. API-synced rows are already verified by the pipeline."
  },
  // ─── ALERT THRESHOLDS PROTOTYPE ───────────────────────────────────────────
  {
    id: 12,
    tab: "Admin",
    title: "Alert Thresholds — breach simulation uses demo values, not live data",
    keywords: ["alert thresholds","breach","simulation","mock","demo","prototype","local","collection ratio","ar","claims","live","production","not live"],
    content: "⚠️ Important: The breach simulation panel in Metric Alert Thresholds uses HARDCODED DEMONSTRATION VALUES — not live metrics. The values shown (e.g., Barnegat: 112% collection ratio, Brick: 236%) are constants for UI demonstration only. They are NOT sourced from any Supabase table, live API, or daily_entries data.\n\nThresholds are labeled 'Active (prototype/local)' — this feature is still in development. Do not rely on threshold alerts for operational decisions until live monitoring is confirmed. Contact Dr. G before acting on breach simulation results."
  },
  // ─── COMPLIANCE SIMULATE PURGE ────────────────────────────────────────────
  {
    id: 13,
    tab: "Finance",
    title: "Compliance & Retention — Simulate Purge does NOT delete data",
    keywords: ["compliance","retention","simulate purge","purge","delete","data","hipaa","browser","localStorage","planning"],
    content: "⚠️ Critical: 'Simulate Purge' in Compliance & Retention does NOT delete any data from Supabase. It is a UI planning simulation only. Actual data purge is not implemented.\n\nRetention rules and purge history are stored in your browser (localStorage) — not in Supabase. They will be lost if you clear browser data.\n\nDefault retention is Forever for all record types. HIPAA minimum = 2190 days (6 years). This page is a compliance planning and documentation tool, not an enforcement system."
  },
  // ─── MONTHLY ANALYTICS LIVE vs LEGACY ────────────────────────────────────
  {
    id: 14,
    tab: "Performance",
    title: "Monthly Analytics — live Executive Summary vs legacy tabs",
    keywords: ["monthly analytics","executive summary","legacy","import","export","manual override","live","dentrix","supabase","monthly_executive_analytics","not live"],
    content: "Monthly Analytics has THREE tabs with different data sources:\n\n• Executive Summary tab: Automated data from Dentrix/FastAPI + reconciled AR snapshot. This is the LIVE source of truth. Use this for reporting.\n\n• Legacy Import/Export tab: Historical/manual data from Supabase monthly_executive_analytics table. CSV-imported or EOD-approved records. NOT live Dentrix actuals.\n\n• Legacy Manual Override tab: Manual data entry into Supabase monthly_executive_analytics table. NOT live Dentrix actuals.\n\nDo not use Legacy tabs for routine reporting — they are for historical reference only."
  },
  // ─── WHAT TO CHECK WHEN NUMBERS LOOK WRONG ───────────────────────────────
  {
    id: 15,
    tab: "General",
    title: "What to check when numbers look wrong",
    keywords: ["wrong","numbers","incorrect","mismatch","different","why","discrepancy","data","off","low","missing","troubleshoot"],
    content: "Work through this checklist in order:\n1. Check office selector — correct office selected?\n2. Check date filter — correct period (This Month vs YTD vs custom)?\n3. Check Pending Approvals — if above 0, some entries not yet approved and not counted.\n4. Check Sync Dashboard — look for Error or Stale status badges.\n5. Refresh the page.\n6. Check Data Health — missing records or data gaps?\n7. Check Import Audit — last import completed without errors?\n8. For Financial Analytics — did you click 'Apply Filters' after changing filters?\n9. For Monthly Analytics — are you on Executive Summary (live) or a Legacy tab (manual/historical)?\n\nIf still wrong, contact Yabezy with: specific metric, date range, office, expected vs actual value."
  },
  // ─── DIRECTORY vs PROFILE SETTINGS ───────────────────────────────────────
  {
    id: 16,
    tab: "Resources",
    title: "Directory vs Profile Settings — photo and data priority",
    keywords: ["directory","profile","photo","settings","staff","email","match","priority","override","display name","directory-first"],
    content: "Staff Directory and Profile Settings are separate but connected:\n\n• Staff Directory (/staff-directory): Internal operational directory for all Nu Dental staff. Contains photos, role categories, office assignments, birthdays. Separate from dashboard login accounts.\n\n• Profile Settings (/profile): Your personal dashboard account settings.\n\n• Directory-first rule: If your email matches a Staff Directory record, the Directory photo and display name take precedence over your Profile Settings data throughout the dashboard.\n\nTo change your displayed photo: update the Directory record (not just Profile Settings). Contact a manager if your Directory record is missing or incorrect."
  },
  // ─── OTP / TRUSTED BROWSER ────────────────────────────────────────────────
  {
    id: 17,
    tab: "General",
    title: "How OTP and trusted browser work",
    keywords: ["otp","trusted","browser","device","sms","email","verification","login","two factor","2fa","code","expire","6 digit","twilio","phone"],
    content: "When you log in from an unrecognized device, you are prompted for a 6-digit OTP code sent to your email or SMS (if phone is verified in Profile Settings).\n\n• Enter the 6-digit code and click Verify. Paste support is available.\n• Check 'Trust this browser' to skip OTP on future logins from the same device.\n• OTP codes expire quickly — if expired, click Resend (60-second cooldown).\n• Trusted browser is browser/device specific — stored in browser cookies/storage.\n• Clearing browser data, using incognito/private mode, or switching browsers removes trusted status and requires OTP again.\n• SMS OTP requires a verified phone number in Profile Settings."
  },
  // ─── REPORTS WORKBOOK EXPORT ──────────────────────────────────────────────
  {
    id: 18,
    tab: "Resources",
    title: "How to use Reports and workbook export",
    keywords: ["report","export","download","production","collections","print","workbook","pdf","csv","goal leaderboard","period comparison","workbook confirm"],
    content: "Reports page provides monthly P&L summaries, goal tracking, period comparisons, and provider production data. Tabs: P&L Summary, Goal Leaderboard, Period Comparison, Provider Production & Collections.\n\n• Date filter defaults to YTD 2026 — verify this is correct before generating.\n• Export Panel: download individual reports as CSV or PDF (file download only, no backend write).\n• Workbook export: generates a comprehensive multi-tab report. WorkbookConfirmModal asks you to confirm before generating — this may take a moment.\n• KPI badges at top show Production, Collections, Expenses for quick reference."
  },
  // ─── DENTRIX RECONCILIATION ───────────────────────────────────────────────
  {
    id: 19,
    tab: "Admin",
    title: "Dentrix Reconciliation — PASS / WARNING / FAIL / ENDPOINT_MISSING explained",
    keywords: ["dentrix","reconciliation","pass","warning","fail","endpoint missing","diagnostic","super admin","tolerance","benchmark","eassist"],
    content: "Dentrix Ascend Reconciliation (/dentrix-diagnostics) is Super Admin only and read-only. It shows data lineage for every metric.\n\nStatus meanings:\n• PASS: Value within tolerance ($1.00 or 5%) — no action needed.\n• WARNING: Outside tolerance but endpoint available — investigate.\n• FAIL: Significant discrepancy — investigate with Yabezy.\n• ENDPOINT_MISSING: No API endpoint exists for this metric — NOT a sync failure. This is expected for some metrics.\n\nThe eAssist benchmark is hardcoded to Apr 22 2026 reference data — not live. Staten Island is excluded from benchmark (no eAssist data). No data is modified on this page."
  },
  // ─── OPERATIONS ───────────────────────────────────────────────────────────
  {
    id: 20,
    tab: "Performance",
    title: "How to use the Operations tab",
    keywords: ["operations","schedule","scheduling","confirmed","available","slots","utilization","cancellation","no show","payor","scorecard","marketing","11 tabs"],
    content: "Operations shows scheduling and clinical workflow health across 11 tabs: Offices, Production, Performance, Providers, Services, Payors, Trends, Cancellations, Claims/AR, Marketing, Scorecards. All tabs are read-only reporting from Dentrix/FastAPI. Use in the morning to identify open time and in the afternoon to review next-day scheduling. If a tab is missing, your role does not have access. If 'This Month' shows no data, the page automatically shows the last available period with a warning banner."
  },
  // ─── OFFICE PERFORMANCE ───────────────────────────────────────────────────
  {
    id: 21,
    tab: "Performance",
    title: "How to use Office Performance",
    keywords: ["office","performance","barnegat","brick","eatontown","staten island","location","kpi","revenue","transaction","activity","dentrix banner"],
    content: "Office Performance shows detailed metrics for a single office. Select the office using the Office Selector at the top. Includes KPI cards (Production, Collections, New Patients, No Shows, Treatment Acceptance), Revenue Trends chart, Expense Category chart, Provider Productivity chart, Transaction Grid, and Activity Feed. Check the DentrixDataSourceBanner — if API failed, data may be stale. A '—' on a KPI card means the value was not returned by Dentrix — it is NOT zero. Export controls allow downloading data for the selected period."
  },
  // ─── PROVIDER PERFORMANCE ─────────────────────────────────────────────────
  {
    id: 22,
    tab: "Performance",
    title: "How to read Provider Performance",
    keywords: ["provider","performance","dentist","hygienist","production","utilization","acceptance","cdt","service category","unattributed"],
    content: "Provider Performance shows production, collections, and case acceptance per provider for the selected office and date range. Use the service category tabs to break down by procedure type. A '—' means the value was not returned by Dentrix. Rows labeled 'Unattributed' (UNATTRIBUTED_OFFICE_LEVEL) represent production not mapped to a specific provider — these are real data, not errors. Requires both admin and super_admin roles. Provider names must match Dentrix exactly for correct attribution."
  },
  // ─── FINANCIAL ANALYTICS ──────────────────────────────────────────────────
  {
    id: 23,
    tab: "Finance",
    title: "How to use Financial Analytics — Apply Filters is required",
    keywords: ["finance","financial","analytics","revenue","collections","service","categories","pivot","filter","bookmark","reconciliation","apply filters"],
    content: "Financial Analytics provides detailed revenue and expense analysis. Tabs: Revenue Breakdown, Collections, Service Categories, Production Adjustments, Dentrix Reconciliation.\n\n⚠️ Important: After changing any filter, you MUST click 'Apply Filters' for charts to update. Data does NOT update until applied.\n\nUse Bookmarks to save frequently used filter combinations (stored in browser localStorage only). The Dentrix Reconciliation tab is the best place to investigate discrepancies between dashboard and Dentrix totals."
  },
  // ─── PAYROLL ──────────────────────────────────────────────────────────────
  {
    id: 24,
    tab: "Finance",
    title: "How to use Payroll (Admin only)",
    keywords: ["payroll","gusto","compensation","provider","pay","salary","benefits","employees","time","attendance","admin","import history"],
    content: "Payroll shows provider compensation data from two sources: Dentrix Ascend (clinical production) and Gusto (HR/payroll). Use the source tabs to switch. Gusto data requires a successful import from Gusto — if Gusto tabs are empty, check Import History tab for latest sync status. The Dentrix tab is the primary source for clinical production payroll. Send Collection Report opens a modal and sends email via edge function. Admin/Super Admin only."
  },
  // ─── PROVIDER COMPENSATION DATE OFFSET ───────────────────────────────────
  {
    id: 34,
    tab: "Finance",
    title: "Provider Compensation — Gusto / Dentrix Ascend one-day date offset rule",
    keywords: ["provider compensation","gusto","dentrix","offset","one day","date","pay period","collection","august","start minus one","end minus one","business rule","date mapping","compensation date"],
    content: "INTENTIONAL BUSINESS RULE (approved by Dr. G, Sep 2026):\n\nFor provider compensation, Gusto payroll dates and Dentrix Ascend collection dates intentionally differ by one day.\n\nMapping rule:\n• Dentrix Ascend collection start = Gusto pay period start − 1 day\n• Dentrix Ascend collection end   = Gusto pay period end   − 1 day\n\nExample:\n• Gusto pay period: Aug 17 – Aug 30, 2026\n• Dentrix Ascend collections queried: Aug 16 – Aug 29, 2026\n\nThis offset applies to every regular provider-compensation pay period without exception. It exists because Dentrix Ascend posts collections one day before the corresponding Gusto pay period date.\n\nIMPLEMENTATION STATUS — ACTIVE:\nThe one-day offset is implemented and applied automatically. The Provider Compensation UI shows both the Gusto pay period (unchanged, for payroll/audit) and the shifted Dentrix Ascend collection window side by side.\n\nThe offset uses timezone-safe calendar arithmetic (no UTC conversion). It applies ONLY to the provider-compensation Dentrix collection query. It does NOT change Gusto payroll totals, the Gusto Payroll Overview, payroll runs, employee data, taxes, deductions, benefits, or any other date filter."
  },
  // ─── RCM ──────────────────────────────────────────────────────────────────
  {
    id: 25,
    tab: "Finance",
    title: "How to use Finance RCM (Revenue Cycle Management)",
    keywords: ["rcm","ar","aging","collections","insurance","claims","write off","outstanding","eassist","billing","90 days","patient balance","revenue cycle"],
    content: "Finance RCM (/rcm) tracks insurance claims, AR aging, and collections health from Dentrix/FastAPI. 13 sub-tabs including AR Aging, Claim Submissions, Patient Balances, EAssist Reports, POS Collection, Adjustments, Daily Comparison. AR Aging tab: 90+ day bucket = highest priority for collections follow-up. Payment Arrangement tab is intentionally hidden — data source not available. Use RCM Diagnostic Panel for data quality checks. This is separate from the 'Regional Manager' sidebar item (which is supply request approvals)."
  },
  // ─── SYNC / DATA HEALTH ───────────────────────────────────────────────────
  {
    id: 26,
    tab: "Admin",
    title: "How to use Sync Dashboard and Data Health",
    keywords: ["sync","data health","import","pipeline","dentrix","fastapi","missing","stale","error","diagnostic","awaiting first run","not instrumented","endpoint missing"],
    content: "Sync Dashboard monitors data synchronization between Dentrix, FastAPI, and Nu Dashboard. Status labels: success/healthy = OK; warning = needs attention; error/failed = problem; stale = not synced recently; awaiting_first_run = never synced; not_instrumented = run logging not wired (not an error); manual_only = no automated sync.\n\nData Health provides full pipeline audit with backfill and reconciliation triggers. Run Validate Endpoints first before taking action. Backfill is for historical gap-filling — not routine use. All actions are logged in the audit trail."
  },
  // ─── AUDIT LOG ────────────────────────────────────────────────────────────
  {
    id: 27,
    tab: "Finance",
    title: "How to use the Audit Dashboard and Audit Log",
    keywords: ["audit","log","transaction","history","change","who","when","compliance","report","admin","redacted","sensitive"],
    content: "Audit Dashboard (/audit-dashboard) shows a log of all system actions: who did what, when, and on which record. Role determines scope: super_admin/admin see all; office_manager sees own office; staff sees own activity. Sensitive fields (password, role, salary, SSN, bank_account, phone) are redacted for non-admin viewers. Filter by date range, action type, resource type, or user. The log is append-only — entries cannot be deleted. Use to investigate data discrepancies or verify corrections."
  },
  // ─── ADMIN USERS ──────────────────────────────────────────────────────────
  {
    id: 28,
    tab: "Admin",
    title: "How to manage users (Admin only)",
    keywords: ["users","user","account","role","access","invite","permissions","login","admin","deactivate","bulk","rbac","role editor"],
    content: "Users Management is admin-only. Roles: Viewer (read-only), Manager (office level), Regional (cross-office), Admin (goals + providers), Super Admin (full access). Click 'Invite User' to add a new staff member — they receive an invitation email. Edit roles and office assignments from the Edit User modal. Role determines what pages the user can see. Office assignment determines data scope. When a staff member leaves, deactivate their account — do not delete it, as this preserves audit history. Use Role Editor to customize permissions beyond default role settings."
  },
  // ─── INVENTORY ────────────────────────────────────────────────────────────
  {
    id: 29,
    tab: "Resources",
    title: "How to use Inventory Dashboard",
    keywords: ["inventory","supply","supplies","bone","tissue","implant","stock","low","reorder","scanner","barcode","qr","urgent","order","scan in","scan out"],
    content: "Inventory Dashboard tracks bone/tissue/membrane, implants, and supply requests. Two-step workflow: Scan In when items arrive (Step 1 — Receiving), Scan Out when used by doctor (Step 2 — Consumption + Patient Linkage). Items must be received before they can be consumed. Supply requests route to the Regional Manager for approval. Front desk requests route separately from clinical/back staff requests. Offline queue support — actions queued when offline and synced when connection restored. Expiration alerts appear for near-expiry items."
  },
  // ─── TEAM ASSIGNMENTS ─────────────────────────────────────────────────────
  {
    id: 30,
    tab: "Workflow",
    title: "How to use Team Assignments / Tasks",
    keywords: ["task","assignment","team","action","pending","progress","completed","assign","kanban","workflow","convert","my tasks","overdue"],
    content: "Team Assignments tracks action items across the team. Use Kanban view to see tasks by status (Submitted, In Progress, Completed) or switch to Table view for a list. Staff can view their assigned tasks and update status only. Managers can create, edit, and assign tasks. Use 'My Tasks' filter to see tasks assigned to you. Use 'Overdue' filter to see past-due items. Tasks can be created from Morning Huddle notes using the Convert to Task button. Realtime subscription keeps the board live."
  },
  // ─── PROFILE SETTINGS ─────────────────────────────────────────────────────
  {
    id: 31,
    tab: "Profile",
    title: "How to update Profile Settings",
    keywords: ["profile","photo","phone","password","settings","account","directory","notification","crop","upload","theme","directory-first"],
    content: "Profile Settings lets you update your display name, phone number, profile photo, and theme. Directory-first rule: if your email matches a Staff Directory record, the Directory photo and name take precedence over Profile Settings data. To change your displayed photo, update the Directory record — not just Profile Settings. Verify your phone number to enable SMS-based login verification. Theme selection changes the dashboard color scheme. Role and office assignments are managed by your administrator — they are read-only in Profile Settings."
  },
  // ─── HELP CENTER ──────────────────────────────────────────────────────────
  {
    id: 32,
    tab: "General",
    title: "How to use the Help Center",
    keywords: ["help","center","drawer","question mark","manual","search","article","faq","view full user manual"],
    content: "The Help Center is accessible from two places: the teal floating button in the bottom-right corner, and the ? icon in the top header. Both open the same right-side Help Center drawer. Use the search bar to find articles by keyword. Common search terms: KPI, Reports, Directory, Manual Entry, OTP, EOD, RCM, Regional Manager, Source Not Recorded, Alert Thresholds, Dentrix, Supabase. Click 'View Full User Manual' to open the complete documentation at /help/manual — it opens inside the dashboard, no new tab."
  },
  // ─── MISSING TAB ──────────────────────────────────────────────────────────
  {
    id: 33,
    tab: "General",
    title: "I can\'t find a tab or page",
    keywords: ["missing","tab","cant find","not showing","access","permission","hidden","sidebar","role","rbac"],
    content: "First scroll the sidebar — some items may be collapsed. If still missing, your user role may not include access to that page. Admin-only pages (Users, Management, Audit, Payroll, Admin System, Data Health, Import Audit, Manual Entry, System, Reconciliation, Alert Thresholds) are hidden from standard users. Contact Dr. G or Ny to request the correct permissions. Role determines all page visibility — this is by design, not a bug."
  }
];

export default HELP_ARTICLES;
