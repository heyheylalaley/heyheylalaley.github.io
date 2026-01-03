// ПРИМЕР: Обновленный app.js для работы с Supabase
// Скопируйте нужные части в ваш app.js

// Конфигурация Supabase - ЗАМЕНИТЕ НА СВОИ ЗНАЧЕНИЯ
const CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY_HERE'
};

// Инициализация Supabase клиента
const supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Глобальное состояние
let currentUser = null;
let currentLogs = [];
let currentUsers = [];
let currentMultiplier = 1.5;
let deleteLogId = null;
let filteredLogs = [];
let currentDateFilter = 'all';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkSession();
});

// Проверка существующей сессии
async function checkSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Получаем информацию о пользователе из таблицы users
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      
      if (userData && !error) {
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
  } catch (error) {
    console.error('Session check error:', error);
  }
}

// Обработка авторизации через email/password
async function handleEmailLogin(email, password) {
  showLoading();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    // Получаем информацию о пользователе
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !userData) {
      throw new Error('User not found in database');
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
    showToast('Login successful', 'success');
  } catch (error) {
    console.error('Login error:', error);
    showToast(error.message || 'Login failed', 'error', 'Login Error');
  }
  hideLoading();
}

// Обработка авторизации через OAuth (Google)
async function handleOAuthLogin(provider = 'google') {
  showLoading();
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
    // Перенаправление на OAuth провайдера
    window.location.href = data.url;
  } catch (error) {
    console.error('OAuth error:', error);
    showToast(error.message || 'OAuth login failed', 'error', 'Login Error');
    hideLoading();
  }
}

// Загрузка данных с Supabase
async function loadData() {
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
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('user_email', currentUser.email)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Преобразуем формат данных
    currentLogs = data.map(log => ({
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
  try {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    currentLogs = data.map(log => ({
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
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    currentUsers = data;
  } catch (error) {
    console.error('Users loading error:', error);
    throw error;
  }
}

// Загрузка настроек
async function loadSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*');
    
    if (error) throw error;
    
    const settings = {};
    data.forEach(row => {
      settings[row.key] = row.value;
    });
    
    if (settings.overtimeMultiplier) {
      currentMultiplier = parseFloat(settings.overtimeMultiplier) || 1.5;
      document.getElementById('multiplierDisplay').textContent = currentMultiplier;
      document.getElementById('userMultiplier').textContent = currentMultiplier;
    }
  } catch (error) {
    console.error('Settings loading error:', error);
    // Используем значение по умолчанию
  }
}

// Сохранение записи
async function saveLogEntry(userEmail, date, type, hours, comment, approvedBy, form) {
  const factHours = hours;
  const creditedHours = type === 'overtime' 
    ? factHours * currentMultiplier 
    : -factHours;
  
  // Optimistic update
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
  
  currentLogs.push(tempLog);
  
  if (currentUser.role === 'admin') {
    renderAdminView();
  } else {
    renderUserView();
  }
  
  // Hide form
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
  
  // Save to Supabase
  try {
    const { data, error } = await supabase
      .from('logs')
      .insert([{
        user_email: userEmail,
        date: date,
        type: type,
        fact_hours: factHours,
        credited_hours: creditedHours,
        comment: comment,
        approved_by: approvedBy || ''
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Remove temp entry and reload
    currentLogs = currentLogs.filter(log => !log.id.toString().startsWith('temp-'));
    await loadData();
    showToast('Entry successfully added', 'success');
  } catch (error) {
    // Rollback
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

// Удаление записи
async function handleDeleteLog(logId) {
  const logToDelete = currentLogs.find(log => log.id == logId);
  if (logToDelete) {
    currentLogs = currentLogs.filter(log => log.id != logId);
    
    if (currentUser.role === 'admin') {
      renderAdminView();
    } else {
      renderUserView();
    }
  }
  
  try {
    const { error } = await supabase
      .from('logs')
      .delete()
      .eq('id', logId);
    
    if (error) throw error;
    
    showToast('Entry successfully deleted', 'success');
  } catch (error) {
    // Rollback
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

// Обновление множителя
async function handleUpdateMultiplier(multiplier) {
  if (!multiplier || isNaN(multiplier) || multiplier <= 0) {
    showToast('Invalid value', 'error');
    return;
  }
  
  const oldMultiplier = currentMultiplier;
  currentMultiplier = multiplier;
  document.getElementById('multiplierDisplay').textContent = multiplier;
  if (document.getElementById('userMultiplier')) {
    document.getElementById('userMultiplier').textContent = multiplier;
  }
  if (document.getElementById('adminMultiplier')) {
    document.getElementById('adminMultiplier').textContent = multiplier;
  }
  
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'overtimeMultiplier', value: multiplier.toString() }, { onConflict: 'key' });
    
    if (error) throw error;
    
    showToast('Multiplier successfully updated', 'success');
  } catch (error) {
    // Rollback
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

// Экспорт данных
async function handleUserExport() {
  try {
    const { data, error } = await supabase
      .from('logs')
      .select(`
        *,
        users!logs_user_email_fkey(name, email)
      `)
      .eq('user_email', currentUser.email)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    let csv = 'Date,Employee,Email,Type,Actual (hrs),Credited,Comment\n';
    
    data.forEach(log => {
      const dateObj = new Date(log.date);
      const formattedDate = dateObj.getDate().toString().padStart(2, '0') + '-' + 
                           (dateObj.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                           dateObj.getFullYear();
      
      const userName = log.users?.name || log.user_email;
      const userEmail = log.users?.email || log.user_email;
      
      csv += `"${formattedDate}","${userName}","${userEmail}","${log.type === 'overtime' ? 'Overtime' : 'Time Off'}","${log.fact_hours}","${log.credited_hours}","${log.comment || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `overtime_report_${currentUser.email.replace('@', '_at_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Export started', 'info');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Error exporting: ' + error.message, 'error', 'Error');
  }
}

// Выход
async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentLogs = [];
  currentUsers = [];
  localStorage.removeItem('user');
  
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

// Остальные функции (renderUserView, renderAdminView, и т.д.) остаются без изменений
// Они используют те же структуры данных

