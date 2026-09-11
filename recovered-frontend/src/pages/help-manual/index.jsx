import React, { useState, useRef } from "react";
import { BookOpen, ChevronRight, ChevronDown, Search, LogIn, LayoutDashboard, DollarSign, Workflow, Package, Shield, User, HelpCircle, Monitor, Bell, Filter, TrendingUp, Users, Settings, Upload, Info, Database } from "lucide-react";

export default function HelpManualPage() {
  const SECTIONS = [
    {
      id: "getting-started",
      icon: LogIn,
      title: "Getting Started",
      color: "#0d9488",
      subsections: [
        {
          id: "login",
          title: "Login",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/login</code> &nbsp;|&nbsp; <strong>Type:</strong> Action-based &nbsp;|&nbsp; <strong>Data source:</strong> Supabase Auth</p>
              <p>Navigate to <strong>nudashboard.com</strong> and enter your email and password. Nu Dashboard uses invite-only access — accounts are created by an admin. You cannot self-register.</p>
              <ul>
                <li>Enter your email and password, then click <strong>Sign In</strong>.</li>
                <li>If your password is incorrect, use <strong>Forgot Password</strong> to receive a reset link by email.</li>
                <li>After login you are directed to the Executive Overview (Home).</li>
                <li>If you see an OTP challenge screen, see <strong>OTP / Trusted Browser</strong> below.</li>
              </ul>
              <p><strong>Check first:</strong> Use the email address associated with your Nu Dental account. Accounts are invite-only — contact Dr. G or Ny to request access.</p>
            </div>
          )
        },
        {
          id: "otp",
          title: "OTP / Trusted Browser",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/otp-challenge</code> &nbsp;|&nbsp; <strong>Type:</strong> Security / Action-based &nbsp;|&nbsp; <strong>Data source:</strong> Supabase (OTP), Twilio (SMS)</p>
              <p>When you log in from an unrecognized device or browser, you will be prompted to enter a <strong>6-digit verification code</strong>.</p>
              <ul>
                <li><strong>Email OTP:</strong> Code sent to your registered email. Check spam if not received.</li>
                <li><strong>SMS OTP:</strong> Code sent by text message if you have a verified phone number in Profile Settings.</li>
                <li><strong>Trust this browser:</strong> After successful OTP, check this box to skip OTP on future logins from the same device. This writes a trusted-device record tied to your browser.</li>
                <li>OTP codes expire quickly — if expired, click <strong>Resend</strong> (60-second cooldown between resends).</li>
                <li>Paste support is available — you can paste the 6-digit code directly into the input boxes.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> Trusted browser status is <strong>browser-specific and cookie-dependent</strong>. Clearing browser data, using incognito/private mode, or switching to a different browser will remove trusted status and require OTP again.
              </div>
              <p><strong>Common mistake:</strong> Expecting trusted browser to work after clearing cookies — it will not. The trust record is stored in browser storage.</p>
            </div>
          )
        },
        {
          id: "phone-verification",
          title: "Phone Verification",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/profile</code> (Phone section) &nbsp;|&nbsp; <strong>Type:</strong> Action-based &nbsp;|&nbsp; <strong>Data source:</strong> Supabase, Twilio</p>
              <p>Adding a verified phone number enables SMS-based OTP and improves account security.</p>
              <ul>
                <li>Go to <strong>Profile Settings</strong> → Phone Verification section.</li>
                <li>Enter your mobile number (with area code) and click <strong>Send Code</strong>.</li>
                <li>Enter the 6-digit SMS code to verify. This writes <code>phone_verified: true</code> to your user profile.</li>
                <li>Once verified, your number is used for SMS OTP during login.</li>
              </ul>
              <p><strong>Check first:</strong> SMS delivery uses Twilio. If you do not receive the code within 60 seconds, try again. Make sure you enter the full mobile number including area code.</p>
            </div>
          )
        },
        {
          id: "password-reset",
          title: "Password Reset / Change Password",
          content: (
            <div>
              <p><strong>Routes:</strong> <code>/forgot-password</code>, <code>/reset-password</code>, <code>/change-password</code> &nbsp;|&nbsp; <strong>Type:</strong> Action-based</p>
              <p><strong>Forgot your password:</strong></p>
              <ul>
                <li>On the login screen, click <strong>Forgot Password</strong>.</li>
                <li>Enter your email and click <strong>Send Reset Link</strong>.</li>
                <li>Check your email for a reset link. The link expires after a short period.</li>
                <li>Click the link, enter your new password, and confirm it.</li>
              </ul>
              <p><strong>Change password while logged in:</strong></p>
              <ul>
                <li>Go to <strong>Profile Settings → Account Settings → Change Password</strong>.</li>
              </ul>
              <p><strong>Check first:</strong> Password reset links expire quickly. If the link has expired, return to the login screen and request a new one.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "dashboard-layout",
      icon: LayoutDashboard,
      title: "Dashboard Layout",
      color: "#0891b2",
      subsections: [
        {
          id: "sidebar",
          title: "Sidebar Navigation",
          content: (
            <div>
              <p><strong>Type:</strong> Navigation &nbsp;|&nbsp; <strong>Data source:</strong> Supabase RBAC (role-gated visibility)</p>
              <p>The left sidebar is the main navigation. It is always visible on desktop.</p>
              <ul>
                <li>Sections: <strong>Home, Performance, Finance, Workflow, Resources, Admin</strong>.</li>
                <li>Click any item to navigate. Some items expand to show sub-pages.</li>
                <li>Admin-only sections are hidden from non-admin roles.</li>
                <li>If a tab you expect is missing, your role may not include access — contact Dr. G or Ny.</li>
              </ul>
              <p><strong>Common mistake:</strong> Expecting all tabs to be visible — tabs are permission-gated by role. Missing tabs are not a bug; they reflect your access level.</p>
            </div>
          )
        },
        {
          id: "office-selector",
          title: "Office Selector",
          content: (
            <div>
              <p><strong>Type:</strong> Global filter &nbsp;|&nbsp; <strong>Data source:</strong> Supabase <code>offices</code> table via OfficeContext</p>
              <p>The office selector in the header filters all dashboard data to a specific location.</p>
              <ul>
                <li>Options: <strong>All Offices, Barnegat, Brick, Eatontown, Staten Island</strong>.</li>
                <li>Select <strong>All Offices</strong> for aggregated data across all locations.</li>
                <li>Office Managers and Staff are locked to their assigned office and cannot switch.</li>
                <li>Regional Managers and Admins can switch freely.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> If data looks wrong, verify the correct office is selected. This is the most common cause of unexpected results.
              </div>
            </div>
          )
        },
        {
          id: "date-filters",
          title: "Date Filters (Global Filter Bar)",
          content: (
            <div>
              <p><strong>Type:</strong> Global filter &nbsp;|&nbsp; <strong>Data source:</strong> None (filter only)</p>
              <p>The date filter in the header sets the time period for dashboard data across most pages.</p>
              <ul>
                <li>Quick presets: <strong>This Month, Last Month, This Quarter, YTD, Custom Date Range</strong>.</li>
                <li>YTD = January 1 to today.</li>
                <li>Custom range requires both start and end dates. Start must be on or before end.</li>
                <li>Some pages have their own internal date pickers that override the global filter.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> If numbers look wrong, always check the date filter — this is the second most common cause of unexpected results after the office selector.
              </div>
            </div>
          )
        },
        {
          id: "header-controls",
          title: "Header Controls",
          content: (
            <div>
              <p><strong>Type:</strong> Navigation / Global controls</p>
              <ul>
                <li><strong>Command Palette (search icon):</strong> Search for any page, provider, or action.</li>
                <li><strong>Help Center (? icon):</strong> Opens the right-side Help Center drawer.</li>
                <li><strong>Notification Bell:</strong> Shows recent system alerts, supply notifications, and approval requests.</li>
                <li><strong>Theme Selector:</strong> Switch dashboard color themes. Preference saved to your user profile.</li>
                <li><strong>Profile Menu:</strong> Access Profile Settings, Account Settings, and Sign Out.</li>
              </ul>
            </div>
          )
        }
      ]
    },
    {
      id: "home",
      icon: Monitor,
      title: "Home — Executive Overview",
      color: "#7c3aed",
      subsections: [
        {
          id: "executive-overview-intro",
          title: "Executive Overview",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/</code> and <code>/executive-overview</code> &nbsp;|&nbsp; <strong>Type:</strong> Reporting / Read-mostly</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary — production, collections, KPIs), Supabase (goals, daily_entries, offices)</p>
              <p><strong>Role access:</strong> Permission <code>dashboard:executive_overview</code>; super_admin always visible; other roles require explicit permission grant.</p>
              <p>The Executive Overview is the home screen and primary morning dashboard. It shows high-level performance across all offices for the selected date range and office filter.</p>
              <ul>
                <li><strong>KPI cards:</strong> Production, Collections, New Patients, Pending Approvals.</li>
                <li>Cards marked <strong>"Verified by Dentrix Ascend"</strong> are sourced directly from the Dentrix/FastAPI pipeline.</li>
                <li><strong>GoalDonutChart:</strong> Visual goal attainment per office.</li>
                <li><strong>MonthEndForecastWidget:</strong> Projects end-of-month totals based on current pace — this is a projection, not a committed figure.</li>
                <li><strong>Multi-Year Revenue Chart / Comparison Table:</strong> Year-over-year production and collections trends.</li>
                <li><strong>P&L Summary Table:</strong> Revenue, expenses, and net by office.</li>
                <li><strong>Executive Reconciliation Panel:</strong> Dentrix vs dashboard comparison.</li>
                <li><strong>Schedule Auto Email:</strong> The only write action on this page — saves an email schedule configuration.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> Pending Approvals count. If above 0, EOD entries are awaiting admin review and are NOT yet counted in KPI totals.
              </div>
              <p><strong>Common mistake:</strong> Assuming KPI cards reflect all data when pending approvals exist. Comparing YTD vs single-month without adjusting the date filter.</p>
              <p><strong>What "—" means:</strong> Value not returned by the API or null from backend — not zero. <strong>Loading spinner:</strong> API call in progress. <strong>Missing "Verified" badge:</strong> Data is from manual entry or pending import.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "performance",
      icon: TrendingUp,
      title: "Performance",
      color: "#059669",
      subsections: [
        {
          id: "kpis-page",
          title: "KPIs",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/kpis</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Reporting</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (goals)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager. Sub-tabs have individual permission keys.</p>
              <p>Detailed KPI breakdown: production, collections, new patients, hygiene CDT metrics, doctor metrics, provider heatmap, goal vs actual, sparklines.</p>
              <ul>
                <li><strong>Tabs:</strong> Main, Specialty, Providers (heatmap), Specialty Providers.</li>
                <li><strong>Hygiene CDT metrics</strong> use live backend-mapped CDT code buckets — these reflect actual procedure codes submitted, not estimates.</li>
                <li><strong>Treatment Acceptance</strong> is value-based (dollar amount of accepted plans) where available.</li>
                <li>The <strong>"Verified by Dentrix Ascend"</strong> badge confirms data came directly from the Dentrix/FastAPI pipeline.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> Verify date range and office. If hygiene CDT metrics show 0, check that CDT codes are mapped in the backend.
              </div>
              <p><strong>Common mistake:</strong> Expecting real-time data — KPIs reflect the selected period, not live today. If a sub-tab is missing, your role does not have that tab's permission.</p>
              <p><strong>What "—" means:</strong> Null from API — not zero. <strong>Missing tab:</strong> Permission not granted for your role.</p>
            </div>
          )
        },
        {
          id: "operations-page",
          title: "Operations",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/operations</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Reporting</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (supplemental)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager. Each sub-tab has its own permission key.</p>
              <p>Comprehensive operational analytics across 11 sub-tabs: Offices, Production, Performance, Providers, Services, Payors, Trends, Cancellations, Claims/AR, Marketing, Scorecards.</p>
              <ul>
                <li>Use in the morning to identify open time; in the afternoon to review next-day scheduling.</li>
                <li><strong>Marketing tab:</strong> New patient source data — requires source data from Dentrix.</li>
                <li>If "This Month" shows no data, the page auto-falls back to the last available period and shows a <code>noDataWarning</code> banner.</li>
              </ul>
              <p><strong>Common mistake:</strong> Expecting all 11 tabs to be visible — tabs are permission-gated. Missing tabs are not a bug.</p>
              <p><strong>What "—" means:</strong> No data for period. <strong>Warning banner:</strong> Fallback period active.</p>
            </div>
          )
        },
        {
          id: "office-performance-page",
          title: "Office Performance",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/office-performance</code> &nbsp;|&nbsp; <strong>Type:</strong> Reporting / Export-focused / Read-only</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (goals), Expense service (WF/AmEx)</p>
              <p><strong>Role access:</strong> Permission: <code>performance:office_view</code>. AccessDenied panel shown if missing.</p>
              <p>Single-office operational analytics: KPI cards, revenue trends, expense categories, provider productivity, transaction grid, goal achievement.</p>
              <ul>
                <li><strong>KPI cards:</strong> Production, Collections, New Patients, No Shows, Treatment Acceptance.</li>
                <li><strong>DentrixDataSourceBanner:</strong> Shows whether live API data is available. If API failed, data may be stale or from manual entries.</li>
                <li><strong>Export controls:</strong> CSV/PDF download — file download only, no backend write.</li>
                <li><strong>Tabs:</strong> Revenue, Expenses, Providers, Transactions.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> Verify correct office is selected. Check DentrixDataSourceBanner — if API failed, data may be stale.
              </div>
              <p><strong>What "—" means:</strong> Null from API — NOT zero. <strong>What "N/A" means:</strong> Percentage denominator was null.</p>
            </div>
          )
        },
        {
          id: "provider-metrics",
          title: "Provider Performance",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/provider-performance</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Reporting</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (providers, offices, service_categories tables)</p>
              <p><strong>Role access:</strong> Roles: admin, super_admin (both required). Permission: <code>performance:provider_view</code>. <code>requireBothRoleAndPermission: true</code>.</p>
              <p>Provider-level production, collections, case acceptance, and service category breakdown.</p>
              <ul>
                <li><strong>ProviderMetricsTable:</strong> Production, collections, case acceptance per provider.</li>
                <li><strong>ServiceCategoryTabs:</strong> Breakdown by CDT service category.</li>
                <li><strong>Trend days filter:</strong> 30/60/90 day trend window.</li>
                <li>Rows labeled <strong>"Unattributed" (UNATTRIBUTED_OFFICE_LEVEL)</strong> represent production not mapped to a specific provider — these are real data, not errors.</li>
              </ul>
              <p><strong>Common mistake:</strong> Expecting all providers across all offices — office filter scopes the list. If a provider is missing, check they are active in Supabase <code>providers</code> table.</p>
              <p><strong>What "—" means:</strong> Null from API. <strong>What "Unattributed" means:</strong> Production not mapped to a specific provider — normal for some Dentrix records.</p>
            </div>
          )
        },
        {
          id: "monthly-analytics",
          title: "Monthly Analytics",
          keywords: ["monthly analytics","executive summary","legacy","legacy import","legacy export","legacy manual override","monthly_executive_analytics","live dentrix","not live","historical","csv import","manual override","monthly trends","executive monthly"],
          searchableText: "Monthly Analytics executive summary legacy legacy import legacy export legacy manual override monthly_executive_analytics live Dentrix not live historical CSV import manual override monthly trends executive monthly",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/executive-monthly-analytics</code> &nbsp;|&nbsp; <strong>Type:</strong> Mixed — Executive Summary tab = Read-only; Legacy tabs = Write-capable</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager, office_manager. Permission: <code>performance.monthly_trends.view</code>.</p>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Critical — Three Tabs, Two Different Data Sources:</strong>
                <ul style={{ margin: "6px 0 0 0" }}>
                  <li><strong>Executive Summary tab:</strong> Automated data from Dentrix/FastAPI + reconciled AR snapshot. This is the live source of truth. NOT sourced from the <code>monthly_executive_analytics</code> Supabase table.</li>
                  <li><strong>Legacy Import/Export tab:</strong> Historical/manual data from Supabase <code>monthly_executive_analytics</code> table. CSV-imported or EOD-approved records. NOT live Dentrix actuals.</li>
                  <li><strong>Legacy Manual Override tab:</strong> Manual data entry into Supabase <code>monthly_executive_analytics</code> table. NOT live Dentrix actuals.</li>
                </ul>
              </div>
              <p><strong>Check first:</strong> Use the <strong>Executive Summary tab</strong> for current reporting. Legacy tabs are for historical/manual data only.</p>
              <p><strong>Common mistake:</strong> Confusing the automated Executive Summary with legacy manual override data. Legacy data does NOT reflect live Dentrix actuals.</p>
              <p><strong>What empty Legacy tabs mean:</strong> No manual entries exist for that period — this is normal if you have not imported or manually entered data.</p>
            </div>
          )
        },
        {
          id: "regional-manager",
          title: "Regional Manager (Supply Request Approvals)",
          keywords: ["regional manager","supply request","approvals","rcm-dashboard","supply request approvals","urgent requests","approve","reject","supabase","supply_request_batches","front desk","back staff","regional clinical manager","supply queue"],
          searchableText: "Regional Manager Supply Request Approvals rcm-dashboard supply_request_batches urgent_supply_requests approve reject bulk approve reject Supabase front desk back staff regional clinical manager supply queue",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/rcm-dashboard</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>supply_request_batches</code>, <code>urgent_supply_requests</code> tables via supplyRequestService)</p>
              <p><strong>Role access:</strong> Roles: regional_clinical_manager, super_admin. Permission: <code>performance.regional_manager.view</code>.</p>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important Clarification:</strong> The sidebar label says "Regional Manager" but this page routes to <code>/rcm-dashboard</code> and is the <strong>Supply Request Approval Queue</strong> — NOT Finance RCM (Revenue Cycle Management). Finance RCM is under Finance → RCM.
                <br /><br />
                <strong>Regional Manager = Supply Request Approvals</strong>
              </div>
              <p>This page shows pending supply requests from all offices, separated by Front Desk and Back Staff departments. Regional Clinical Managers approve or reject requests here.</p>
              <ul>
                <li><strong>Urgent Requests section:</strong> Time-sensitive requests flagged as urgent — check these first.</li>
                <li><strong>Pending Requests table:</strong> All pending requests by office and department.</li>
                <li><strong>Approve / Reject:</strong> Writes status update to Supabase <code>supply_request_batches</code>.</li>
                <li><strong>Bulk approve/reject:</strong> BulkConfirmModal — writes batch updates. Requires confirmation before executing.</li>
                <li>Realtime subscription keeps the queue live — no manual refresh needed.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> Urgent Requests section — these are flagged as time-sensitive. Then review Pending Requests by office.
              </div>
              <p><strong>Common mistake:</strong> Confusing this page with Finance RCM. This page is supply request approvals only.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "finance",
      icon: DollarSign,
      title: "Finance",
      color: "#d97706",
      subsections: [
        {
          id: "payroll",
          title: "Payroll",
          keywords: ["payroll","gusto","compensation","provider","pay","salary","benefits","employees","time attendance","admin","import history","dentrix payroll","gusto payroll","provider compensation","collection report"],
          searchableText: "Payroll Gusto compensation provider pay salary benefits employees time attendance admin import history Dentrix payroll Gusto payroll provider compensation collection report",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/payroll</code> &nbsp;|&nbsp; <strong>Type:</strong> Reporting / Export-focused (most tabs); Send Collection Report = write action</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (Dentrix tab), Gusto via Supabase import tables (Gusto tab)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Multiple granular permissions per sub-tab.</p>
              <p>Provider-level payroll compensation reporting from two sources: Dentrix Ascend (clinical production) and Gusto (HR/payroll).</p>
              <ul>
                <li><strong>Dentrix tab:</strong> Primary source for clinical production payroll.</li>
                <li><strong>Gusto tab:</strong> Imported Gusto data — Overview, Employees, Payroll Runs, Contractors, Benefits, Pay Schedules, Import History, Time &amp; Attendance.</li>
                <li><strong>Comparison tab:</strong> Side-by-side Dentrix vs Gusto.</li>
                <li><strong>Provider Compensation tab:</strong> Production-based compensation calculations.</li>
                <li><strong>Send Collection Report:</strong> Opens modal — sends email via edge function (write action).</li>
              </ul>
              <p><strong>Common mistake:</strong> Gusto tab shows imported data — if Gusto import has not run, data will be empty or stale. Check Import History tab for latest sync status.</p>
              <p><strong>What empty Gusto tabs mean:</strong> Gusto import has not run or failed — not a dashboard error.</p>
              <p><strong>⚠️ Admin/Super Admin only.</strong></p>
            </div>
          )
        },
        {
          id: "provider-compensation-date-offset",
          title: "Provider Compensation — Gusto / Dentrix Ascend Date-Offset Rule",
          keywords: ["provider compensation","gusto","dentrix","offset","one day","date","pay period","collection","start minus one","end minus one","business rule","date mapping","compensation date","august","intentional"],
          searchableText: "provider compensation Gusto Dentrix offset one day date pay period collection start minus one end minus one business rule date mapping compensation date intentional approved Dr G",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/payroll</code> → Provider Compensation tab &nbsp;|&nbsp; <strong>Type:</strong> Internal business rule documentation</p>
              <p><strong>Approved by:</strong> Dr. G &nbsp;|&nbsp; <strong>Status:</strong> Implemented — active as of September 2026</p>

              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "12px 16px", margin: "12px 0" }}>
                <strong>✓ Intentional Business Rule — Active</strong>
                <p style={{ margin: "6px 0 0 0" }}>
                  For provider compensation, Gusto payroll dates and Dentrix Ascend collection dates
                  intentionally differ by one day. This offset is implemented and applied automatically.
                </p>
              </div>

              <h4 style={{ marginTop: 12, marginBottom: 4 }}>The Rule</h4>
              <p>For every provider-compensation pay period:</p>
              <ul>
                <li><strong>Dentrix Ascend collection start</strong> = Gusto pay period start − 1 day</li>
                <li><strong>Dentrix Ascend collection end</strong> = Gusto pay period end − 1 day</li>
              </ul>

              <h4 style={{ marginTop: 12, marginBottom: 4 }}>Canonical Example</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #e5e7eb" }}>Gusto Pay Period (displayed unchanged)</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #e5e7eb" }}>Dentrix Ascend Collections Queried</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", fontFamily: "monospace" }}>Aug 17 – Aug 30, 2026</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", fontFamily: "monospace", color: "#059669" }}>Aug 16 – Aug 29, 2026</td>
                  </tr>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", fontStyle: "italic", color: "#6b7280" }}>Any pay period start S, end date E</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", fontStyle: "italic", color: "#059669" }}>(S − 1 day) – (E − 1 day)</td>
                  </tr>
                </tbody>
              </table>

              <h4 style={{ marginTop: 12, marginBottom: 4 }}>Why This Offset Exists</h4>
              <p>
                Dentrix Ascend posts collections one day before the corresponding Gusto pay period date.
                The offset aligns the Dentrix Ascend collection window with the actual compensation period
                that Gusto pays out.
              </p>

              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "12px 16px", margin: "12px 0" }}>
                <strong>✓ Implementation — Active (September 2026)</strong>
                <p style={{ margin: "6px 0 0 0" }}>
                  The one-day offset is applied automatically to every provider-compensation Dentrix Ascend
                  collection query. The Provider Compensation UI shows both the Gusto pay period (unchanged,
                  for payroll and audit) and the shifted Dentrix Ascend collection window side by side.
                </p>
                <p style={{ margin: "6px 0 0 0" }}>
                  The helper uses timezone-safe calendar arithmetic — no UTC conversion that could shift dates unexpectedly.
                </p>
              </div>

              <h4 style={{ marginTop: 12, marginBottom: 4 }}>Scope of This Rule</h4>
              <ul>
                <li>Applies to: Provider Compensation tab — Dentrix Ascend collection/production query only</li>
                <li>Does NOT apply to: Gusto Payroll Overview, Gusto payroll totals, Gusto Payroll Runs, employee data, taxes, deductions, benefits, or any other date filter</li>
                <li>Does NOT change: Gusto payroll amounts, benefits, reimbursements, AmEx, Wells Fargo, or any expense calculation</li>
              </ul>

              <p><strong>Questions:</strong> Contact Dr. G for any changes to provider compensation date logic.</p>
            </div>
          )
        },
        {
          id: "finance-page",
          title: "Financial Analytics",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/financial-analytics</code> &nbsp;|&nbsp; <strong>Type:</strong> Reporting / Export-focused / Read-only (Bookmark writes to localStorage only)</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (goals, service categories)</p>
              <p><strong>Role access:</strong> Permission: <code>analytics:financial_view</code>. Each sub-tab has its own permission key.</p>
              <p>Advanced financial analytics: revenue breakdown, production adjustments, collections, service categories, Dentrix reconciliation, pivot tables, bookmarks.</p>
              <ul>
                <li><strong>Tabs:</strong> Revenue Breakdown, Collections, Service Categories, Production Adjustments, Dentrix Reconciliation.</li>
                <li><strong>Filter Panel:</strong> Office, date range, provider, service category. Uses staged → applied pattern.</li>
                <li><strong>Pivot Table:</strong> Custom grouping of financial data.</li>
                <li><strong>Bookmarks:</strong> Save filter combinations to localStorage (browser-local only).</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> After changing any filter, you must click <strong>"Apply Filters"</strong> for charts to update. Data does NOT update until applied.
              </div>
              <p><strong>Common mistake:</strong> Changing filters without clicking Apply Filters — charts will not update. Reconciliation tab shows Dentrix vs dashboard discrepancies — small differences during sync windows are normal.</p>
            </div>
          )
        },
        {
          id: "expenses",
          title: "Expenses",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/financial-analytics/expense-report</code> &nbsp;|&nbsp; <strong>Type:</strong> Mixed — Overview/Transactions = Reporting; Import/Manual Entry/Admin Tools = Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>expenses</code> table), AmEx CSV import, Gusto payroll layer (<code>expense_facts</code>)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager. Admin-only tabs hidden from other roles.</p>
              <p>Centralized expense intelligence: payroll, AmEx, utilities, occupancy, insurance, and all operating costs.</p>
              <ul>
                <li><strong>Tabs:</strong> Overview, Transactions, AmEx Detail (Reconciliation), AmEx Payments, Import, V292 Transfer Audit (admin only), Admin Tools (admin only).</li>
                <li><strong>AmEx Import:</strong> Upload CSV — writes to <code>expenses</code> table. AmEx data requires import to be current.</li>
                <li><strong>Manual Expense Entry:</strong> Writes to <code>expenses</code> — for exceptions only.</li>
                <li><strong>Add Payment:</strong> Writes to <code>amex_payments</code>.</li>
              </ul>
              <p><strong>Common mistake:</strong> AmEx Detail tab shows reconciliation data — requires AmEx import to have run. V292 Transfer Audit and Admin Tools are admin-only and hidden from other roles.</p>
              <p><strong>What empty AmEx tabs mean:</strong> Import has not run — not a dashboard error.</p>
            </div>
          )
        },
        {
          id: "rcm",
          title: "RCM (Revenue Cycle Management)",
          keywords: ["rcm","revenue cycle management","ar aging","claims","collections","insurance","patient balances","eassist","billing","outstanding","write off","90 days","claim submissions","pos collection","adjustment","daily comparison","finance rcm"],
          searchableText: "RCM Revenue Cycle Management AR aging claims collections insurance patient balances eAssist billing outstanding write off 90 days claim submissions POS collection adjustment daily comparison finance rcm",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/rcm</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Reporting</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (supplemental)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager. Each tab has its own permission.</p>
              <div style={{ backgroundColor: "#e0f2fe", border: "1px solid #0891b2", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>ℹ️ Note:</strong> Finance RCM (this page at <code>/rcm</code>) is Revenue Cycle Management — claims, collections, AR aging. It is separate from the "Regional Manager" sidebar item (which is the supply request approval queue at <code>/rcm-dashboard</code>).
              </div>
              <p>13 sub-tabs: Claim Submissions, Patient Balances, Patient AR Follow-Up, Point of Service Collection, Adjustment, Dashboard, AR Aging, Collection Refund, Daily Comparison, Dentrix Daily Summary, Patient Portion, eAssist Reports.</p>
              <ul>
                <li><strong>AR Aging tab:</strong> Outstanding balances in 0–30, 31–60, 61–90, 90+ day buckets. 90+ days = highest priority.</li>
                <li><strong>RcmDiagnosticPanel:</strong> Available for troubleshooting data discrepancies.</li>
                <li><strong>Payment Arrangement tab:</strong> Intentionally hidden — backend endpoint does not expose true arrangement data.</li>
              </ul>
              <p><strong>Common mistake:</strong> Expecting Payment Arrangement tab — it is hidden because the data source does not currently support it.</p>
            </div>
          )
        },
        {
          id: "transaction-audit",
          title: "Transaction Audit",
          keywords: ["transaction audit","source not recorded","dentrix api synced","human submission","submitted_by","null","source badge","daily entries","audit trail","compliance","pending review","approved","rejected","draft","ascend api sync"],
          searchableText: "Transaction Audit source not recorded dentrix api synced human submission submitted_by null source badge daily_entries audit trail compliance pending review approved rejected draft ascend api sync source attribution",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/transaction-audit</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Diagnostic</p>
              <p><strong>Data source:</strong> Supabase (<code>daily_entries</code> table), Dentrix/FastAPI (supplemental)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager, office_manager. Permission: <code>finance.audit.view</code>.</p>
              <p>Full audit trail of daily entries, adjustments, and expenses for compliance — shows all <code>daily_entries</code> records with source attribution.</p>
              <ul>
                <li><strong>Source badges:</strong>
                  <ul>
                    <li><strong>Ascend API Sync (purple):</strong> Row came from the Dentrix pipeline.</li>
                    <li><strong>Human Submission:</strong> Row was manually entered.</li>
                    <li><strong>Source Not Recorded:</strong> <code>submitted_by</code> field is null.</li>
                  </ul>
                </li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> <strong>"Source Not Recorded" does NOT mean bad data.</strong> It often means <code>submitted_by</code> is null, which is common for API-synced rows. The automated Dentrix pipeline does not always populate the <code>submitted_by</code> field. This is expected behavior, not an error.
              </div>
              <p><strong>Common mistake:</strong> Treating "Source Not Recorded" as suspicious — it is normal for API sync rows.</p>
            </div>
          )
        },
        {
          id: "audit-log",
          title: "Audit Dashboard (Audit Log)",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/audit-dashboard</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Diagnostic</p>
              <p><strong>Data source:</strong> Supabase (<code>audit_logs</code> table)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Lower roles see scoped views (staff = own activity, office_manager = own office). Permission: <code>finance.audit_log.view</code>.</p>
              <p>Who accessed which data, when, and what actions were taken.</p>
              <ul>
                <li>Filters: Date range (Today, 7d, 30d, 90d, All Time), Action type (CREATE, UPDATE, DELETE, APPROVE, EXPORT, etc.), Resource type, User.</li>
                <li>Sensitive fields (password, role, salary, SSN, bank_account, phone) are <strong>redacted</strong> for viewers below admin level.</li>
                <li>Role determines scope: super_admin/admin see all; office_manager sees own office; staff sees own activity.</li>
              </ul>
              <p><strong>What "[REDACTED]" means:</strong> Sensitive field hidden from current role. <strong>What "—" means:</strong> Field not recorded in that log entry.</p>
            </div>
          )
        },
        {
          id: "audit-reports",
          title: "Audit Reports",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/audit-reports</code> &nbsp;|&nbsp; <strong>Type:</strong> Reporting / Export-focused</p>
              <p><strong>Data source:</strong> Supabase (<code>audit_logs</code> table); saved configs in localStorage</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>finance.audit_reports.view</code>.</p>
              <p>Generate and export audit log summaries by day, week, or month.</p>
              <ul>
                <li>Select frequency (Daily, Weekly, Monthly) — date range auto-populates.</li>
                <li>Preview the report before exporting as CSV or PDF.</li>
                <li><strong>Save Config:</strong> Writes to localStorage — browser-specific only.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> Saved report configurations are stored in your browser (localStorage) — they will be lost if you clear browser data. They are not saved to Supabase.
              </div>
            </div>
          )
        },
        {
          id: "compliance",
          title: "Compliance & Retention",
          keywords: ["compliance","retention","simulate purge","purge","delete","hipaa","financial retention","data minimization","localstorage","browser","planning","simulation","not delete","audit_logs","retention rules","purge history"],
          searchableText: "Compliance Retention simulate purge purge delete HIPAA financial retention data minimization localStorage browser planning simulation does not delete audit_logs retention rules purge history",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/compliance-retention</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — planning reference tool</p>
              <p><strong>Data source:</strong> Supabase (<code>audit_logs</code> for counts); retention rules and purge history in localStorage</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>finance.compliance.view</code>.</p>
              <p>Audit log retention policies, purge schedules, and compliance status indicators (HIPAA, Financial Retention, Data Minimization).</p>
              <ul>
                <li><strong>Compliance status badges:</strong> HIPAA, Financial Retention, Data Minimization — shows whether retention periods meet minimum standards.</li>
                <li><strong>Set retention period:</strong> Writes to localStorage.</li>
                <li>Default retention is <strong>Forever</strong> for all resources (per V491 documented retention policy).</li>
                <li>HIPAA minimum = 2190 days (6 years).</li>
              </ul>
              <div style={{ backgroundColor: "#fee2e2", border: "1px solid #ef4444", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>🚫 Critical Warning:</strong> <strong>"Simulate Purge" does NOT delete any data from Supabase.</strong> It is a UI planning simulation only. Actual data purge is not implemented. Do not rely on this button to remove data.
                <br /><br />
                Retention rules and purge history are stored in your browser (localStorage) — not in Supabase. This page is a <strong>compliance planning and documentation tool</strong>, not an enforcement system.
              </div>
              <p><strong>What "Needs Review" means:</strong> Retention period does not meet compliance standard minimum. <strong>What "Compliant" means:</strong> Meets or exceeds minimum.</p>
            </div>
          )
        },
        {
          id: "heatmap",
          title: "Access Heatmap",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/access-heatmap</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Diagnostic</p>
              <p><strong>Data source:</strong> Supabase (<code>audit_logs</code> table)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>finance.heatmap.view</code>.</p>
              <p>Interactive heatmap of system access patterns by hour, day, and user.</p>
              <ul>
                <li>7×24 grid (day × hour) — darker cells = more activity.</li>
                <li>View modes: Heatmap, Hourly, Daily, Users.</li>
                <li>Date range: 7d, 30d, 90d.</li>
              </ul>
              <p><strong>Important limitation:</strong> Heatmap only reflects actions that write to <code>audit_logs</code>. Not all system activity is captured — only instrumented actions appear here. Low intensity does not necessarily mean low usage.</p>
            </div>
          )
        },
        {
          id: "alerts",
          title: "Alert Rules",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/alert-rules</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>alert_rules</code> table, <code>audit_logs</code> via suspiciousActivityService)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>finance.alerts.view</code>.</p>
              <p>Configure suspicious activity detection rules: mass deletions, after-hours access, bulk exports, rapid role changes.</p>
              <ul>
                <li><strong>Write actions:</strong> Create/Edit/Enable/Disable/Delete rules (all write to <code>alert_rules</code>); Acknowledge Alert (writes to alert record).</li>
                <li><strong>Actively monitored rule types:</strong> mass_deletion, after_hours, bulk_export, rapid_role_change.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> The <strong>Failed Login</strong> rule type is marked "Not Monitored" — failed login events are not stored in <code>audit_logs</code>. This rule type will never trigger even if configured.
              </div>
              <p><strong>What "Not Monitored" badge means:</strong> Rule type cannot trigger because the event source is not in audit_logs.</p>
            </div>
          )
        },
        {
          id: "error-logs",
          title: "Error Logs",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/error-logs</code> &nbsp;|&nbsp; <strong>Type:</strong> Diagnostic — Write-capable (Mark as Resolved)</p>
              <p><strong>Data source:</strong> Supabase (<code>error_logs</code> table)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>finance.error_logs.view</code>.</p>
              <p>Structured production error logs with severity levels, stack traces, and user context.</p>
              <ul>
                <li>Severity: critical, error, warning, info.</li>
                <li>Filter to "Unresolved" first to see active issues. Critical = highest priority.</li>
                <li><strong>Mark as Resolved:</strong> Writes <code>resolved: true</code>, <code>resolved_by</code>, <code>resolved_at</code> to <code>error_logs</code>.</li>
              </ul>
              <p><strong>Common mistake:</strong> Resolving an error log does not fix the underlying issue — it only marks it as acknowledged. Contact Yabezy for persistent critical errors.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "workflow",
      icon: Workflow,
      title: "Workflow",
      color: "#dc2626",
      subsections: [
        {
          id: "morning-huddle",
          title: "Morning Huddle",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/daily-morning-huddle</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>huddles</code> table via huddleService); Dentrix/FastAPI (yesterday's actuals via ascendApi)</p>
              <p><strong>Role access:</strong> Permission: <code>huddle:view</code> (all authenticated users with this permission).</p>
              <p>Daily morning huddle submission and management — production goals, patient counts, checklist, provider selection, history, reports.</p>
              <ul>
                <li><strong>Submit Huddle:</strong> Writes to <code>huddles</code> table — status: submitted. Sends push notification to admins.</li>
                <li><strong>Unlock (admin only):</strong> Writes unlock status + audit record. Use sparingly.</li>
                <li><strong>Convert to Task:</strong> ConvertToTaskModal — writes to <code>action_items</code>.</li>
                <li><strong>Tabs:</strong> Today, History, Reports.</li>
                <li>Yesterday's actuals are prefilled from Dentrix API — if API unavailable, these fields show "—".</li>
                <li>If "Previous Open Day" shows, a prior day was missed — use it to submit retroactively.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> Check if today's huddle is already submitted (status badge). If "Previous Open Day" shows, a prior day was missed.
              </div>
              <p><strong>Common mistake:</strong> Submitting estimated numbers — use actual scheduled patient count and production goal from Dentrix. Submitting under the wrong provider.</p>
              <p><strong>What "—" means:</strong> Value not available from Dentrix for yesterday's actuals. <strong>Draft status:</strong> Not yet submitted.</p>
            </div>
          )
        },
        {
          id: "eod-report",
          title: "EOD Report (Daily Entry Form)",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/daily-entry-form</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>daily_entries</code> table — write); Dentrix/FastAPI (Dentrix Daily Closeout tab, Unscheduled Treatment tab — read)</p>
              <p><strong>Role access:</strong> RBAC guard via useRbacGuard. Permission: <code>workflow.eod.view</code>.</p>
              <p>End-of-day submission of actual production, collections, expenses, and operational notes; multi-step attestation workflow.</p>
              <ul>
                <li><strong>Submit:</strong> Writes to <code>daily_entries</code> — status: pending. Sends approval notification via edge function.</li>
                <li><strong>Auto-save:</strong> Writes draft every 30 seconds — prevents data loss.</li>
                <li><strong>Bulk Import tab:</strong> Writes multiple entries at once — use with caution.</li>
                <li><strong>Steps:</strong> Step 1: Attestation checklist; Step 2: Notes/exceptions; Step 3: Legacy reference fields.</li>
                <li><strong>Additional tabs:</strong> Dentrix Daily Closeout, Unscheduled Treatment, Treatment Plan Completion, Bulk Import.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Warning:</strong> Do not submit estimated numbers. Use actual Dentrix closeout figures. Attestation checklist must be completed before submission.
              </div>
              <p><strong>What "Draft" means:</strong> Auto-saved but not submitted. <strong>What "Pending" means:</strong> Submitted, awaiting admin approval.</p>
            </div>
          )
        },
        {
          id: "pending-approvals",
          title: "EOD Approval Queue (Pending Approvals)",
          keywords: ["pending approvals","eod approval","approve","reject","dentrix api synced","human submission","source badge","purple badge","eod_status_history","daily_entries","reverse approval","pending re-approval","approval queue"],
          searchableText: "Pending Approvals EOD Approval Queue approve reject Dentrix API Synced Human Submission source badge purple badge eod_status_history daily_entries reverse approval pending re-approval approval queue",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/pending-approvals</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>daily_entries</code>, <code>eod_status_history</code>, <code>user_profiles</code> tables)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager. Permission: <code>workflow.approvals.view</code>.</p>
              <p>Review and approve or reject End-of-Day reports from all assigned offices.</p>
              <ul>
                <li><strong>Source badges:</strong>
                  <ul>
                    <li><strong>Dentrix API Synced (purple):</strong> Automated pipeline row — typically does not need manual approval.</li>
                    <li><strong>Human Submission:</strong> Manually entered — focus on these first.</li>
                  </ul>
                </li>
                <li><strong>Approve:</strong> Writes status: approved to <code>daily_entries</code> + <code>eod_status_history</code>.</li>
                <li><strong>Reject:</strong> Writes status: rejected + reason + sends rejection email via edge function to office manager.</li>
                <li><strong>Reverse Approval:</strong> Writes pending_reapproval.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> "Dentrix API Synced" rows (purple) are from the automated pipeline — focus on "Human Submission" rows first. Goal: end each day at zero pending approvals.
              </div>
              <p><strong>Common mistake:</strong> Rejecting without providing a clear rejection reason — the reason is emailed to the submitter. <strong>What "Pending Re-Approval" means:</strong> Previously approved, then reversed.</p>
            </div>
          )
        },
        {
          id: "huddle-approvals",
          title: "Workflow Approvals Queue (Huddle Approvals)",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/huddle-approvals</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (huddles/daily_entries tables via huddleService)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager, regional_clinical_manager. Permission: <code>workflow.huddle_queue.view</code>.</p>
              <p>Review and approve pending Morning Huddle submissions by office with SLA tracking (24-hour SLA).</p>
              <ul>
                <li><strong>SLA badges:</strong> Red = overdue, Orange = &lt;4h, Yellow = &lt;12h, Green = OK.</li>
                <li><strong>Approve / Reject / Bulk approve/reject:</strong> All write to Supabase.</li>
              </ul>
              <p><strong>Check first:</strong> Red/orange SLA badges = overdue or near-deadline huddles. Address these first. SLA is informational only — no automated escalation.</p>
            </div>
          )
        },
        {
          id: "team-assignments",
          title: "Team Assignments / Tasks",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/team-assignments</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>action_items</code> table via actionItemsService). Realtime subscription active.</p>
              <p><strong>Role access:</strong> Permission: <code>workflow.tasks.view</code>. Write access is role-scoped: super_admin/admin = full; regional/clinical_manager = create/edit/status/select office; office_manager = own office only; staff = view assigned + update own task status only.</p>
              <p>Manage and track team action items — Kanban board and table view.</p>
              <ul>
                <li><strong>Create/Edit/Delete Task:</strong> All write to <code>action_items</code>.</li>
                <li><strong>Update Status:</strong> Writes status to <code>action_items</code>.</li>
                <li><strong>Kanban columns:</strong> Submitted, In Progress, Completed.</li>
                <li>Quick filters: all, my tasks, overdue, submitted, in_progress, completed.</li>
              </ul>
              <p><strong>Common mistake:</strong> Staff can only update status on their own assigned tasks — they cannot create or edit tasks for others.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "resources",
      icon: Package,
      title: "Resources",
      color: "#7c3aed",
      subsections: [
        {
          id: "reports",
          title: "Reports",
          keywords: ["reports","workbook","export","download","pl summary","goal leaderboard","period comparison","provider production","csv","pdf","workbook confirm","workbook export","financial reports","monthly reports","ytd"],
          searchableText: "Reports workbook export download P&L summary goal leaderboard period comparison provider production CSV PDF workbook confirm workbook export financial reports monthly reports YTD",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/reports</code> &nbsp;|&nbsp; <strong>Type:</strong> Reporting / Export-focused / Read-only (Export = file download only)</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (primary), Supabase (goals), Expense service</p>
              <p><strong>Role access:</strong> Permission: <code>reports:financial_view</code>. Tab-level permissions for each report type.</p>
              <p>Monthly P&L reports, goal leaderboard, period comparison, revenue by provider — export-focused financial reporting.</p>
              <ul>
                <li><strong>Tabs:</strong> P&L Summary, Goal Leaderboard, Period Comparison, Provider Production &amp; Collections.</li>
                <li><strong>Date filter:</strong> Defaults to YTD 2026. Verify this is correct before generating reports.</li>
                <li><strong>Export Panel:</strong> CSV/PDF download — no backend write.</li>
                <li><strong>WorkbookConfirmModal:</strong> Requires confirmation before generating full workbook — this may take a moment to generate.</li>
                <li>KPI badges at top show Production, Collections, Expenses for quick reference.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>✓ Check First:</strong> Verify date filter — defaults to YTD 2026. Check office filter. The Workbook export generates a comprehensive multi-tab report and requires confirmation.
              </div>
              <p><strong>Common mistake:</strong> Expecting real-time data — Reports reflects the selected period. Workbook export may take a moment to generate.</p>
            </div>
          )
        },
        {
          id: "inventory",
          title: "Inventory Dashboard",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/inventory-dashboard</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Workflow-based — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>bone_tissue_stock</code>, <code>implant_inventory</code>, <code>supply_request_batches</code>, <code>urgent_supply_requests</code>, <code>front_desk_inventory</code> tables). Offline queue support.</p>
              <p><strong>Role access:</strong> Permission: <code>inventory:view</code>.</p>
              <p>Central inventory hub — bone/tissue/membrane tracking, implant inventory, front desk supply requests, monthly supply module.</p>
              <ul>
                <li><strong>Tabs:</strong> Implant &amp; Grafting (bone/tissue + implants), Front Desk, Monthly Supply.</li>
                <li><strong>Scan In:</strong> Writes receive record to Supabase (Step 1 — Receiving).</li>
                <li><strong>Scan Out:</strong> Writes consumption record + patient linkage (Step 2 — Consumption).</li>
                <li><strong>Submit Supply Request:</strong> Writes to <code>supply_request_batches</code> — routes to Regional Manager for approval.</li>
                <li><strong>Submit Urgent Request:</strong> Writes to <code>urgent_supply_requests</code>.</li>
                <li>Offline queue support — actions queued when offline and synced when connection restored.</li>
              </ul>
              <p><strong>Common mistake:</strong> Scanning out without scanning in first — items must be received before they can be consumed. Not linking patient on scan-out.</p>
              <p><strong>What expiration alert means:</strong> Item within expiration window — review and use or reorder.</p>
            </div>
          )
        },
        {
          id: "directory",
          title: "Staff Directory",
          keywords: ["directory","staff directory","staff","photo","birthday","role category","office assignment","canmanage","add staff","edit staff","delete staff","upload photo","directory-first","profile photo","internal directory","operational directory"],
          searchableText: "Staff Directory directory photo birthday role category office assignment canManage add staff edit staff delete staff upload photo directory-first profile photo internal directory operational directory",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/staff-directory</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only for staff; Action/Configuration for managers</p>
              <p><strong>Data source:</strong> Supabase (<code>staff_directory</code> table via staffDirectoryService; photos via Supabase Storage)</p>
              <p><strong>Role access:</strong> Visible to all authenticated users. Edit/add/delete restricted to managers (<code>canManage</code> role check).</p>
              <p>Internal operational staff/management directory with photos, birthdays, role categories, and contact information. This is <strong>separate from dashboard login accounts</strong> (<code>user_profiles</code>).</p>
              <ul>
                <li><strong>Add/Edit/Delete Staff:</strong> Writes to <code>staff_directory</code> — managers only.</li>
                <li><strong>Upload Photo:</strong> Writes to Supabase Storage — uses PhotoCropModal for cropping before upload.</li>
                <li>Filters: Search (name, email, role), Office, Role category, Birthday month.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Directory-first photo rule:</strong> Profile Settings uses the Directory photo when a matching email record exists. If you upload a photo to Profile Settings but a Directory record exists for your email, the <strong>Directory photo takes precedence</strong> throughout the dashboard. To change your photo, update the Directory record.
              </div>
              <p><strong>Important:</strong> A staff member may exist in the Directory without a dashboard login account. Directory is separate from <code>user_profiles</code>.</p>
              <p><strong>What "—" means:</strong> Field not set in directory record. <strong>Initials avatar:</strong> No photo uploaded.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "admin",
      icon: Shield,
      title: "Admin",
      color: "#0891b2",
      subsections: [
        {
          id: "users",
          title: "Users Management",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/users-management</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>user_profiles</code>, <code>user_office_assignments</code> tables). Realtime subscription active.</p>
              <p><strong>Role access:</strong> Roles: admin, super_admin. Permission: <code>admin.users.view</code>.</p>
              <p>Manage users, roles, and office assignments — invite, edit, deactivate, bulk actions.</p>
              <ul>
                <li><strong>Invite User:</strong> Writes to <code>user_profiles</code> + sends invite email.</li>
                <li><strong>Edit User:</strong> Writes role/office/status to <code>user_profiles</code>.</li>
                <li><strong>Deactivate/Activate:</strong> Writes <code>is_active</code>.</li>
                <li><strong>Role Editor:</strong> Writes permissions to <code>role_permissions</code>.</li>
                <li>Role determines what tabs the user can see. Office assignment determines data scope.</li>
              </ul>
              <p><strong>Common mistake:</strong> Assigning wrong role — role determines all permission access. When a staff member leaves, <strong>deactivate</strong> their account — do not delete it, as this preserves audit history.</p>
              <p><strong>What "Inactive" badge means:</strong> User deactivated — cannot log in.</p>
            </div>
          )
        },
        {
          id: "providers",
          title: "Manage Providers",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/staff-management</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>providers</code>, <code>offices</code> tables via managementService)</p>
              <p><strong>Role access:</strong> Roles: admin, super_admin. Permission: <code>admin.providers.view</code>.</p>
              <p>Add, edit, and manage providers (doctors and hygienists) by office.</p>
              <ul>
                <li><strong>Add/Edit Provider:</strong> Writes to <code>providers</code>.</li>
                <li><strong>Deactivate/Activate:</strong> Writes <code>is_active</code>.</li>
                <li><strong>CSV Import:</strong> Bulk writes to <code>providers</code>.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> Provider names must match Dentrix Ascend exactly. Mismatches cause production to appear as "Unattributed" in reports. Check existing list before adding to avoid duplicates.
              </div>
              <p><strong>What "Inactive" provider means:</strong> Excluded from active provider lists in KPIs and EOD form — historical data is preserved.</p>
            </div>
          )
        },
        {
          id: "settings-goals",
          title: "Management & Settings / Goals",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/management</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — Write-capable (all CRUD)</p>
              <p><strong>Data source:</strong> Supabase (multiple tables: offices, providers, user_profiles, cost_drivers, back_staff_orders, service_categories, office_goals, service_category_goals, email_logs, audit_logs)</p>
              <p><strong>Role access:</strong> Roles: super_admin only. Permission: <code>admin.settings.view</code>.</p>
              <p>System configuration for Super Admins — offices, providers, users, cost drivers, back staff orders, service categories, goals, email logs, audit trail, pending entity review.</p>
              <ul>
                <li><strong>Goals Management:</strong> Set monthly collection targets per office — set before the month begins.</li>
                <li><strong>Service Category Goals:</strong> Set targets by CDT service category.</li>
                <li><strong>Review Pending Entities:</strong> Approve/reject auto-created providers/categories from imports.</li>
                <li><strong>Email Logs:</strong> View history of system-generated emails.</li>
              </ul>
              <p><strong>Common mistake:</strong> Setting goals after the month has started. Deleting cost drivers or service categories referenced by existing entries.</p>
              <p><strong>What "Pending Entities" means:</strong> Auto-created during import — need review before they appear in reports.</p>
              <p><strong>⚠️ Super Admin only.</strong></p>
            </div>
          )
        },
        {
          id: "sync",
          title: "Sync Dashboard",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/sync-dashboard</code> &nbsp;|&nbsp; <strong>Type:</strong> Diagnostic + limited write (Resolve Conflict)</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (<code>/v2/admin/sync-dashboard</code> endpoint), Supabase (<code>sync_logs</code>, <code>sync_conflicts</code> tables)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>admin.sync.view</code>.</p>
              <p>Dentrix Ascend ↔ Supabase sync status, logs, and conflict resolution.</p>
              <ul>
                <li><strong>Status labels:</strong> success/healthy/warning/error/failed/conflict/stale/running/partial/pending/skipped/awaiting_first_run/manual_only/not_instrumented/unknown.</li>
                <li><strong>Resolve Conflict:</strong> Writes resolution to <code>sync_conflicts</code>.</li>
                <li><strong>Validate Endpoints:</strong> Reads only — no write.</li>
              </ul>
              <p><strong>What "Not Instrumented" means:</strong> Run logging not wired for that endpoint — not that the endpoint is broken. <strong>What "Awaiting First Run" means:</strong> Endpoint has never synced. <strong>What "Manual Only" means:</strong> No automated sync for this endpoint.</p>
              <p><strong>Check first:</strong> Error or Stale status badges — these indicate sync problems. Contact Yabezy for sync issues.</p>
            </div>
          )
        },
        {
          id: "data-health",
          title: "Data Health",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/data-health</code> &nbsp;|&nbsp; <strong>Type:</strong> Diagnostic + Write-capable (Backfill, Reconciliation, Resolve Conflict)</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (ascendSyncService), Supabase (sync_logs, sync_conflicts, audit_logs)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>admin.data_health.view</code>.</p>
              <p>Full data pipeline audit — endpoint mapping, backfill, reconciliation, and conflict resolution.</p>
              <ul>
                <li><strong>Validate Endpoints:</strong> Reads endpoint health — no write.</li>
                <li><strong>Run Historical Backfill:</strong> Triggers API backfill — for historical gap-filling, not routine use.</li>
                <li><strong>Run Reconciliation:</strong> Triggers reconciliation — compares Dentrix and dashboard data.</li>
                <li><strong>Resolve Conflict:</strong> Writes to Supabase.</li>
                <li>All write actions log to <code>audit_logs</code> via writeAuditLog() (non-blocking).</li>
              </ul>
              <p><strong>What "Untested" means:</strong> Endpoint never validated. <strong>What "Stale" means:</strong> Last test &gt; 24 hours ago. Backfill and reconciliation are long-running — results appear in audit log after completion.</p>
            </div>
          )
        },
        {
          id: "import-audit",
          title: "Import Audit",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/import-audit</code> &nbsp;|&nbsp; <strong>Type:</strong> Diagnostic + Write-capable (import triggers)</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (dentrixIngestionService — runFullImport, runOfficeImport, runEndpointImport, retryFailedImports, fetchImportAuditLog, fetchImportSummary)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>admin.import_audit.view</code>.</p>
              <p>Dentrix Ascend multi-location import pipeline — per-office, per-endpoint audit log with manual sync triggers.</p>
              <ul>
                <li><strong>Run Full Import:</strong> Triggers full multi-office import — requires ConfirmDialog.</li>
                <li><strong>Run Office Import:</strong> Triggers single-office import — requires ConfirmDialog.</li>
                <li><strong>Run Endpoint Import:</strong> Triggers single endpoint — requires ConfirmDialog.</li>
                <li><strong>Retry Failed Imports:</strong> Re-runs failed endpoints — requires ConfirmDialog.</li>
                <li>All confirmed actions are logged in the audit trail.</li>
              </ul>
              <p><strong>Common mistake:</strong> Running full import during business hours — imports may cause temporary data inconsistency. Import operations are asynchronous — results appear in audit log after completion.</p>
              <p><strong>What "Skipped" means:</strong> Endpoint not included in this import run. <strong>What "Failed" means:</strong> Import error — check error_details.</p>
            </div>
          )
        },
        {
          id: "manual-entry",
          title: "Manual Production Entry",
          keywords: ["manual entry","manual production entry","manual production","exception only","last resort","ucr fee","production adjustment","net production","admin","manual entry admin","override","supplement","apply to analytics","manual data entry"],
          searchableText: "Manual Entry Manual Production Entry exception only last resort UCR fee production adjustment net production admin override supplement apply to analytics manual data entry manual_production_entries",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/manual-production-entry</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — Write-capable — Exception-only</p>
              <p><strong>Data source:</strong> Supabase (<code>manual_production_entries</code> table via manualProductionService)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin, regional_manager. Permission: <code>admin.manual_entry.view</code>.</p>
              <div style={{ backgroundColor: "#fee2e2", border: "1px solid #ef4444", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>🚫 Exception-Only Tool — Last Resort:</strong>
                <ul style={{ margin: "6px 0 0 0" }}>
                  <li>Use ONLY when Dentrix Ascend API does not provide UCR fee or production adjustment data for a specific period.</li>
                  <li>NOT for routine production correction.</li>
                  <li>Does NOT overwrite Dentrix/FastAPI verified data — manual entries supplement API data.</li>
                  <li>All entries require ConfirmDialog confirmation and are logged in the audit trail.</li>
                  <li>Manual entries are clearly labeled in reports to distinguish from Dentrix-verified data.</li>
                  <li>Consult with Dr. G or Yabezy before using for any significant data correction.</li>
                  <li><strong>Apply to Analytics</strong> must be used explicitly to include manual entries in reporting.</li>
                </ul>
              </div>
              <p><strong>Business rules:</strong> UCR Fee = full billed fee before reductions. Production Adjustments = reductions (stored as negative values). Net Production = auto-calculated.</p>
              <p><strong>What "—" means:</strong> No manual entry for that period/office/provider — this is normal.</p>
            </div>
          )
        },
        {
          id: "system",
          title: "System Dashboard",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/admin-system-dashboard</code> &nbsp;|&nbsp; <strong>Type:</strong> Diagnostic / Read-only (alert dismiss = UI only)</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (ascendSyncService, dentrixIngestionService), Supabase (notifications via notificationsService)</p>
              <p><strong>Role access:</strong> Roles: super_admin, admin. Permission: <code>admin.system.view</code>.</p>
              <p>Dentrix sync status, notification delivery health, import failures, and endpoint coverage by office with real-time alerts.</p>
              <ul>
                <li><strong>Alert banners:</strong> Critical (red), High (amber), Info (blue) — check these first.</li>
                <li><strong>Dismiss Alert:</strong> Removes from UI only — no backend write. Dismissed alerts may reappear on page refresh if the underlying condition persists.</li>
              </ul>
              <p><strong>What "Offline" means:</strong> Service unreachable. <strong>What "Degraded" means:</strong> Partial functionality. <strong>What "Checking" means:</strong> Health check in progress.</p>
              <p><strong>Common mistake:</strong> Dismissing alerts without investigating the underlying issue.</p>
            </div>
          )
        },
        {
          id: "reconciliation",
          title: "Dentrix Ascend Reconciliation",
          keywords: ["reconciliation","dentrix reconciliation","pass","warning","fail","endpoint missing","endpoint_missing","diagnostic","super admin","tolerance","benchmark","eassist","dentrix diagnostics","data lineage","mismatch"],
          searchableText: "Dentrix Ascend Reconciliation PASS WARNING FAIL ENDPOINT_MISSING diagnostic super admin tolerance benchmark eAssist dentrix-diagnostics data lineage mismatch",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/dentrix-diagnostics</code> &nbsp;|&nbsp; <strong>Type:</strong> Diagnostic / Read-only</p>
              <p><strong>Data source:</strong> Dentrix/FastAPI (ascendApi, dentrixNormalizedService), Supabase (supplemental), hardcoded eAssist Apr 22 2026 benchmark</p>
              <p><strong>Role access:</strong> Roles: super_admin only. Permission: <code>admin.reconciliation.view</code>.</p>
              <p>Full source-to-dashboard lineage, endpoint health checks, and eAssist benchmark reconciliation.</p>
              <ul>
                <li><strong>Status per metric:</strong>
                  <ul>
                    <li><strong>PASS:</strong> Within tolerance ($1.00 or 5%).</li>
                    <li><strong>WARNING:</strong> Outside tolerance but endpoint available.</li>
                    <li><strong>FAIL:</strong> Significant discrepancy — investigate.</li>
                    <li><strong>ENDPOINT_MISSING:</strong> No API endpoint exists for this metric — NOT a sync failure.</li>
                  </ul>
                </li>
                <li>eAssist benchmark is hardcoded to Apr 22 2026 reference data — not live.</li>
                <li>Staten Island excluded from benchmark (no eAssist data).</li>
                <li>This page is <strong>read-only</strong> — no data is modified here.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Important:</strong> <strong>ENDPOINT_MISSING does NOT mean a sync failure.</strong> It means no API endpoint exists for that metric. This is expected for some metrics.
              </div>
              <p><strong>Common mistake:</strong> Expecting exact matches — tolerance is $1.00 or 5% for reconciliation. Treating ENDPOINT_MISSING as an error.</p>
            </div>
          )
        },
        {
          id: "alert-thresholds",
          title: "Metric Alert Thresholds",
          keywords: ["alert thresholds","metric alert thresholds","breach simulation","mock values","demo values","prototype","local","collection ratio","30 day ar","claims submission rate","active prototype","simulate breach","threshold","hardcoded","not live","development"],
          searchableText: "Alert Thresholds Metric Alert Thresholds breach simulation mock values demo values prototype local collection ratio 30 day AR claims submission rate active prototype simulate breach threshold hardcoded not live development",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/metric-alert-thresholds</code> &nbsp;|&nbsp; <strong>Type:</strong> Admin/Configuration — Write-capable; breach simulation = UI only</p>
              <p><strong>Data source:</strong> Supabase (threshold configs — persistence to DB vs localStorage unclear); breach simulation uses hardcoded mock values</p>
              <p><strong>Role access:</strong> Roles: super_admin only. Permission: <code>admin.alert_thresholds.view</code>.</p>
              <p>Define threshold-based alerts for collection ratio, 30+ day AR, and claims submission rate across offices.</p>
              <ul>
                <li><strong>Create/Edit/Enable/Disable/Delete Threshold:</strong> Writes threshold config.</li>
                <li><strong>Simulate Breach:</strong> UI simulation using hardcoded mock values — no backend write.</li>
              </ul>
              <div style={{ backgroundColor: "#fee2e2", border: "1px solid #ef4444", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>🚫 Critical Warning — Breach Simulation Uses Mock Values:</strong>
                <ul style={{ margin: "6px 0 0 0" }}>
                  <li>The breach simulation panel uses <strong>hardcoded demonstration values</strong> (e.g., Barnegat: 112% collection ratio, Brick: 236%) — these are NOT live metrics.</li>
                  <li>These values are hardcoded constants for UI demonstration only. They are NOT sourced from any Supabase table, live API, or daily_entries data.</li>
                  <li>Thresholds are labeled <strong>"Active (prototype/local)"</strong> — this feature is still in development.</li>
                  <li><strong>Do not rely on threshold alerts for operational decisions until live monitoring is confirmed.</strong></li>
                </ul>
              </div>
              <p><strong>What "Active (prototype/local)" means:</strong> Threshold is configured but may not be connected to live monitoring — feature is in development.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "account",
      icon: User,
      title: "Account / Profile",
      color: "#0d9488",
      subsections: [
        {
          id: "profile-settings",
          title: "Profile Settings",
          keywords: ["profile settings","profile","photo","phone","password","theme","notification","directory-first","directory photo","otp","trusted browser","phone verification","display name","account settings"],
          searchableText: "Profile Settings profile photo phone password theme notification directory-first directory photo OTP trusted browser phone verification display name account settings",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/profile</code> &nbsp;|&nbsp; <strong>Type:</strong> Action/Configuration — Write-capable</p>
              <p><strong>Data source:</strong> Supabase (<code>user_profiles</code> table — primary), Supabase Storage (photos), Staff Directory (<code>staff_directory</code> table — Directory-first lookup by email match)</p>
              <p><strong>Role access:</strong> All authenticated users.</p>
              <p>View and update personal profile: name, phone, photo, theme, assigned offices, birthday, notification preferences.</p>
              <ul>
                <li><strong>Save Profile:</strong> Writes <code>full_name</code>, <code>phone_number</code> to <code>user_profiles</code>.</li>
                <li><strong>Upload Photo:</strong> Writes to Supabase Storage.</li>
                <li><strong>Send OTP / Verify OTP:</strong> Writes <code>phone_verified: true</code> via phoneVerificationService.</li>
                <li><strong>Select Theme:</strong> Writes to <code>user_profiles.theme</code>.</li>
                <li>Role and office assignment are <strong>read-only</strong> — managed by admins.</li>
                <li>Birthday is display-only (Month Day, no year).</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Directory-first rule:</strong> If your email matches a Staff Directory record, the Directory photo and display name take precedence over your user_profiles data. To change your displayed photo, update the Directory record — not just the Profile Settings photo.
              </div>
              <p><strong>Common mistake:</strong> Uploading a photo to Profile Settings when a Directory record exists — the Directory photo will override it.</p>
            </div>
          )
        },
        {
          id: "otp-trusted",
          title: "OTP / Trusted Browser",
          keywords: ["otp","trusted browser","trusted device","6 digit","sms","email verification","two factor","2fa","phone verification","twilio","login verification","browser trust","incognito","clear cookies","resend","expire"],
          searchableText: "OTP trusted browser trusted device 6 digit SMS email verification two factor 2FA phone verification Twilio login verification browser trust incognito clear cookies resend expire",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/otp-challenge</code> &nbsp;|&nbsp; <strong>Type:</strong> Security / Action-based — Write-capable (trusted device write on verify)</p>
              <p><strong>Data source:</strong> Supabase (OTP verification via otpAuthService), Twilio (SMS delivery via edge function)</p>
              <p>Two-step login verification — 6-digit OTP entry with trusted browser option.</p>
              <ul>
                <li><strong>Verify Code:</strong> Calls verifyLoginOtp — writes trusted device record if "Trust this browser" is checked.</li>
                <li><strong>Resend Code:</strong> Calls sendLoginOtp — 60-second cooldown between resends.</li>
                <li>Code length = 6 digits. Paste support available.</li>
                <li>SMS OTP requires a verified phone number in Profile Settings.</li>
              </ul>
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>⚠️ Trusted browser is browser/device specific:</strong> Clearing browser data, using incognito/private mode, or switching browsers removes trusted status and requires OTP again.
              </div>
              <p><strong>What "Code expired" means:</strong> OTP window passed — request new code via Resend button.</p>
            </div>
          )
        },
        {
          id: "office-selector-account",
          title: "Office Selector",
          content: (
            <div>
              <p><strong>Type:</strong> Global filter &nbsp;|&nbsp; <strong>Data source:</strong> Supabase <code>offices</code> table via OfficeContext</p>
              <ul>
                <li>Options: All Offices, Barnegat, Brick, Eatontown, Staten Island.</li>
                <li>Office Managers and Staff are locked to their assigned office (<code>canSwitchOffice: false</code>).</li>
                <li>Regional Managers and Admins can switch freely.</li>
                <li>Some pages have their own internal office selector that overrides the global one.</li>
              </ul>
              <p><strong>Check first:</strong> If data looks wrong, always check the office selector first.</p>
            </div>
          )
        },
        {
          id: "date-filters-account",
          title: "Date Filters",
          content: (
            <div>
              <p><strong>Type:</strong> Global filter &nbsp;|&nbsp; <strong>Data source:</strong> None (filter only)</p>
              <ul>
                <li>Quick presets: This Month, Last Month, This Quarter, YTD, Custom Date Range.</li>
                <li>YTD = January 1 to today.</li>
                <li>Custom range: start must be on or before end date.</li>
                <li>Not all pages use GlobalFilterBar — some have their own date controls.</li>
              </ul>
              <p><strong>Check first:</strong> If numbers look wrong, always check the date filter — this is the second most common cause of unexpected results.</p>
            </div>
          )
        }
      ]
    },
    {
      id: "help-center-section",
      icon: HelpCircle,
      title: "Help Center",
      color: "#0d9488",
      subsections: [
        {
          id: "help-drawer",
          title: "Help Center Drawer",
          content: (
            <div>
              <p><strong>Type:</strong> Read-only / Static &nbsp;|&nbsp; <strong>Data source:</strong> Static/frontend-only (helpArticles.js — no backend)</p>
              <p>The Help Center drawer is accessible from two locations:</p>
              <ul>
                <li><strong>Bottom-right floating button:</strong> Teal circle with ? icon — always visible.</li>
                <li><strong>Top-right header icon:</strong> HelpCircle (?) icon in the top header bar.</li>
                <li>Both open the same right-side Help Center drawer.</li>
                <li>Click outside the drawer or press Escape to close it.</li>
              </ul>
              <p><strong>Search:</strong> Client-side filter — no backend. Search by tab name, task, or keyword. Common search terms: KPI, Reports, Directory, Manual Entry, OTP, EOD, RCM, Regional Manager, Source Not Recorded, Alert Thresholds, Dentrix, Supabase.</p>
              <p><strong>What "no results" means:</strong> Search term not in any article title, content, keywords, or tab name. Try a shorter or different keyword.</p>
            </div>
          )
        },
        {
          id: "full-manual-help",
          title: "Full User Manual",
          content: (
            <div>
              <p><strong>Route:</strong> <code>/help/manual</code> &nbsp;|&nbsp; <strong>Type:</strong> Read-only / Static</p>
              <ul>
                <li>Click <strong>View Full User Manual</strong> at the top of the Help Center drawer to navigate here.</li>
                <li>The manual opens <strong>inside the dashboard</strong> — sidebar and header remain visible. No new browser tab is opened.</li>
                <li>You can navigate directly to <code>/help/manual</code> by typing it in the browser address bar.</li>
                <li>Use the left-side Table of Contents to jump to any section.</li>
                <li>Use the search bar in the TOC to filter sections by keyword.</li>
                <li>Use the ← → navigation arrows at the bottom to move between sections.</li>
              </ul>
            </div>
          )
        }
      ]
    },
    {
      id: "reference",
      icon: Database,
      title: "Reference",
      color: "#6366f1",
      subsections: [
        {
          id: "data-source-table",
          title: "Data Source Table",
          content: (
            <div>
              <p>Quick reference: which pages use which data source.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Page</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Primary Source</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Secondary Source</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Executive Overview", "Dentrix/FastAPI", "Supabase (goals, daily_entries)"],
                    ["KPIs", "Dentrix/FastAPI", "Supabase (goals)"],
                    ["Operations", "Dentrix/FastAPI", "Supabase"],
                    ["Office Performance", "Dentrix/FastAPI", "Supabase (goals), Expense service"],
                    ["Provider Performance", "Dentrix/FastAPI", "Supabase (providers, offices)"],
                    ["Monthly Analytics — Executive Summary tab", "Dentrix/FastAPI + reconciled AR", "—"],
                    ["Monthly Analytics — Legacy tabs", "Supabase (monthly_executive_analytics)", "—"],
                    ["Regional Manager (Supply Queue)", "Supabase (supply_request_batches)", "—"],
                    ["Payroll — Dentrix tab", "Dentrix/FastAPI", "—"],
                    ["Payroll — Gusto tab", "Gusto via Supabase import tables", "—"],
                    ["Financial Analytics", "Dentrix/FastAPI", "Supabase (goals, service_categories)"],
                    ["Expenses", "Supabase (expenses)", "AmEx CSV import, Gusto"],
                    ["RCM", "Dentrix/FastAPI", "Supabase"],
                    ["Transaction Audit", "Supabase (daily_entries)", "Dentrix/FastAPI"],
                    ["Audit Dashboard", "Supabase (audit_logs)", "—"],
                    ["Audit Reports", "Supabase (audit_logs)", "localStorage (configs)"],
                    ["Compliance & Retention", "Supabase (audit_logs counts)", "localStorage (rules, history)"],
                    ["Access Heatmap", "Supabase (audit_logs)", "—"],
                    ["Alert Rules", "Supabase (alert_rules, audit_logs)", "—"],
                    ["Error Logs", "Supabase (error_logs)", "—"],
                    ["Morning Huddle", "Supabase (huddles)", "Dentrix/FastAPI (yesterday actuals)"],
                    ["EOD Report", "Supabase (daily_entries)", "Dentrix/FastAPI (closeout tabs)"],
                    ["EOD Approval Queue", "Supabase (daily_entries, eod_status_history)", "—"],
                    ["Workflow Approvals Queue", "Supabase (huddles/daily_entries)", "—"],
                    ["Team Assignments", "Supabase (action_items)", "—"],
                    ["Reports", "Dentrix/FastAPI", "Supabase (goals), Expense service"],
                    ["Inventory Dashboard", "Supabase (bone_tissue_stock, implant_inventory, supply tables)", "—"],
                    ["Staff Directory", "Supabase (staff_directory, Storage)", "—"],
                    ["Users Management", "Supabase (user_profiles, user_office_assignments)", "—"],
                    ["Manage Providers", "Supabase (providers, offices)", "—"],
                    ["Management & Settings", "Supabase (multiple tables)", "—"],
                    ["Sync Dashboard", "Dentrix/FastAPI (/v2/admin/sync-dashboard)", "Supabase (sync_logs, conflicts)"],
                    ["Data Health", "Dentrix/FastAPI", "Supabase (sync_logs, conflicts, audit_logs)"],
                    ["Import Audit", "Dentrix/FastAPI (dentrixIngestionService)", "Supabase"],
                    ["Manual Production Entry", "Supabase (manual_production_entries)", "—"],
                    ["System Dashboard", "Dentrix/FastAPI", "Supabase (notifications)"],
                    ["Dentrix Reconciliation", "Dentrix/FastAPI", "Supabase; hardcoded eAssist benchmark"],
                    ["Metric Alert Thresholds", "Supabase (threshold configs)", "Hardcoded mock values (breach simulation)"],
                    ["Profile Settings", "Supabase (user_profiles, Storage)", "Supabase (staff_directory)"],
                    ["OTP Challenge", "Supabase (otpAuthService)", "Twilio (SMS)"],
                    ["Help Center / Help Manual", "Static/frontend-only", "—"],
                  ]?.map(([page, primary, secondary], i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{page}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#0891b2" }}>{primary}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#64748b" }}>{secondary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: "write-actions-table",
          title: "Write-Capable Actions Table",
          content: (
            <div>
              <p>Pages and buttons that actually write data to Supabase or trigger API operations.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Page</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Write Actions</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Executive Overview", "Schedule Auto Email", "Email schedule config"],
                    ["Monthly Analytics (Legacy)", "CSV Import, Manual Data Entry", "Supabase monthly_executive_analytics"],
                    ["Regional Manager (Supply Queue)", "Approve/Reject supply requests", "Supabase supply_request_batches"],
                    ["Expenses", "AmEx Import, Manual Entry, Add Payment, Admin Tools", "Supabase expenses, amex_payments"],
                    ["Alert Rules", "Create/Edit/Delete/Enable/Disable rules", "Supabase alert_rules"],
                    ["Error Logs", "Mark as Resolved", "Supabase error_logs"],
                    ["Morning Huddle", "Submit Huddle, Unlock, Convert to Task", "Supabase huddles, action_items"],
                    ["EOD Report", "Submit, Auto-save, Bulk Import", "Supabase daily_entries"],
                    ["EOD Approval Queue", "Approve, Reject, Edit, Reverse", "Supabase daily_entries, eod_status_history; email via edge function"],
                    ["Workflow Approvals Queue", "Approve, Reject", "Supabase"],
                    ["Team Assignments", "Create/Edit/Delete/Update Status tasks", "Supabase action_items"],
                    ["Inventory Dashboard", "Scan In, Scan Out, Submit Supply Request", "Supabase bone_tissue_stock, implant_inventory, supply_request_batches"],
                    ["Staff Directory", "Add/Edit/Delete staff, Upload photo", "Supabase staff_directory, Storage"],
                    ["Users Management", "Invite, Edit, Deactivate, Role Editor", "Supabase user_profiles, role_permissions"],
                    ["Manage Providers", "Add/Edit/Deactivate, CSV Import", "Supabase providers"],
                    ["Management & Settings", "All CRUD across all sections", "Supabase (multiple tables)"],
                    ["Sync Dashboard", "Resolve Conflict", "Supabase sync_conflicts"],
                    ["Data Health", "Backfill, Reconciliation, Resolve Conflict", "Dentrix/FastAPI API calls; Supabase"],
                    ["Import Audit", "Run Full/Office/Endpoint Import, Retry", "Dentrix/FastAPI API calls"],
                    ["Manual Production Entry", "Save/Delete Entry, Apply to Analytics", "Supabase manual_production_entries"],
                    ["Metric Alert Thresholds", "Create/Edit/Delete thresholds", "Supabase (threshold configs)"],
                    ["Profile Settings", "Save profile, Upload photo, Verify phone", "Supabase user_profiles, Storage"],
                    ["OTP Challenge", "Verify code, Trust browser", "Supabase (trusted device record)"],
                  ]?.map(([page, actions, target], i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{page}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#dc2626" }}>{actions}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#64748b" }}>{target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: "readonly-pages-table",
          title: "Read-Only / Diagnostic Pages",
          content: (
            <div>
              <p>These pages display data only — no write actions (or only file downloads / UI-only actions).</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Page</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Executive Overview", "Read-only/reporting (Schedule Auto Email is only write)"],
                    ["KPIs", "Read-only/reporting"],
                    ["Operations", "Read-only/reporting"],
                    ["Office Performance", "Read-only/reporting (Export = file download only)"],
                    ["Provider Performance", "Read-only/reporting"],
                    ["Monthly Analytics — Executive Summary tab", "Read-only/reporting"],
                    ["RCM", "Read-only/reporting"],
                    ["Transaction Audit", "Read-only/diagnostic"],
                    ["Audit Dashboard", "Read-only/diagnostic"],
                    ["Access Heatmap", "Read-only/diagnostic"],
                    ["Reports", "Read-only/reporting (Export = file download only)"],
                    ["System Dashboard", "Read-only/diagnostic (alert dismiss = UI only)"],
                    ["Dentrix Reconciliation", "Read-only/diagnostic"],
                    ["Help Center", "Read-only/static"],
                    ["Help Manual", "Read-only/static"],
                  ]?.map(([page, type], i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{page}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#059669" }}>{type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: "status-label-glossary",
          title: "Status Label Glossary",
          keywords: ["status label","glossary","source not recorded","dentrix api synced","human submission","endpoint missing","active prototype","unattributed","pass","warning","fail","pending re-approval","not monitored","stale","awaiting first run","not instrumented","manual only","degraded","offline","needs review","compliant","redacted","draft","pending","approved","rejected"],
          searchableText: "Status Label Glossary source not recorded Dentrix API Synced Human Submission ENDPOINT_MISSING active prototype unattributed PASS WARNING FAIL pending re-approval not monitored stale awaiting first run not instrumented manual only degraded offline needs review compliant redacted draft pending approved rejected",
          content: (
            <div>
              <p>What common status labels, badges, and values mean across the dashboard.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Label / Value</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Where seen</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>What it means</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["—", "KPI cards, tables", "Value not returned by API or null from backend — NOT zero"],
                    ["N/A", "Percentage fields", "Denominator was null — percentage cannot be calculated"],
                    ["Loading spinner", "Any page", "API call in progress — wait for it to complete"],
                    ["Source Not Recorded", "Transaction Audit", "submitted_by field is null — normal for API-synced rows, NOT bad data"],
                    ["Dentrix API Synced (purple)", "EOD Approval Queue, Transaction Audit", "Row came from the automated Dentrix pipeline"],
                    ["Human Submission", "EOD Approval Queue, Transaction Audit", "Row was manually entered by a staff member"],
                    ["Verified by Dentrix Ascend", "KPI cards", "Data sourced directly from Dentrix/FastAPI pipeline"],
                    ["PASS", "Dentrix Reconciliation", "Value within tolerance ($1.00 or 5%)"],
                    ["WARNING", "Dentrix Reconciliation", "Outside tolerance but endpoint available — investigate"],
                    ["FAIL", "Dentrix Reconciliation", "Significant discrepancy — investigate"],
                    ["ENDPOINT_MISSING", "Dentrix Reconciliation", "No API endpoint exists for this metric — NOT a sync failure"],
                    ["Active (prototype/local)", "Metric Alert Thresholds", "Feature in development — not connected to live monitoring"],
                    ["Not Monitored", "Alert Rules", "Rule type cannot trigger — event source not in audit_logs"],
                    ["Awaiting First Run", "Sync Dashboard", "Endpoint has never synced"],
                    ["Not Instrumented", "Sync Dashboard", "Run logging not wired for this endpoint — not an error"],
                    ["Stale", "Sync Dashboard, Data Health", "Data not synced recently — may need attention"],
                    ["Pending", "EOD Report, Huddle", "Submitted, awaiting admin approval"],
                    ["Draft", "EOD Report, Huddle", "Auto-saved but not yet submitted"],
                    ["Pending Re-Approval", "EOD Approval Queue", "Previously approved, then reversed"],
                    ["Inactive", "Users, Providers", "Deactivated — cannot log in / excluded from active lists"],
                    ["[REDACTED]", "Audit Dashboard", "Sensitive field hidden from current role"],
                    ["Compliant", "Compliance & Retention", "Retention period meets or exceeds minimum standard"],
                    ["Needs Review", "Compliance & Retention", "Retention period does not meet compliance standard minimum"],
                    ["Overdue (red SLA)", "Workflow Approvals Queue", "SLA exceeded — address immediately"],
                    ["Unattributed", "Provider Performance", "Production not mapped to a specific provider — real data, not an error"],
                  ]?.map(([label, where, meaning], i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{label}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#64748b" }}>{where}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: "troubleshooting",
          title: "Troubleshooting: Numbers Look Wrong",
          keywords: ["numbers look wrong","wrong numbers","incorrect","mismatch","discrepancy","data off","low","missing data","troubleshoot","why different","numbers wrong","data wrong","incorrect numbers","data issue","numbers incorrect"],
          searchableText: "Numbers Look Wrong wrong numbers incorrect mismatch discrepancy data off low missing data troubleshoot why different numbers wrong data wrong incorrect numbers data issue numbers incorrect",
          content: (
            <div>
              <p>When numbers look incorrect, work through this checklist in order:</p>
              <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
                <li><strong>Check the office selector</strong> — is the correct office selected? This is the most common cause.</li>
                <li><strong>Check the date filter</strong> — is the correct period selected? YTD vs This Month vs custom range?</li>
                <li><strong>Check Pending Approvals</strong> — if above 0, some EOD entries are not yet approved and not counted in KPIs.</li>
                <li><strong>Check the Sync Dashboard</strong> — verify data is current and the last import was successful. Look for Error or Stale status badges.</li>
                <li><strong>Refresh the page</strong> — some data is cached; a refresh may load updated values.</li>
                <li><strong>Check Data Health</strong> — look for missing records or data gaps for the specific office and date range.</li>
                <li><strong>Check Import Audit</strong> — verify the last import completed without errors.</li>
                <li><strong>For Financial Analytics specifically</strong> — did you click "Apply Filters" after changing filters? Charts do not update until applied.</li>
                <li><strong>For Monthly Analytics</strong> — are you on the Executive Summary tab (live Dentrix) or a Legacy tab (manual/historical data)?</li>
                <li><strong>For Provider Performance</strong> — are "Unattributed" rows included? These are real production not mapped to a specific provider.</li>
              </ol>
              <p>If still incorrect after all of the above, contact your admin or Yabezy with: the specific metric, date range, office, and what value you expected vs what you see.</p>
              <div style={{ backgroundColor: "#e0f2fe", border: "1px solid #0891b2", borderRadius: 6, padding: "10px 14px", margin: "10px 0" }}>
                <strong>ℹ️ Role/Access Note:</strong> If a page or tab is missing, your user role may not include access. Contact Dr. G or Ny to request the correct permissions. Admin-only pages (Users, Management, Audit, Payroll, Admin System, Data Health, Import Audit, Manual Entry, System, Reconciliation, Alert Thresholds) are hidden from standard users.
              </div>
            </div>
          )
        }
      ]
    }
  ];

  const [activeSection, setActiveSection] = useState(SECTIONS?.[0]?.id);
  const [activeSubsection, setActiveSubsection] = useState(SECTIONS?.[0]?.subsections?.[0]?.id);
  const [expandedSections, setExpandedSections] = useState(() => {
    const init = {};
    SECTIONS?.forEach(s => { init[s.id] = true; });
    return init;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef(null);

  const currentSection = SECTIONS?.find(s => s?.id === activeSection);
  const currentSubsection = currentSection?.subsections?.find(sub => sub?.id === activeSubsection);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev?.[sectionId] }));
  };

  const handleNavClick = (sectionId, subsectionId) => {
    setActiveSection(sectionId);
    setActiveSubsection(subsectionId);
    if (contentRef?.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const filteredSections = searchQuery?.trim()
    ? SECTIONS?.map(section => ({
        ...section,
        subsections: section?.subsections?.filter(sub => {
          const q = searchQuery?.toLowerCase();
          const inTitle = sub?.title?.toLowerCase()?.includes(q);
          const inSectionTitle = section?.title?.toLowerCase()?.includes(q);
          const inKeywords = sub?.keywords?.some(k => k?.toLowerCase()?.includes(q));
          const inSearchableText = sub?.searchableText?.toLowerCase()?.includes(q);
          return inTitle || inSectionTitle || inKeywords || inSearchableText;
        })
      }))?.filter(s => s?.subsections?.length > 0)
    : SECTIONS;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden", backgroundColor: "#f8fafc" }}>
      {/* Left TOC sidebar */}
      <div
        style={{
          width: 260,
          minWidth: 220,
          backgroundColor: "#fff",
          borderRight: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Manual header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#0d9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>User Manual</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>NU Dental Dashboard — V747</div>
            </div>
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={e => setSearchQuery(e?.target?.value)}
              style={{
                width: "100%",
                padding: "6px 8px 6px 26px",
                fontSize: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                outline: "none",
                backgroundColor: "#f8fafc",
                color: "#334155",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* TOC nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {filteredSections?.map(section => {
            const SectionIcon = section?.icon;
            const isExpanded = expandedSections?.[section?.id] !== false;
            return (
              <div key={section?.id}>
                <button
                  onClick={() => toggleSection(section?.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <SectionIcon size={13} color={section?.color} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {section?.title}
                  </span>
                  {isExpanded ? <ChevronDown size={11} color="#94a3b8" /> : <ChevronRight size={11} color="#94a3b8" />}
                </button>
                {isExpanded && section?.subsections?.map(sub => {
                  const isActive = activeSection === section?.id && activeSubsection === sub?.id;
                  return (
                    <button
                      key={sub?.id}
                      onClick={() => handleNavClick(section?.id, sub?.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 14px 5px 32px",
                        background: isActive ? "#f0fdfa" : "none",
                        border: "none",
                        borderLeft: isActive ? `2px solid ${section?.color}` : "2px solid transparent",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 12, color: isActive ? section?.color : "#64748b", fontWeight: isActive ? 600 : 400, lineHeight: 1.4 }}>
                        {sub?.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content area */}
      <div ref={contentRef} style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12, color: "#94a3b8" }}>
          <BookOpen size={12} />
          <span>User Manual</span>
          <ChevronRight size={10} />
          <span style={{ color: currentSection?.color }}>{currentSection?.title}</span>
          <ChevronRight size={10} />
          <span style={{ color: "#374151", fontWeight: 500 }}>{currentSubsection?.title}</span>
        </div>

        {/* Section badge */}
        {currentSection && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, backgroundColor: `${currentSection?.color}15`, border: `1px solid ${currentSection?.color}30` }}>
              {React.createElement(currentSection?.icon, { size: 12, color: currentSection?.color })}
              <span style={{ fontSize: 11, fontWeight: 600, color: currentSection?.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {currentSection?.title}
              </span>
            </div>
          </div>
        )}

        {/* Article title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 16, lineHeight: 1.3 }}>
          {currentSubsection?.title}
        </h1>

        {/* Article content */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            padding: "24px 28px",
            fontSize: 14,
            color: "#374151",
            lineHeight: 1.75,
            maxWidth: 820,
          }}
        >
          <style>{`
            .manual-content p { margin: 0 0 12px 0; }
            .manual-content ul { margin: 8px 0 12px 0; padding-left: 20px; }
            .manual-content ol { margin: 8px 0 12px 0; padding-left: 20px; }
            .manual-content li { margin-bottom: 6px; }
            .manual-content strong { color: #0f172a; font-weight: 600; }
            .manual-content code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 12px; color: #0891b2; }
            .manual-content table { width: 100%; border-collapse: collapse; }
            .manual-content th, .manual-content td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
          `}</style>
          <div className="manual-content">
            {currentSubsection?.content}
          </div>
        </div>

        {/* Navigation arrows */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, maxWidth: 820 }}>
          {(() => {
            const allItems = SECTIONS?.flatMap(s => s?.subsections?.map(sub => ({ sectionId: s?.id, subsectionId: sub?.id, title: sub?.title, sectionTitle: s?.title })));
            const currentIdx = allItems?.findIndex(i => i?.sectionId === activeSection && i?.subsectionId === activeSubsection);
            const prev = currentIdx > 0 ? allItems?.[currentIdx - 1] : null;
            const next = currentIdx < allItems?.length - 1 ? allItems?.[currentIdx + 1] : null;
            return (
              <>
                {prev ? (
                  <button
                    onClick={() => handleNavClick(prev?.sectionId, prev?.subsectionId)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" }}
                  >
                    ← <span>{prev?.title}</span>
                  </button>
                ) : <div />}
                {next ? (
                  <button
                    onClick={() => handleNavClick(next?.sectionId, next?.subsectionId)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" }}
                  >
                    <span>{next?.title}</span> →
                  </button>
                ) : <div />}
              </>
            );
          })()}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 40, maxWidth: 820, padding: "14px 18px", borderRadius: 8, backgroundColor: "#f0fdfa", border: "1px solid #99f6e4", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={14} color="#0d9488" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#0f766e", lineHeight: 1.6 }}>
            This is the internal Nu Dental Dashboard user manual (V747 — based on V746 functional usage audit). For technical issues or data pipeline questions, contact Yabezy. For access, role, or goal changes, contact Dr. G or Ny.
          </p>
        </div>
      </div>
    </div>
  );
}
