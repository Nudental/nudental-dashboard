import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: { env: { get: (key: string) => string | undefined } };

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const taskAssignmentTemplate = (data: {
  assigneeName: string;
  taskTitle: string;
  dueDate: string;
  priority: string;
  officeName: string;
  appUrl: string;
}) => {
  const priorityColor = data.priority === 'high' ? '#dc2626' : data.priority === 'medium' ? '#d97706' : '#16a34a';
  const priorityLabel = data.priority?.charAt(0)?.toUpperCase() + data.priority?.slice(1);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Task Assigned</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 36px 40px; }
    .body h2 { color: #1a3a5c; font-size: 20px; margin: 0 0 16px; }
    .body p { color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px; }
    .task-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }
    .task-title { color: #1e293b; font-size: 17px; font-weight: 700; margin: 0 0 12px; }
    .meta-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13px; color: #64748b; }
    .priority-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; color: white; background: ${priorityColor}; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 16px 0 24px; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>NU Dental</h1>
      <p>Practice Management Portal — Task Assignment</p>
    </div>
    <div class="body">
      <h2>Hi ${data.assigneeName},</h2>
      <p>A new task has been assigned to you in the NU Dental Practice Management System. Please review the details below and take action by the due date.</p>
      <div class="task-card">
        <div class="task-title">${data.taskTitle}</div>
        <div class="meta-row">📅 <strong>Due Date:</strong>&nbsp;${data.dueDate || 'No due date set'}</div>
        <div class="meta-row">🏢 <strong>Office:</strong>&nbsp;${data.officeName}</div>
        <div class="meta-row">⚡ <strong>Priority:</strong>&nbsp;<span class="priority-badge">${priorityLabel}</span></div>
      </div>
      <p>Log in to your dashboard to view the full task details, update the status, and collaborate with your team.</p>
      <a href="${data.appUrl}/team-assignments" class="cta-btn">View My Tasks</a>
    </div>
    <div class="footer">
      <p>This automated notification was sent by the NU Dental Practice Management System.&lt;br/&gt;Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
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
    const body = await req.json();
    const { assignee_email, assignee_name, task_title, due_date, priority, office_name, app_url } = body;

    if (!assignee_email || !task_title) {
      return new Response(
        JSON.stringify({ error: "assignee_email and task_title are required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const dueDateFormatted = due_date
      ? new Date(due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'No due date set';

    const html = taskAssignmentTemplate({
      assigneeName: assignee_name || 'Team Member',
      taskTitle: task_title,
      dueDate: dueDateFormatted,
      priority: priority || 'medium',
      officeName: office_name || 'NU Dental',
      appUrl: app_url || 'https://nudentalr1699.builtwithrocket.new',
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "alerts@nudashboard.com",
        to: [assignee_email],
        subject: `📋 New Task Assigned: ${task_title?.substring(0, 60)}${task_title?.length > 60 ? '...' : ''}`,
        html,
      }),
    });

    const resendData = await resendResponse.json();
    return new Response(
      JSON.stringify({ success: resendResponse.ok, message_id: resendData?.id, error: resendResponse.ok ? null : resendData?.message }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
