// Конфигурация - ЗАМЕНИТЕ НА СВОИ ЗНАЧЕНИЯ
const CONFIG = {
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbwPN7R5be2PX35bbtPT8800UbkaYVo86UVJF9v_2qI2xUZrw1vMOCCWyedXB7L7jUFY/exec',
  GOOGLE_CLIENT_ID: '821999196894-20d8semsbtdp3dcpu4qf2p1h0u4okb39.apps.googleusercontent.com'
};

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
  
  // Проверка сохранённой сессии
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
});

// Инициализация Google Sign-In
function initializeGoogleSignIn() {
  window.onload = function() {
    if (window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
      });
      
      google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        { theme: 'outline', size: 'large', text: 'signin_with', locale: 'en' }
      );
    }
  };
}

// Обработка авторизации
async function handleCredentialResponse(response) {
  showLoading();
  try {
    // Используем FormData для совместимости с Google Apps Script
    // action передаём в URL, данные в FormData
    const formData = new FormData();
    formData.append('token', response.credential);
    
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=login`, {
      method: 'POST',
      body: formData,
      redirect: 'follow'
    });
    
    // Проверка статуса ответа
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const text = await res.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', text);
      throw new Error('Server returned invalid response. Check Google Apps Script settings.');
    }
    
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
      showMainApp();
      loadData();
      showToast('Login successful', 'success');
    } else {
      showToast(data.message || 'Authorization error', 'error', 'Login Error');
    }
  } catch (error) {
    console.error('Authorization error:', error);
    const errorMessage = error.message || 'Unknown error';
    showToast(`Connection error. Check CONFIG.GAS_API_URL settings`, 'error', 'Connection Error');
  }
  hideLoading();
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
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
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
  document.getElementById('addFormToggle').addEventListener('click', () => {
    document.getElementById('addLogForm').classList.remove('hidden');
    document.getElementById('addFormToggle').classList.add('hidden');
  });
  
  document.getElementById('cancelFormBtn').addEventListener('click', () => {
    document.getElementById('addLogForm').classList.add('hidden');
    document.getElementById('addFormToggle').classList.remove('hidden');
    resetForm();
  });
  
  // Admin form
  document.getElementById('adminAddFormToggle').addEventListener('click', () => {
    document.getElementById('adminAddLogForm').classList.remove('hidden');
    document.getElementById('adminAddFormToggle').classList.add('hidden');
  });
  
  document.getElementById('adminCancelFormBtn').addEventListener('click', () => {
    document.getElementById('adminAddLogForm').classList.add('hidden');
    document.getElementById('adminAddFormToggle').classList.remove('hidden');
    resetAdminForm();
  });
  
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
  if (logDate) logDate.valueAsDate = new Date();
  if (adminLogDate) adminLogDate.valueAsDate = new Date();
  
  // Form submission
  const addLogForm = document.getElementById('addLogForm');
  if (addLogForm) addLogForm.addEventListener('submit', handleAddLog);
  
  // Admin buttons
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', showMultiplierModal);
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
  try {
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=getLogs&email=${encodeURIComponent(currentUser.email)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);
    if (data.success) {
      currentLogs = data.logs || [];
    } else {
      console.error('Logs loading error:', data.message);
    }
  } catch (error) {
    console.error('Logs loading error:', error);
    throw error;
  }
}

// Загрузка всех логов (админ)
async function loadAllLogs() {
  try {
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=getAllLogs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);
    if (data.success) {
      currentLogs = data.logs || [];
    } else {
      console.error('All logs loading error:', data.message);
    }
  } catch (error) {
    console.error('All logs loading error:', error);
    throw error;
  }
}

// Загрузка пользователей (админ)
async function loadUsers() {
  try {
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=getUsers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);
    if (data.success) {
      currentUsers = data.users || [];
    } else {
      console.error('Users loading error:', data.message);
    }
  } catch (error) {
    console.error('Users loading error:', error);
    throw error;
  }
}

// Загрузка настроек
async function loadSettings() {
  try {
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=getSettings`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);
    if (data.success && data.settings) {
      currentMultiplier = parseFloat(data.settings.overtimeMultiplier) || 1.5;
      document.getElementById('multiplierDisplay').textContent = currentMultiplier;
      document.getElementById('userMultiplier').textContent = currentMultiplier;
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
  
  // Save to server in background
  try {
    const formData = new FormData();
    formData.append('userEmail', userEmail);
    formData.append('date', date);
    formData.append('type', type);
    formData.append('factHours', factHours.toString());
    formData.append('creditedHours', creditedHours.toString());
    formData.append('comment', comment);
    if (approvedBy) {
      formData.append('approvedBy', approvedBy);
    }
    
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=addLog`, {
      method: 'POST',
      body: formData,
      redirect: 'follow'
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', text);
      throw new Error('Server returned invalid response');
    }
    
    if (data.success) {
      // Remove temp entry and reload real data
      currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
      await loadData();
      showToast('Entry successfully added', 'success');
    } else {
      // Rollback on error
      currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
      if (currentUser.role === 'admin') {
        renderAdminView();
      } else {
        renderUserView();
      }
      showToast(data.message || 'Error saving', 'error', 'Error');
    }
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
  
  // Delete from server in background
  try {
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=deleteLog&id=${logId}`, {
      method: 'POST',
      redirect: 'follow'
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', text);
      throw new Error('Server returned invalid response');
    }
    
    if (!data.success) {
      // Rollback on error
      if (logToDelete) {
        currentLogs.push(logToDelete);
        if (currentUser.role === 'admin') {
          renderAdminView();
        } else {
          renderUserView();
        }
      }
      showToast(data.message || 'Error deleting', 'error', 'Error');
    } else {
      showToast('Entry successfully deleted', 'success');
    }
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
  
  // Save to server in background
  try {
    const formData = new FormData();
    formData.append('overtimeMultiplier', multiplier.toString());
    
    const res = await fetch(`${CONFIG.GAS_API_URL}?action=updateSettings`, {
      method: 'POST',
      body: formData,
      redirect: 'follow'
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', text);
      throw new Error('Server returned invalid response');
    }
    
    if (!data.success) {
      // Rollback on error
      currentMultiplier = oldMultiplier;
      document.getElementById('multiplierDisplay').textContent = oldMultiplier;
      if (document.getElementById('userMultiplier')) {
        document.getElementById('userMultiplier').textContent = oldMultiplier;
      }
      if (document.getElementById('adminMultiplier')) {
        document.getElementById('adminMultiplier').textContent = oldMultiplier;
      }
      showToast(data.message || 'Error updating', 'error', 'Error');
    } else {
      showToast('Multiplier successfully updated', 'success');
    }
  } catch (error) {
    // Rollback on error
    currentMultiplier = oldMultiplier;
    document.getElementById('multiplierDisplay').textContent = oldMultiplier;
    if (document.getElementById('userMultiplier')) {
      document.getElementById('userMultiplier').textContent = oldMultiplier;
    }
    if (document.getElementById('adminMultiplier')) {
      document.getElementById('adminMultiplier').textContent = oldMultiplier;
    }
    console.error('Update error:', error);
    showToast('Error updating: ' + error.message, 'error', 'Error');
  }
}

// Admin export (with user selection)
function handleAdminExport() {
  // Get selected user from filter
  const selectedCard = document.querySelector('.user-card.selected');
  let exportUrl = `${CONFIG.GAS_API_URL}?action=export`;
  
  if (selectedCard) {
    const email = selectedCard.dataset.email;
    if (email) {
      exportUrl += `&email=${encodeURIComponent(email)}`;
    }
  }
  
  window.open(exportUrl, '_blank');
  showToast('Экспорт начат', 'info');
}

// User export
function handleUserExport() {
  const exportUrl = `${CONFIG.GAS_API_URL}?action=export&email=${encodeURIComponent(currentUser.email)}`;
  window.open(exportUrl, '_blank');
  showToast('Экспорт начат', 'info');
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
function logout() {
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
