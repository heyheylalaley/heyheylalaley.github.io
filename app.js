// Конфигурация Supabase
const CONFIG = {
  SUPABASE_URL: 'https://qwtwezxoodqfmdqpzkkl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_iW0DJWq84mfMA30kA_HDOg_Fx99JPKU',
  GOOGLE_CLIENT_ID: '821999196894-20d8semsbtdp3dcpu4qf2p1h0u4okb39.apps.googleusercontent.com'
};

// Инициализация Supabase клиента
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// Глобальное состояние
let currentUser = null;
let currentLogs = [];
let currentUsers = [];
let currentMultiplier = 1.5;
let deleteLogId = null; // For delete modal
let filteredLogs = []; // For search functionality
let currentDateFilter = 'all'; // Current date filter (all, today, week, month)

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  initializeGoogleSignIn();
  setupEventListeners();
  setupAuthListener();
  checkSupabaseSession();
});

// Настройка слушателя изменений авторизации
function setupAuthListener() {
  if (!supabaseClient) return;
  
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session);
    
    if (event === 'SIGNED_IN' && session) {
      // Пользователь успешно вошел
      try {
        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        if (userData && !userError) {
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
          
          // Убираем hash из URL после успешного входа
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          showToast('User not found in database. Contact administrator.', 'error', 'Login Error');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data', 'error');
      }
    } else if (event === 'SIGNED_OUT') {
      // Пользователь вышел
      currentUser = null;
      currentLogs = [];
      currentUsers = [];
      localStorage.removeItem('user');
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
    }
  });
}

