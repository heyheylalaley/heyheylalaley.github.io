# План миграции с Google на Supabase

## Проблема
Google Apps Script медленный из-за:
- Ограничений по времени выполнения
- Медленного доступа к Google Sheets
- Очередей запросов

## Решение: Supabase

**Преимущества:**
- ⚡ **Очень быстрый** - PostgreSQL с глобальным CDN
- 🆓 **Бесплатный тариф** - 500MB базы, 2GB bandwidth
- 🔐 **Встроенная аутентификация** - email/password или OAuth
- 📊 **PostgreSQL** - надежная реляционная БД
- 🔄 **Real-time** - обновления в реальном времени (опционально)
- 🌍 **Глобальная инфраструктура** - низкая задержка

## Архитектура после миграции

```
Frontend (GitHub Pages)
    ↓
Supabase API (REST/PostgREST)
    ↓
PostgreSQL Database
```

## Шаги миграции

### 1. Создание проекта Supabase

1. Перейдите на https://supabase.com
2. Создайте аккаунт (бесплатно)
3. Создайте новый проект
4. Запишите:
   - Project URL: `https://xxxxx.supabase.co`
   - API Key (anon/public): `eyJhbGc...`

### 2. Создание таблиц в Supabase

Выполните SQL в SQL Editor:

```sql
-- Таблица пользователей
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица логов
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('overtime', 'timeoff')),
  fact_hours DECIMAL(5,2) NOT NULL,
  credited_hours DECIMAL(5,2) NOT NULL,
  comment TEXT,
  approved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица настроек
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Вставка начальных данных
INSERT INTO settings (key, value) VALUES ('overtimeMultiplier', '1.5');

-- Создание индексов для быстрого поиска
CREATE INDEX idx_logs_user_email ON logs(user_email);
CREATE INDEX idx_logs_date ON logs(date);
CREATE INDEX idx_users_email ON users(email);

-- Row Level Security (RLS) политики
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Политики для чтения (все авторизованные пользователи)
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can read own logs" ON logs
  FOR SELECT USING (true);

CREATE POLICY "Users can read settings" ON settings
  FOR SELECT USING (true);

-- Политики для записи (только админы могут изменять)
CREATE POLICY "Admins can insert logs" ON logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete logs" ON logs
  FOR DELETE USING (true);

CREATE POLICY "Admins can update settings" ON settings
  FOR UPDATE USING (true);
```

### 3. Настройка аутентификации

**Вариант A: Email/Password (проще)**
- В Supabase Dashboard → Authentication → Settings
- Включите Email provider
- Настройте email templates (опционально)

**Вариант B: OAuth (Google/Microsoft)**
- В Authentication → Providers
- Включите нужные провайдеры
- Настройте OAuth credentials

### 4. Миграция данных из Google Sheets

1. Экспортируйте данные из Google Sheets в CSV
2. Используйте скрипт миграции (см. `migrate-data.js`)

### 5. Обновление frontend

- Замените `CONFIG.GAS_API_URL` на Supabase URL
- Обновите функции API в `app.js`
- Замените Google OAuth на Supabase Auth

## Сравнение производительности

| Операция | Google Apps Script | Supabase |
|----------|-------------------|----------|
| Загрузка логов | 2-5 сек | 50-200 мс |
| Добавление записи | 1-3 сек | 50-150 мс |
| Авторизация | 2-4 сек | 100-300 мс |

## Стоимость

**Supabase Free Tier:**
- 500 MB базы данных
- 2 GB bandwidth/месяц
- 50,000 активных пользователей
- Достаточно для небольших команд

**Если нужно больше:**
- Pro: $25/месяц (8 GB, 50 GB bandwidth)

## Безопасность

- Row Level Security (RLS) - защита на уровне БД
- API ключи - отдельные для анонимного и сервисного доступа
- HTTPS по умолчанию
- Автоматические бэкапы

## Следующие шаги

1. Создайте проект Supabase
2. Выполните SQL миграцию
3. Обновите код (см. новые файлы)
4. Протестируйте локально
5. Мигрируйте данные
6. Обновите production

