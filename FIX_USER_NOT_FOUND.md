# Исправление ошибки "User not found in database"

## Проблема
После успешной авторизации через Google OAuth появляется ошибка "User not found in database", хотя пользователи есть в таблице `users`.

## Причины
1. **Регистр email**: Email в базе данных может отличаться регистром от email в сессии Google (например, `B1ackproff@gmail.com` vs `b1ackproff@gmail.com`)
2. **Задержка триггера**: Триггер создает пользователя асинхронно, а приложение ищет его сразу
3. **Проблемы с поиском**: Поиск не учитывает регистр email

## Решение

### Шаг 1: Обновите функцию триггера в Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект
3. Перейдите в **SQL Editor**
4. Выполните следующий SQL:

```sql
-- Обновляем функцию для нормализации email
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
```

### Шаг 2: Нормализуйте существующие email

1. В **SQL Editor** выполните:

```sql
-- Нормализуем email всех существующих пользователей
UPDATE users 
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));

-- Проверяем результат
SELECT id, name, email, role FROM users ORDER BY id;
```

2. Убедитесь, что все email теперь в нижнем регистре

### Шаг 3: Проверьте пользователей в базе

1. Перейдите в **Table Editor** → **users**
2. Убедитесь, что email совпадает с email вашего Google аккаунта (без учета регистра)
3. Если email отличается, обновите его вручную

### Шаг 4: Протестируйте

1. Очистите кэш браузера (Ctrl+Shift+Delete)
2. Откройте: https://heyheylalaley.github.io
3. Попробуйте войти через Google
4. Проверьте консоль браузера (F12) - должны быть логи о поиске пользователя

## Что было исправлено в коде

1. **Функция `findUserByEmail`**: 
   - Нормализует email (приводит к нижнему регистру)
   - Делает повторные попытки поиска (до 5 попыток с задержкой 500ms)
   - Ищет без учета регистра через получение всех пользователей

2. **Триггер `handle_new_user`**:
   - Нормализует email при создании пользователя
   - Обновляет имя пользователя при повторном входе

3. **Обработка OAuth**:
   - Добавлены задержки для ожидания создания пользователя триггером
   - Улучшено логирование для отладки

## Отладка

Если проблема сохраняется:

1. Откройте консоль браузера (F12)
2. Попробуйте войти
3. Проверьте логи:
   - `Searching for user with email: ...` - какой email ищется
   - `All users in database: ...` - какие пользователи есть в базе
   - `User found on attempt X` - на какой попытке найден пользователь

4. Проверьте в Supabase:
   - **Table Editor** → **users** - какие email там хранятся
   - **SQL Editor** → выполните: `SELECT * FROM users;`

## Важно

- Email должен совпадать с email вашего Google аккаунта (без учета регистра)
- После обновления триггера новые пользователи будут создаваться с нормализованным email
- Существующие пользователи нужно нормализовать вручную через SQL

