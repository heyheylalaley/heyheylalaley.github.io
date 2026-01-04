# Toil Tracker

Web application for tracking overtime and time off for employees.

## 🏗️ Architecture

- **Frontend**: HTML + CSS + JavaScript (Vanilla)
- **Hosting**: GitHub Pages
- **Backend**: Supabase (PostgreSQL + Auth)
- **Database**: PostgreSQL (Supabase)

## 📋 Features

### For Employees:
- ✅ View current time off balance with detailed statistics
- ✅ Quick add overtime buttons (1h, 2h, 3h, custom)
- ✅ Add overtime and time off entries with comments
- ✅ View personal history with search and filters
- ✅ Filter entries by date (All, Today, This Week, This Month)
- ✅ Sort entries (Newest First / Oldest First)
- ✅ Edit own entries (date, hours, comment)
- ✅ Delete own entries within 5 minutes of creation
- ✅ Edit own name
- ✅ View statistics chart for last 30 days
- ✅ Dark/Light theme support

### For Administrators:
- ✅ All employee features
- ✅ View all employees and their balances
- ✅ View all entries in table format
- ✅ Search entries by name, email, or comments
- ✅ Filter and sort all entries
- ✅ Approve time off entries
- ✅ Edit any entry (date, hours, comment)
- ✅ Delete any entry
- ✅ Delete users
- ✅ Edit user names
- ✅ Change user roles (assign administrator role)
- ✅ Acknowledge edited entries after approval
- ✅ View change history for entries
- ✅ See edited entries indicators (⚠️ badge)
- ✅ See acknowledged entries status (✓ Acknowledged badge)

## 🚀 Quick Start

### Step 1: Setup Supabase

1. Create a project on [Supabase](https://supabase.com)
2. Go to **SQL Editor**
3. Execute SQL from `supabase-schema.sql` file
4. If you're upgrading an existing database, also run `add_acknowledged_by_column.sql` to add the `acknowledged_by` column
5. Configure Google OAuth in **Authentication → Providers → Google**
6. Enable Email/Password authentication in **Authentication → Providers → Email** (optional)

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
├── index.html                    # Main HTML file
├── styles.css                    # Styles (includes dark theme)
├── app.js                       # Frontend logic
├── supabase-schema.sql          # Database schema with RLS policies
├── add_acknowledged_by_column.sql # Migration script for acknowledged_by
└── README.md                    # Documentation
```

## 🔐 Security

- **Authentication**: Google OAuth + Email/Password (Supabase)
- **Row Level Security (RLS)**: Enforced at database level
- **User permissions**:
  - Can only view/edit/delete their own entries
  - Can delete own entries only within 5 minutes of creation
  - Can edit own name only
- **Admin permissions**:
  - Full access to all entries and users
  - Can approve time off entries
  - Can acknowledge edited entries after approval
  - Can configure system settings (overtime multiplier)
  - Can edit user names
  - Can assign/remove administrator role for other users
- **Data integrity**:
  - Change history tracking for audit trail
  - Edited entries marked with warning indicators
  - Acknowledgment system for post-approval changes

## 📊 Data Structure

### users table
| id | name | email | role | created_at |
|----|------|-------|------|------------|
| 1 | Ivan Petrov | ivan@company.com | user | 2025-01-10 |

### logs table
| id | user_email | date | type | fact_hours | credited_hours | comment | approved_by | edited_at | change_history | acknowledged_by | created_at |
|----|-----------|------|------|------------|----------------|---------|-------------|-----------|----------------|-----------------|------------|
| 1 | ivan@... | 2025-01-10 | overtime | 4 | 6 | Project X | - | - | [] | - | 2025-01-10 |
| 2 | ivan@... | 2025-01-11 | timeoff | 8 | -8 | Vacation | Admin Name | 2025-01-12 | [{...}] | Admin Name | 2025-01-11 |

**Fields:**
- `approved_by`: Admin who approved the time off entry (only for timeoff type)
- `edited_at`: Timestamp when entry was edited after creation
- `change_history`: JSON array tracking all changes (who, when, what changed)
- `acknowledged_by`: Admin who acknowledged changes made after approval

**Accrual formula:**
- Overtime: `credited_hours = fact_hours × multiplier` (default: 1.5x)
- Time off: `credited_hours = -fact_hours`

**Entry lifecycle:**
1. User creates entry → `created_at` set
2. Admin approves (timeoff only) → `approved_by` set
3. User edits entry → `edited_at` set, `change_history` updated
4. Admin acknowledges changes → `acknowledged_by` set
5. If edited again after acknowledgment → `acknowledged_by` reset (requires new acknowledgment)

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

## 🚨 Production Considerations

### Current Setup (GitHub Pages)
- ✅ **Suitable for**: Small teams (up to 50 users), low traffic
- ⚠️ **Limitations**: 
  - No SLA guarantee
  - 100 GB/month bandwidth limit
  - 10 builds/hour limit
  - Not intended for commercial use per GitHub ToS

### Netlify (Recommended Alternative)

#### Free Plan:
- ✅ **100 GB/month** bandwidth (same as GitHub Pages)
- ✅ **Unlimited sites** (vs GitHub Pages: 1 per repo)
- ✅ **125,000 serverless function invocations/month**
- ✅ **Automatic SSL certificates**
- ✅ **Global CDN** (faster than GitHub Pages)
- ✅ **Commercial use allowed** (unlike GitHub Pages)
- ✅ **Better support** (community + docs)
- ⚠️ **No SLA** on free plan (but better uptime than GitHub Pages)
- ⚠️ **Build time**: 300 minutes/month

#### Pro Plan ($19/month):
- ✅ **1 TB/month** bandwidth
- ✅ **SLA: 99.99% uptime** guarantee
- ✅ **Priority support**
- ✅ **1,000 build minutes/month**
- ✅ **Advanced analytics**
- ✅ **Team collaboration features**

#### Business Plan ($99/month):
- ✅ **1.5 TB/month** bandwidth
- ✅ **SLA: 99.99% uptime** guarantee
- ✅ **24/7 priority support**
- ✅ **5,000 build minutes/month**
- ✅ **Advanced security features**
- ✅ **Role-based access control**

### Comparison: GitHub Pages vs Netlify

| Feature | GitHub Pages | Netlify Free | Netlify Pro |
|---------|-------------|--------------|-------------|
| Bandwidth | 100 GB/month | 100 GB/month | 1 TB/month |
| SLA | ❌ None | ❌ None | ✅ 99.99% |
| Commercial Use | ⚠️ Not allowed | ✅ Allowed | ✅ Allowed |
| Builds | 10/hour | 300 min/month | 1,000 min/month |
| Support | Community only | Community + Docs | Priority |
| CDN Speed | Good | Excellent | Excellent |
| SSL | ✅ Free | ✅ Free | ✅ Free |

### Recommendation for 40 Users:

**Short-term (Current)**: GitHub Pages is fine for testing
**Production**: 
- **Netlify Free** - Good for start (commercial use allowed)
- **Netlify Pro** - Recommended for reliability ($19/month = $0.48/user/month)

**Note**: Your backend (Supabase) handles the main load. Frontend hosting is just for static files.

## 📝 License

MIT License

## 👨‍💻 Author

Created for tracking overtime and time off for employees.