// Проверка сессии Supabase
async function checkSupabaseSession() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    return;
  }
  
  try {
    // Проверяем существующую сессию
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && !error) {
      // Получаем информацию о пользователе из таблицы users
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      
      if (userData && !userError) {
        currentUser = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        showMainApp();
        loadData();
      }
    }
    
    // Обработка OAuth callback (если есть hash в URL с токеном)
    // Supabase автоматически обрабатывает токен из hash при вызове getSession()
    if (window.location.hash && window.location.hash.includes('access_token')) {
      // Подождем немного, чтобы Supabase обработал токен
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Проверим сессию снова после обработки токена
      const { data: { session: newSession }, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (newSession && !sessionError && !currentUser) {
        // Сессия установлена, но пользователь еще не загружен
        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('email', newSession.user.email)
          .single();
        
        if (userData && !userError) {
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
          showToast('User not found in database. Contact administrator.', 'error', 'Login Error');
        }
        
        // Убираем hash из URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (window.location.hash === '#' && !currentUser) {
      // Если hash пустой (#), но сессия может быть установлена после OAuth
      // Проверим сессию еще раз
      await new Promise(resolve => setTimeout(resolve, 300));
      const { data: { session: finalSession }, error: finalError } = await supabaseClient.auth.getSession();
      
      if (finalSession && !finalError) {
        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('email', finalSession.user.email)
          .single();
        
        if (userData && !userError) {
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
          
          // Убираем hash из URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  } catch (error) {
    console.error('Session check error:', error);
    // Проверяем сохранённую сессию как fallback
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        showMainApp();
        loadData();
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }
}

// Инициализация Google Sign-In через Supabase OAuth
function initializeGoogleSignIn() {
  // Создаем кнопку для Supabase OAuth
  const buttonContainer = document.getElementById('googleSignInButton');
  if (buttonContainer) {
    buttonContainer.innerHTML = `
      <button id="supabaseGoogleSignIn" class="google-signin-btn" style="
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
    
    document.getElementById('supabaseGoogleSignIn').addEventListener('click', handleGoogleSignIn);
  }
}

// Обработка авторизации через Google OAuth (Supabase)
async function handleGoogleSignIn() {
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  showLoading();
  try {
    // Используем Google OAuth через Supabase
    // Используем явный URL вместо window.location.origin для избежания проблем с парсингом
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
    
    // Перенаправление на Google OAuth
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    console.error('Authorization error:', error);
    showToast(error.message || 'Authorization error', 'error', 'Login Error');
    hideLoading();
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

function showMultiplierModal() {
  const modal = document.getElementById('multiplierModal');
  const input = document.getElementById('multiplierInput');
  if (modal && input) {
    input.value = currentMultiplier;
    modal.classList.remove('hidden');
    input.focus();
    input.select();
  }
}

function hideMultiplierModal() {
  const modal = document.getElementById('multiplierModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Setup event listeners
function setupEventListeners() {
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
  
  // Multiplier modal
  const multiplierConfirmBtn = document.getElementById('multiplierConfirmBtn');
  const multiplierCancelBtn = document.getElementById('multiplierCancelBtn');
  if (multiplierConfirmBtn) {
    multiplierConfirmBtn.addEventListener('click', () => {
      const input = document.getElementById('multiplierInput');
      if (input && input.value) {
        const multiplier = parseFloat(input.value);
        if (!isNaN(multiplier) && multiplier > 0) {
          handleUpdateMultiplier(multiplier);
          hideMultiplierModal();
        } else {
          showToast('Please enter a valid number', 'error');
        }
      }
    });
  }
  if (multiplierCancelBtn) {
    multiplierCancelBtn.addEventListener('click', hideMultiplierModal);
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
      // resetAdminForm(); // Функция не реализована, так как админ форма не используется
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
      // Игнорируем ошибку, если поле не поддерживает valueAsDate
    }
  }
  if (adminLogDate) {
    try {
      adminLogDate.valueAsDate = new Date();
    } catch (e) {
      // Игнорируем ошибку, если поле не поддерживает valueAsDate
    }
  }
  
  // Form submission (addLogForm уже объявлена выше)
  if (addLogForm) addLogForm.addEventListener('submit', handleAddLog);
  
  // Admin buttons
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', showMultiplierModal);
  
  // Export buttons
  const userExportBtn = document.getElementById('userExportBtn');
  if (userExportBtn) userExportBtn.addEventListener('click', handleUserExport);
  
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

// Загрузка логов пользователя
async function loadUserLogs() {
  if (!supabaseClient) throw new Error('Supabase client not initialized');
  
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('user_email', currentUser.email)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Преобразуем формат данных для совместимости
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

// Загрузка всех логов (админ)
async function loadAllLogs() {
  if (!supabaseClient) throw new Error('Supabase client not initialized');
  
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Преобразуем формат данных для совместимости
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

// Загрузка пользователей (админ)
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

// Загрузка настроек
async function loadSettings() {
  if (!supabaseClient) {
    // Используем значение по умолчанию
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
      const multiplierDisplay = document.getElementById('multiplierDisplay');
      const userMultiplier = document.getElementById('userMultiplier');
      if (multiplierDisplay) multiplierDisplay.textContent = currentMultiplier;
      if (userMultiplier) userMultiplier.textContent = currentMultiplier;
    }
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
  
  // Sort by date (newest first) - handle ISO format dates
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
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
      </div>
    `;
  }).join('');
  
  // Click handlers for user cards
  container.querySelectorAll('.user-card').forEach(card => {
    card.addEventListener('click', () => {
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
  
  // Sort by date (newest first) - handle ISO format dates
  logsToShow = [...logsToShow].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
  });
  
  if (logsToShow.length === 0) {
    const allLogsCount = currentLogs.length;
    container.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          ${allLogsCount === 0 
            ? '<div class="empty-state-icon">📋</div><div class="empty-state-title">Нет записей</div><div class="empty-state-description">Записи о переработках и отгулах появятся здесь</div>'
            : '<div class="empty-state-icon">🔍</div><div class="empty-state-title">Ничего не найдено</div><div class="empty-state-description">Попробуйте изменить фильтры или поисковый запрос</div>'
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
  
  const dateObj = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (dateObj > today) {
    showToast('Cannot select future date', 'warning');
    return;
  }
  
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
  const formEl = document.getElementById('addLogForm');
  const toggleEl = document.getElementById('addFormToggle');
  if (formEl) {
    formEl.style.opacity = '0';
    formEl.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      resetForm();
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

// Update multiplier with optimistic update
async function handleUpdateMultiplier(multiplier) {
  if (!multiplier) return;
  
  if (isNaN(multiplier) || multiplier <= 0) {
    showToast('Invalid value', 'error');
    return;
  }
  
  // Optimistic update - update UI immediately
  const oldMultiplier = currentMultiplier;
  currentMultiplier = multiplier;
  document.getElementById('multiplierDisplay').textContent = multiplier;
  if (document.getElementById('userMultiplier')) {
    document.getElementById('userMultiplier').textContent = multiplier;
  }
  if (document.getElementById('adminMultiplier')) {
    document.getElementById('adminMultiplier').textContent = multiplier;
  }
  
  // Save to Supabase in background
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('settings')
      .upsert({ key: 'overtimeMultiplier', value: multiplier.toString() }, { onConflict: 'key' });
    
    if (error) throw error;
    
    showToast('Multiplier successfully updated', 'success');
  } catch (error) {
    // Rollback on error
    currentMultiplier = oldMultiplier;
    const multiplierDisplay = document.getElementById('multiplierDisplay');
    const userMultiplier = document.getElementById('userMultiplier');
    const adminMultiplier = document.getElementById('adminMultiplier');
    if (multiplierDisplay) multiplierDisplay.textContent = oldMultiplier;
    if (userMultiplier) userMultiplier.textContent = oldMultiplier;
    if (adminMultiplier) adminMultiplier.textContent = oldMultiplier;
    console.error('Update error:', error);
    showToast('Error updating: ' + error.message, 'error', 'Error');
  }
}

// Admin export (with user selection)
async function handleAdminExport() {
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const selectedCard = document.querySelector('.user-card.selected');
    const email = selectedCard ? selectedCard.dataset.email : null;
    
    // Получаем логи
    let logsQuery = supabaseClient
      .from('logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (email) {
      logsQuery = logsQuery.eq('user_email', email);
    }
    
    const { data: logsData, error: logsError } = await logsQuery;
    if (logsError) throw logsError;
    
    // Получаем всех пользователей для маппинга
    const { data: usersData, error: usersError } = await supabaseClient
      .from('users')
      .select('*');
    
    if (usersError) throw usersError;
    
    // Создаем маппинг email -> user
    const usersMap = {};
    (usersData || []).forEach(user => {
      usersMap[user.email] = user;
    });
    
    // Формируем CSV
    let csv = 'Date,Employee,Email,Type,Actual (hrs),Credited,Comment\n';
    
    (logsData || []).forEach(log => {
      const dateObj = new Date(log.date);
      const formattedDate = dateObj.getDate().toString().padStart(2, '0') + '-' + 
                           (dateObj.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                           dateObj.getFullYear();
      
      const user = usersMap[log.user_email];
      const userName = user ? user.name : log.user_email;
      const userEmail = log.user_email;
      
      csv += `"${formattedDate}","${userName}","${userEmail}","${log.type === 'overtime' ? 'Overtime' : 'Time Off'}","${log.fact_hours}","${log.credited_hours}","${log.comment || ''}"\n`;
    });
    
    // Создаем и скачиваем файл
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', email ? `overtime_report_${email.replace('@', '_at_')}.csv` : 'overtime_report_all.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Export completed', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Error exporting: ' + error.message, 'error', 'Error');
  }
}

// User export
async function handleUserExport() {
  if (!supabaseClient) {
    showToast('Supabase client not initialized', 'error', 'Error');
    return;
  }
  
  try {
    const { data: logsData, error: logsError } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('user_email', currentUser.email)
      .order('date', { ascending: false });
    
    if (logsError) throw logsError;
    
    // Формируем CSV
    let csv = 'Date,Employee,Email,Type,Actual (hrs),Credited,Comment\n';
    
    (logsData || []).forEach(log => {
      const dateObj = new Date(log.date);
      const formattedDate = dateObj.getDate().toString().padStart(2, '0') + '-' + 
                           (dateObj.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                           dateObj.getFullYear();
      
      const userName = currentUser.name;
      const userEmail = currentUser.email;
      
      csv += `"${formattedDate}","${userName}","${userEmail}","${log.type === 'overtime' ? 'Overtime' : 'Time Off'}","${log.fact_hours}","${log.credited_hours}","${log.comment || ''}"\n`;
    });
    
    // Создаем и скачиваем файл
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `overtime_report_${currentUser.email.replace('@', '_at_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Export completed', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Error exporting: ' + error.message, 'error', 'Error');
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
  
  if (dateInput) dateInput.valueAsDate = new Date();
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

// Выход
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
