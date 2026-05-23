// scripts/send-report.js
// Runs inside GitHub Actions every Friday at 02:00 UTC
// Reads table data from data.json, sends a styled HTML email via Gmail API

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// ─── Load table data ──────────────────────────────────────────────
const dataPath = path.join(__dirname, "..", "data.json");
if (!fs.existsSync(dataPath)) {
  console.error("❌ data.json not found");
  process.exit(1);
}

let tableData;
try {
  tableData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!tableData.headers || !tableData.rows) throw new Error("Invalid shape");
} catch (e) {
  console.error("❌ Failed to parse data.json:", e.message);
  process.exit(1);
}

// ─── Validate env vars ────────────────────────────────────────────
const required = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER",
  "REPORT_RECIPIENT",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing secret: ${key}`);
    process.exit(1);
  }
}

const subject =
  process.env.REPORT_SUBJECT || "📊 Weekly Report — Friday Dispatch";
const sender    = process.env.GMAIL_SENDER;
const recipient = process.env.REPORT_RECIPIENT;

// ─── Build HTML email ─────────────────────────────────────────────
function buildHTML() {
  const now = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const headerCells = tableData.headers
    .map(
      (h) =>
        `<th style="background:#1e1e2e;color:#9b8bff;padding:10px 14px;
          text-align:left;font-size:12px;letter-spacing:0.1em;
          text-transform:uppercase;border-bottom:2px solid #3a3a5c;">${h}</th>`
    )
    .join("");

  const bodyRows = tableData.rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 0 ? "#111118" : "#16161f"}">` +
        row
          .map(
            (cell) =>
              `<td style="padding:9px 14px;color:#d0d0e0;font-size:13px;
                border-bottom:1px solid #2a2a3a;">${cell}</td>`
          )
          .join("") +
        `</tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0f;font-family:'Courier New',monospace;">
  <div style="max-width:700px;margin:40px auto;background:#111118;
    border:1px solid #2a2a3a;border-radius:12px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#1a1040,#1a1828);
      padding:32px;border-bottom:1px solid #2a2a3a;">
      <div style="font-size:10px;letter-spacing:0.25em;color:#7c6aff;
        text-transform:uppercase;margin-bottom:8px;">Automated Weekly Report</div>
      <div style="font-family:sans-serif;font-size:28px;font-weight:800;
        color:#e8e8f0;">${subject}</div>
      <div style="font-size:12px;color:#6b6b80;margin-top:6px;">${now}</div>
    </div>

    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #2a2a3a;
      font-size:11px;color:#6b6b80;">
      Sent automatically every Friday at 2:00 AM UTC · Friday Dispatch via GitHub Actions
    </div>
  </div>
</body></html>`;
}

// ─── Encode for Gmail API ─────────────────────────────────────────
function makeRaw(to, from, subj, html) {
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");

  return Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Send ─────────────────────────────────────────────────────────
async function main() {
  console.log("📨 Friday Dispatch — sending report…");
  console.log(`   To:      ${recipient}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Rows:    ${tableData.rows.length}`);

  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: "v1", auth });

  const raw = makeRaw(recipient, sender, subject, buildHTML());

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  console.log(`✅ Email sent! Message ID: ${res.data.id}`);
}

main().catch((err) => {
  console.error("❌ Send failed:", err.message);
  process.exit(1);
});
