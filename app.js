// Supabase Configuration
const CONFIG = {
  SUPABASE_URL: 'https://qwtwezxoodqfmdqpzkkl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_iW0DJWq84mfMA30kA_HDOg_Fx99JPKU',
  GOOGLE_CLIENT_ID: '821999196894-20d8semsbtdp3dcpu4qf2p1h0u4okb39.apps.googleusercontent.com'
};

// Initialize Supabase client
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true, // Save session in localStorage
      autoRefreshToken: true, // Automatically refresh token
      detectSessionInUrl: true // Automatically detect session in URL
    }
  });
}

// Global state
let currentUser = null;
let currentLogs = [];
let currentUsers = [];
let currentMultiplier = 1.5;
let deleteLogId = null; // For delete modal
let filteredLogs = []; // For search functionality
let currentDateFilter = 'all'; // Current date filter (all, today, week, month)
let sortOrder = 'desc'; // Sort order: 'desc' (newest first) or 'asc' (oldest first)

// Flags to prevent multiple calls
let isCheckingSession = false; // Session check flag
let isLoggingIn = false; // Login process flag
let sessionCheckTimeout = null; // Session check timeout

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeGoogleSignIn();
  initializeAuthTabs();
  setupEventListeners();
  setupAuthListener();
  
  // Debounce session check on page load
  // Prevent multiple checks on rapid refresh (F5 spam)
  if (sessionCheckTimeout) {
    clearTimeout(sessionCheckTimeout);
  }
  
  sessionCheckTimeout = setTimeout(() => {
    checkSupabaseSession();
  }, 100); // Small delay to prevent race conditions
});

// Prevent multiple session checks on page refresh
let lastSessionCheck = 0;
const SESSION_CHECK_COOLDOWN = 2000; // 2 seconds between checks

// Intercept page unload
window.addEventListener('beforeunload', () => {
  // Clear timeout on page unload
  if (sessionCheckTimeout) {
    clearTimeout(sessionCheckTimeout);
  }
  isCheckingSession = false;
  isLoggingIn = false;
});

