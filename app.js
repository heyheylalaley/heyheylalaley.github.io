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
let editLogId = null; // For edit modal
let filteredLogs = []; // For search functionality
let currentDateFilter = 'all'; // Current date filter (all, today, week, month)
let sortOrder = 'desc'; // Sort order: 'desc' (newest first) or 'asc' (oldest first)

// Flags to prevent multiple calls
let isCheckingSession = false; // Session check flag
let isLoggingIn = false; // Login process flag
let sessionCheckTimeout = null; // Session check timeout
let emailPasswordLoginInProgress = false; // Flag to track email/password login

// Undo delete state
// Removed pendingDelete - now using immediate deletion with undo via re-insert

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
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

// Theme management
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const lightIcon = document.querySelector('.theme-icon-light');
  const darkIcon = document.querySelector('.theme-icon-dark');
  if (lightIcon && darkIcon) {
    if (theme === 'dark') {
      lightIcon.classList.add('hidden');
      darkIcon.classList.remove('hidden');
    } else {
      lightIcon.classList.remove('hidden');
      darkIcon.classList.add('hidden');
    }
  }
}

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

// Function to find user by email - simple and fast
async function findUserByEmail(email) {
  if (!supabaseClient || !email) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  console.log('Searching for user:', normalizedEmail);
  
  try {
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, name, role')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (userError) {
      console.error('Error finding user:', userError.message);
      return null;
    }
    
    if (userData) {
      console.log('User found:', userData.email);
      return userData;
    }
    
    console.log('User not found in database');
    return null;
  } catch (error) {
    console.error('Error searching for user:', error);
    return null;
  }
}

// Setup authentication state change listener
function setupAuthListener() {
  if (!supabaseClient) return;
  
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session) {
      // User successfully signed in
      // Only process if user is not already loaded (to avoid duplicate messages)
      if (currentUser) {
        console.log('User already loaded, skipping onAuthStateChange processing');
        return;
      }
      
      // Skip if any login process is active
      if (emailPasswordLoginInProgress || isLoggingIn) {
        console.log('Login in progress, skipping onAuthStateChange processing');
        return;
      }
      
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
          // Only show toast for OAuth logins (not email/password, which is handled in handleEmailLogin)
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
    return;
  }
  
  isCheckingSession = true;
  
  try {
    // First, get Supabase session (this also restores from localStorage)
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && !error) {
      // Session is valid - try to use cached user data
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.email?.toLowerCase() === session.user.email.toLowerCase() && parsed.id && parsed.role) {
            currentUser = parsed;
            showMainApp();
            loadData();
            console.log('Quick restore with valid session');
            return;
          }
        } catch (e) {}
      }
      
      // Fallback: get user from database
      console.log('Getting user from database...');
      const userData = await findUserByEmail(session.user.email);
      
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
        console.log('User restored from database');
      } else {
        console.warn('Session exists but user not found');
        localStorage.removeItem('user');
      }
    } else {
      console.log('No active session');
      localStorage.removeItem('user');
    }
    
    // Clean up URL hash if present
    if (window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (error) {
    console.error('Session check error:', error);
    // Check saved session as fallback
    await restoreUserFromStorage();
  } finally {
    isCheckingSession = false;
  }
}

