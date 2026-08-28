const DEFAULT_RECIPIENT = "nan02020@qq.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers:{ "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" } });
}

function clean(value, maxLength) { return String(value ?? "").trim().slice(0, maxLength); }
function escapeHtml(value) { return clean(value, 4000).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok:false, error:"Invalid JSON" }, 400); }

  const feedback = {
    name:clean(body.name, 80), email:clean(body.email, 160), module:clean(body.module, 100), category:clean(body.category, 80),
    message:clean(body.message, 3000), page:clean(body.page, 500), language:clean(body.language, 10), submittedAt:new Date().toISOString()
  };
  if (!feedback.message) return json({ ok:false, error:"Message is required" }, 400);

  const subject = `[EUPV2026] ${feedback.category || "Feedback"} · ${feedback.module || "Portal"}`;
  const plainText = [`Name: ${feedback.name || "-"}`, `Reply email: ${feedback.email || "-"}`, `Module: ${feedback.module || "-"}`, `Category: ${feedback.category || "-"}`, `Language: ${feedback.language || "-"}`, `Page: ${feedback.page || "-"}`, `Submitted: ${feedback.submittedAt}`, "", feedback.message].join("\n");

  if (env.FEEDBACK_WEBHOOK_URL) {
    const response = await fetch(env.FEEDBACK_WEBHOOK_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ text:plainText }) });
    if (!response.ok) return json({ ok:false, error:"Webhook delivery failed" }, 502);
    return json({ ok:true, channel:"webhook" });
  }

  if (env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{ Authorization:`Bearer ${env.RESEND_API_KEY}`, "Content-Type":"application/json" },
      body:JSON.stringify({
        from:env.FEEDBACK_FROM_EMAIL || "EUPV2026 Feedback <onboarding@resend.dev>",
        to:[env.FEEDBACK_TO_EMAIL || DEFAULT_RECIPIENT],
        reply_to:feedback.email || undefined,
        subject,
        text:plainText,
        html:`<h2>${escapeHtml(subject)}</h2><table style="border-collapse:collapse"><tr><td><b>Name</b></td><td>${escapeHtml(feedback.name || "-")}</td></tr><tr><td><b>Reply email</b></td><td>${escapeHtml(feedback.email || "-")}</td></tr><tr><td><b>Module</b></td><td>${escapeHtml(feedback.module || "-")}</td></tr><tr><td><b>Category</b></td><td>${escapeHtml(feedback.category || "-")}</td></tr><tr><td><b>Page</b></td><td>${escapeHtml(feedback.page || "-")}</td></tr></table><h3>Message</h3><p style="white-space:pre-wrap">${escapeHtml(feedback.message)}</p>`
      })
    });
    if (!response.ok) return json({ ok:false, error:"Email delivery failed" }, 502);
    return json({ ok:true, channel:"email" });
  }

  return json({ ok:false, error:"Feedback delivery is not configured" }, 503);
}

export function onRequest() { return json({ ok:false, error:"Method not allowed" }, 405); }
