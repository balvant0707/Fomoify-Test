// app/utils/sendOwnerEmail.server.js
import nodemailer from "nodemailer";

const host = String(process.env.SMTP_HOST || "").trim();
const user = String(process.env.SMTP_USER || "").trim();
const pass = String(process.env.SMTP_PASS || "").trim();
const port = Number(process.env.SMTP_PORT || 587);
const secureMode = (process.env.SMTP_SECURE || "").toLowerCase();
const smtpDebug = process.env.SMTP_DEBUG === "1";
const canUseSmtp = Boolean(host && user && pass);

let secure = false;
if (port === 465 || secureMode === "ssl") {
  secure = true;
}

const transporter = canUseSmtp
  ? nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
      logger: smtpDebug,
      debug: smtpDebug,
    })
  : null;

if (transporter) {
  transporter
    .verify()
    .then(() => {
      console.log(`[SMTP] Connected successfully -> SSL=${secure}, PORT=${port}`);
    })
    .catch((err) => {
      console.error("[SMTP] Connection failed:", {
        message: err?.message,
        code: err?.code,
      });
    });
} else {
  console.warn(
    "[SMTP] Skipping SMTP verify: missing SMTP_HOST/SMTP_USER/SMTP_PASS"
  );
}

export async function sendOwnerEmail({ to, subject, text, html }) {
  try {
    const finalTo = to || process.env.APP_OWNER_FALLBACK_EMAIL;
    if (!finalTo) {
      console.warn("[sendOwnerEmail] No recipient email configured");
      return;
    }

    if (!transporter) {
      console.warn("[sendOwnerEmail] SMTP is not configured; skipping send");
      return;
    }

    const fromAddress =
      process.env.SMTP_FROM ||
      `"${process.env.SMTP_FROM_NAME || "Fomoify Sales Popup & Proof"}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: finalTo,
      subject,
      text,
      html,
    });

    console.log("[sendOwnerEmail] Email sent:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    return info;
  } catch (err) {
    console.error("[sendOwnerEmail] Failed to send email:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
    });
    throw err;
  }
}
