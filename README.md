# Toil Tracker

Web application for tracking overtime and time off for employees.

## 🏗️ Architecture

- **Frontend**: HTML + CSS + JavaScript (Vanilla)
- **Hosting**: GitHub Pages
- **Backend**: Supabase (PostgreSQL + Auth)
- **Database**: PostgreSQL (Supabase)

## 📋 Features

### For Employees:
- ✅ View current time off balance
- ✅ Add overtime and time off entries
- ✅ View personal history
- ✅ Edit own name
- ✅ Export personal data to CSV

### For Administrators:
- ✅ View all employees and their balances
- ✅ View all entries
- ✅ Delete entries
- ✅ Delete users
- ✅ Export monthly report to CSV

## 🚀 Quick Start

### Step 1: Setup Supabase

1. Create a project on [Supabase](https://supabase.com)
2. Go to **SQL Editor**
3. Execute SQL from `supabase-schema.sql` file
4. Configure Google OAuth in **Authentication → Providers → Google**

### Step 2: Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 Client ID
3. Add **Authorized redirect URIs**:
   - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - `https://YOUR_USERNAME.github.io`
4. Copy Client ID and Client Secret to Supabase

### Step 3: Configure Frontend

1. Open `app.js` file
2. Replace values in `CONFIG` object:
   ```javascript
   const CONFIG = {
     SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
     SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',
     GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID'
   };
   ```

### Step 4: Deploy to GitHub Pages

1. Commit all files to repository:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push
   ```

2. In repository settings:
   - Go to **Settings → Pages**
   - **Source**: select branch (usually `main`)
   - **Folder**: `/ (root)`
   - Save

3. After a few minutes, the site will be available at:
   `https://YOUR_USERNAME.github.io`

## 📁 Project Structure

```
.
├── index.html          # Main HTML file
├── styles.css          # Styles
├── app.js             # Frontend logic
├── supabase-schema.sql # Database schema
└── README.md          # Documentation
```

## 🔐 Security

- Authentication via Google OAuth (Supabase)
- Row Level Security (RLS) policies in PostgreSQL
- Users can only edit their own data
- Admins have extended access rights

## 📊 Data Structure

### users table
| id | name | email | role | created_at |
|----|------|-------|------|------------|
| 1 | Ivan Petrov | ivan@company.com | user | 2025-01-10 |

### logs table
| id | user_email | date | type | fact_hours | credited_hours | comment | created_at |
|----|-----------|------|------|------------|----------------|---------|-------------|
| 1 | ivan@... | 2025-01-10 | overtime | 4 | 6 | Project X | 2025-01-10 |

**Accrual formula:**
- Overtime: `credited_hours = fact_hours × 1.5`
- Time off: `credited_hours = -fact_hours`

### settings table
| key | value |
|-----|-------|
| overtimeMultiplier | 1.5 |

## 🧪 Local Development

For local development, you can use a simple HTTP server:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 📝 License

MIT License

## 👨‍💻 Author

Created for tracking overtime and time off for employees.