// Function to find user with retry attempts
async function findUserByEmail(email, maxAttempts = 5, delay = 500) {
  if (!supabaseClient || !email) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  console.log('Searching for user with email:', normalizedEmail, '(normalized from:', email, ')');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // First try exact search
      let { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      // If not found, try case-insensitive search by getting all users
      if (!userData || userError) {
        console.log('Exact match not found, trying case-insensitive search...');
        const { data: allUsers, error: allError } = await supabaseClient
          .from('users')
          .select('*');
        
        if (allUsers && !allError) {
          console.log('All users in database:', allUsers.map(u => ({ email: u.email, id: u.id })));
          userData = allUsers.find(u => u.email && u.email.toLowerCase().trim() === normalizedEmail);
          if (userData) {
            console.log('User found in case-insensitive search:', userData);
            userError = null;
          }
        }
      }
      
      if (userData && !userError) {
        console.log('User found on attempt', attempt, ':', userData);
        return userData;
      }
      
      // If this is not the last attempt, wait before next one
      if (attempt < maxAttempts) {
        console.log(`User not found, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('User not found after', maxAttempts, 'attempts. Email searched:', normalizedEmail);
        if (userError) {
          console.error('Last error:', userError);
        }
      }
    } catch (error) {
      console.error('Error searching for user (attempt', attempt, '):', error);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return null;
}

// Setup authentication state change listener
function setupAuthListener() {
  if (!supabaseClient) return;
  
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session);
    
    if (event === 'SIGNED_IN' && session) {
      // User successfully signed in
      try {
        // Wait a bit for trigger to create user
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Normalize email for search
        const normalizedEmail = session.user.email.toLowerCase().trim();
        
        // Find user with retry attempts
        const userData = await findUserByEmail(normalizedEmail);
        
        if (userData) {
          currentUser = {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          };
          localStorage.setItem('user', JSON.stringify(currentUser));
          showMainApp();
          loadData();
          showToast('Login successful', 'success');
          
          // Remove hash from URL after successful login
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          console.error('User not found. Session email:', session.user.email, 'Normalized:', normalizedEmail);
          // Try to create user if not found
          const userName = session.user.user_metadata?.full_name || 
                          session.user.user_metadata?.name || 
                          normalizedEmail.split('@')[0];
          
          const { data: newUser, error: createError } = await supabaseClient
            .from('users')
            .insert({
              email: normalizedEmail,
              name: userName,
              role: 'user'
            })
            .select()
            .single();
          
          if (newUser && !createError) {
            currentUser = {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role
            };
            localStorage.setItem('user', JSON.stringify(currentUser));
            showMainApp();
            loadData();
            showToast('Login successful', 'success');
          } else {
            showToast('User not found in database. Contact administrator.', 'error', 'Login Error');
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data: ' + error.message, 'error');
      }
    } else if (event === 'SIGNED_OUT') {
      // User signed out
      currentUser = null;
      currentLogs = [];
      currentUsers = [];
      localStorage.removeItem('user');
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
    }
  });
}

// Check Supabase session
async function checkSupabaseSession() {
  // Prevent multiple simultaneous checks
  if (isCheckingSession) {
    console.log('Session check already in progress, skipping...');
    return;
  }
  
  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    // Try to restore from localStorage
    await restoreUserFromStorage();
    return;
  }
  
  isCheckingSession = true;
  
  try {
    // Check existing session (Supabase automatically restores from localStorage)
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && !error) {
      console.log('Session found, loading user data...');
      // Get user information from users table
      const userData = await findUserByEmail(session.user.email, 3, 200);
      
      if (userData) {
        currentUser = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        showMainApp();
        loadData();
        console.log('User restored from session:', currentUser.email);
      } else {
        console.warn('Session exists but user not found in database');
        // Try to restore from localStorage as fallback
        await restoreUserFromStorage();
      }
    } else {
      // No active session, try to restore from localStorage
      console.log('No active session, trying to restore from storage...');
      await restoreUserFromStorage();
    }
    
    // Handle OAuth callback (if hash in URL with token)
    // Supabase automatically processes token from hash when calling getSession()
    if (window.location.hash && window.location.hash.includes('access_token')) {
      // Wait a bit for Supabase to process token
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check session again after token processing
      const { data: { session: newSession }, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (newSession && !sessionError && !currentUser) {
        // Сессия установлена, но пользователь еще не загружен
        // Ждем немного, чтобы триггер успел создать пользователя
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Ищем пользователя с повторными попытками
        const userData = await findUserByEmail(newSession.user.email);
        
        if (userData) {
          currentUser = {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          };
          localStorage.setItem('user', JSON.stringify(currentUser));
          showMainApp();
          loadData();
          showToast('Login successful', 'success');
        } else {
          console.error('User not found. Session email:', newSession.user.email);
          showToast('User not found in database. Contact administrator.', 'error', 'Login Error');
        }
        
        // Remove hash from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (window.location.hash === '#' && !currentUser) {
      // If hash is empty (#), but session might be set after OAuth
      // Check session again
      await new Promise(resolve => setTimeout(resolve, 300));
      const { data: { session: finalSession }, error: finalError } = await supabaseClient.auth.getSession();
      
      if (finalSession && !finalError) {
        // Normalize email for search
        const normalizedEmail = finalSession.user.email.toLowerCase().trim();
        // Find user with retry attempts
        const userData = await findUserByEmail(normalizedEmail);
        
        if (userData) {
          currentUser = {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          };
          localStorage.setItem('user', JSON.stringify(currentUser));
          showMainApp();
          loadData();
          showToast('Login successful', 'success');
          
          // Remove hash from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.error('User not found. Session email:', finalSession.user.email);
        }
      }
    }
  } catch (error) {
    console.error('Session check error:', error);
    // Check saved session as fallback
    await restoreUserFromStorage();
  } finally {
    isCheckingSession = false;
  }
}

// Restore user from localStorage
async function restoreUserFromStorage() {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      const parsedUser = JSON.parse(savedUser);
      
      // Check if Supabase session is still valid
      if (supabaseClient) {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        // Normalize email for comparison
        const sessionEmail = session?.user?.email?.toLowerCase().trim();
        const parsedEmail = parsedUser.email?.toLowerCase().trim();
        
        if (session && !error && sessionEmail === parsedEmail) {
          // Session is valid, use saved user
          currentUser = parsedUser;
          showMainApp();
          loadData();
          console.log('User restored from localStorage:', currentUser.email);
          return true;
        } else {
          // Session expired, but try to refresh token
          try {
            const { data: { session: refreshedSession }, error: refreshError } = await supabaseClient.auth.refreshSession();
            const refreshedEmail = refreshedSession?.user?.email?.toLowerCase().trim();
            if (refreshedSession && !refreshError && refreshedEmail === parsedEmail) {
              currentUser = parsedUser;
              showMainApp();
              loadData();
              console.log('User restored after token refresh:', currentUser.email);
              return true;
            }
          } catch (refreshErr) {
            console.log('Could not refresh session:', refreshErr);
          }
        }
      }
      
      // If session is not valid, remove saved user
      localStorage.removeItem('user');
    } catch (e) {
      console.error('Error parsing saved user:', e);
      localStorage.removeItem('user');
    }
  }
  return false;
}

// Initialize authentication tabs
function initializeAuthTabs() {
  const loginTabBtn = document.getElementById('loginTabBtn');
  const registerTabBtn = document.getElementById('registerTabBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  if (loginTabBtn && registerTabBtn && loginForm && registerForm) {
    loginTabBtn.addEventListener('click', () => {
      loginTabBtn.classList.add('active');
      registerTabBtn.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    });
    
    registerTabBtn.addEventListener('click', () => {
      registerTabBtn.classList.add('active');
      loginTabBtn.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });
  }
}

// Initialize Google Sign-In via Supabase OAuth
function initializeGoogleSignIn() {
  const googleSignInButton = `
    <button class="google-signin-btn" style="
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background-color: #fff;
      border: 1px solid #dadce0;
      border-radius: 4px;
      color: #3c4043;
      cursor: pointer;
      font-family: 'Google Sans', arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      height: 40px;
      letter-spacing: 0.25px;
      padding: 0 12px;
      text-align: center;
      transition: background-color 0.218s, border-color 0.218s, box-shadow 0.218s;
      width: auto;
      min-width: 200px;
    ">
      <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
        <g fill="#000" fill-rule="evenodd">
          <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"/>
          <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.18-1.79 2.91l2.78 2.15c1.9-1.75 2.69-4.33 2.69-7.56z" fill="#4285F4"/>
          <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"/>
          <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.78-2.15c-.76.53-1.78.9-3.18.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"/>
        </g>
      </svg>
      Sign in with Google
    </button>
  `;
  
  // Button for login form
  const buttonContainer = document.getElementById('googleSignInButton');
  if (buttonContainer) {
    buttonContainer.innerHTML = googleSignInButton;
    buttonContainer.querySelector('.google-signin-btn').addEventListener('click', handleGoogleSignIn);
  }
  
  // Button for registration form
  const buttonContainerRegister = document.getElementById('googleSignInButtonRegister');
  if (buttonContainerRegister) {
    buttonContainerRegister.innerHTML = googleSignInButton;
    buttonContainerRegister.querySelector('.google-signin-btn').addEventListener('click', handleGoogleSignIn);
  }
}

// Handle authentication via Google OAuth (Supabase)
async function handleGoogleSignIn() {
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  showLoading();
  try {
    // Use Google OAuth via Supabase
    // Use explicit URL instead of window.location.origin to avoid parsing issues
    const redirectUrl = 'https://heyheylalaley.github.io';
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    
    if (error) throw error;
    
    // Redirect to Google OAuth
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    console.error('Authorization error:', error);
    showToast(error.message || 'Authorization error', 'error', 'Login Error');
    hideLoading();
  }
}

// Handle email/password registration
async function handleEmailRegister(e) {
  e.preventDefault();
  
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
  
  // Validation
  if (!name || name.length < 2) {
    showToast('Please enter a valid name (at least 2 characters)', 'warning');
    return;
  }
  
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address', 'warning');
    return;
  }
  
  if (password.length < 6) {
    showToast('Password must be at least 6 characters long', 'warning');
    return;
  }
  
  if (password !== passwordConfirm) {
    showToast('Passwords do not match', 'warning');
    return;
  }
  
  showLoading();
  try {
    // Check if user already exists in our database
    const normalizedEmail = email.toLowerCase().trim();
    const { data: existingUser, error: checkError } = await supabaseClient
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      // Log error but don't block registration - let Supabase handle it
      console.warn('Error checking existing user:', checkError);
    }
    
    if (existingUser) {
      showToast('This email is already registered. Please sign in instead.', 'warning', 'Email Already Exists');
      hideLoading();
      return;
    }
    
    // Check if user exists in Supabase Auth (even if not in our users table yet)
    // We'll let Supabase handle this, but add better error handling
    
    // Register user in Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
      password: password,
      options: {
        data: {
          name: name,
          full_name: name
        }
      }
    });
    
    if (authError) {
      // Handle specific Supabase errors
      const errorMsg = authError.message.toLowerCase();
      if (errorMsg.includes('already registered') || 
          errorMsg.includes('user already registered') ||
          errorMsg.includes('already exists') ||
          errorMsg.includes('user already exists')) {
        showToast('This email is already registered. Please sign in instead.', 'warning', 'Email Already Exists');
        hideLoading();
        return;
      }
      // Show more detailed error message
      console.error('Registration error:', authError);
      showToast(authError.message || 'Registration failed. Please try again.', 'error', 'Registration Error');
      hideLoading();
      return;
    }
    
    if (authData.user) {
      // User will be created in users table by trigger with role 'user' (never 'admin')
      // Wait a bit for trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find user in database
      const userData = await findUserByEmail(normalizedEmail);
      
      if (userData) {
        // Ensure user has 'user' role (not admin) - security check
        if (userData.role !== 'user') {
          // This should never happen, but if it does, fix it
          await supabaseClient
            .from('users')
            .update({ role: 'user' })
            .eq('email', normalizedEmail);
          userData.role = 'user';
        }
        
        currentUser = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        showMainApp();
        loadData();
        showToast('Registration successful! Welcome!', 'success');
      } else {
        showToast('Registration successful! Please check your email to verify your account.', 'success');
        // User needs to verify email, so we'll wait for them to sign in
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    showToast(error.message || 'Registration failed', 'error', 'Registration Error');
  } finally {
    hideLoading();
  }
}

// Handle email/password login
async function handleEmailLogin(e) {
  e.preventDefault();
  
  // Prevent multiple login attempts
  if (isLoggingIn) {
    console.log('Login already in progress, please wait...');
    return;
  }
  
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  // Validation
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address', 'warning');
    return;
  }
  
  if (!password) {
    showToast('Please enter your password', 'warning');
    return;
  }
  
  // Normalize email (same as registration)
  const normalizedEmail = email.toLowerCase().trim();
  
  isLoggingIn = true;
  showLoading();
  
  // Disable login button
  const loginButton = e.target.querySelector('button[type="submit"]') || 
                      document.querySelector('#emailLoginForm button[type="submit"]');
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
  }
  
  try {
    // Sign in with email/password
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: password
    });
    
    if (authError) {
      // Handle specific errors
      if (authError.message.includes('Invalid login credentials') || 
          authError.message.includes('invalid') ||
          authError.message.includes('wrong password')) {
        showToast('Invalid email or password. Please check your credentials.', 'error', 'Login Error');
        hideLoading();
        return;
      }
      if (authError.message.includes('Email not confirmed') || 
          authError.message.includes('email not verified')) {
        showToast('Please check your email and verify your account before signing in.', 'warning', 'Email Not Verified');
        hideLoading();
        return;
      }
      throw authError;
    }
    
    if (authData.user) {
      // Wait a bit for trigger to create user if needed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find user in database
      // If user doesn't exist in users table but exists in auth, create them
      let userData = await findUserByEmail(normalizedEmail);
      
      if (!userData) {
        // User exists in auth but not in users table - trigger might have failed
        // Try to create user manually
        console.warn('User exists in auth but not in users table, creating user...');
        const userName = authData.user.user_metadata?.full_name || 
                        authData.user.user_metadata?.name || 
                        normalizedEmail.split('@')[0];
        
        const { data: newUser, error: createError } = await supabaseClient
          .from('users')
          .insert({
            email: normalizedEmail,
            name: userName,
            role: 'user'
          })
          .select()
          .single();
        
        if (createError && !createError.message.includes('duplicate')) {
          console.error('Error creating user:', createError);
          showToast('User account created but database error occurred. Please contact administrator.', 'error', 'Error');
          hideLoading();
          return;
        }
        
        if (newUser) {
          userData = newUser;
        } else {
          // Try to find again after insert
          userData = await findUserByEmail(normalizedEmail);
        }
      }
      
      if (userData) {
        currentUser = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Hide loading and update UI
        hideLoading();
        isLoggingIn = false;
        
        // Re-enable login button
        const loginButton = document.querySelector('#emailLoginForm button[type="submit"]');
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.textContent = 'Sign In';
        }
        
        // Show main application
        showMainApp();
        loadData();
        showToast('Login successful!', 'success');
        
        // Remove hash from URL if present
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        return; // Exit, login successful
      } else {
        // If user still not found, wait a bit more
        console.warn('User not found immediately, waiting for auth state change...');
        // onAuthStateChange should handle this, but give it time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Проверим еще раз
        const retryUserData = await findUserByEmail(normalizedEmail);
        if (retryUserData) {
          currentUser = {
            id: retryUserData.id,
            name: retryUserData.name,
            email: retryUserData.email,
            role: retryUserData.role
          };
          localStorage.setItem('user', JSON.stringify(currentUser));
          
          hideLoading();
          isLoggingIn = false;
          
          const loginButton = document.querySelector('#emailLoginForm button[type="submit"]');
          if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Sign In';
          }
          
          showMainApp();
          loadData();
          showToast('Login successful!', 'success');
          
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    let errorMessage = 'Login failed';
    if (error.message && error.message.includes('Invalid login credentials')) {
      errorMessage = 'Invalid email or password';
    } else if (error.message && error.message.includes('Email not confirmed')) {
      errorMessage = 'Please check your email and verify your account';
    } else {
      errorMessage = error.message || 'Login failed';
    }
    showToast(errorMessage, 'error', 'Login Error');
  } finally {
    // Make sure flags are reset and UI is updated
    if (isLoggingIn) {
      isLoggingIn = false;
      hideLoading();
      
      const loginButton = document.querySelector('#emailLoginForm button[type="submit"]');
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'Sign In';
      }
    }
  }
}

// Toast notification system
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// Modal functions
function showDeleteModal(logId) {
  deleteLogId = logId;
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideDeleteModal() {
  deleteLogId = null;
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function showEditNameModal() {
  const modal = document.getElementById('editNameModal');
  const input = document.getElementById('nameInput');
  if (modal && input && currentUser) {
    input.value = currentUser.name;
    modal.classList.remove('hidden');
    input.focus();
    input.select();
  }
}

function hideEditNameModal() {
  const modal = document.getElementById('editNameModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function showDeleteUserModal(userEmail, userName) {
  const modal = document.getElementById('deleteUserModal');
  const message = document.getElementById('deleteUserMessage');
  if (modal && message) {
    message.textContent = `Are you sure you want to delete user "${userName}" (${userEmail})? This action cannot be undone and will delete all their logs.`;
    modal.dataset.userEmail = userEmail;
    modal.classList.remove('hidden');
  }
}

function hideDeleteUserModal() {
  const modal = document.getElementById('deleteUserModal');
  if (modal) {
    modal.classList.add('hidden');
    delete modal.dataset.userEmail;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Auth forms
  const emailLoginForm = document.getElementById('emailLoginForm');
  const emailRegisterForm = document.getElementById('emailRegisterForm');
  
  if (emailLoginForm) {
    emailLoginForm.addEventListener('submit', handleEmailLogin);
  }
  
  if (emailRegisterForm) {
    emailRegisterForm.addEventListener('submit', handleEmailRegister);
  }
  
  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Refresh buttons
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshUserBtn = document.getElementById('refreshUserBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadData());
  if (refreshUserBtn) refreshUserBtn.addEventListener('click', () => loadData());
  
  // Date filters - user view
  const userDateFilters = document.getElementById('userDateFilters');
  if (userDateFilters) {
    userDateFilters.querySelectorAll('.date-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        userDateFilters.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDateFilter = btn.dataset.filter;
        filterUserLogs();
      });
    });
  }
  
  // Sort toggle - user view
  const userSortToggle = document.getElementById('userSortToggle');
  if (userSortToggle) {
    userSortToggle.addEventListener('click', () => {
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      updateSortButton('user');
      filterUserLogs();
    });
  }
  
  // Date filters - admin view
  const adminDateFilters = document.getElementById('adminDateFilters');
  if (adminDateFilters) {
    adminDateFilters.querySelectorAll('.date-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        adminDateFilters.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDateFilter = btn.dataset.filter;
        const selectedCard = document.querySelector('.user-card.selected');
        const selectedEmail = selectedCard ? selectedCard.dataset.email : null;
        filterAdminLogs(selectedEmail);
      });
    });
  }
  
  // Sort toggle - admin view
  const adminSortToggle = document.getElementById('adminSortToggle');
  if (adminSortToggle) {
    adminSortToggle.addEventListener('click', () => {
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      updateSortButton('admin');
      const selectedCard = document.querySelector('.user-card.selected');
      const selectedEmail = selectedCard ? selectedCard.dataset.email : null;
      filterAdminLogs(selectedEmail);
    });
  }
  
  // Delete modal
  const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
  const deleteCancelBtn = document.getElementById('deleteCancelBtn');
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', () => {
      if (deleteLogId !== null) {
        handleDeleteLog(deleteLogId);
        hideDeleteModal();
      }
    });
  }
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', hideDeleteModal);
  }
  
  // Edit name modal
  const editNameBtn = document.getElementById('editNameBtn');
  const nameConfirmBtn = document.getElementById('nameConfirmBtn');
  const nameCancelBtn = document.getElementById('nameCancelBtn');
  if (editNameBtn) {
    editNameBtn.addEventListener('click', showEditNameModal);
  }
  if (nameConfirmBtn) {
    nameConfirmBtn.addEventListener('click', handleUpdateName);
  }
  if (nameCancelBtn) {
    nameCancelBtn.addEventListener('click', hideEditNameModal);
  }

  // Delete user modal
  const deleteUserConfirmBtn = document.getElementById('deleteUserConfirmBtn');
  const deleteUserCancelBtn = document.getElementById('deleteUserCancelBtn');
  if (deleteUserConfirmBtn) {
    deleteUserConfirmBtn.addEventListener('click', () => {
      const modal = document.getElementById('deleteUserModal');
      const userEmail = modal?.dataset.userEmail;
      if (userEmail) {
        handleDeleteUser(userEmail);
        hideDeleteUserModal();
      }
    });
  }
  if (deleteUserCancelBtn) {
    deleteUserCancelBtn.addEventListener('click', hideDeleteUserModal);
  }
  
  // Close modals on backdrop click
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
  
  // User form
  const addFormToggle = document.getElementById('addFormToggle');
  const addLogForm = document.getElementById('addLogForm');
  const cancelFormBtn = document.getElementById('cancelFormBtn');
  
  if (addFormToggle && addLogForm) {
    addFormToggle.addEventListener('click', () => {
      addLogForm.classList.remove('hidden');
      addFormToggle.classList.add('hidden');
    });
  }
  
  if (cancelFormBtn && addLogForm && addFormToggle) {
    cancelFormBtn.addEventListener('click', () => {
      addLogForm.classList.add('hidden');
      addFormToggle.classList.remove('hidden');
      resetForm();
    });
  }
  
  // Admin form
  const adminAddFormToggle = document.getElementById('adminAddFormToggle');
  const adminAddLogForm = document.getElementById('adminAddLogForm');
  const adminCancelFormBtn = document.getElementById('adminCancelFormBtn');
  
  if (adminAddFormToggle && adminAddLogForm) {
    adminAddFormToggle.addEventListener('click', () => {
      adminAddLogForm.classList.remove('hidden');
      adminAddFormToggle.classList.add('hidden');
    });
  }
  
  if (adminCancelFormBtn && adminAddLogForm && adminAddFormToggle) {
    adminCancelFormBtn.addEventListener('click', () => {
      adminAddLogForm.classList.add('hidden');
      adminAddFormToggle.classList.remove('hidden');
      resetAdminForm();
    });
  }
  
  // Type selection - user form
  const userForm = document.getElementById('addLogForm');
  if (userForm) {
    userForm.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        userForm.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        toggleApprovedByField('logApprovedBy', 'approvedByGroup', btn.dataset.type === 'timeoff');
        updateCreditedPreview();
      });
    });
  }
  
  // Type selection - admin form
  const adminForm = document.getElementById('adminAddLogForm');
  if (adminForm) {
    adminForm.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        adminForm.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        toggleApprovedByField('adminLogApprovedBy', 'adminApprovedByGroup', btn.dataset.type === 'timeoff');
        updateAdminCreditedPreview();
      });
    });
  }
  
  // Toggle Approved By field visibility
  function toggleApprovedByField(inputId, groupId, show) {
    const group = document.getElementById(groupId);
    const input = document.getElementById(inputId);
    if (group && input) {
      group.style.display = show ? 'block' : 'none';
      if (!show) input.value = '';
    }
  }
  
  // Form fields
  const logHours = document.getElementById('logHours');
  const adminLogHours = document.getElementById('adminLogHours');
  if (logHours) logHours.addEventListener('input', updateCreditedPreview);
  if (adminLogHours) adminLogHours.addEventListener('input', updateAdminCreditedPreview);
  
  const logDate = document.getElementById('logDate');
  const adminLogDate = document.getElementById('adminLogDate');
  if (logDate) {
    try {
      logDate.valueAsDate = new Date();
    } catch (e) {
      // Ignore error if field doesn't support valueAsDate
    }
  }
  if (adminLogDate) {
    try {
      adminLogDate.valueAsDate = new Date();
    } catch (e) {
      // Ignore error if field doesn't support valueAsDate
    }
  }
  
  // Form submission
  if (addLogForm) addLogForm.addEventListener('submit', handleAddLog);
  if (adminAddLogForm) adminAddLogForm.addEventListener('submit', handleAdminAddLog);
  
  
  
  // Search input for user view
  const userSearchInput = document.getElementById('userSearchInput');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', () => {
      const searchTerm = userSearchInput.value.toLowerCase();
      if (searchTerm) {
        filteredLogs = currentLogs.filter(log => 
          (log.comment && log.comment.toLowerCase().includes(searchTerm))
        );
      } else {
        filteredLogs = filterLogsByDate(currentLogs, currentDateFilter);
      }
      renderUserLogs();
    });
  }
}

// Show main app
function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  if (currentUser.role === 'admin') {
    document.getElementById('userView').classList.add('hidden');
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminControls').classList.remove('hidden');
    document.getElementById('refreshUserBtn').classList.add('hidden');
    document.getElementById('headerTitle').textContent = 'Toil Tracker';
    document.getElementById('headerSubtitle').textContent = currentUser.name;
  } else {
    document.getElementById('userView').classList.remove('hidden');
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('adminControls').classList.add('hidden');
    document.getElementById('refreshUserBtn').classList.remove('hidden');
    document.getElementById('headerTitle').textContent = 'Toil Tracker';
    document.getElementById('headerSubtitle').textContent = currentUser.name;
  }
}

// Load data with smooth loading indicators
async function loadData() {
  // Show skeleton loaders instead of blocking overlay
  showSkeletonLoaders();
  
  try {
    if (currentUser.role === 'admin') {
      await Promise.all([
        loadAllLogs(),
        loadUsers(),
        loadSettings()
      ]);
      renderAdminView();
    } else {
      await Promise.all([
        loadUserLogs(),
        loadSettings()
      ]);
      renderUserView();
    }
  } catch (error) {
    console.error('Data loading error:', error);
    showToast('Error loading data', 'error');
  }
  
  hideSkeletonLoaders();
}

// Load user logs
async function loadUserLogs() {
  if (!supabaseClient) throw new Error('Supabase client not initialized');
  
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('user_email', currentUser.email)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Transform data format for compatibility
    currentLogs = (data || []).map(log => ({
      id: log.id,
      userEmail: log.user_email,
      date: log.date,
      type: log.type,
      factHours: log.fact_hours,
      creditedHours: log.credited_hours,
      comment: log.comment || '',
      createdAt: log.created_at,
      approvedBy: log.approved_by || ''
    }));
  } catch (error) {
    console.error('Logs loading error:', error);
    throw error;
  }
}

// Load all logs (admin)
async function loadAllLogs() {
  if (!supabaseClient) throw new Error('Supabase client not initialized');
  
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Transform data format for compatibility
    currentLogs = (data || []).map(log => ({
      id: log.id,
      userEmail: log.user_email,
      date: log.date,
      type: log.type,
      factHours: log.fact_hours,
      creditedHours: log.credited_hours,
      comment: log.comment || '',
      createdAt: log.created_at,
      approvedBy: log.approved_by || ''
    }));
  } catch (error) {
    console.error('All logs loading error:', error);
    throw error;
  }
}

// Load users (admin)
async function loadUsers() {
  if (!supabaseClient) throw new Error('Supabase client not initialized');
  
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    currentUsers = data || [];
  } catch (error) {
    console.error('Users loading error:', error);
    throw error;
  }
}

// Load settings
async function loadSettings() {
  if (!supabaseClient) {
    // Use default value
    return;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('*');
    
    if (error) throw error;
    
    const settings = {};
    (data || []).forEach(row => {
      settings[row.key] = row.value;
    });
    
    if (settings.overtimeMultiplier) {
      currentMultiplier = parseFloat(settings.overtimeMultiplier) || 1.5;
    } else {
      currentMultiplier = 1.5; // Always 1.5 from DB
    }
    const userMultiplier = document.getElementById('userMultiplier');
    if (userMultiplier) userMultiplier.textContent = currentMultiplier;
  } catch (error) {
    console.error('Settings loading error:', error);
    // Don't throw error, use default value
  }
}

// Format date to DD-MM-YYYY
function formatDate(dateString) {
  if (!dateString) return '';
  
  // Handle ISO format (2026-01-03T00:00:00.000Z) or YYYY-MM-DD format
  let date;
  if (dateString.includes('T')) {
    // ISO format
    date = new Date(dateString);
  } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // YYYY-MM-DD format
    const parts = dateString.split('-');
    date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    date = new Date(dateString);
  }
  
  if (isNaN(date.getTime())) {
    // If parsing failed, try to extract date part from ISO string
    const dateMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    return dateString;
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Calculate balance
function calculateBalance(logs) {
  return logs.reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0);
}

// Calculate hours for current month
function calculateMonthHours(logs) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  return logs
    .filter(log => {
      const logDate = new Date(log.date);
      return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
    })
    .reduce((sum, log) => sum + Math.abs(parseFloat(log.creditedHours) || 0), 0);
}

// Filter logs by date range
function filterLogsByDate(logs, filterType) {
  if (filterType === 'all') return logs;
  
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return logs.filter(log => {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    
    switch (filterType) {
      case 'today':
        return logDate.getTime() === today.getTime();
      case 'week':
        return logDate.getTime() >= startOfWeek.getTime() && logDate.getTime() <= now.getTime();
      case 'month':
        return logDate.getTime() >= startOfMonth.getTime() && logDate.getTime() <= now.getTime();
      default:
        return true;
    }
  });
}

// Render user view
function renderUserView() {
  const balance = calculateBalance(currentLogs);
  const monthHours = calculateMonthHours(currentLogs);
  
  document.getElementById('userBalance').textContent = balance.toFixed(1) + ' hrs';
  document.getElementById('userBalance').className = 'balance-value ' + 
    (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero');
  
  // Update statistics
  const monthHoursEl = document.getElementById('userMonthHours');
  const totalEntriesEl = document.getElementById('userTotalEntries');
  if (monthHoursEl) monthHoursEl.textContent = monthHours.toFixed(1) + ' hrs';
  if (totalEntriesEl) totalEntriesEl.textContent = currentLogs.length.toString();
  
  // Apply date filter
  filteredLogs = filterLogsByDate(currentLogs, currentDateFilter);
  renderUserLogs();
}

// Filter user logs
function filterUserLogs() {
  // Apply date filter
  filteredLogs = filterLogsByDate(currentLogs, currentDateFilter);
  renderUserLogs();
}

// Update sort button UI
function updateSortButton(view) {
  const icon = document.getElementById(`${view}SortIcon`);
  const text = document.getElementById(`${view}SortText`);
  
  if (icon && text) {
    if (sortOrder === 'desc') {
      icon.textContent = '⬇️';
      text.textContent = 'Newest First';
    } else {
      icon.textContent = '⬆️';
      text.textContent = 'Oldest First';
    }
  }
}

function renderUserLogs() {
  const container = document.getElementById('userLogs');
  
  if (filteredLogs.length === 0) {
    if (currentLogs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No entries</div>
          <div class="empty-state-description">Start adding overtime and time off entries to track your balance</div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No results found</div>
          <div class="empty-state-description">Try changing the date filters</div>
        </div>
      `;
    }
    return;
  }
  
  // Sort by date - handle ISO format dates
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (sortOrder === 'asc') {
      return dateA.getTime() - dateB.getTime(); // Ascending order (oldest first)
    } else {
      return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
    }
  });
  
  // Use documentFragment for better performance with smooth fade-in
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  sortedLogs.forEach((log, index) => {
    const credited = parseFloat(log.creditedHours) || 0;
    tempDiv.innerHTML = `
      <div class="log-item" style="opacity: 0; transform: translateY(10px); transition: opacity 0.3s ease ${index * 0.05}s, transform 0.3s ease ${index * 0.05}s;">
        <div class="log-item-left">
          <div>
            <span class="log-badge ${log.type === 'overtime' ? 'badge-overtime' : 'badge-timeoff'}">
              ${log.type === 'overtime' ? 'Overtime' : 'Time Off'}
            </span>
            <span class="log-date">${formatDate(log.date)}</span>
          </div>
          <div class="log-details">
            Actual: <strong>${log.factHours} hrs</strong>
          </div>
          ${log.comment ? `<div class="log-comment">${escapeHtml(log.comment)}</div>` : ''}
          ${log.type === 'timeoff' && log.approvedBy ? `<div class="log-approved-by" style="margin-top: 4px; font-size: 12px; color: var(--gray-600);">Approved By: <strong>${escapeHtml(log.approvedBy)}</strong></div>` : ''}
        </div>
        <div class="log-credited ${credited > 0 ? 'positive' : 'negative'}">
          ${credited > 0 ? '+' : ''}${credited} hrs
        </div>
      </div>
    `;
    const item = tempDiv.firstElementChild;
    fragment.appendChild(item);
    
    // Trigger fade-in animation
    requestAnimationFrame(() => {
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    });
  });
  
  container.innerHTML = '';
  container.appendChild(fragment);
}

