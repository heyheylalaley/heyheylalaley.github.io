# Руководство по миграции на Supabase

## Быстрый старт

### 1. Создайте проект Supabase

1. Перейдите на https://supabase.com
2. Зарегистрируйтесь (бесплатно)
3. Создайте новый проект
4. Дождитесь завершения создания (2-3 минуты)

### 2. Настройте базу данных

1. В Supabase Dashboard перейдите в **SQL Editor**
2. Скопируйте и выполните SQL из файла `supabase-schema.sql`
3. Проверьте, что таблицы созданы в **Table Editor**

### 3. Получите ключи API

1. В Dashboard перейдите в **Settings → API**
2. Скопируйте:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`

### 4. Обновите код

1. Добавьте Supabase JS библиотеку в `index.html`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```

2. Обновите `app.js`:
   - Замените `CONFIG.GAS_API_URL` на Supabase конфигурацию
   - Используйте функции из `backend-supabase.js`

### 5. Настройте аутентификацию

**Вариант A: Email/Password (рекомендуется)**

1. В Dashboard → Authentication → Settings
2. Включите Email provider
3. Настройте email templates (опционально)

**Вариант B: OAuth (Google)**

1. В Authentication → Providers
2. Включите Google
3. Добавьте OAuth credentials из Google Cloud Console

### 6. Мигрируйте данные

Используйте скрипт `migrate-data.js` для переноса данных из Google Sheets.

## Структура файлов после миграции

```
├── index.html          # Добавить Supabase script
├── app.js             # Обновить для Supabase
├── backend-supabase.js # Новые функции API
├── supabase-schema.sql # SQL схема
└── migrate-data.js    # Скрипт миграции данных
```

## Тестирование

1. Локально: `python -m http.server 8000`
2. Проверьте авторизацию
3. Проверьте CRUD операции
4. Проверьте экспорт

## Развертывание

После тестирования:
1. Закоммитьте изменения
2. Запушьте в GitHub
3. GitHub Pages автоматически обновится

## Откат на Google (если нужно)

Если что-то пойдет не так, вы можете вернуться к Google:
1. Восстановите старый `app.js` из git
2. Убедитесь, что `CONFIG.GAS_API_URL` указывает на Google Apps Script

