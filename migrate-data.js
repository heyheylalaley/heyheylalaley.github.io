/**
 * Скрипт для миграции данных из Google Sheets в Supabase
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * 1. Экспортируйте данные из Google Sheets в CSV
 * 2. Запустите этот скрипт в браузере (консоль разработчика)
 * 3. Или используйте Node.js версию
 */

// Конфигурация Supabase
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Миграция пользователей из CSV
 * Формат CSV: id,name,email,role
 */
async function migrateUsers(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  const users = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    users.push({
      id: parseInt(values[0]),
      name: values[1],
      email: values[2],
      role: values[3] || 'user'
    });
  }
  
  console.log(`Migrating ${users.length} users...`);
  
  for (const user of users) {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          name: user.name,
          email: user.email,
          role: user.role
        }, { onConflict: 'email' });
      
      if (error) {
        console.error(`Error migrating user ${user.email}:`, error);
      } else {
        console.log(`✓ Migrated user: ${user.email}`);
      }
    } catch (error) {
      console.error(`Error migrating user ${user.email}:`, error);
    }
  }
  
  console.log('Users migration completed!');
}

/**
 * Миграция логов из CSV
 * Формат CSV: id,userEmail,date,type,factHours,creditedHours,comment,createdAt,approvedBy
 */
async function migrateLogs(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  const logs = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    logs.push({
      id: parseInt(values[0]),
      user_email: values[1],
      date: values[2],
      type: values[3],
      fact_hours: parseFloat(values[4]),
      credited_hours: parseFloat(values[5]),
      comment: values[6] || '',
      created_at: values[7] || new Date().toISOString(),
      approved_by: values[8] || ''
    });
  }
  
  console.log(`Migrating ${logs.length} logs...`);
  
  // Мигрируем батчами по 100 записей
  const batchSize = 100;
  for (let i = 0; i < logs.length; i += batchSize) {
    const batch = logs.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('logs')
        .insert(batch);
      
      if (error) {
        console.error(`Error migrating batch ${i}-${i + batch.length}:`, error);
      } else {
        console.log(`✓ Migrated batch ${i}-${i + batch.length}`);
      }
    } catch (error) {
      console.error(`Error migrating batch ${i}-${i + batch.length}:`, error);
    }
    
    // Небольшая задержка между батчами
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('Logs migration completed!');
}

/**
 * Миграция настроек из CSV
 * Формат CSV: key,value
 */
async function migrateSettings(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  const settings = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    settings.push({
      key: values[0],
      value: values[1]
    });
  }
  
  console.log(`Migrating ${settings.length} settings...`);
  
  for (const setting of settings) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .upsert({
          key: setting.key,
          value: setting.value
        }, { onConflict: 'key' });
      
      if (error) {
        console.error(`Error migrating setting ${setting.key}:`, error);
      } else {
        console.log(`✓ Migrated setting: ${setting.key}`);
      }
    } catch (error) {
      console.error(`Error migrating setting ${setting.key}:`, error);
    }
  }
  
  console.log('Settings migration completed!');
}

/**
 * Полная миграция всех данных
 */
async function migrateAll(usersCsv, logsCsv, settingsCsv) {
  console.log('Starting full migration...');
  
  try {
    await migrateUsers(usersCsv);
    await migrateLogs(logsCsv);
    await migrateSettings(settingsCsv);
    
    console.log('✓ Full migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Пример использования:
// 1. Экспортируйте данные из Google Sheets в CSV
// 2. Вставьте CSV текст в переменные:
/*
const usersCsv = `id,name,email,role
1,Admin,admin@company.com,admin
2,User,user@company.com,user`;

const logsCsv = `id,userEmail,date,type,factHours,creditedHours,comment,createdAt,approvedBy
1,user@company.com,2025-01-10,overtime,4,6,Project X,2025-01-10,`;

const settingsCsv = `key,value
overtimeMultiplier,1.5`;

// 3. Запустите миграцию:
migrateAll(usersCsv, logsCsv, settingsCsv);
*/