// Render admin view
function renderAdminView() {
  // Render admin's personal balance
  const adminLogs = currentLogs.filter(log => log.userEmail === currentUser.email);
  const adminBalance = calculateBalance(adminLogs);
  const adminMonthHours = calculateMonthHours(adminLogs);
  
  document.getElementById('adminBalance').textContent = adminBalance.toFixed(1) + ' hrs';
  document.getElementById('adminBalance').className = 'balance-value ' + 
    (adminBalance > 0 ? 'positive' : adminBalance < 0 ? 'negative' : 'zero');
  
  // Update statistics
  const monthHoursEl = document.getElementById('adminMonthHours');
  const totalEntriesEl = document.getElementById('adminTotalEntries');
  if (monthHoursEl) monthHoursEl.textContent = adminMonthHours.toFixed(1) + ' hrs';
  if (totalEntriesEl) totalEntriesEl.textContent = adminLogs.length.toString();
  
  if (document.getElementById('adminMultiplier')) {
    document.getElementById('adminMultiplier').textContent = currentMultiplier;
  }
  
  // Reset search and render
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) searchInput.value = '';
  
  // Apply date filter
  filteredLogs = filterLogsByDate(currentLogs, currentDateFilter);
  renderUsersList();
  renderAdminLogs();
}

// Filter admin logs
function filterAdminLogs(searchTerm, selectedEmail = null) {
  // First filter by selected user if any
  let logsToFilter = selectedEmail 
    ? currentLogs.filter(log => log.userEmail === selectedEmail)
    : currentLogs;
  
  // Apply date filter
  logsToFilter = filterLogsByDate(logsToFilter, currentDateFilter);
  
  // Then apply search filter if any
  if (searchTerm && searchTerm.trim() !== '') {
    const term = searchTerm.toLowerCase();
    filteredLogs = logsToFilter.filter(log => {
      const userName = currentUsers.find(u => u.email === log.userEmail)?.name || log.userEmail;
      return (
        userName.toLowerCase().includes(term) ||
        log.userEmail.toLowerCase().includes(term) ||
        (log.comment && log.comment.toLowerCase().includes(term)) ||
        formatDate(log.date).toLowerCase().includes(term)
      );
    });
  } else {
    filteredLogs = logsToFilter;
  }
  renderAdminLogs();
}

