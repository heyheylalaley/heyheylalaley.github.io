# Решение проблем

## Ошибка "Ошибка подключения к серверу"

Эта ошибка возникает, когда фронтенд не может подключиться к Google Apps Script. Проверьте следующее:

### 1. Проверка URL Google Apps Script

Убедитесь, что:
- ✅ Google Apps Script развёрнут как Web App
- ✅ URL в `app.js` (CONFIG.GAS_API_URL) совпадает с URL развёртывания
- ✅ Доступ установлен на "Anyone" или "Anyone with Google account"

**Как проверить:**
1. Откройте Google Apps Script проект
2. Перейдите в **Deploy → Manage deployments**
3. Скопируйте URL из колонки "Web app URL"
4. Вставьте его в `app.js` в поле `GAS_API_URL`

### 2. Проверка SPREADSHEET_ID

В файле `gas-backend.gs` должна быть указана правильная ID таблицы:

```javascript
const SPREADSHEET_ID = 'ВАШ_ID_ТАБЛИЦЫ';
```

**Как найти ID:**
- Откройте Google Таблицу
- Посмотрите в URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
- Скопируйте `SPREADSHEET_ID` и вставьте в код

### 3. Проверка структуры таблиц

Убедитесь, что в Google Таблице созданы 3 листа:
- **Users** — с колонками: id, name, email, role
- **Logs** — с колонками: id, userEmail, date, type, factHours, creditedHours, comment, createdAt
- **Settings** — с колонками: key, value

**Как создать автоматически:**
1. В Google Apps Script выберите функцию `initializeSheets`
2. Нажмите ▶️ (Run)
3. Разрешите доступ к таблице при запросе

### 4. Проверка прав доступа

**Для Google Apps Script:**
- Web App должен быть развёрнут с доступом "Anyone" или "Anyone with Google account"
- При первом запуске нужно разрешить доступ к таблице

**Для Google Таблицы:**
- Убедитесь, что аккаунт, под которым развёрнут скрипт, имеет права на редактирование таблицы

### 5. Проверка логов

**В Google Apps Script:**
1. Откройте проект
2. Перейдите в **View → Logs** (или нажмите Ctrl+Enter)
3. Попробуйте выполнить запрос снова
4. Проверьте логи на наличие ошибок

**В браузере:**
1. Откройте консоль разработчика (F12)
2. Перейдите на вкладку "Console"
3. Попробуйте авторизоваться
4. Проверьте сообщения об ошибках

### 6. Типичные ошибки

#### "SPREADSHEET_ID is not configured"
- ❌ В `gas-backend.gs` не указан ID таблицы
- ✅ Замените `YOUR_SPREADSHEET_ID_HERE` на реальный ID

#### "Cannot access spreadsheet"
- ❌ Неправильный ID или нет прав доступа
- ✅ Проверьте ID и права доступа к таблице

#### "Users sheet not found"
- ❌ Лист "Users" не создан
- ✅ Запустите функцию `initializeSheets()` в GAS

#### "User not found"
- ❌ Email пользователя не добавлен в таблицу Users
- ✅ Добавьте пользователя в лист Users с правильным email

#### CORS ошибки
- ❌ Web App не развёрнут или неправильный доступ
- ✅ Переразверните Web App с доступом "Anyone"

### 7. Тестирование API напрямую

Попробуйте открыть в браузере:
```
https://YOUR_GAS_URL?action=getSettings
```

Должен вернуться JSON:
```json
{
  "success": true,
  "settings": {
    "overtimeMultiplier": "1.5"
  }
}
```

Если видите ошибку — проблема в Google Apps Script.

### 8. Переразвёртывание

Если ничего не помогает:
1. В Google Apps Script: **Deploy → Manage deployments**
2. Нажмите на иконку редактирования (✏️)
3. Выберите "New version"
4. Нажмите "Deploy"
5. Обновите URL в `app.js`, если он изменился

## Ошибка "User not found"

Эта ошибка означает, что email пользователя не найден в таблице Users.

**Решение:**
1. Откройте Google Таблицу
2. Перейдите на лист "Users"
3. Добавьте строку с данными пользователя:
   ```
   id | name | email | role
   1  | Иван | ivan@example.com | user
   ```
4. Убедитесь, что email точно совпадает с email в Google аккаунте

## Ошибка авторизации Google

**Проблема:** Кнопка "Вход через аккаунт Google" не появляется или не работает.

**Решение:**
1. Проверьте `GOOGLE_CLIENT_ID` в `app.js`
2. Убедитесь, что домен `heyheylalaley.github.io` добавлен в **Authorized JavaScript origins** в Google Cloud Console
3. Проверьте, что OAuth consent screen настроен
4. Проверьте консоль браузера на ошибки JavaScript

## Проблемы с сохранением данных

**Проблема:** Данные не сохраняются в таблицу.

**Решение:**
1. Проверьте права доступа к Google Таблице
2. Убедитесь, что листы "Logs" и "Users" существуют
3. Проверьте логи в Google Apps Script
4. Убедитесь, что Web App имеет права на редактирование

## Дополнительная помощь

Если проблема не решена:
1. Проверьте все логи (браузер + GAS)
2. Убедитесь, что все шаги из README.md выполнены
3. Попробуйте создать новый проект с нуля
4. Проверьте, что все URL и ID правильные
