/**
 * Google Apps Script Backend для учёта переработок и отгулов
 * 
 * ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
 * 1. Создайте новый Google Sheet
 * 2. Создайте 3 листа: "Users", "Logs", "Settings"
 * 3. Скопируйте этот код в Google Apps Script (Расширения → Apps Script)
 * 4. Замените SPREADSHEET_ID на ID вашей таблицы
 * 5. Разверните как Web App (Deploy → New deployment → Web app)
 * 6. Установите доступ: "Anyone" или "Anyone with Google account"
 * 7. Скопируйте URL развёртывания в CONFIG.GAS_API_URL в app.js
 */

// ⚠️ ЗАМЕНИТЕ НА ID ВАШЕЙ GOOGLE ТАБЛИЦЫ
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Инициализация таблиц
function getSpreadsheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('SPREADSHEET_ID is not configured. Please set it in the script.');
  }
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (error) {
    Logger.log('Error opening spreadsheet: ' + error.toString());
    throw new Error('Cannot access spreadsheet. Check SPREADSHEET_ID and permissions.');
  }
}

function getUsersSheet() {
  try {
    return getSpreadsheet().getSheetByName('Users');
  } catch (error) {
    Logger.log('Error getting Users sheet: ' + error.toString());
    return null;
  }
}

function getLogsSheet() {
  try {
    return getSpreadsheet().getSheetByName('Logs');
  } catch (error) {
    Logger.log('Error getting Logs sheet: ' + error.toString());
    return null;
  }
}

function getSettingsSheet() {
  try {
    return getSpreadsheet().getSheetByName('Settings');
  } catch (error) {
    Logger.log('Error getting Settings sheet: ' + error.toString());
    return null;
  }
}

// Инициализация структуры таблиц (вызовите один раз вручную)
function initializeSheets() {
  const ss = getSpreadsheet();
  
  // Создание листа Users
  let usersSheet = ss.getSheetByName('Users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('Users');
    usersSheet.getRange(1, 1, 1, 4).setValues([['id', 'name', 'email', 'role']]);
    usersSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    
    // Добавление примера пользователя
    usersSheet.appendRow([1, 'Admin', 'admin@company.com', 'admin']);
  }
  
  // Создание листа Logs
  let logsSheet = ss.getSheetByName('Logs');
  if (!logsSheet) {
    logsSheet = ss.insertSheet('Logs');
    logsSheet.getRange(1, 1, 1, 8).setValues([[
      'id', 'userEmail', 'date', 'type', 'factHours', 'creditedHours', 'comment', 'createdAt'
    ]]);
    logsSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  
  // Создание листа Settings
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    settingsSheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    
    // Добавление коэффициента по умолчанию
    settingsSheet.appendRow(['overtimeMultiplier', '1.5']);
  }
}

