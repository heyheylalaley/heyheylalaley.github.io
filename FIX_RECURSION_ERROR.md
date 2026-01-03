# Исправление ошибки "infinite recursion detected in policy"

## Проблема
Ошибка `42P17: infinite recursion detected in policy for relation "users"` возникает из-за того, что RLS политика "Admins can manage users" обращается к таблице `users` для проверки роли, что создает бесконечную рекурсию.

## Решение

### Шаг 1: Создайте функцию для проверки роли админа

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект
3. Перейдите в **SQL Editor**
4. Выполните следующий SQL:

```sql
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
```

### Шаг 2: Удалите старые политики и создайте новые

Выполните следующий SQL:

```sql
-- Удаляем старые политики
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
```

### Шаг 3: Обновите политики для таблицы logs

```sql
-- Удаляем старые политики
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
```

### Шаг 4: Обновите политики для таблицы settings

```sql
-- Удаляем старую политику
DROP POLICY IF EXISTS "Admins can update settings" ON settings;

-- Только админы могут обновлять настройки
CREATE POLICY "Admins can update settings" ON settings
  FOR UPDATE USING (public.is_admin());
```

### Шаг 5: Проверьте результат

1. Выполните в SQL Editor:

```sql
-- Проверяем, что функция создана
SELECT proname FROM pg_proc WHERE proname = 'is_admin';

-- Проверяем политики для users
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';

-- Проверяем политики для logs
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'logs';
```

2. Очистите кэш браузера (Ctrl+Shift+Delete)
3. Откройте: https://heyheylalaley.github.io
4. Попробуйте войти через Google
5. Проверьте консоль браузера (F12) - ошибка рекурсии должна исчезнуть

## Что было исправлено

1. **Создана функция `is_admin()`**:
   - Использует `SECURITY DEFINER` для обхода RLS
   - Проверяет роль без рекурсии
   - Нормализует email (нижний регистр, обрезка пробелов)

2. **Разделены политики для таблицы `users`**:
   - `FOR SELECT` - все могут читать
   - `FOR INSERT` - все могут создавать (для триггера)
   - `FOR UPDATE` - только админы (через `is_admin()`)
   - `FOR DELETE` - только админы (через `is_admin()`)

3. **Обновлены политики для `logs` и `settings`**:
   - Используют функцию `is_admin()` вместо прямого обращения к `users`
   - Нормализуют email при сравнении

## Важно

- Функция `is_admin()` должна быть создана **ПЕРЕД** созданием политик
- После применения изменений ошибка рекурсии должна исчезнуть
- Все политики теперь используют функцию `is_admin()` вместо прямого обращения к таблице `users`

