import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const lowStockEmailHtml = (items: Array<{ product_name: string; identification_number: string; office_name: string; current_stock: number }>) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Low Stock Alert — Nu Dental Inventory</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a3a5c 0%, #2563eb 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 36px 40px; }
    .alert-badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .body h2 { color: #1a3a5c; font-size: 20px; margin: 0 0 12px; }
    .body p { color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #f3f4f6; color: #374151; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; font-size: 14px; color: #374151; border-bottom: 1px solid #f3f4f6; }
    .stock-badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 12px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>NU Dental</h1>
      <p>Inventory Management System</p>
    </div>
    <div class="body">
      <span class="alert-badge">⚠️ Low Stock Alert</span>
      <h2>Bone &amp; Tissue Inventory — Low Stock Warning</h2>
      <p>The following items have reached a critically low stock level (2 units or fewer). Please restock as soon as possible to avoid disruptions.</p>
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th>ID / Serial</th>
            <th>Office</th>
            <th>In Stock</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.product_name}</td>
            <td style="font-family: monospace; font-size: 12px;">${item.identification_number || '—'}</td>
            <td>${item.office_name?.replace('Nu Dental of ', '') || '—'}</td>
            <td><span class="stock-badge">${item.current_stock}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size: 13px; color: #6b7280;">Please log in to the Nu Dental portal to restock these items.</p>
    </div>
    <div class="footer">
      <p>This is an automated alert from the NU Dental Practice Management System.&lt;br/&gt;Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

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
    const body = await req.json();
    const { recipient_email, recipient_name, items } = body;

    if (!recipient_email || !items || items.length === 0) {
      return new Response(JSON.stringify({ error: "recipient_email and items are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const subject = `Low Stock Alert — Nu Dental Inventory (${items.length} item${items.length > 1 ? 's' : ''})`;
    const html = lowStockEmailHtml(items);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [recipient_email],
        subject,
        html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ error: resendData?.message || "Failed to send email", details: resendData }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true, message_id: resendData?.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
