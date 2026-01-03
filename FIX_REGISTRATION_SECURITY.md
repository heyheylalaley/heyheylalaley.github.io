# Fix Registration Security Issues

## Problem

Users could register multiple accounts with the same email, and there was no proper validation to prevent duplicate registrations.

## Solution

### 1. Update the Trigger Function in Supabase

The trigger function needs to be updated to ensure:
- Email uniqueness is enforced
- Role is always 'user' (never 'admin') for new registrations
- Duplicate registrations are prevented

**Execute this SQL in Supabase SQL Editor:**

```sql
-- Update the function to ensure role is always 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, name, role)
  VALUES (
    LOWER(TRIM(NEW.email)), -- Normalize email: lowercase and trim spaces
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    'user' -- Always 'user', never 'admin' for security
  )
  ON CONFLICT (email) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', users.name),
    role = 'user'; -- Ensure role is always 'user', never allow admin role through registration
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Verify Email Uniqueness Constraint

Make sure the `users` table has a unique constraint on email:

```sql
-- Check if unique constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'users' AND constraint_type = 'UNIQUE';

-- If not exists, add it:
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
```

### 3. What Was Fixed in the Code

1. **Pre-registration check**: Before registering, the app now checks if the email already exists in the `users` table
2. **Better error handling**: Improved handling of "user already exists" errors from Supabase
3. **Role enforcement**: Added a check to ensure newly registered users always have role 'user', never 'admin'
4. **Email normalization**: Email is normalized (lowercase, trimmed) before checking and registering

### 4. Security Improvements

✅ **Email uniqueness**: Cannot register with the same email twice
✅ **Role protection**: New registrations always get 'user' role, never 'admin'
✅ **Duplicate prevention**: Multiple checks prevent duplicate accounts
✅ **Normalized emails**: Emails are normalized to prevent case-sensitivity issues

### 5. Testing

After applying the fix:

1. Try to register with an email that already exists
   - Should show: "This email is already registered. Please sign in instead."

2. Register a new user
   - Should create user with role 'user' (not 'admin')
   - Should not allow duplicate registration

3. Check in Supabase Dashboard
   - Go to **Table Editor → users**
   - Verify that all new users have role 'user'
   - Verify that emails are unique

### 6. Making a User Admin

To make a user an admin, you must manually update their role in Supabase:

```sql
-- Make a user admin (only do this manually, never through registration)
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

**Important**: Only trusted administrators should have admin access. Never allow users to register as admin.