// Restore user from localStorage or session
async function restoreUserFromStorage() {
  if (!supabaseClient) return false;
  
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && !error) {
      const sessionEmail = session.user.email.toLowerCase().trim();
      console.log('Valid session found for:', sessionEmail);
      
      // First try localStorage (fastest)
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.email?.toLowerCase() === sessionEmail && parsed.id) {
            currentUser = parsed;
            showMainApp();
            loadData();
            console.log('User restored from localStorage:', currentUser.email);
            return true;
          }
        } catch (e) {}
      }
      
      // Fallback to database query
      const userData = await findUserByEmail(sessionEmail);
      if (userData) {
        currentUser = userData;
        localStorage.setItem('user', JSON.stringify(currentUser));
        showMainApp();
        loadData();
        console.log('User restored from database:', currentUser.email);
        return true;
      }
    }
    
    localStorage.removeItem('user');
  } catch (e) {
    console.error('Error restoring user:', e);
    localStorage.removeItem('user');
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
  
  // Set flag to prevent duplicate toast in onAuthStateChange
  emailPasswordLoginInProgress = true;
  isLoggingIn = true;
  showLoading();
  
  // Disable login button
  const loginButton = e.target.querySelector('button[type="submit"]') || 
                      document.querySelector('#emailLoginForm button[type="submit"]');
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
  }
  
  // Safety timeout - if login takes more than 10 seconds, reset state
  const safetyTimeout = setTimeout(() => {
    console.warn('Login timeout - resetting state');
    isLoggingIn = false;
    emailPasswordLoginInProgress = false;
    hideLoading();
    const btn = document.querySelector('#emailLoginForm button[type="submit"]');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
    showToast('Login timed out. Please try again.', 'warning');
  }, 10000);
  
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
      console.log('Auth successful, setting up user...');
      
      // First, try to find existing user (don't overwrite their data)
      try {
        const { data: existingUser } = await supabaseClient
          .from('users')
          .select('id, email, name, role')
          .eq('email', normalizedEmail)
          .single();
        
        if (existingUser) {
          // User exists - use their existing data (don't overwrite name!)
          currentUser = existingUser;
        } else {
          // User doesn't exist - create new one
          const userName = authData.user.user_metadata?.full_name || 
                          authData.user.user_metadata?.name || 
                          normalizedEmail.split('@')[0];
          
          const { data: newUser, error: insertError } = await supabaseClient
            .from('users')
            .insert({ email: normalizedEmail, name: userName, role: 'user' })
            .select('id, email, name, role')
            .single();
          
          if (insertError) {
            console.error('Insert error:', insertError);
            throw new Error('Could not create user');
          }
          currentUser = newUser;
        }
        
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Clear timeout and flags
        clearTimeout(safetyTimeout);
        hideLoading();
        isLoggingIn = false;
        emailPasswordLoginInProgress = false;
        
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
        
        return;
      } catch (dbError) {
        console.error('Database error:', dbError);
        showToast('Database error. Please try again.', 'error', 'Error');
        return;
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
    // Clear safety timeout
    clearTimeout(safetyTimeout);
    
    // ALWAYS reset all flags and UI state
    isLoggingIn = false;
    emailPasswordLoginInProgress = false;
    hideLoading();
    
    const loginButton = document.querySelector('#emailLoginForm button[type="submit"]');
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Sign In';
    }
  }
}

