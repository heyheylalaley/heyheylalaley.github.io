/**
 * Supabase Backend для учёта переработок и отгулов
 * 
 * Этот файл содержит функции для работы с Supabase API
 * Замените CONFIG в app.js на Supabase конфигурацию
 */

// Конфигурация Supabase (замените на свои значения)
const SUPABASE_CONFIG = {
  URL: 'https://YOUR_PROJECT.supabase.co',
  ANON_KEY: 'YOUR_ANON_KEY_HERE'
};

// Инициализация Supabase клиента
let supabaseClient = null;

function initSupabase() {
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  } else {
    console.error('Supabase JS library not loaded. Add: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
  }
}

// ========== АВТОРИЗАЦИЯ ==========

/**
 * Вход через email/password
 */
async function loginWithEmail(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    // Получаем информацию о пользователе из таблицы users
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('User not found in database');
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      session: data.session
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Вход через OAuth (Google, Microsoft и т.д.)
 */
async function loginWithOAuth(provider = 'google') {
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
    // Перенаправление на OAuth провайдера
    window.location.href = data.url;
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Регистрация нового пользователя
 */
async function signUp(email, password, name) {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: name
        }
      }
    });
    
    if (error) throw error;
    
    // Создаем запись в таблице users
    const { error: dbError } = await supabaseClient
      .from('users')
      .insert([{
        email: email,
        name: name,
        role: 'user'
      }]);
    
    if (dbError) throw dbError;
    
    return {
      success: true,
      user: data.user
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Выход
 */
async function logout() {
  await supabaseClient.auth.signOut();
}

/**
 * Проверка текущей сессии
 */
async function getCurrentSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// ========== ПОЛУЧЕНИЕ ДАННЫХ ==========

/**
 * Получить пользователя по email
 */
async function getUserByEmail(email) {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Получить всех пользователей (только для админа)
 */
async function getAllUsers() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return { success: true, users: data };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Получить логи пользователя
 */
async function getUserLogs(email) {
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('user_email', email)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Преобразуем формат данных для совместимости
    const logs = data.map(log => ({
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
    
    return { success: true, logs: logs };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Получить все логи (только для админа)
 */
async function getAllLogs() {
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Преобразуем формат данных
    const logs = data.map(log => ({
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
    
    return { success: true, logs: logs };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Получить настройки
 */
async function getSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('*');
    
    if (error) throw error;
    
    const settings = {};
    data.forEach(row => {
      settings[row.key] = row.value;
    });
    
    return { success: true, settings: settings };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ========== ИЗМЕНЕНИЕ ДАННЫХ ==========

/**
 * Добавить запись
 */
async function addLog(log) {
  try {
    const { data, error } = await supabaseClient
      .from('logs')
      .insert([{
        user_email: log.userEmail,
        date: log.date,
        type: log.type,
        fact_hours: log.factHours,
        credited_hours: log.creditedHours,
        comment: log.comment || '',
        approved_by: log.approvedBy || ''
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      id: data.id
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Удалить запись
 */
async function deleteLog(id) {
  try {
    const { error } = await supabaseClient
      .from('logs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Обновить настройки
 */
async function updateSettings(key, value) {
  try {
    const { error } = await supabaseClient
      .from('settings')
      .upsert({ key: key, value: value }, { onConflict: 'key' });
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Экспорт данных в CSV
 */
async function exportLogs(email = null) {
  try {
    let query = supabaseClient
      .from('logs')
      .select(`
        *,
        users!logs_user_email_fkey(name, email)
      `)
      .order('date', { ascending: false });
    
    if (email) {
      query = query.eq('user_email', email);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Формируем CSV
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
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

