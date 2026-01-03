-- Скрипт для нормализации email адресов в таблице users
-- Приводит все email к нижнему регистру и убирает пробелы

-- Обновляем email всех пользователей
UPDATE users 
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));

-- Проверяем результат
SELECT id, name, email, role FROM users ORDER BY id;