// Toast notification system
function showToast(message, type = 'info', title = '', options = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return null;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.position = 'relative';
  
  // Animated SVG icons
  const icons = {
    success: `<svg class="icon-animated" viewBox="0 0 52 52">
      <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none" stroke-width="2"/>
      <path class="checkmark-check" fill="none" stroke-width="3" d="M14 27l7 7 16-16"/>
    </svg>`,
    error: `<svg class="icon-animated" viewBox="0 0 52 52" style="color: var(--danger)">
      <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" stroke-width="2"/>
      <path stroke="currentColor" stroke-width="3" d="M16 16l20 20M36 16L16 36"/>
    </svg>`,
    warning: `<svg class="icon-animated" viewBox="0 0 52 52" style="color: var(--warning)">
      <path fill="currentColor" d="M26 4L2 48h48L26 4zm0 8l18 32H8L26 12z"/>
      <rect x="24" y="20" width="4" height="12" fill="currentColor"/>
      <rect x="24" y="36" width="4" height="4" fill="currentColor"/>
    </svg>`,
    info: `<svg class="icon-animated" viewBox="0 0 52 52" style="color: var(--info)">
      <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="24" y="22" width="4" height="14" fill="currentColor"/>
      <rect x="24" y="14" width="4" height="4" fill="currentColor"/>
    </svg>`
  };
  
  const undoButton = options.onUndo ? `<button class="toast-undo" onclick="event.stopPropagation()">Undo</button>` : '';
  const progressBar = options.showProgress ? `<div class="toast-progress"></div>` : '';
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    ${undoButton}
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    ${progressBar}
  `;
  
  // Add undo handler
  if (options.onUndo) {
    const undoBtn = toast.querySelector('.toast-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        options.onUndo();
        toast.remove();
      });
    }
  }
  
  container.appendChild(toast);
  
  // Auto remove after timeout (default 5 seconds)
  const timeout = options.timeout || 5000;
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'toastSlideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }
  }, timeout);
  
  return toast;
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

function showEditLogModal(logId) {
  const log = currentLogs.find(l => l.id == logId);
  if (!log) return;
  
  editLogId = logId;
  const modal = document.getElementById('editLogModal');
  const dateInput = document.getElementById('editLogDate');
  const commentInput = document.getElementById('editLogComment');
  const approvedByInput = document.getElementById('editLogApprovedBy');
  const approvedByGroup = document.getElementById('editApprovedByGroup');
  
  if (modal && dateInput && commentInput) {
    // Set date value (convert from stored format to input format)
    const dateStr = log.date.split('T')[0];
    dateInput.value = dateStr;
    
    commentInput.value = log.comment || '';
    
    // Show/hide approved by field based on type
    if (log.type === 'timeoff') {
      approvedByGroup.style.display = 'block';
      approvedByInput.value = log.approvedBy || '';
    } else {
      approvedByGroup.style.display = 'none';
      approvedByInput.value = '';
    }
    
    modal.classList.remove('hidden');
    commentInput.focus();
  }
}

function hideEditLogModal() {
  editLogId = null;
  const modal = document.getElementById('editLogModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Quick add buttons (user view)
  const quickAddButtons = document.querySelectorAll('.quick-add-btn:not(.quick-add-custom)');
  quickAddButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hours = parseFloat(btn.dataset.hours);
      if (hours && currentUser) {
        quickAddOvertime(hours, 'user');
      }
    });
  });
  
  // Quick add custom button - opens form (user view)
  const quickAddCustomBtn = document.getElementById('quickAddCustomBtn');
  if (quickAddCustomBtn) {
    quickAddCustomBtn.addEventListener('click', () => {
      const addLogForm = document.getElementById('addLogForm');
      if (addLogForm) {
        addLogForm.classList.remove('hidden');
        document.getElementById('logHours')?.focus();
      }
    });
  }
  
  // Quick add buttons (admin view)
  const adminQuickAddButtons = document.querySelectorAll('.admin-quick-add-btn:not(.quick-add-custom)');
  adminQuickAddButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hours = parseFloat(btn.dataset.hours);
      if (hours && currentUser) {
        quickAddOvertime(hours, 'admin');
      }
    });
  });
  
  // Quick add custom button - opens form (admin view)
  const adminQuickAddCustomBtn = document.getElementById('adminQuickAddCustomBtn');
  if (adminQuickAddCustomBtn) {
    adminQuickAddCustomBtn.addEventListener('click', () => {
      const adminAddLogForm = document.getElementById('adminAddLogForm');
      if (adminAddLogForm) {
        adminAddLogForm.classList.remove('hidden');
        document.getElementById('adminLogHours')?.focus();
      }
    });
  }
  
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
  if (userDateFilters && !userDateFilters.hasAttribute('data-listener-attached')) {
    userDateFilters.setAttribute('data-listener-attached', 'true');
    
    // Set default active filter
    const defaultFilter = userDateFilters.querySelector('[data-filter="all"]');
    if (defaultFilter) defaultFilter.classList.add('active');
    
    userDateFilters.querySelectorAll('.date-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        userDateFilters.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDateFilter = btn.dataset.filter;
        filterUserLogs();
        console.log('Date filter changed to:', currentDateFilter);
      });
    });
  }
  
  // Sort toggle - user view
  const userSortToggle = document.getElementById('userSortToggle');
  if (userSortToggle && !userSortToggle.hasAttribute('data-listener-attached')) {
    userSortToggle.setAttribute('data-listener-attached', 'true');
    userSortToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      updateSortButton('user');
      filterUserLogs();
      console.log('Sort order changed to:', sortOrder);
    });
  }
  
  // Date filters - admin view
  const adminDateFilters = document.getElementById('adminDateFilters');
  if (adminDateFilters && !adminDateFilters.hasAttribute('data-listener-attached')) {
    adminDateFilters.setAttribute('data-listener-attached', 'true');
    adminDateFilters.querySelectorAll('.date-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
  if (adminSortToggle && !adminSortToggle.hasAttribute('data-listener-attached')) {
    adminSortToggle.setAttribute('data-listener-attached', 'true');
    adminSortToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
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
  
  // Edit log modal
  const editLogForm = document.getElementById('editLogForm');
  const editLogCancelBtn = document.getElementById('editLogCancelBtn');
  if (editLogForm) {
    editLogForm.addEventListener('submit', handleEditLog);
  }
  if (editLogCancelBtn) {
    editLogCancelBtn.addEventListener('click', hideEditLogModal);
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
  
  // User form cancel button
  const addLogForm = document.getElementById('addLogForm');
  const cancelFormBtn = document.getElementById('cancelFormBtn');
  
  if (cancelFormBtn && addLogForm) {
    cancelFormBtn.addEventListener('click', () => {
      addLogForm.classList.add('hidden');
      resetForm();
    });
  }
  
  // Admin form cancel button
  const adminAddLogForm = document.getElementById('adminAddLogForm');
  const adminCancelFormBtn = document.getElementById('adminCancelFormBtn');
  
  if (adminCancelFormBtn && adminAddLogForm) {
    adminCancelFormBtn.addEventListener('click', () => {
      adminAddLogForm.classList.add('hidden');
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
  
  
  
  // Search input for user view with debounce for performance
  const userSearchInput = document.getElementById('userSearchInput');
  if (userSearchInput) {
    let searchTimeout = null;
    userSearchInput.addEventListener('input', () => {
      // Debounce search for better performance
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const searchTerm = userSearchInput.value.toLowerCase();
        if (searchTerm) {
          filteredLogs = currentLogs.filter(log => 
            (log.comment && log.comment.toLowerCase().includes(searchTerm)) ||
            formatDate(log.date).toLowerCase().includes(searchTerm)
          );
        } else {
          filteredLogs = filterLogsByDate(currentLogs, currentDateFilter);
        }
        renderUserLogs();
      }, 150); // 150ms debounce
    });
  }
  
  // Search input for admin view with debounce for performance
  const adminSearchInput = document.getElementById('adminSearchInput');
  if (adminSearchInput) {
    let adminSearchTimeout = null;
    adminSearchInput.addEventListener('input', () => {
      // Debounce search for better performance
      if (adminSearchTimeout) clearTimeout(adminSearchTimeout);
      adminSearchTimeout = setTimeout(() => {
        const searchTerm = adminSearchInput.value;
        const selectedCard = document.querySelector('.user-card.selected');
        const selectedEmail = selectedCard ? selectedCard.dataset.email : null;
        filterAdminLogs(searchTerm, selectedEmail);
      }, 150); // 150ms debounce
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
      hideDeleteModal();
      hideEditNameModal();
      hideDeleteUserModal();
      hideEditLogModal();
    }
  });
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
      return `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}`;
    }
    return dateString;
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
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
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  return logs.filter(log => {
    // Parse date string as local date to avoid timezone issues
    const dateStr = log.date.split('T')[0];
    const parts = dateStr.split('-');
    const logDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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
  
  // Calculate totals
  const totalOvertime = currentLogs
    .filter(log => log.type === 'overtime')
    .reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0);
  const totalTimeOff = currentLogs
    .filter(log => log.type === 'timeoff')
    .reduce((sum, log) => sum + Math.abs(parseFloat(log.creditedHours) || 0), 0);
  
  document.getElementById('userBalance').textContent = balance.toFixed(1) + ' hrs';
  document.getElementById('userBalance').className = 'balance-value ' + 
    (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero');
  
  // Update statistics
  const overtimeEl = document.getElementById('userTotalOvertime');
  const timeOffEl = document.getElementById('userTotalTimeOff');
  if (overtimeEl) overtimeEl.textContent = '+' + totalOvertime.toFixed(1) + ' hrs';
  if (timeOffEl) timeOffEl.textContent = '-' + totalTimeOff.toFixed(1) + ' hrs';
  
  // Render stats chart
  renderStatsChart();
  
  // Apply date filter
  filteredLogs = filterLogsByDate(currentLogs, currentDateFilter);
  renderUserLogs();
}

// Quick add overtime entry
async function quickAddOvertime(hours, source = 'user') {
  if (!currentUser) return;
  
  const today = new Date().toISOString().split('T')[0];
  
  // Get comment from input field (user or admin)
  const commentInputId = source === 'admin' ? 'adminQuickAddComment' : 'quickAddComment';
  const commentInput = document.getElementById(commentInputId);
  const comment = commentInput?.value.trim() || 'Quick add';
  
  // Optimistic update
  const creditedHours = hours * currentMultiplier;
  const tempLog = {
    id: 'temp-' + Date.now(),
    userEmail: currentUser.email,
    date: today,
    type: 'overtime',
    factHours: hours,
    creditedHours: creditedHours,
    comment: comment,
    approvedBy: ''
  };
  
  currentLogs.push(tempLog);
  
  // Render correct view based on user role
  if (currentUser.role === 'admin') {
    renderAdminView();
  } else {
    renderUserView();
  }
  
  // Clear the comment input after adding
  if (commentInput) {
    commentInput.value = '';
  }
  
  // Save to Supabase
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .insert([{
        user_email: currentUser.email,
        date: today,
        type: 'overtime',
        fact_hours: hours,
        credited_hours: creditedHours,
        comment: comment,
        approved_by: ''
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Remove temp and reload
    currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
    await loadData();
    showToast(`+${hours} hour${hours > 1 ? 's' : ''} overtime added!`, 'success');
  } catch (error) {
    // Rollback
    currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
    console.error('Quick add error:', error);
    showToast('Error adding entry: ' + error.message, 'error', 'Error');
  }
}

// Render statistics chart for last 30 days
function renderStatsChart() {
  const chartContainer = document.getElementById('statsChart');
  if (!chartContainer) return;
  
  // Use local dates to avoid timezone issues
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of day
  
  // Get logs for last 30 days
  const recentLogs = currentLogs.filter(log => {
    // Parse date string to local date
    const dateStr = log.date.split('T')[0];
    const parts = dateStr.split('-');
    const logDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    logDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone edge cases
    return logDate >= thirtyDaysAgo && logDate <= now;
  });
  
  // Group by date
  const dailyData = {};
  for (let i = 0; i <= 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - 30 + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    dailyData[dateStr] = { overtime: 0, timeoff: 0, net: 0 };
  }
  
  recentLogs.forEach(log => {
    const dateStr = log.date.split('T')[0];
    if (dailyData[dateStr]) {
      const credited = parseFloat(log.creditedHours) || 0;
      if (log.type === 'overtime') {
        dailyData[dateStr].overtime += credited;
      } else {
        dailyData[dateStr].timeoff += Math.abs(credited);
      }
      dailyData[dateStr].net += credited;
    }
  });
  
  // Find max value for scaling (consider both overtime and timeoff separately)
  const maxOvertime = Math.max(...Object.values(dailyData).map(d => d.overtime), 1);
  const maxTimeoff = Math.max(...Object.values(dailyData).map(d => d.timeoff), 1);
  const maxValue = Math.max(maxOvertime, maxTimeoff, 1);
  
  // Calculate totals
  let totalOvertime = 0;
  let totalTimeoff = 0;
  Object.values(dailyData).forEach(d => {
    totalOvertime += d.overtime;
    totalTimeoff += d.timeoff;
  });
  const netChange = totalOvertime - totalTimeoff;
  
  // Update summary
  const overtimeEl = document.getElementById('statsTotalOvertime');
  const timeoffEl = document.getElementById('statsTotalTimeoff');
  const netEl = document.getElementById('statsNetChange');
  
  if (overtimeEl) overtimeEl.textContent = `+${totalOvertime.toFixed(1)} hrs`;
  if (timeoffEl) timeoffEl.textContent = `-${totalTimeoff.toFixed(1)} hrs`;
  if (netEl) {
    netEl.textContent = `${netChange >= 0 ? '+' : ''}${netChange.toFixed(1)} hrs`;
    netEl.className = `stats-value ${netChange > 0 ? 'positive' : netChange < 0 ? 'negative' : ''}`;
  }
  
  // Render stacked bars showing both overtime and time off
  const bars = Object.entries(dailyData).map(([date, data]) => {
    const overtimeHeight = Math.max((data.overtime / maxValue) * 100, 0);
    const timeoffHeight = Math.max((data.timeoff / maxValue) * 100, 0);
    const dateObj = new Date(date);
    const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    let tooltipParts = [dateLabel];
    if (data.overtime > 0) tooltipParts.push(`Overtime: +${data.overtime.toFixed(1)}h`);
    if (data.timeoff > 0) tooltipParts.push(`Time Off: -${data.timeoff.toFixed(1)}h`);
    if (data.overtime === 0 && data.timeoff === 0) tooltipParts.push('No entries');
    const tooltip = tooltipParts.join(' | ');
    
    // Stacked bar: overtime (green) on top of time off (orange)
    if (data.overtime > 0 || data.timeoff > 0) {
      return `<div class="stats-bar-container" data-tooltip="${tooltip}">
        ${data.overtime > 0 ? `<div class="stats-bar-segment positive" style="height: ${overtimeHeight}%"></div>` : ''}
        ${data.timeoff > 0 ? `<div class="stats-bar-segment negative" style="height: ${timeoffHeight}%"></div>` : ''}
      </div>`;
    } else {
      return `<div class="stats-bar-container" data-tooltip="${tooltip}">
        <div class="stats-bar-segment zero" style="height: 4%"></div>
      </div>`;
    }
  }).join('');
  
  chartContainer.innerHTML = bars;
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
  // Secondary sort by ID when dates are equal (ensures consistent ordering)
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const dateCompare = dateA.getTime() - dateB.getTime();
    
    // If dates are equal, sort by ID (newer entries have higher IDs)
    if (dateCompare === 0) {
      if (sortOrder === 'asc') {
        return (a.id || 0) - (b.id || 0); // Older first (lower ID first)
      } else {
        return (b.id || 0) - (a.id || 0); // Newer first (higher ID first)
      }
    }
    
    if (sortOrder === 'asc') {
      return dateCompare; // Ascending order (oldest first)
    } else {
      return -dateCompare; // Descending order (newest first)
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
        <div class="log-item-right">
          <div class="log-credited ${credited > 0 ? 'positive' : 'negative'}">
            ${credited > 0 ? '+' : ''}${credited} hrs
          </div>
          <div class="log-actions">
            <button class="log-action-btn log-edit-btn" onclick="showEditLogModal(${log.id})" title="Edit entry">
              ✏️
            </button>
            <button class="log-action-btn log-delete-btn" onclick="showDeleteModal(${log.id})" title="Delete entry">
              🗑️
            </button>
          </div>
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
  
  // Calculate totals for admin's personal logs
  const totalOvertime = adminLogs
    .filter(log => log.type === 'overtime')
    .reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0);
  const totalTimeOff = adminLogs
    .filter(log => log.type === 'timeoff')
    .reduce((sum, log) => sum + Math.abs(parseFloat(log.creditedHours) || 0), 0);
  
  document.getElementById('adminBalance').textContent = adminBalance.toFixed(1) + ' hrs';
  document.getElementById('adminBalance').className = 'balance-value ' + 
    (adminBalance > 0 ? 'positive' : adminBalance < 0 ? 'negative' : 'zero');
  
  // Update statistics
  const overtimeEl = document.getElementById('adminTotalOvertime');
  const timeOffEl = document.getElementById('adminTotalTimeOff');
  if (overtimeEl) overtimeEl.textContent = '+' + totalOvertime.toFixed(1) + ' hrs';
  if (timeOffEl) timeOffEl.textContent = '-' + totalTimeOff.toFixed(1) + ' hrs';
  
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
        filterAdminLogs(searchTerm, email);
      } else {
        document.getElementById('historyTitle').textContent = 'All Records';
        filterAdminLogs(searchTerm, null);
      }
    });
  });
}

function renderAdminLogs() {
  const container = document.getElementById('adminLogsBody');
  
  let logsToShow = filteredLogs;
  
  // Sort by date - handle ISO format dates
  // Secondary sort by ID when dates are equal (ensures consistent ordering)
  logsToShow = [...logsToShow].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const dateCompare = dateA.getTime() - dateB.getTime();
    
    // If dates are equal, sort by ID (newer entries have higher IDs)
    if (dateCompare === 0) {
      if (sortOrder === 'asc') {
        return (a.id || 0) - (b.id || 0); // Older first (lower ID first)
      } else {
        return (b.id || 0) - (a.id || 0); // Newer first (higher ID first)
      }
    }
    
    if (sortOrder === 'asc') {
      return dateCompare; // Ascending order (oldest first)
    } else {
      return -dateCompare; // Descending order (newest first)
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
        <button class="table-action-btn table-edit-btn" onclick="showEditLogModal(${log.id})" title="Edit">
          ✏️
        </button>
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

// Delete log entry - immediate deletion with undo option
async function handleDeleteLog(logId) {
  // Find log to delete
  const logToDelete = currentLogs.find(log => log.id == logId);
  if (!logToDelete) return;
  
  // Remove from UI immediately (optimistic)
  currentLogs = currentLogs.filter(log => log.id != logId);
  
  // Update UI immediately
  if (currentUser.role === 'admin') {
    renderAdminView();
  } else {
    renderUserView();
  }
  
  // Delete from Supabase immediately
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    currentLogs.push(logToDelete);
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('logs')
      .delete()
      .eq('id', logId);
    
    if (error) throw error;
    
    // Show success toast with undo option
    const undoHandler = async () => {
      try {
        // Re-insert the deleted entry
        const { data, error: insertError } = await supabaseClient
          .from('logs')
          .insert([{
            user_email: logToDelete.userEmail,
            date: logToDelete.date,
            type: logToDelete.type,
            fact_hours: logToDelete.factHours,
            credited_hours: logToDelete.creditedHours,
            comment: logToDelete.comment || '',
            approved_by: logToDelete.approvedBy || ''
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        // Update local state with new ID
        const restoredLog = {
          id: data.id,
          userEmail: data.user_email,
          date: data.date,
          type: data.type,
          factHours: data.fact_hours,
          creditedHours: data.credited_hours,
          comment: data.comment,
          approvedBy: data.approved_by
        };
        
        currentLogs.push(restoredLog);
        
        // Update UI
        if (currentUser.role === 'admin') {
          renderAdminView();
        } else {
          renderUserView();
        }
        
        showToast('Entry restored', 'info');
      } catch (restoreError) {
        console.error('Error restoring entry:', restoreError);
        showToast('Could not restore entry: ' + restoreError.message, 'error');
      }
    };
    
    showToast('Entry deleted', 'success', '', { 
      onUndo: undoHandler,
      timeout: 5000
    });
    
  } catch (error) {
    // Rollback on error
    console.error('Delete error:', error);
    currentLogs.push(logToDelete);
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
    showToast('Error deleting: ' + error.message, 'error', 'Error');
  }
}

// Edit log entry
async function handleEditLog(e) {
  e.preventDefault();
  
  if (!editLogId) return;
  
  const log = currentLogs.find(l => l.id == editLogId);
  if (!log) {
    hideEditLogModal();
    return;
  }
  
  const newDate = document.getElementById('editLogDate').value;
  const newComment = document.getElementById('editLogComment').value.trim();
  const newApprovedBy = log.type === 'timeoff' 
    ? document.getElementById('editLogApprovedBy').value.trim() 
    : '';
  
  // Validation
  if (!newDate) {
    showToast('Please select a date', 'warning');
    return;
  }
  
  // Check if anything changed
  const oldDateStr = log.date.split('T')[0];
  if (newDate === oldDateStr && newComment === (log.comment || '') && newApprovedBy === (log.approvedBy || '')) {
    hideEditLogModal();
    return;
  }
  
  // Store old values for rollback
  const oldDate = log.date;
  const oldComment = log.comment;
  const oldApprovedBy = log.approvedBy;
  
  // Optimistic update
  log.date = newDate;
  log.comment = newComment;
  log.approvedBy = newApprovedBy;
  
  // Update UI immediately
  if (currentUser.role === 'admin') {
    renderAdminView();
  } else {
    renderUserView();
  }
  
  hideEditLogModal();
  
  // Save to Supabase
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('logs')
      .update({
        date: newDate,
        comment: newComment,
        approved_by: newApprovedBy
      })
      .eq('id', editLogId);
    
    if (error) throw error;
    
    showToast('Entry updated', 'success');
  } catch (error) {
    // Rollback on error
    log.date = oldDate;
    log.comment = oldComment;
    log.approvedBy = oldApprovedBy;
    
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
    
    console.error('Edit error:', error);
    showToast('Error updating entry: ' + error.message, 'error', 'Error');
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

// Export functions for global use
window.showDeleteModal = showDeleteModal;
window.showEditLogModal = showEditLogModal;
