# ⚡ Cyber Mail — Outlook Mail Fetcher

A powerful local-first Outlook mail manager and OTP fetcher. No database required — all data is stored locally on disk.

![Cyber Mail](https://img.shields.io/badge/Cyber%20Mail-Local%20Mode-3b82f6?style=for-the-badge&logo=microsoft-outlook)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)

---

## ✨ Features

- 📥 **Batch Import** — Import Outlook accounts with `email|password|refresh_token|client_id`
- 📧 **Mail Fetcher** — Fetch emails via Microsoft Graph API
- 🔑 **OTP Detection** — Automatically detects and highlights OTP codes
- ✅ **Activation Tracking** — Mark accounts as activated (for ChatGPT Plus, etc.)
- 📤 **Export** — Export activated accounts as `email|password` (copy or download TXT)
- 🔐 **Persistent Sessions** — Stay logged in across server restarts
- 💾 **Local Storage** — All data saved to `.local-data/accounts.json` (no database needed)

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/cys-solom/Cyber-Mail.git
cd Cyber-Mail
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# Generate a random 64-char hex key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_char_hex_key_here

# Set your admin password
ADMIN_PASSWORD=YourSecurePassword123
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with your `ADMIN_PASSWORD`.

---

## 📋 Import Format

Accounts are imported in pipe-separated format, **one per line**:

```
email@hotmail.com|password|refresh_token|client_id
email2@outlook.com|password2|M.C531_SN1...|9e5f94bc-e8a4-4e73-b8be-63364c29d753
```

Both `|` and `----` separators are supported. Field order:  
`email | password | refresh_token | client_id`

---

## 📂 Data Storage

All account data is persisted to `.local-data/accounts.json` (excluded from git).  
This file is created automatically on first import.

| File | Purpose |
|------|---------|
| `.local-data/accounts.json` | Encrypted account credentials |
| `.env` | App configuration (never committed) |

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | ✅ | 64-char hex key for encrypting passwords |
| `ADMIN_PASSWORD` | ✅ | Login password for the dashboard |
| `APP_MODE` | ✅ | Set to `local` (no database needed) |
| `NEXT_PUBLIC_APP_NAME` | ❌ | App display name (default: Cyber Mail) |

> **Note:** Supabase variables are optional and only needed for future database migration.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Vanilla CSS (Premium Dark Theme)
- **Icons:** Lucide React
- **Auth:** HMAC-SHA256 stateless sessions (survive restarts)
- **Storage:** Local file system (`.local-data/`)
- **Mail API:** Microsoft Graph API (OAuth2 refresh token)

---

## 📝 License

MIT — Use freely, no attribution required.