function renderUsersList() {
  const container = document.getElementById('usersList');
  
  const userBalances = currentUsers.map(user => ({
    ...user,
    balance: calculateBalance(currentLogs.filter(log => log.userEmail === user.email))
  }));
  
  container.innerHTML = userBalances.map(user => {
    const balance = user.balance;
    const isCurrentUser = user.email === currentUser.email;
    return `
      <div class="user-card" data-email="${user.email}">
        <div class="user-card-content">
          <div class="user-info">
            <h3>${escapeHtml(user.name)}</h3>
            <p>${escapeHtml(user.email)}</p>
          </div>
          <div class="user-balance">
            <div class="user-balance-value ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero'}">
              ${balance.toFixed(1)} hrs
            </div>
            <div class="user-balance-label">balance</div>
          </div>
        </div>
        ${!isCurrentUser ? `
          <button class="user-delete-btn" data-email="${user.email}" data-name="${escapeHtml(user.name)}" title="Delete user">
            🗑️
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Click handlers for user cards
  container.querySelectorAll('.user-card').forEach(card => {
    const deleteBtn = card.querySelector('.user-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = deleteBtn.dataset.email;
        const name = deleteBtn.dataset.name;
        showDeleteUserModal(email, name);
      });
    }
    
    card.addEventListener('click', (e) => {
      // Don't trigger selection if clicking delete button
      if (e.target.closest('.user-delete-btn')) return;
      
      const email = card.dataset.email;
      const isSelected = card.classList.contains('selected');
      
      container.querySelectorAll('.user-card').forEach(c => c.classList.remove('selected'));
      
      // Re-apply search filter if any
      const searchInput = document.getElementById('adminSearchInput');
      const searchTerm = searchInput ? searchInput.value : '';
      
      if (!isSelected) {
        card.classList.add('selected');
        const userName = currentUsers.find(u => u.email === email)?.name || email;
        document.getElementById('historyTitle').textContent = `History: ${userName}`;
        filterAdminLogs(email);
      } else {
        document.getElementById('historyTitle').textContent = 'All Records';
        filterAdminLogs(null);
      }
    });
  });
}

