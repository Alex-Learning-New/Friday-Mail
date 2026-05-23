# 📨 Friday Dispatch — GitHub Actions + GitHub Pages

Sends your data table as a styled HTML email to Gmail **every Friday at 2:00 AM UTC**,
automatically, with no server and no open tab. Powered by GitHub Actions + Gmail API.

---

## 🗂 Files

```
friday-dispatch/
├── index.html                         # Dashboard UI (hosted on GitHub Pages)
├── data.json                          # Table data (edited via UI, committed to repo)
├── scripts/
│   └── send-report.js                 # Node script that sends the email
├── .github/
│   └── workflows/
│       └── send-report.yml            # Cron: every Friday 02:00 UTC
└── package.json
```

---

## 🚀 Setup (5 Steps)

### 1 — Google Cloud: Enable Gmail API

1. [console.cloud.google.com](https://console.cloud.google.com) → New project
2. Enable **Gmail API**
3. **Credentials → Create → OAuth 2.0 Client ID** (Web application)
4. Add Authorized redirect URI: `https://developers.google.com/oauthplayground`
5. Save your **Client ID** and **Client Secret**

### 2 — Get a Refresh Token

1. Open [OAuth Playground](https://developers.google.com/oauthplayground)
2. Click ⚙ → **Use your own OAuth credentials** → paste Client ID + Secret
3. Scope: `https://www.googleapis.com/auth/gmail.send` → Authorize APIs
4. Step 2 → **Exchange authorization code for tokens**
5. Copy the **Refresh token**

### 3 — Push to GitHub

```bash
git init
git add .
git commit -m "init friday dispatch"
git remote add origin https://github.com/YOUR_USERNAME/friday-dispatch.git
git push -u origin main
```

### 4 — Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `GMAIL_CLIENT_ID` | From step 1 |
| `GMAIL_CLIENT_SECRET` | From step 1 |
| `GMAIL_REFRESH_TOKEN` | From step 2 |
| `GMAIL_SENDER` | Your Gmail address (must match OAuth account) |
| `REPORT_RECIPIENT` | Where to send the report |
| `REPORT_SUBJECT` | Email subject (optional) |

### 5 — Enable GitHub Pages

Repo → **Settings → Pages → Source: Deploy from branch → Branch: main, / (root)** → Save

Your dashboard is now live at `https://YOUR_USERNAME.github.io/friday-dispatch`

---

## ✏️ Updating the Table

1. Open your GitHub Pages URL
2. Edit the table
3. Enter your **GitHub Token** (Settings → Developer settings → Personal access tokens → `repo` scope)
   and your **repo** (`username/friday-dispatch`)
4. Click **Save to GitHub** — this commits `data.json` directly to your repo
5. Next Friday at 2:00 AM UTC, the action picks up the new data and sends the email

---

## ⚡ Test It Now

Click **Run Workflow Now** in the dashboard, or go to:
**GitHub → Actions → Friday Report Sender → Run workflow**

---

## 🔧 Change the Schedule

Edit `.github/workflows/send-report.yml`:
```yaml
- cron: "0 2 * * 5"   # min hour day month weekday
# "0 9 * * 1"          → Every Monday 9 AM UTC
# "0 8 * * 1-5"        → Weekdays 8 AM UTC
```

Friday 02:00 UTC = **Friday 07:30 AM IST**
