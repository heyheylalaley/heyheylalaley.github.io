// Конфигурация - ЗАМЕНИТЕ НА СВОИ ЗНАЧЕНИЯ
const CONFIG = {
  GAS_API_URL: 'AKfycbwPN7R5be2PX35bbtPT8800UbkaYVo86UVJF9v_2qI2xUZrw1vMOCCWyedXB7L7jUFY',
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
        { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ru' }
      );
    }
  };
}

// Обработка авторизации
async function handleCredentialResponse(response) {
  showLoading();
  try {
    // Используем FormData для совместимости с Google Apps Script
    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('token', response.credential);
    
    const res = await fetch(CONFIG.GAS_API_URL, {
      method: 'POST',
      body: formData,
      // Не указываем Content-Type, браузер установит его автоматически с boundary
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
      console.error('Ошибка парсинга JSON:', text);
      throw new Error('Сервер вернул некорректный ответ. Проверьте настройки Google Apps Script.');
    }
    
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
      showMainApp();
      loadData();
    } else {
      alert('Ошибка авторизации: ' + (data.message || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    const errorMessage = error.message || 'Неизвестная ошибка';
    alert(`Ошибка подключения к серверу:\n\n${errorMessage}\n\nПроверьте:\n1. Правильность URL в CONFIG.GAS_API_URL\n2. Что Google Apps Script развёрнут как Web App\n3. Что доступ установлен на "Anyone" или "Anyone with Google account"`);
  }
  hideLoading();
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Выход
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Форма добавления записи
  document.getElementById('addFormToggle').addEventListener('click', () => {
    document.getElementById('addLogForm').classList.remove('hidden');
    document.getElementById('addFormToggle').classList.add('hidden');
  });
  
  document.getElementById('cancelFormBtn').addEventListener('click', () => {
    document.getElementById('addLogForm').classList.add('hidden');
    document.getElementById('addFormToggle').classList.remove('hidden');
    resetForm();
  });
  
  // Выбор типа записи
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateCreditedPreview();
    });
  });
  
  // Поля формы
  document.getElementById('logHours').addEventListener('input', updateCreditedPreview);
  document.getElementById('logDate').valueAsDate = new Date();
  
  // Отправка формы
  document.getElementById('addLogForm').addEventListener('submit', handleAddLog);
  
  // Админские кнопки
  document.getElementById('settingsBtn').addEventListener('click', handleUpdateMultiplier);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
}

// Показать главное приложение
function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  if (currentUser.role === 'admin') {
    document.getElementById('userView').classList.add('hidden');
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminControls').classList.remove('hidden');
    document.getElementById('headerTitle').textContent = 'Админ-панель';
    document.getElementById('headerSubtitle').textContent = currentUser.name;
  } else {
    document.getElementById('userView').classList.remove('hidden');
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('adminControls').classList.add('hidden');
    document.getElementById('headerTitle').textContent = 'Учёт переработок';
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
    console.error('Ошибка загрузки данных:', error);
    alert('Ошибка загрузки данных');
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
      console.error('Ошибка загрузки логов:', data.message);
    }
  } catch (error) {
    console.error('Ошибка загрузки логов:', error);
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
      console.error('Ошибка загрузки всех логов:', data.message);
    }
  } catch (error) {
    console.error('Ошибка загрузки всех логов:', error);
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
      console.error('Ошибка загрузки пользователей:', data.message);
    }
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
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
    console.error('Ошибка загрузки настроек:', error);
    // Не бросаем ошибку, используем значение по умолчанию
  }
}

// Расчёт баланса
function calculateBalance(logs) {
  return logs.reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0);
}