function renderAdminLogs() {
  const container = document.getElementById('adminLogsBody');
  
  let logsToShow = filteredLogs;
  
  // Sort by date - handle ISO format dates
  logsToShow = [...logsToShow].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (sortOrder === 'asc') {
      return dateA.getTime() - dateB.getTime(); // Ascending order (oldest first)
    } else {
      return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
    }
  });
  
  if (logsToShow.length === 0) {
    const allLogsCount = currentLogs.length;
    container.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          ${allLogsCount === 0 
            ? '<div class="empty-state-icon">📋</div><div class="empty-state-title">No entries</div><div class="empty-state-description">Overtime and time off entries will appear here</div>'
            : '<div class="empty-state-icon">🔍</div><div class="empty-state-title">Nothing found</div><div class="empty-state-description">Try changing filters or search query</div>'
          }
        </td>
      </tr>
    `;
    return;
  }
  
  // Use documentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  logsToShow.forEach((log, index) => {
    const credited = parseFloat(log.creditedHours) || 0;
    const userName = currentUsers.find(u => u.email === log.userEmail)?.name || log.userEmail;
    const approvedByText = log.type === 'timeoff' && log.approvedBy ? `<br><small style="color: var(--gray-600);">Approved By: ${escapeHtml(log.approvedBy)}</small>` : '';
    
    const row = document.createElement('tr');
    row.style.opacity = '0';
    row.style.transform = 'translateX(-10px)';
    row.style.transition = `opacity 0.3s ease ${index * 0.03}s, transform 0.3s ease ${index * 0.03}s`;
    row.innerHTML = `
      <td>${formatDate(log.date)}</td>
      <td>${escapeHtml(userName)}</td>
      <td>
        <span class="table-badge ${log.type === 'overtime' ? 'badge-overtime' : 'badge-timeoff'}">
          ${log.type === 'overtime' ? 'Overtime' : 'Time Off'}
        </span>
      </td>
      <td class="text-right">${log.factHours}</td>
      <td class="text-right ${credited > 0 ? 'positive' : 'negative'}" style="font-weight: 600; color: ${credited > 0 ? 'var(--success)' : 'var(--danger)'}">
        ${credited > 0 ? '+' : ''}${credited}
      </td>
      <td>${escapeHtml(log.comment || '')}${approvedByText}</td>
      <td class="text-center">
        <button class="table-action-btn" onclick="showDeleteModal(${log.id})" title="Delete">
          🗑️
        </button>
      </td>
    `;
    fragment.appendChild(row);
    
    // Trigger fade-in animation
    requestAnimationFrame(() => {
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    });
  });
  
  // Clear and append rows directly (container is tbody)
  container.innerHTML = '';
  container.appendChild(fragment);
}

// Add log entry (user)
async function handleAddLog(e) {
  e.preventDefault();
  
  const form = e.target;
  const type = form.querySelector('.type-btn.active').dataset.type;
  const date = document.getElementById('logDate').value;
  const hours = parseFloat(document.getElementById('logHours').value);
  const comment = document.getElementById('logComment').value;
  const approvedBy = type === 'timeoff' ? (document.getElementById('logApprovedBy')?.value || '') : '';
  
  // Validation
  if (!date) {
    showToast('Please select a date', 'warning');
    return;
  }
  
  // Allow future dates - removed restriction
  
  if (!hours || hours <= 0) {
    showToast('Please enter a valid number of hours (minimum 0.25)', 'warning');
    return;
  }
  
  if (hours > 24) {
    showToast('Hours cannot exceed 24 hours per day', 'warning');
    return;
  }
  
  await saveLogEntry(currentUser.email, date, type, hours, comment, approvedBy, form);
}

// Add log entry (admin)
async function handleAdminAddLog(e) {
  e.preventDefault();
  
  const form = e.target;
  const type = form.querySelector('.type-btn.active').dataset.type;
  const date = document.getElementById('adminLogDate').value;
  const hours = parseFloat(document.getElementById('adminLogHours').value);
  const comment = document.getElementById('adminLogComment').value;
  const approvedBy = type === 'timeoff' ? (document.getElementById('adminLogApprovedBy')?.value || '') : '';
  
  // Validation
  if (!date) {
    showToast('Please select a date', 'warning');
    return;
  }
  
  // Allow future dates - removed restriction
  
  if (!hours || hours <= 0) {
    showToast('Please enter a valid number of hours (minimum 0.25)', 'warning');
    return;
  }
  
  if (hours > 24) {
    showToast('Hours cannot exceed 24 hours per day', 'warning');
    return;
  }
  
  await saveLogEntry(currentUser.email, date, type, hours, comment, approvedBy, form);
}

// Save log entry with optimistic update
async function saveLogEntry(userEmail, date, type, hours, comment, approvedBy, form) {
  // Optimistic update - add entry immediately to UI
  const factHours = hours;
  const creditedHours = type === 'overtime' 
    ? factHours * currentMultiplier 
    : -factHours;
  
  const tempLog = {
    id: 'temp-' + Date.now(),
    userEmail: userEmail,
    date: date,
    type: type,
    factHours: factHours,
    creditedHours: creditedHours,
    comment: comment,
    approvedBy: approvedBy || ''
  };
  
  // Add to current logs immediately
  currentLogs.push(tempLog);
  
  // Update UI immediately
  if (currentUser.role === 'admin') {
    renderAdminView();
  } else {
    renderUserView();
  }
  
  // Hide form immediately with smooth transition
  // Determine which form was used (user or admin)
  const isAdminForm = form && form.id === 'adminAddLogForm';
  const formEl = isAdminForm ? document.getElementById('adminAddLogForm') : document.getElementById('addLogForm');
  const toggleEl = isAdminForm ? document.getElementById('adminAddFormToggle') : document.getElementById('addFormToggle');
  
  if (formEl) {
    formEl.style.opacity = '0';
    formEl.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (isAdminForm) {
        resetAdminForm();
      } else {
        resetForm();
      }
      formEl.classList.add('hidden');
      formEl.style.opacity = '';
      formEl.style.transform = '';
      if (toggleEl) toggleEl.classList.remove('hidden');
    }, 200);
  }
  
  // Save to Supabase in background
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .insert([{
        user_email: userEmail,
        date: date,
        type: type,
        fact_hours: factHours,
        credited_hours: creditedHours,
        comment: comment || '',
        approved_by: approvedBy || ''
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Remove temp entry and reload real data
    currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
    await loadData();
    showToast('Entry successfully added', 'success');
  } catch (error) {
    // Rollback on error
    currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
    console.error('Save error:', error);
    showToast('Error saving: ' + error.message, 'error', 'Error');
  }
}

// Delete log entry with optimistic update
async function handleDeleteLog(logId) {
  // Optimistic update - remove from UI immediately
  const logToDelete = currentLogs.find(log => log.id == logId);
  if (logToDelete) {
    currentLogs = currentLogs.filter(log => log.id != logId);
    
    // Update UI immediately
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
  }
  
  // Delete from Supabase in background
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('logs')
      .delete()
      .eq('id', logId);
    
    if (error) throw error;
    
    showToast('Entry successfully deleted', 'success');
  } catch (error) {
    // Rollback on error
    if (logToDelete) {
      currentLogs.push(logToDelete);
      if (currentUser.role === 'admin') {
        renderAdminView();
      } else {
        renderUserView();
      }
    }
    console.error('Delete error:', error);
    showToast('Error deleting: ' + error.message, 'error', 'Error');
  }
}

// Update user name
async function handleUpdateName() {
  const input = document.getElementById('nameInput');
  if (!input || !input.value.trim()) {
    showToast('Please enter a name', 'warning');
    return;
  }
  
  const newName = input.value.trim();
  if (newName === currentUser.name) {
    hideEditNameModal();
    return;
  }
  
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  // Optimistic update
  const oldName = currentUser.name;
  currentUser.name = newName;
  localStorage.setItem('user', JSON.stringify(currentUser));
  
  // Update UI
  if (currentUser.role === 'admin') {
    renderAdminView();
  } else {
    renderUserView();
  }
  hideEditNameModal();
  
  // Save to Supabase
  try {
    const { error } = await supabaseClient
      .from('users')
      .update({ name: newName })
      .eq('email', currentUser.email);
    
    if (error) throw error;
    
    showToast('Name successfully updated', 'success');
    await loadUsers(); // Reload users list for admin view
  } catch (error) {
    // Rollback
    currentUser.name = oldName;
    localStorage.setItem('user', JSON.stringify(currentUser));
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
    console.error('Update error:', error);
    showToast('Error updating name: ' + error.message, 'error', 'Error');
  }
}

// Delete user (admin only)
async function handleDeleteUser(userEmail) {
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  if (userEmail === currentUser.email) {
    showToast('You cannot delete your own account', 'error', 'Error');
    return;
  }
  
  try {
    // Delete user (this will cascade delete logs due to ON DELETE CASCADE)
    const { error } = await supabaseClient
      .from('users')
      .delete()
      .eq('email', userEmail);
    
    if (error) throw error;
    
    showToast('User successfully deleted', 'success');
    
    // Reload data
    await loadUsers();
    await loadAllLogs();
    renderAdminView();
  } catch (error) {
    console.error('Delete user error:', error);
    showToast('Error deleting user: ' + error.message, 'error', 'Error');
  }
}


// Update credited hours preview (user form)
function updateCreditedPreview() {
  const form = document.getElementById('addLogForm');
  if (!form) return;
  
  const type = form.querySelector('.type-btn.active')?.dataset.type;
  const hours = parseFloat(document.getElementById('logHours')?.value);
  const preview = document.getElementById('creditedPreview');
  
  if (preview && type === 'overtime' && hours && hours > 0) {
    const credited = hours * currentMultiplier;
    preview.textContent = `Credited: ${credited.toFixed(1)} hrs`;
    preview.classList.remove('hidden');
  } else if (preview) {
    preview.textContent = '';
    preview.classList.add('hidden');
  }
}

// Update credited hours preview (admin form)
function updateAdminCreditedPreview() {
  const form = document.getElementById('adminAddLogForm');
  if (!form) return;
  
  const type = form.querySelector('.type-btn.active')?.dataset.type;
  const hours = parseFloat(document.getElementById('adminLogHours')?.value);
  const preview = document.getElementById('adminCreditedPreview');
  
  if (preview && type === 'overtime' && hours && hours > 0) {
    const credited = hours * currentMultiplier;
    preview.textContent = `Credited: ${credited.toFixed(1)} hrs`;
    preview.classList.remove('hidden');
  } else if (preview) {
    preview.textContent = '';
    preview.classList.add('hidden');
  }
}

// Reset user form
function resetForm() {
  const dateInput = document.getElementById('logDate');
  const hoursInput = document.getElementById('logHours');
  const commentInput = document.getElementById('logComment');
  const approvedByInput = document.getElementById('logApprovedBy');
  const approvedByGroup = document.getElementById('approvedByGroup');
  const form = document.getElementById('addLogForm');
  
  if (dateInput) {
    try {
      dateInput.valueAsDate = new Date();
    } catch (e) {
      // Ignore error if valueAsDate is not supported
    }
  }
  if (hoursInput) hoursInput.value = '';
  if (commentInput) commentInput.value = '';
  if (approvedByInput) approvedByInput.value = '';
  if (approvedByGroup) approvedByGroup.style.display = 'none';
  if (form) {
    form.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    const overtimeBtn = form.querySelector('.type-btn[data-type="overtime"]');
    if (overtimeBtn) overtimeBtn.classList.add('active');
  }
  updateCreditedPreview();
}

// Reset admin form
function resetAdminForm() {
  const dateInput = document.getElementById('adminLogDate');
  const hoursInput = document.getElementById('adminLogHours');
  const commentInput = document.getElementById('adminLogComment');
  const approvedByInput = document.getElementById('adminLogApprovedBy');
  const approvedByGroup = document.getElementById('adminApprovedByGroup');
  const form = document.getElementById('adminAddLogForm');
  
  if (dateInput) {
    try {
      dateInput.valueAsDate = new Date();
    } catch (e) {
      // Ignore error if valueAsDate is not supported
    }
  }
  if (hoursInput) hoursInput.value = '';
  if (commentInput) commentInput.value = '';
  if (approvedByInput) approvedByInput.value = '';
  if (approvedByGroup) approvedByGroup.style.display = 'none';
  if (form) {
    form.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    const overtimeBtn = form.querySelector('.type-btn[data-type="overtime"]');
    if (overtimeBtn) overtimeBtn.classList.add('active');
  }
  updateAdminCreditedPreview();
}

// Logout
async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  
  currentUser = null;
  currentLogs = [];
  currentUsers = [];
  localStorage.removeItem('user');
  
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

// Utilities - show loading only for critical operations (login)
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Show skeleton loaders for smooth loading experience
function showSkeletonLoaders() {
  const userLogs = document.getElementById('userLogs');
  const adminLogsBody = document.getElementById('adminLogsBody');
  const usersList = document.getElementById('usersList');
  
  if (userLogs) {
    userLogs.innerHTML = '<div class="skeleton-loader"></div><div class="skeleton-loader"></div><div class="skeleton-loader"></div>';
  }
  
  if (adminLogsBody) {
    adminLogsBody.innerHTML = '<tr><td colspan="7"><div class="skeleton-loader" style="height: 40px;"></div></td></tr>';
  }
  
  if (usersList) {
    usersList.innerHTML = '<div class="skeleton-loader" style="height: 80px;"></div><div class="skeleton-loader" style="height: 80px;"></div>';
  }
}

function hideSkeletonLoaders() {
  // Skeleton loaders are replaced by actual content in render functions
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Экспорт функции для глобального использования
window.showDeleteModal = showDeleteModal;