// Главная функция обработки запросов
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    // Поддержка как FormData (e.parameter), так и JSON (e.postData.contents)
    let action = e.parameter.action;
    
    // Если action в параметрах URL (GET запрос)
    if (!action && e.postData) {
      // Пытаемся получить из JSON
      try {
        const postData = JSON.parse(e.postData.contents);
        action = postData.action;
      } catch (e) {
        // Игнорируем ошибку парсинга
      }
    }
    
    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Action parameter is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // CORS headers
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    let result;
    
    switch (action) {
      case 'login':
        result = handleLogin(e);
        break;
      case 'getLogs':
        result = handleGetLogs(e);
        break;
      case 'getAllLogs':
        result = handleGetAllLogs(e);
        break;
      case 'getUsers':
        result = handleGetUsers(e);
        break;
      case 'getSettings':
        result = handleGetSettings(e);
        break;
      case 'addLog':
        result = handleAddLog(e);
        break;
      case 'deleteLog':
        result = handleDeleteLog(e);
        break;
      case 'updateSettings':
        result = handleUpdateSettings(e);
        break;
      case 'export':
        result = handleExport(e);
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    Logger.log('Error in handleRequest: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Server error: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Авторизация через Google OAuth
function handleLogin(e) {
  try {
    // Поддержка FormData (e.parameter) и JSON (e.postData.contents)
    let token;
    
    if (e.parameter && e.parameter.token) {
      // FormData запрос
      token = e.parameter.token;
    } else if (e.postData && e.postData.contents) {
      // JSON запрос
      try {
        const postData = JSON.parse(e.postData.contents);
        token = postData.token;
      } catch (parseError) {
        Logger.log('JSON parse error: ' + parseError.toString());
        return { success: false, message: 'Invalid JSON in request' };
      }
    } else {
      Logger.log('No token in request');
      return { success: false, message: 'Token is required' };
    }
    
    if (!token) {
      return { success: false, message: 'Token is required' };
    }
    
    // Верификация токена (упрощённая версия)
    // В продакшене используйте библиотеку для верификации JWT
    const payload = parseJWT(token);
    
    if (!payload || !payload.email) {
      Logger.log('Invalid token payload');
      return { success: false, message: 'Invalid token. Please try signing in again.' };
    }
    
    const email = payload.email;
    const name = payload.name || email;
    
    // Проверка пользователя в таблице
    const user = getUserByEmail(email);
    
    if (!user) {
      Logger.log('User not found: ' + email);
      return { success: false, message: 'User not found. Contact administrator to add your email to the system.' };
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
    
  } catch (error) {
    Logger.log('Error in handleLogin: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, message: 'Login error: ' + error.toString() };
  }
}

// Получение логов пользователя
function handleGetLogs(e) {
  const email = e.parameter.email;
  if (!email) {
    return { success: false, message: 'Email required' };
  }
  
  const logs = getLogsByEmail(email);
  return { success: true, logs: logs };
}

// Получение всех логов (админ)
function handleGetAllLogs(e) {
  const logs = getAllLogs();
  return { success: true, logs: logs };
}

// Получение списка пользователей (админ)
function handleGetUsers(e) {
  const users = getAllUsers();
  return { success: true, users: users };
}

// Получение настроек
function handleGetSettings(e) {
  const settings = getSettings();
  return { success: true, settings: settings };
}

// Добавление записи
function handleAddLog(e) {
  try {
    let log;
    
    if (e.parameter && e.parameter.userEmail) {
      // FormData запрос
      log = {
        userEmail: e.parameter.userEmail,
        date: e.parameter.date,
        type: e.parameter.type,
        factHours: parseFloat(e.parameter.factHours),
        creditedHours: parseFloat(e.parameter.creditedHours),
        comment: e.parameter.comment || ''
      };
    } else if (e.postData && e.postData.contents) {
      // JSON запрос
      const postData = JSON.parse(e.postData.contents);
      log = {
        userEmail: postData.userEmail,
        date: postData.date,
        type: postData.type,
        factHours: parseFloat(postData.factHours),
        creditedHours: parseFloat(postData.creditedHours),
        comment: postData.comment || ''
      };
    } else {
      return { success: false, message: 'No data received' };
    }
    
    const id = addLog(log);
    return { success: true, id: id };
    
  } catch (error) {
    Logger.log('Error in handleAddLog: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// Удаление записи
function handleDeleteLog(e) {
  try {
    const id = parseInt(e.parameter.id);
    deleteLogById(id);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// Обновление настроек
function handleUpdateSettings(e) {
  try {
    let multiplier;
    
    if (e.parameter && e.parameter.overtimeMultiplier) {
      // FormData запрос
      multiplier = e.parameter.overtimeMultiplier;
    } else if (e.postData && e.postData.contents) {
      // JSON запрос
      const postData = JSON.parse(e.postData.contents);
      multiplier = postData.overtimeMultiplier;
    } else {
      return { success: false, message: 'No data received' };
    }
    
    if (multiplier !== undefined) {
      updateSetting('overtimeMultiplier', multiplier.toString());
    }
    
    return { success: true };
  } catch (error) {
    Logger.log('Error in handleUpdateSettings: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// Экспорт отчёта
function handleExport(e) {
  const month = e.parameter.month; // YYYY-MM
  
  try {
    const logs = getAllLogs();
    const filteredLogs = month 
      ? logs.filter(log => log.date.startsWith(month))
      : logs;
    
    // Создание CSV
    let csv = 'Дата,Сотрудник,Email,Тип,Факт (ч),Начислено,Комментарий\n';
    
    const users = getAllUsers();
    filteredLogs.forEach(log => {
      const user = users.find(u => u.email === log.userEmail);
      const userName = user ? user.name : log.userEmail;
      
      csv += `"${log.date}","${userName}","${log.userEmail}","${log.type === 'overtime' ? 'Переработка' : 'Отгул'}","${log.factHours}","${log.creditedHours}","${log.comment}"\n`;
    });
    
    // Возврат CSV файла
    return ContentService.createTextOutput(csv)
      .setMimeType(ContentService.MimeType.CSV)
      .downloadAsFile(`overtime_report_${month || 'all'}.csv`);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== Вспомогательные функции для работы с данными ==========

function getUserByEmail(email) {
  try {
    const sheet = getUsersSheet();
    if (!sheet) {
      Logger.log('Users sheet not found');
      return null;
    }
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === email) { // email в колонке C (индекс 2)
        return {
          id: data[i][0],
          name: data[i][1],
          email: data[i][2],
          role: data[i][3]
        };
      }
    }
    return null;
  } catch (error) {
    Logger.log('Error in getUserByEmail: ' + error.toString());
    return null;
  }
}

function getAllUsers() {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const users = [];
  
  for (let i = 1; i < data.length; i++) {
    users.push({
      id: data[i][0],
      name: data[i][1],
      email: data[i][2],
      role: data[i][3]
    });
  }
  return users;
}

function getLogsByEmail(email) {
  const sheet = getLogsSheet();
  const data = sheet.getDataRange().getValues();
  const logs = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email) { // userEmail в колонке B (индекс 1)
      logs.push({
        id: data[i][0],
        userEmail: data[i][1],
        date: data[i][2],
        type: data[i][3],
        factHours: data[i][4],
        creditedHours: data[i][5],
        comment: data[i][6],
        createdAt: data[i][7]
      });
    }
  }
  return logs;
}

function getAllLogs() {
  const sheet = getLogsSheet();
  const data = sheet.getDataRange().getValues();
  const logs = [];
  
  for (let i = 1; i < data.length; i++) {
    logs.push({
      id: data[i][0],
      userEmail: data[i][1],
      date: data[i][2],
      type: data[i][3],
      factHours: data[i][4],
      creditedHours: data[i][5],
      comment: data[i][6],
      createdAt: data[i][7]
    });
  }
  return logs;
}

function addLog(log) {
  const sheet = getLogsSheet();
  const lastRow = sheet.getLastRow();
  const newId = lastRow; // Простая нумерация
  
  const now = new Date().toISOString().split('T')[0];
  
  sheet.appendRow([
    newId,
    log.userEmail,
    log.date,
    log.type,
    log.factHours,
    log.creditedHours,
    log.comment,
    now
  ]);
  
  return newId;
}

function deleteLogById(id) {
  const sheet = getLogsSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function getSettings() {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  const settings = {};
  
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function updateSetting(key, value) {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  
  // Если настройка не найдена, добавляем
  sheet.appendRow([key, value]);
}

// Упрощённый парсер JWT (для демо)
// В продакшене используйте библиотеку для верификации
function parseJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    return JSON.parse(decoded);
  } catch (e) {
    Logger.log('JWT parse error: ' + e.toString());
    return null;
  }
}
