import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const APP_URL = "https://nudentalr1699.builtwithrocket.new";

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const thStyle = `background:#1e293b; padding:10px 14px; text-align:left; font-weight:600; color:#e2e8f0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;`;
const thCenterStyle = `background:#1e293b; padding:10px 14px; text-align:center; font-weight:600; color:#e2e8f0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;`;
const tdStyle = `padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#334155; font-size:13px;`;
const tdAltStyle = `padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#334155; font-size:13px; background:#f8fafc;`;
const tdCenterStyle = `padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#334155; font-size:13px; text-align:center;`;
const tdCenterAltStyle = `padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#334155; font-size:13px; text-align:center; background:#f8fafc;`;

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

const calcGrowthPct = (current: number, previous: number): string => {
  if (previous === 0 && current === 0) return 'N/A';
  if (previous === 0 && current > 0) return '+100%';
  const pct = (((current - previous) / previous) * 100).toFixed(1);
  return `${parseFloat(pct) >= 0 ? '+' : ''}${pct}%`;
};

const growthColor = (pctStr: string): string => {
  if (pctStr === 'N/A') return '#94a3b8';
  return pctStr.startsWith('+') ? '#059669' : '#dc2626';
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if auto-email is enabled in management_settings
    const { data: scheduleSetting } = await supabase
      .from('management_settings')
      .select('setting_value')
      .eq('setting_key', 'monthly_executive_email_schedule')
      .maybeSingle();

    let scheduleConfig = { enabled: true, recipients: { ny: true, maia: true } };
    if (scheduleSetting?.setting_value) {
      try {
        const parsed = typeof scheduleSetting.setting_value === 'string'
          ? JSON.parse(scheduleSetting.setting_value)
          : scheduleSetting.setting_value;
        scheduleConfig = { ...scheduleConfig, ...parsed };
      } catch (_) {}
    }

    if (!scheduleConfig.enabled) {
      return new Response(JSON.stringify({ success: true, message: 'Auto-email is disabled' }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Determine report month (previous month)
    const now = new Date();
    const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const reportMonth = reportDate.getMonth() + 1;
    const reportYear = reportDate.getFullYear();
    const monthLabel = `${MONTH_NAMES[reportMonth - 1]} ${reportYear}`;
    const dateGenerated = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Fetch recipients
    const { data: allProfiles } = await supabase
      .from('user_profiles')
      .select('full_name, email, role')
      .in('role', ['regional_manager', 'regional_clinical_manager'])
      .not('email', 'is', null);

    const recipientList: { email: string; name: string }[] = [];
    (allProfiles || []).forEach((p) => {
      if (p.role === 'regional_manager' && scheduleConfig.recipients?.ny) {
        recipientList.push({ email: p.email, name: p.full_name || 'Regional Manager' });
      }
      if (p.role === 'regional_clinical_manager' && scheduleConfig.recipients?.maia) {
        recipientList.push({ email: p.email, name: p.full_name || 'Regional Clinical Manager' });
      }
    });

    if (recipientList.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients configured' }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch office data
    const { data: offices } = await supabase
      .from('offices')
      .select('id, name')
      .eq('is_active', true);

    const OFFICE_NAMES = ['Eatontown', 'Brick', 'Barnegat', 'Staten Island'];
    const officeIdMap: Record<string, string> = {};
    (offices || []).forEach((o) => {
      OFFICE_NAMES.forEach((name) => {
        if (o.name?.toLowerCase().includes(name.toLowerCase())) {
          officeIdMap[name] = o.id;
        }
      });
    });

    // Fetch current month data
    const monthStart = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(reportYear, reportMonth, 0).getDate();
    const monthEnd = `${reportYear}-${String(reportMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Fetch previous month data
    const prevDate = new Date(reportYear, reportMonth - 2, 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();
    const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;
    const prevMonthLabel = `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`;

    const [currRes, prevRes, providerRes] = await Promise.all([
      supabase.from('daily_entries')
        .select('office_id, production_amount, collection_amount, new_patients')
        .gte('entry_date', monthStart)
        .lte('entry_date', monthEnd),
      supabase.from('daily_entries')
        .select('office_id, production_amount, collection_amount, new_patients')
        .gte('entry_date', prevMonthStart)
        .lte('entry_date', prevMonthEnd),
      supabase.from('daily_entries')
        .select('provider_name, office_id, production_amount, collection_amount')
        .gte('entry_date', monthStart)
        .lte('entry_date', monthEnd)
        .not('provider_name', 'is', null),
    ]);

    const currData = currRes.data || [];
    const prevData = prevRes.data || [];
    const providerData = providerRes.data || [];

    // Aggregate by office
    const aggregate = (rows: typeof currData) => {
      const result: Record<string, { production: number; collection: number; new_patients: number }> = {};
      OFFICE_NAMES.forEach((n) => { result[n] = { production: 0, collection: 0, new_patients: 0 }; });
      rows.forEach((row) => {
        const name = Object.keys(officeIdMap).find((n) => officeIdMap[n] === row.office_id);
        if (name) {
          result[name].production += parseFloat(String(row.production_amount || 0));
          result[name].collection += parseFloat(String(row.collection_amount || 0));
          result[name].new_patients += parseInt(String(row.new_patients || 0), 10);
        }
      });
      return result;
    };

    const curr = aggregate(currData);
    const prev = aggregate(prevData);

    // Group totals
    const groupCurrProd = OFFICE_NAMES.reduce((s, n) => s + curr[n].production, 0);
    const groupCurrColl = OFFICE_NAMES.reduce((s, n) => s + curr[n].collection, 0);
    const groupCurrNP = OFFICE_NAMES.reduce((s, n) => s + curr[n].new_patients, 0);
    const groupCollRate = groupCurrProd > 0 ? ((groupCurrColl / groupCurrProd) * 100).toFixed(1) : '0.0';

    // Top providers
    const providerMap: Record<string, { provider_name: string; production: number; collection: number; office_id: string }> = {};
    providerData.forEach((row) => {
      const key = row.provider_name;
      if (!providerMap[key]) providerMap[key] = { provider_name: key, production: 0, collection: 0, office_id: row.office_id };
      providerMap[key].production += parseFloat(String(row.production_amount || 0));
      providerMap[key].collection += parseFloat(String(row.collection_amount || 0));
    });
    const topProviders = Object.values(providerMap)
      .sort((a, b) => b.production - a.production)
      .slice(0, 3);

    // Ranked offices
    const rankedOffices = OFFICE_NAMES
      .map((name) => ({
        name,
        currProd: curr[name].production,
        prevProd: prev[name].production,
        currColl: curr[name].collection,
        prevColl: prev[name].collection,
        currNP: curr[name].new_patients,
        prevNP: prev[name].new_patients,
        prodGrowth: calcGrowthPct(curr[name].production, prev[name].production),
        collGrowth: calcGrowthPct(curr[name].collection, prev[name].collection),
        npGrowth: calcGrowthPct(curr[name].new_patients, prev[name].new_patients),
        collRate: curr[name].production > 0
          ? ((curr[name].collection / curr[name].production) * 100).toFixed(1)
          : '0.0',
      }))
      .sort((a, b) => b.currProd - a.currProd);

    const topOffice = rankedOffices[0];
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];

    // Build HTML email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:20px; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:700px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#1e293b; padding:28px 32px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">NuDental</div>
        <div style="font-size:11px; color:#94a3b8; letter-spacing:2px; text-transform:uppercase; margin-top:2px;">Management Group</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px; font-weight:600; color:#e2e8f0;">Monthly Performance Summary</div>
        <div style="font-size:18px; font-weight:700; color:#6366f1; margin-top:2px;">${monthLabel}</div>
        <div style="font-size:10px; color:#64748b; margin-top:4px; text-transform:uppercase; letter-spacing:1px;">Confidential — Executive Use Only</div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">

    <!-- Group KPI Summary -->
    <h2 style="margin:0 0 12px; font-size:14px; font-weight:700; color:#1e293b; border-left:4px solid #6366f1; padding-left:10px;">📊 Group KPI Summary</h2>
    <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
      <thead><tr>
        <th style="${thCenterStyle}">Total Production</th>
        <th style="${thCenterStyle}">Total Collection</th>
        <th style="${thCenterStyle}">New Patients</th>
        <th style="${thCenterStyle}">Net Collection Rate</th>
      </tr></thead>
      <tbody><tr>
        <td style="${tdCenterStyle} font-size:18px; font-weight:700; color:#1e293b;">${fmtCurrency(groupCurrProd)}</td>
        <td style="${tdCenterStyle} font-size:18px; font-weight:700; color:#059669;">${fmtCurrency(groupCurrColl)}</td>
        <td style="${tdCenterStyle} font-size:18px; font-weight:700; color:#4f46e5;">${groupCurrNP}</td>
        <td style="${tdCenterStyle} font-size:18px; font-weight:700; color:#d97706;">${groupCollRate}%</td>
      </tr></tbody>
    </table>

    <!-- Office Breakdown -->
    <h2 style="margin:0 0 12px; font-size:14px; font-weight:700; color:#1e293b; border-left:4px solid #6366f1; padding-left:10px;">🏢 Office Breakdown</h2>
    <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
      <thead><tr>
        <th style="${thStyle}">Office</th>
        <th style="${thCenterStyle}">Production</th>
        <th style="${thCenterStyle}">Collection</th>
        <th style="${thCenterStyle}">New Patients</th>
        <th style="${thCenterStyle}">Coll. Rate</th>
      </tr></thead>
      <tbody>
        ${rankedOffices.map((o, i) => `<tr>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-weight:600;">${o.name}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle}">${fmtCurrency(o.currProd)}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle}">${fmtCurrency(o.currColl)}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle}">${o.currNP}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle}">${o.collRate}%</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <!-- Growth Analysis -->
    <h2 style="margin:0 0 12px; font-size:14px; font-weight:700; color:#1e293b; border-left:4px solid #6366f1; padding-left:10px;">📈 Growth Analysis — ${prevMonthLabel} vs ${monthLabel}</h2>

    ${topOffice ? `
    <div style="background:#fef9c3; border:1px solid #fbbf24; border-radius:8px; padding:14px 18px; margin-bottom:16px; text-align:center;">
      <span style="font-size:14px; font-weight:700; color:#92400e;">🏆 Top Performing Office: ${topOffice.name}</span>
      <span style="font-size:13px; color:#92400e; margin-left:12px;">Production Growth: <strong style="color:${growthColor(topOffice.prodGrowth)}">${topOffice.prodGrowth}</strong></span>
    </div>` : ''}

    <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
      <thead><tr>
        <th style="${thStyle}">Office</th>
        <th style="${thCenterStyle}">Prev Prod</th>
        <th style="${thCenterStyle}">Curr Prod</th>
        <th style="${thCenterStyle}">Prod Growth</th>
        <th style="${thCenterStyle}">Coll Growth</th>
        <th style="${thCenterStyle}">NP Growth</th>
      </tr></thead>
      <tbody>
        ${rankedOffices.map((o, i) => `<tr>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-weight:600;">${medals[i] || ''} ${o.name}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle} color:#64748b;">${fmtCurrency(o.prevProd)}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle} font-weight:600;">${fmtCurrency(o.currProd)}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle} font-weight:700; color:${growthColor(o.prodGrowth)};">${o.prodGrowth}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle} font-weight:700; color:${growthColor(o.collGrowth)};">${o.collGrowth}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle} font-weight:700; color:${growthColor(o.npGrowth)};">${o.npGrowth}</td>
        </tr>`).join('')}
        <tr style="background:#e0e7ff;">
          <td style="${tdStyle} font-weight:700; color:#4f46e5;">Group Total</td>
          <td style="${tdCenterStyle} color:#64748b;">${fmtCurrency(OFFICE_NAMES.reduce((s, n) => s + prev[n].production, 0))}</td>
          <td style="${tdCenterStyle} font-weight:700; color:#1e293b;">${fmtCurrency(groupCurrProd)}</td>
          <td style="${tdCenterStyle} font-weight:700; color:${growthColor(calcGrowthPct(groupCurrProd, OFFICE_NAMES.reduce((s, n) => s + prev[n].production, 0)))}">${calcGrowthPct(groupCurrProd, OFFICE_NAMES.reduce((s, n) => s + prev[n].production, 0))}</td>
          <td style="${tdCenterStyle} font-weight:700; color:${growthColor(calcGrowthPct(groupCurrColl, OFFICE_NAMES.reduce((s, n) => s + prev[n].collection, 0)))}">${calcGrowthPct(groupCurrColl, OFFICE_NAMES.reduce((s, n) => s + prev[n].collection, 0))}</td>
          <td style="${tdCenterStyle} font-weight:700; color:${growthColor(calcGrowthPct(groupCurrNP, OFFICE_NAMES.reduce((s, n) => s + prev[n].new_patients, 0)))}">${calcGrowthPct(groupCurrNP, OFFICE_NAMES.reduce((s, n) => s + prev[n].new_patients, 0))}</td>
        </tr>
      </tbody>
    </table>

    <!-- Top Producers -->
    <h2 style="margin:0 0 12px; font-size:14px; font-weight:700; color:#1e293b; border-left:4px solid #6366f1; padding-left:10px;">👨‍⚕️ Top 3 Producers</h2>
    ${topProviders.length > 0 ? `
    <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
      <thead><tr>
        <th style="${thStyle}">Rank</th>
        <th style="${thStyle}">Provider</th>
        <th style="${thCenterStyle}">Production</th>
        <th style="${thCenterStyle}">Collection</th>
      </tr></thead>
      <tbody>
        ${topProviders.map((p, i) => `<tr>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-size:16px;">${medals[i]}</td>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-weight:600;">${p.provider_name}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle} font-weight:700;">${fmtCurrency(p.production)}</td>
          <td style="${i % 2 === 0 ? tdCenterStyle : tdCenterAltStyle}">${fmtCurrency(p.collection)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : `<p style="color:#94a3b8; font-style:italic; font-size:13px; margin-bottom:28px;">No provider data available for this period.</p>`}

    <!-- CTA -->
    <div style="text-align:center; padding:20px 0;">
      <a href="${APP_URL}/executive-overview" style="display:inline-block; padding:14px 32px; background:#4f46e5; color:white; text-decoration:none; border-radius:8px; font-weight:700; font-size:15px;">📊 View Full Executive Dashboard</a>
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 32px; text-align:center;">
    <p style="margin:0; font-size:11px; color:#94a3b8;">NuDental Confidential Management Report — Generated ${dateGenerated}</p>
    <p style="margin:4px 0 0; font-size:11px; color:#94a3b8;">This report was automatically generated by the NuDental Executive Dashboard</p>
  </div>

</div>
</body>
</html>`;

    // Send to all recipients
    const sendResults = await Promise.all(
      recipientList.map(async ({ email, name }) => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NuDental Reports <reports@nudentalr1699.builtwithrocket.new>',
            to: [email],
            subject: `NuDental Monthly Performance Summary — ${monthLabel}`,
            html: emailHtml,
          }),
        });
        const data = await res.json();
        return { email, success: res.ok, data };
      })
    );

    const successCount = sendResults.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Monthly executive digest sent to ${successCount}/${recipientList.length} recipients`,
        month: monthLabel,
        results: sendResults,
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );

  } catch (err) {
    console.error('monthly-executive-digest error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
