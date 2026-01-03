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
    } else {
      alert('Authorization error: ' + (data.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('Authorization error:', error);
    const errorMessage = error.message || 'Unknown error';
    alert(`Server connection error:\n\n${errorMessage}\n\nCheck:\n1. Correctness of URL in CONFIG.GAS_API_URL\n2. That Google Apps Script is deployed as Web App\n3. That access is set to "Anyone" or "Anyone with Google account"`);
  }
  hideLoading();
}

// Setup event listeners
function setupEventListeners() {
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
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
        updateAdminCreditedPreview();
      });
    });
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
  const adminAddLogForm = document.getElementById('adminAddLogForm');
  if (addLogForm) addLogForm.addEventListener('submit', handleAddLog);
  if (adminAddLogForm) adminAddLogForm.addEventListener('submit', handleAdminAddLog);
  
  // Admin buttons
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', handleUpdateMultiplier);
}

// Show main app
function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  if (currentUser.role === 'admin') {
    document.getElementById('userView').classList.add('hidden');
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminControls').classList.remove('hidden');
    document.getElementById('headerTitle').textContent = 'Admin Panel';
    document.getElementById('headerSubtitle').textContent = currentUser.name;
  } else {
    document.getElementById('userView').classList.remove('hidden');
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('adminControls').classList.add('hidden');
    document.getElementById('headerTitle').textContent = 'Overtime Tracker';
    document.getElementById('headerSubtitle').textContent = currentUser.name;
  }
}

// Загрузка данных
async function loadData() {
  showLoading();
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
    alert('Data loading error');
  }
  hideLoading();
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

// Render user view
function renderUserView() {
  const balance = calculateBalance(currentLogs);
  document.getElementById('userBalance').textContent = balance.toFixed(1) + ' hrs';
  document.getElementById('userBalance').className = 'balance-value ' + 
    (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero');
  
  renderUserLogs();
}

function renderUserLogs() {
  const container = document.getElementById('userLogs');
  
  if (currentLogs.length === 0) {
    container.innerHTML = '<div class="empty-state">No records yet</div>';
    return;
  }
  
  // Sort by date (newest first) - handle ISO format dates
  const sortedLogs = [...currentLogs].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
  });
  
  container.innerHTML = sortedLogs.map(log => {
    const credited = parseFloat(log.creditedHours) || 0;
    return `
      <div class="log-item">
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
        </div>
        <div class="log-credited ${credited > 0 ? 'positive' : 'negative'}">
          ${credited > 0 ? '+' : ''}${credited} hrs
        </div>
      </div>
    `;
  }).join('');
}

// Render admin view
function renderAdminView() {
  // Render admin's personal balance
  const adminLogs = currentLogs.filter(log => log.userEmail === currentUser.email);
  const adminBalance = calculateBalance(adminLogs);
  document.getElementById('adminBalance').textContent = adminBalance.toFixed(1) + ' hrs';
  document.getElementById('adminBalance').className = 'balance-value ' + 
    (adminBalance > 0 ? 'positive' : adminBalance < 0 ? 'negative' : 'zero');
  
  if (document.getElementById('adminMultiplier')) {
    document.getElementById('adminMultiplier').textContent = currentMultiplier;
  }
  
  renderUsersList();
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
      
      if (!isSelected) {
        card.classList.add('selected');
        renderAdminLogs(email);
        const userName = currentUsers.find(u => u.email === email)?.name || email;
        document.getElementById('historyTitle').textContent = `History: ${userName}`;
      } else {
        renderAdminLogs();
        document.getElementById('historyTitle').textContent = 'All Records';
      }
    });
  });
}

