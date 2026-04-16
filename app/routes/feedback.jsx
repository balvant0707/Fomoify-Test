// app/routes/feedback.jsx
// Public page — no Shopify auth required.
// Merchants land here from the uninstall feedback email link.
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import prisma from "../db.server";

const AUTO_UNINSTALL_FEEDBACK_TEXT = "[AUTO] App uninstalled. Feedback form not yet submitted.";

const REASONS = [
  "Missing features I need",
  "Too expensive / not enough value",
  "Too hard to set up or use",
  "Found a better alternative",
  "My store doesn't need this anymore",
  "Just testing — not using it yet",
  "Other",
];

// ── loader ────────────────────────────────────────────────────────────────────
export async function loader({ request }) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();

  if (!token) {
    return json({ status: "invalid" });
  }

  const record = await prisma.uninstallfeedback
    .findUnique({ where: { feedbackToken: token } })
    .catch(() => null);

  if (!record) return json({ status: "invalid" });
  const hasRealFeedback =
    Boolean(record.feedbackSubmittedAt) &&
    String(record.feedbackText || "").trim() !== AUTO_UNINSTALL_FEEDBACK_TEXT;
  if (hasRealFeedback) return json({ status: "done", shop: record.shop });

  return json({ status: "open", token, shop: record.shop, ownerName: record.ownerName });
}

// ── action ────────────────────────────────────────────────────────────────────
export async function action({ request }) {
  const form = await request.formData();
  const token = String(form.get("token") || "").trim();
  const feedbackText = String(form.get("feedbackText") || "").trim().slice(0, 3000);
  const reason = String(form.get("reason") || "").trim();

  if (!token) return json({ ok: false, error: "Missing token" });

  const record = await prisma.uninstallfeedback
    .findUnique({ where: { feedbackToken: token } })
    .catch(() => null);

  if (!record) return json({ ok: false, error: "Invalid token" });
  const hasRealFeedback =
    Boolean(record.feedbackSubmittedAt) &&
    String(record.feedbackText || "").trim() !== AUTO_UNINSTALL_FEEDBACK_TEXT;
  if (hasRealFeedback) return json({ ok: true, alreadyDone: true });

  const combined = [reason, feedbackText].filter(Boolean).join("\n\n");

  await prisma.uninstallfeedback.update({
    where: { feedbackToken: token },
    data: {
      feedbackText: combined || null,
      feedbackSubmittedAt: new Date(),
    },
  });

  return json({ ok: true });
}

// ── view helpers ──────────────────────────────────────────────────────────────
function Page({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Fomoify — Feedback</title>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
               background:#f3f4f6;min-height:100vh;display:grid;place-items:center;padding:24px}
          .card{background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.10);
                max-width:520px;width:100%;overflow:hidden}
          .hdr{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 28px 24px;color:#fff}
          .hdr h1{font-size:20px;font-weight:700;margin-bottom:6px}
          .hdr p{font-size:14px;opacity:.85}
          .body{padding:28px}
          label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
          select,textarea{width:100%;border:1.5px solid #e5e7eb;border-radius:8px;
                          padding:10px 12px;font-size:14px;font-family:inherit;
                          outline:none;transition:border-color .15s;color:#111}
          select:focus,textarea:focus{border-color:#6366f1}
          textarea{resize:vertical;min-height:100px}
          .gap{margin-bottom:16px}
          .btn{width:100%;padding:13px;background:#6366f1;color:#fff;border:none;
               border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;
               transition:background .15s;margin-top:4px}
          .btn:hover{background:#4f46e5}
          .muted{font-size:13px;color:#6b7280;margin-top:10px;text-align:center}
          .icon{font-size:48px;margin-bottom:14px}
          .center{text-align:center}
          h2{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
          .sub{font-size:14px;color:#6b7280;line-height:1.6}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

// ── component ─────────────────────────────────────────────────────────────────
export default function FeedbackPage() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const submitted = fetcher.data?.ok && !fetcher.data?.alreadyDone;

  if (data.status === "invalid") {
    return (
      <Page>
        <div className="card">
          <div className="hdr"><h1>Fomoify — Feedback</h1></div>
          <div className="body center">
            <div className="icon">🔗</div>
            <h2>Invalid or expired link</h2>
            <p className="sub">This feedback link is no longer valid.</p>
          </div>
        </div>
      </Page>
    );
  }

  if (data.status === "done" || submitted || fetcher.data?.alreadyDone) {
    return (
      <Page>
        <div className="card">
          <div className="hdr"><h1>Thank you!</h1><p>Your feedback has been received.</p></div>
          <div className="body center">
            <div className="icon">🙏</div>
            <h2>We appreciate your honesty</h2>
            <p className="sub">
              Your feedback helps us improve Fomoify for everyone.
              {data.shop ? ` We hope to see ${data.shop} back someday!` : ""}
            </p>
          </div>
        </div>
      </Page>
    );
  }

  const displayName = data.ownerName ? `, ${data.ownerName.split(" ")[0]}` : "";

  return (
    <Page>
      <div className="card">
        <div className="hdr">
          <h1>We&rsquo;re sorry to see you go{displayName}!</h1>
          <p>Help us improve by sharing why you uninstalled Fomoify.</p>
        </div>
        <div className="body">
          <fetcher.Form method="post">
            <input type="hidden" name="token" value={data.token} />

            <div className="gap">
              <label htmlFor="reason">Main reason for uninstalling</label>
              <select id="reason" name="reason" defaultValue="">
                <option value="" disabled>Select a reason…</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="gap">
              <label htmlFor="feedbackText">Anything else you&rsquo;d like to share? (optional)</label>
              <textarea
                id="feedbackText"
                name="feedbackText"
                placeholder="Tell us what we could have done better…"
              />
            </div>

            <button type="submit" className="btn" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? "Submitting…" : "Submit Feedback"}
            </button>
            <p className="muted">Takes less than a minute &mdash; we read every response.</p>
          </fetcher.Form>
        </div>
      </div>
    </Page>
  );
}
