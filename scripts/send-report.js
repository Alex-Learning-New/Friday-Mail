// scripts/send-report.js
// Runs inside GitHub Actions every Friday at 02:00 UTC
// Reads table data from data.json, generates an Excel (.xlsx) file,
// and sends it as an email attachment via Gmail API

const { google } = require("googleapis");
const ExcelJS    = require("exceljs");
const fs         = require("fs");
const path       = require("path");
const os         = require("os");

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

const subject   = process.env.REPORT_SUBJECT || "📊 Weekly Report — Friday Dispatch";
const sender    = process.env.GMAIL_SENDER;
const recipient = process.env.REPORT_RECIPIENT;

// ─── Build Excel file ─────────────────────────────────────────────
async function buildExcel() {
  const wb = new ExcelJS.Workbook();

  wb.creator  = "Friday Dispatch";
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Weekly Report", {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
  });

  // ── Title row ────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  ws.mergeCells(1, 1, 1, tableData.headers.length);
  const titleCell = ws.getCell("A1");
  titleCell.value = `${subject}  ·  ${dateStr}`;
  titleCell.font  = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1A1A2E" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E4FF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // ── Blank spacer row ─────────────────────────────────────────────
  ws.addRow([]);

  // ── Header row ───────────────────────────────────────────────────
  const headerRow = ws.addRow(tableData.headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font  = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B4ECC" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF3D31A8" } },
    };
  });

  // ── Data rows ─────────────────────────────────────────────────────
  tableData.rows.forEach((row, i) => {
    const dr = ws.addRow(row);
    dr.height = 19;
    const bg = i % 2 === 0 ? "FFFAFAFA" : "FFF0EEFF";
    dr.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF1A1A2E" } };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFD0C8FF" } },
      };
    });
  });

  // ── Auto column widths ────────────────────────────────────────────
  tableData.headers.forEach((h, i) => {
    const col    = ws.getColumn(i + 1);
    const maxLen = Math.max(
      h.length,
      ...tableData.rows.map((r) => String(r[i] ?? "").length)
    );
    col.width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  // ── Footer row ────────────────────────────────────────────────────
  ws.addRow([]);
  ws.mergeCells(ws.rowCount + 1, 1, ws.rowCount + 1, tableData.headers.length);
  const footerRow = ws.addRow([
    `Sent automatically every Friday at 2:00 AM UTC · Friday Dispatch via GitHub Actions`
  ]);
  footerRow.getCell(1).font = {
    name: "Calibri", size: 9, italic: true, color: { argb: "FF888888" }
  };

  // ── Write to temp file ────────────────────────────────────────────
  const tmpPath = path.join(os.tmpdir(), `report-${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(tmpPath);
  console.log(`   Excel: ${tmpPath} (${fs.statSync(tmpPath).size} bytes)`);
  return tmpPath;
}

// ─── Build MIME multipart email with attachment ───────────────────
function buildMime(to, from, subj, xlsxPath) {
  const now = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const filename  = `weekly-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const xlsxB64   = fs.readFileSync(xlsxPath).toString("base64");

  // Plain-text body (fallback)
  const textBody = [
    `Weekly Report — ${now}`,
    ``,
    `Please find this week's report attached as an Excel file.`,
    ``,
    `Sent automatically every Friday at 2:00 AM UTC.`,
    `Friday Dispatch via GitHub Actions`,
  ].join("\r\n");

  // HTML body
  const htmlBody = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Calibri,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#5b4ecc,#7c6aff);padding:28px 32px;">
      <div style="font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:6px;">Automated Weekly Report</div>
      <div style="font-size:24px;font-weight:700;color:#fff;">${subj}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:4px;">${now}</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 20px;">
        Hi,<br><br>
        Please find this week's report attached as an <strong>Excel file (.xlsx)</strong>.
        It contains <strong>${tableData.rows.length} rows</strong> across
        <strong>${tableData.headers.length} columns</strong>.
      </p>
      <div style="background:#f0eeff;border:1px solid #d0c8ff;border-radius:8px;padding:14px 18px;display:inline-block;">
        <span style="font-size:22px;">📎</span>
        <span style="font-size:13px;color:#5b4ecc;font-weight:600;margin-left:8px;">${filename}</span>
      </div>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #eee;font-size:11px;color:#999;">
      Sent automatically every Friday at 2:00 AM UTC · Friday Dispatch via GitHub Actions
    </div>
  </div>
</body></html>`;

  // Build MIME
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="alt_${boundary}"`,
    ``,
    `--alt_${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    textBody,
    ``,
    `--alt_${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
    ``,
    `--alt_${boundary}--`,
    ``,
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    // Gmail API requires base64 in 76-char lines
    ...xlsxB64.match(/.{1,76}/g),
    ``,
    `--${boundary}--`,
  ];

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("📨 Friday Dispatch — generating Excel report…");
  console.log(`   To:      ${recipient}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Rows:    ${tableData.rows.length}`);

  // Build Excel
  const xlsxPath = await buildExcel();

  // Auth
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: "v1", auth });

  // Send
  const raw = buildMime(recipient, sender, subject, xlsxPath);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  // Cleanup temp file
  fs.unlinkSync(xlsxPath);

  console.log(`✅ Email with Excel attachment sent! Message ID: ${res.data.id}`);
}

main().catch((err) => {
  console.error("❌ Send failed:", err.message);
  process.exit(1);
});