function renderAdminLogs(filterEmail = null) {
  const container = document.getElementById('adminLogsBody');
  
  let logsToShow = filterEmail 
    ? currentLogs.filter(log => log.userEmail === filterEmail)
    : currentLogs;
  
  // Sort by date (newest first) - handle ISO format dates
  logsToShow = [...logsToShow].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
  });
  
  if (logsToShow.length === 0) {
    container.innerHTML = '<tr><td colspan="7" class="empty-state">No records</td></tr>';
    return;
  }
  
  container.innerHTML = logsToShow.map(log => {
    const credited = parseFloat(log.creditedHours) || 0;
    const userName = currentUsers.find(u => u.email === log.userEmail)?.name || log.userEmail;
    
    return `
      <tr>
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
        <td>${escapeHtml(log.comment || '')}</td>
        <td class="text-center">
          <button class="table-action-btn" onclick="handleDeleteLog(${log.id})" title="Delete">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Add log entry (user)
async function handleAddLog(e) {
  e.preventDefault();
  
  const form = e.target;
  const type = form.querySelector('.type-btn.active').dataset.type;
  const date = document.getElementById('logDate').value;
  const hours = parseFloat(document.getElementById('logHours').value);
  const comment = document.getElementById('logComment').value;
  
  if (!hours || hours <= 0) {
    alert('Please enter a valid number of hours');
    return;
  }
  
  await saveLogEntry(currentUser.email, date, type, hours, comment, form);
}

// Add log entry (admin)
async function handleAdminAddLog(e) {
  e.preventDefault();
  
  const form = e.target;
  const type = form.querySelector('.type-btn.active').dataset.type;
  const date = document.getElementById('adminLogDate').value;
  const hours = parseFloat(document.getElementById('adminLogHours').value);
  const comment = document.getElementById('adminLogComment').value;
  
  if (!hours || hours <= 0) {
    alert('Please enter a valid number of hours');
    return;
  }
  
  await saveLogEntry(currentUser.email, date, type, hours, comment, form);
}

// Save log entry
async function saveLogEntry(userEmail, date, type, hours, comment, form) {
  showLoading();
  try {
    const factHours = hours;
    const creditedHours = type === 'overtime' 
      ? factHours * currentMultiplier 
      : -factHours;
    
    const formData = new FormData();
    formData.append('userEmail', userEmail);
    formData.append('date', date);
    formData.append('type', type);
    formData.append('factHours', factHours.toString());
    formData.append('creditedHours', creditedHours.toString());
    formData.append('comment', comment);
    
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
      if (form.id === 'addLogForm') {
        resetForm();
        document.getElementById('addLogForm').classList.add('hidden');
        document.getElementById('addFormToggle').classList.remove('hidden');
      } else {
        resetAdminForm();
        document.getElementById('adminAddLogForm').classList.add('hidden');
        document.getElementById('adminAddFormToggle').classList.remove('hidden');
      }
      loadData();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('Save error: ' + error.message);
  }
  hideLoading();
}

// Delete log entry
async function handleDeleteLog(logId) {
  if (!confirm('Delete entry?')) return;
  
  showLoading();
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
    
    if (data.success) {
      loadData();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Delete error: ' + error.message);
  }
  hideLoading();
}

// Update multiplier
async function handleUpdateMultiplier() {
  const newValue = prompt('New overtime multiplier:', currentMultiplier);
  if (!newValue) return;
  
  const multiplier = parseFloat(newValue);
  if (isNaN(multiplier) || multiplier <= 0) {
    alert('Invalid value');
    return;
  }
  
  showLoading();
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
    
    if (data.success) {
      currentMultiplier = multiplier;
      document.getElementById('multiplierDisplay').textContent = multiplier;
      if (document.getElementById('userMultiplier')) {
        document.getElementById('userMultiplier').textContent = multiplier;
      }
      if (document.getElementById('adminMultiplier')) {
        document.getElementById('adminMultiplier').textContent = multiplier;
      }
      alert('Multiplier updated');
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Update error:', error);
    alert('Update error: ' + error.message);
  }
  hideLoading();
}

// Admin export (with user selection)
function handleAdminExport() {
  const userOptions = currentUsers.map(u => `${u.email} - ${u.name}`).join('\n');
  const userInput = prompt(`Enter user email to export (leave empty for all users):\n\n${userOptions}`);
  
  let exportUrl = `${CONFIG.GAS_API_URL}?action=export`;
  if (userInput && userInput.trim()) {
    exportUrl += `&email=${encodeURIComponent(userInput.trim())}`;
  }
  
  window.open(exportUrl, '_blank');
}

// User export
function handleUserExport() {
  const exportUrl = `${CONFIG.GAS_API_URL}?action=export&email=${encodeURIComponent(currentUser.email)}`;
  window.open(exportUrl, '_blank');
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
  const form = document.getElementById('addLogForm');
  
  if (dateInput) dateInput.valueAsDate = new Date();
  if (hoursInput) hoursInput.value = '';
  if (commentInput) commentInput.value = '';
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
  const form = document.getElementById('adminAddLogForm');
  
  if (dateInput) dateInput.valueAsDate = new Date();
  if (hoursInput) hoursInput.value = '';
  if (commentInput) commentInput.value = '';
  if (form) {
    form.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    const overtimeBtn = form.querySelector('.type-btn[data-type="overtime"]');
    if (overtimeBtn) overtimeBtn.classList.add('active');
  }
  updateAdminCreditedPreview();
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

// Утилиты
function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Экспорт функции для глобального использования
window.handleDeleteLog = handleDeleteLog;
