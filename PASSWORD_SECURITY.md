# Password Storage and Security

## Where Passwords Are Stored

### Supabase Auth System

**Passwords are stored in Supabase's built-in authentication system**, specifically in the `auth.users` table. This is a **separate, secure system** managed entirely by Supabase.

### Important Points:

1. **Passwords are NOT stored in our `users` table**
   - Our `users` table only contains: `id`, `name`, `email`, `role`, `created_at`
   - **No password fields** - passwords are never stored in our application database

2. **Passwords are hashed (not stored in plain text)**
   - Supabase uses industry-standard hashing algorithms (bcrypt)
   - Original passwords are **never stored** - only cryptographic hashes
   - Even if someone gains access to the database, they cannot see actual passwords

3. **Where to find password data in Supabase:**
   - Go to **Authentication → Users** in Supabase Dashboard
   - You'll see user emails and metadata
   - **You will NOT see passwords** - they are hashed and not displayed

## Security Features

### ✅ What Supabase Does Automatically:

- **Password Hashing**: All passwords are hashed using bcrypt before storage
- **Salt**: Each password gets a unique salt for additional security
- **Secure Storage**: Passwords are stored in a separate, protected `auth` schema
- **No Plain Text**: Passwords are never stored or transmitted in plain text

### ✅ What We Do:

- **No Password Storage**: Our application never stores passwords
- **Direct to Supabase**: Passwords go directly from the form to Supabase Auth API
- **No Logging**: We don't log passwords anywhere in our code
- **HTTPS Only**: All communication is encrypted (Supabase enforces HTTPS)

## Password Management

### Users Can:

- **Register**: Create account with email and password
- **Sign In**: Use email and password to authenticate
- **Reset Password**: Use "Forgot Password" feature (if enabled in Supabase)
- **Change Password**: Through Supabase Auth API (can be added to the app)

### Administrators Can:

- **View Users**: See user emails and names in the `users` table
- **Delete Users**: Remove users from the system
- **Change Roles**: Update user roles (user/admin)
- **CANNOT**: See passwords, reset passwords directly (must use Supabase Dashboard)

## Password Reset (Future Feature)

If you want to add password reset functionality:

1. Enable it in Supabase: **Authentication → Email Templates → Reset Password**
2. Users can request password reset via email
3. Reset link is sent to their email
4. They can set a new password through the link

## Database Structure

### Our `users` table (public schema):
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**No password field!**

### Supabase `auth.users` table (auth schema):
```sql
-- This is managed by Supabase, we don't create it
-- Contains:
-- - id (UUID)
-- - email
-- - encrypted_password (hashed)
-- - email_confirmed_at
-- - created_at
-- - etc.
```
**Password is hashed in `encrypted_password` field**

## Best Practices

1. ✅ **Never store passwords in your application code**
2. ✅ **Never log passwords**
3. ✅ **Use HTTPS only** (Supabase enforces this)
4. ✅ **Let Supabase handle password security** (they're experts)
5. ✅ **Use strong password requirements** (minimum 6 characters, can be increased)
6. ✅ **Enable email confirmation** for additional security

## Summary

- **Passwords are stored**: In Supabase's `auth.users` table
- **How**: Hashed using bcrypt (one-way encryption)
- **Who can see them**: Nobody - not even administrators
- **Our responsibility**: None - Supabase handles all password security
- **Our database**: Only stores email, name, role - no passwords

This is the **secure, industry-standard way** to handle passwords. You don't need to worry about password security - Supabase handles it all!

