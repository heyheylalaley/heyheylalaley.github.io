# Toil Tracker - React Version

Modernized version of Toil Tracker built with React, Vite, and Zustand.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
.
├── src/
│   ├── components/          # React components
│   │   ├── user/            # User-specific components
│   │   ├── modals/          # Modal components
│   │   ├── AdminView.jsx    # Admin interface
│   │   ├── UserView.jsx     # User interface
│   │   ├── LoginScreen.jsx  # Authentication
│   │   └── Header.jsx       # App header
│   ├── services/            # API services
│   │   ├── auth.js          # Authentication
│   │   ├── logs.js          # Log entries
│   │   ├── users.js         # User management
│   │   └── settings.js      # Settings
│   ├── store/               # State management
│   │   └── useStore.js      # Zustand store
│   ├── utils/               # Utilities
│   │   ├── format.js        # Formatting functions
│   │   └── toast.js         # Toast notifications
│   ├── lib/                 # Libraries
│   │   └── supabase.js      # Supabase client
│   ├── config.js            # Configuration
│   ├── App.jsx              # Main app component
│   └── main.jsx             # Entry point
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies
```

## 🎯 Key Improvements

### 1. **Modern Framework (React)**
   - Component-based architecture
   - Reusable components
   - Better code organization
   - Easier to maintain and extend

### 2. **Build Tool (Vite)**
   - Fast development server
   - Optimized production builds
   - Code splitting
   - Hot Module Replacement (HMR)

### 3. **State Management (Zustand)**
   - Simple and lightweight
   - Better than Context API for this use case
   - Persistent state (localStorage)
   - Type-safe (can add TypeScript later)

### 4. **Code Organization**
   - Separated concerns (services, components, utils)
   - Modular CSS
   - Easier to test
   - Better developer experience

### 5. **Performance**
   - React optimizations (useMemo, useCallback)
   - Code splitting
   - Lazy loading ready
   - Optimized re-renders

## 🔄 Migration from Vanilla JS

The React version maintains 100% feature parity with the original vanilla JS version:

- ✅ All authentication features
- ✅ All user features
- ✅ All admin features
- ✅ Same Supabase backend
- ✅ Same database schema
- ✅ Same styling

## 📦 Dependencies

### Core
- **React 18** - UI framework
- **Vite** - Build tool
- **Zustand** - State management

### Utilities
- **date-fns** - Date manipulation
- **@supabase/supabase-js** - Backend integration

## 🛠️ Development

### Environment Setup

1. Configure Supabase in `src/config.js`:
```javascript
export const CONFIG = {
  SUPABASE_URL: 'your-supabase-url',
  SUPABASE_ANON_KEY: 'your-anon-key',
  GOOGLE_CLIENT_ID: 'your-google-client-id'
};
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:3000

### Building for Production

```bash
npm run build
```

Output will be in `dist/` directory, ready for deployment to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting

## 🚀 Deployment

### GitHub Pages (Автоматический деплой через GitHub Actions) ⭐ Рекомендуется

**Самый простой способ - автоматический деплой при каждом push:**

1. **Включите GitHub Pages в настройках репозитория:**
   - Откройте ваш репозиторий на GitHub
   - Перейдите в **Settings** → **Pages**
   - В разделе **Source** выберите:
     - **Source**: `GitHub Actions`
   - Сохраните изменения

2. **Файл `.github/workflows/deploy.yml` уже создан** - он автоматически:
   - Соберет проект при каждом push в ветки `main` или `test`
   - Задеплоит результат на GitHub Pages
   - Сайт будет доступен по адресу: `https://heyheylalaley.github.io`

3. **Просто запушьте изменения:**
```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin test  # или main
```

4. **Проверьте статус деплоя:**
   - Перейдите в **Actions** вкладку на GitHub
   - Увидите процесс сборки и деплоя
   - После успешного деплоя сайт будет доступен через 1-2 минуты

### GitHub Pages (Ручной деплой)

Если хотите деплоить вручную:

1. **Соберите проект:**
```bash
npm run build
```

2. **Настройте GitHub Pages:**
   - Откройте **Settings** → **Pages**
   - **Source**: выберите ветку (например, `main`)
   - **Folder**: выберите `/ (root)` (НЕ `dist/`)
   - Сохраните

3. **Создайте ветку `gh-pages` и закоммитьте dist:**
```bash
# Создайте ветку gh-pages
git checkout --orphan gh-pages
git rm -rf .

# Скопируйте содержимое dist в корень
cp -r dist/* .

# Закоммитьте
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

4. **Вернитесь в основную ветку:**
```bash
git checkout main
```

⚠️ **Примечание:** Ручной деплой требует обновления вручную при каждом изменении. Автоматический деплой через GitHub Actions предпочтительнее.

### Netlify/Vercel

1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy!

## 🔧 Configuration

All configuration is in `src/config.js`. No environment variables needed for basic setup.

## 📝 Notes

- The original `app.js`, `index.html`, and `styles.css` are preserved for reference
- All functionality has been ported to React components
- Styling is maintained in `src/index.css` (copied from original `styles.css`)
- Supabase schema remains unchanged

## 🎨 Future Enhancements

Possible improvements:
- TypeScript for type safety
- React Router for navigation
- Unit tests with Vitest
- E2E tests with Playwright
- PWA support
- Offline functionality
- Better error boundaries
- Loading states
- Skeleton loaders