// Рендер интерфейса пользователя
function renderUserView() {
  const balance = calculateBalance(currentLogs);
  document.getElementById('userBalance').textContent = balance.toFixed(1) + ' ч';
  document.getElementById('userBalance').className = 'balance-value ' + 
    (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero');
  
  renderUserLogs();
}

function renderUserLogs() {
  const container = document.getElementById('userLogs');
  
  if (currentLogs.length === 0) {
    container.innerHTML = '<div class="empty-state">Записей пока нет</div>';
    return;
  }
  
  // Сортировка по дате (новые сверху)
  const sortedLogs = [...currentLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  container.innerHTML = sortedLogs.map(log => {
    const credited = parseFloat(log.creditedHours) || 0;
    return `
      <div class="log-item">
        <div class="log-item-left">
          <div>
            <span class="log-badge ${log.type === 'overtime' ? 'badge-overtime' : 'badge-timeoff'}">
              ${log.type === 'overtime' ? 'Переработка' : 'Отгул'}
            </span>
            <span class="log-date">${log.date}</span>
          </div>
          <div class="log-details">
            Фактически: <strong>${log.factHours} ч</strong>
          </div>
          ${log.comment ? `<div class="log-comment">${escapeHtml(log.comment)}</div>` : ''}
        </div>
        <div class="log-credited ${credited > 0 ? 'positive' : 'negative'}">
          ${credited > 0 ? '+' : ''}${credited} ч
        </div>
      </div>
    `;
  }).join('');
}

// Рендер интерфейса админа
function renderAdminView() {
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
              ${balance.toFixed(1)} ч
            </div>
            <div class="user-balance-label">баланс</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Обработчики клика по карточкам пользователей
  container.querySelectorAll('.user-card').forEach(card => {
    card.addEventListener('click', () => {
      const email = card.dataset.email;
      const isSelected = card.classList.contains('selected');
      
      container.querySelectorAll('.user-card').forEach(c => c.classList.remove('selected'));
      
      if (!isSelected) {
        card.classList.add('selected');
        renderAdminLogs(email);
        const userName = currentUsers.find(u => u.email === email)?.name || email;
        document.getElementById('historyTitle').textContent = `История: ${userName}`;
      } else {
        renderAdminLogs();
        document.getElementById('historyTitle').textContent = 'Все записи';
      }
    });
  });
}

function renderAdminLogs(filterEmail = null) {
  const container = document.getElementById('adminLogsBody');
  
  let logsToShow = filterEmail 
    ? currentLogs.filter(log => log.userEmail === filterEmail)
    : currentLogs;
  
  // Сортировка по дате (новые сверху)
  logsToShow = [...logsToShow].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (logsToShow.length === 0) {
    container.innerHTML = '<tr><td colspan="7" class="empty-state">Записей нет</td></tr>';
    return;
  }
  
  container.innerHTML = logsToShow.map(log => {
    const credited = parseFloat(log.creditedHours) || 0;
    const userName = currentUsers.find(u => u.email === log.userEmail)?.name || log.userEmail;
    
    return `
      <tr>
        <td>${log.date}</td>
        <td>${escapeHtml(userName)}</td>
        <td>
          <span class="table-badge ${log.type === 'overtime' ? 'badge-overtime' : 'badge-timeoff'}">
            ${log.type === 'overtime' ? 'Переработка' : 'Отгул'}
          </span>
        </td>
        <td class="text-right">${log.factHours}</td>
        <td class="text-right ${credited > 0 ? 'positive' : 'negative'}" style="font-weight: 600; color: ${credited > 0 ? 'var(--success)' : 'var(--danger)'}">
          ${credited > 0 ? '+' : ''}${credited}
        </td>
        <td>${escapeHtml(log.comment || '')}</td>
        <td class="text-center">
          <button class="table-action-btn" onclick="handleDeleteLog(${log.id})" title="Удалить">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Добавление записи
async function handleAddLog(e) {
  e.preventDefault();
  
  const type = document.querySelector('.type-btn.active').dataset.type;
  const date = document.getElementById('logDate').value;
  const hours = parseFloat(document.getElementById('logHours').value);
  const comment = document.getElementById('logComment').value;
  
  if (!hours || hours <= 0) {
    alert('Укажите корректное количество часов');
    return;
  }
  
  showLoading();
  try {
    const factHours = hours;
    const creditedHours = type === 'overtime' 
      ? factHours * currentMultiplier 
      : -factHours;
    
    const formData = new FormData();
    formData.append('action', 'addLog');
    formData.append('userEmail', currentUser.email);
    formData.append('date', date);
    formData.append('type', type);
    formData.append('factHours', factHours.toString());
    formData.append('creditedHours', creditedHours.toString());
    formData.append('comment', comment);
    
    const res = await fetch(CONFIG.GAS_API_URL, {
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
      console.error('Ошибка парсинга JSON:', text);
      throw new Error('Сервер вернул некорректный ответ');
    }
    
    if (data.success) {
      resetForm();
      document.getElementById('addLogForm').classList.add('hidden');
      document.getElementById('addFormToggle').classList.remove('hidden');
      loadData();
    } else {
      alert('Ошибка: ' + data.message);
    }
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    alert('Ошибка сохранения: ' + error.message);
  }
  hideLoading();
}

// Удаление записи
async function handleDeleteLog(logId) {
  if (!confirm('Удалить запись?')) return;
  
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
      console.error('Ошибка парсинга JSON:', text);
      throw new Error('Сервер вернул некорректный ответ');
    }
    
    if (data.success) {
      loadData();
    } else {
      alert('Ошибка: ' + data.message);
    }
  } catch (error) {
    console.error('Ошибка удаления:', error);
    alert('Ошибка удаления: ' + error.message);
  }
  hideLoading();
}

// Обновление коэффициента
async function handleUpdateMultiplier() {
  const newValue = prompt('Новый коэффициент переработки:', currentMultiplier);
  if (!newValue) return;
  
  const multiplier = parseFloat(newValue);
  if (isNaN(multiplier) || multiplier <= 0) {
    alert('Некорректное значение');
    return;
  }
  
  showLoading();
  try {
    const formData = new FormData();
    formData.append('action', 'updateSettings');
    formData.append('overtimeMultiplier', multiplier.toString());
    
    const res = await fetch(CONFIG.GAS_API_URL, {
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
      console.error('Ошибка парсинга JSON:', text);
      throw new Error('Сервер вернул некорректный ответ');
    }
    
    if (data.success) {
      currentMultiplier = multiplier;
      document.getElementById('multiplierDisplay').textContent = multiplier;
      alert('Коэффициент обновлён');
    } else {
      alert('Ошибка: ' + data.message);
    }
  } catch (error) {
    console.error('Ошибка обновления:', error);
    alert('Ошибка обновления: ' + error.message);
  }
  hideLoading();
}

// Экспорт отчёта
function handleExport() {
  const month = prompt('Укажите месяц для экспорта (YYYY-MM):', new Date().toISOString().slice(0, 7));
  if (!month) return;
  
  window.open(`${CONFIG.GAS_API_URL}?action=export&month=${month}`, '_blank');
}

// Обновление превью начисленных часов
function updateCreditedPreview() {
  const type = document.querySelector('.type-btn.active')?.dataset.type;
  const hours = parseFloat(document.getElementById('logHours').value);
  const preview = document.getElementById('creditedPreview');
  
  if (type === 'overtime' && hours && hours > 0) {
    const credited = hours * currentMultiplier;
    preview.textContent = `Начислено: ${credited.toFixed(1)} ч`;
    preview.classList.remove('hidden');
  } else {
    preview.textContent = '';
    preview.classList.add('hidden');
  }
}

// Сброс формы
function resetForm() {
  document.getElementById('logDate').valueAsDate = new Date();
  document.getElementById('logHours').value = '';
  document.getElementById('logComment').value = '';
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.type-btn[data-type="overtime"]').classList.add('active');
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
