# Email/Password Authentication Setup

## ⚠️ IMPORTANT: Enable Email/Password Authentication in Supabase

**If you see the error "Email signups are disabled", you need to enable the Email provider in Supabase.**

### Step-by-Step Instructions:

1. **Go to Supabase Dashboard**
   - Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign in to your account

2. **Select Your Project**
   - Click on your project (e.g., `qwtwezxoodqfmdqpzkkl`)

3. **Navigate to Authentication Settings**
   - In the left sidebar, click on **Authentication**
   - Then click on **Providers** (or go directly to Authentication → Providers)

4. **Enable Email Provider**
   - Scroll down to find **Email** in the list of providers
   - Click on the **Email** card/button to open its settings
   - You should see a toggle switch or checkbox labeled **"Enable Email provider"**
   - **Turn it ON** (toggle should be green/enabled)

5. **Configure Email Settings (Optional but Recommended)**
   - **Enable email confirmations**: 
     - If **ON**: Users must verify their email before they can sign in (more secure)
     - If **OFF**: Users can sign in immediately after registration (easier for testing)
   - **Secure email change**: Optional security feature
   - **Double confirm email changes**: Optional security feature

6. **Save Changes**
   - Click the **Save** button at the bottom of the settings panel
   - Wait for confirmation that settings are saved

7. **Verify It's Enabled**
   - The Email provider should now show as **Enabled** or have a green checkmark
   - You should see "Email" in the list of active providers

### Email Templates (Optional)

You can customize email templates in **Authentication → Email Templates**:
- **Confirm signup**: Sent when user registers
- **Magic Link**: For passwordless login
- **Change Email Address**: When user changes email
- **Reset Password**: For password recovery

### Testing

After enabling email/password authentication:

1. **Refresh your application** (Ctrl+F5 or Cmd+Shift+R)
2. Click on **Register** tab
3. Fill in the form:
   - **Full Name**: Your name (e.g., "John Doe")
   - **Email**: A valid email address (e.g., "john@example.com")
   - **Password**: At least 6 characters
   - **Confirm Password**: Same as password
4. Click **Register**
5. **If email confirmation is enabled:**
   - Check your email inbox
   - Click the verification link in the email
   - Then sign in with your email and password
6. **If email confirmation is disabled:**
   - You should be automatically signed in after registration
   - If not, sign in manually with your email and password

### Troubleshooting

**Error: "Email signups are disabled"**
- ✅ Make sure you enabled the Email provider in Supabase Dashboard
- ✅ Check that you clicked "Save" after enabling
- ✅ Refresh the application page
- ✅ Check Supabase logs (Authentication → Logs) for more details

**Error: "User already registered"**
- The email is already in use
- Try signing in instead of registering
- Or use a different email address

**Error: "Invalid email"**
- Make sure the email format is correct (e.g., user@example.com)
- Check for typos

**User created but can't sign in**
- If email confirmation is enabled, check your email and verify the account
- Check Supabase logs for any errors

### Notes

- The trigger `on_auth_user_created` will automatically create a user in the `users` table when they register
- Users registered via email/password will have role `user` by default
- To make a user an admin, update their role in the `users` table in Supabase
- Password must be at least 6 characters long
- Email addresses must be unique

