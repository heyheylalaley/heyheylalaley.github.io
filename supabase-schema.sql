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

-- Политики безопасности для таблицы users
-- Все могут читать пользователей (для отображения списка)
CREATE POLICY "Anyone can read users" ON users
  FOR SELECT USING (true);

-- Только админы могут создавать/обновлять пользователей
CREATE POLICY "Admins can manage users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE email = auth.jwt() ->> 'email'
      AND role = 'admin'
    )
  );

-- Политики безопасности для таблицы logs
-- Пользователи могут читать свои логи
CREATE POLICY "Users can read own logs" ON logs
  FOR SELECT USING (
    user_email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE email = auth.jwt() ->> 'email'
      AND role = 'admin'
    )
  );

-- Пользователи могут создавать свои логи
CREATE POLICY "Users can insert own logs" ON logs
  FOR INSERT WITH CHECK (
    user_email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE email = auth.jwt() ->> 'email'
      AND role = 'admin'
    )
  );

-- Только админы могут удалять логи
CREATE POLICY "Admins can delete logs" ON logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE email = auth.jwt() ->> 'email'
      AND role = 'admin'
    )
  );

-- Политики безопасности для таблицы settings
-- Все могут читать настройки
CREATE POLICY "Anyone can read settings" ON settings
  FOR SELECT USING (true);

-- Только админы могут обновлять настройки
CREATE POLICY "Admins can update settings" ON settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE email = auth.jwt() ->> 'email'
      AND role = 'admin'
    )
  );

-- Функция для автоматического создания пользователя при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, name, role)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического создания пользователя
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Комментарии к таблицам
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON TABLE logs IS 'Записи о переработках и отгулах';
COMMENT ON TABLE settings IS 'Настройки системы';

