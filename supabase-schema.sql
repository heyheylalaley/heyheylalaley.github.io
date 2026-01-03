-- Схема базы данных для Toil Tracker на Supabase

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица логов (переработки и отгулы)
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('overtime', 'timeoff')),
  fact_hours DECIMAL(5,2) NOT NULL CHECK (fact_hours > 0),
  credited_hours DECIMAL(5,2) NOT NULL,
  comment TEXT,
  approved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Таблица настроек
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_logs_user_email ON logs(user_email);
CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Вставка начальных настроек
INSERT INTO settings (key, value) 
VALUES ('overtimeMultiplier', '1.5')
ON CONFLICT (key) DO NOTHING;

-- Row Level Security (RLS) - включение
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Функция для проверки роли админа (без рекурсии)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  user_role TEXT;
BEGIN
  -- Получаем email из JWT токена
  user_email := auth.jwt() ->> 'email';
  
  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Используем SECURITY DEFINER для обхода RLS
  -- Это позволяет проверить роль без рекурсии
  SELECT role INTO user_role
  FROM public.users
  WHERE email = LOWER(TRIM(user_email))
  LIMIT 1;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Политики безопасности для таблицы users
-- Удаляем существующие политики перед созданием новых
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Все могут читать пользователей (для отображения списка)
CREATE POLICY "Anyone can read users" ON users
  FOR SELECT USING (true);

-- Все могут создавать пользователей (триггер и API)
CREATE POLICY "Anyone can insert users" ON users
  FOR INSERT WITH CHECK (true);

-- Только админы могут обновлять пользователей
CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (public.is_admin());

-- Только админы могут удалять пользователей
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (public.is_admin());

-- Политики безопасности для таблицы logs
-- Удаляем существующие политики перед созданием новых
DROP POLICY IF EXISTS "Users can read own logs" ON logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON logs;
DROP POLICY IF EXISTS "Admins can delete logs" ON logs;

-- Пользователи могут читать свои логи
CREATE POLICY "Users can read own logs" ON logs
  FOR SELECT USING (
    LOWER(TRIM(user_email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
    OR public.is_admin()
  );

-- Пользователи могут создавать свои логи
CREATE POLICY "Users can insert own logs" ON logs
  FOR INSERT WITH CHECK (
    LOWER(TRIM(user_email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
    OR public.is_admin()
  );

-- Только админы могут удалять логи
CREATE POLICY "Admins can delete logs" ON logs
  FOR DELETE USING (public.is_admin());

-- Политики безопасности для таблицы settings
-- Удаляем существующие политики перед созданием новых
DROP POLICY IF EXISTS "Anyone can read settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;

-- Все могут читать настройки
CREATE POLICY "Anyone can read settings" ON settings
  FOR SELECT USING (true);

-- Только админы могут обновлять настройки
CREATE POLICY "Admins can update settings" ON settings
  FOR UPDATE USING (public.is_admin());

-- Функция для автоматического создания пользователя при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, name, role)
  VALUES (
    LOWER(TRIM(NEW.email)), -- Нормализуем email: нижний регистр и убираем пробелы
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (email) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', users.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического создания пользователя
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Комментарии к таблицам
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON TABLE logs IS 'Записи о переработках и отгулах';
COMMENT ON TABLE settings IS 'Настройки системы';

