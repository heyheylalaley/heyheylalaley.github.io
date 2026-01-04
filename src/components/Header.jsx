import { useStore } from '../store/useStore';
import './Header.css';

function Header({ user, onLogout, onRefresh }) {
  const { theme, setTheme } = useStore();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <div className="header-icon">
            <svg viewBox="0 0 100 100" width="40" height="40">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
              <line x1="50" y1="50" x2="50" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="50" y1="50" x2="68" y2="58" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <circle cx="50" cy="50" r="4" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 id="headerTitle">Toil Tracker</h1>
            <p id="headerSubtitle" className="header-subtitle">
              {user.role === 'admin' ? 'Administrator' : `Welcome, ${user.name}`}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-icon"
            onClick={toggleTheme}
            title="Toggle dark mode"
          >
            <span className={theme === 'light' ? 'theme-icon-light' : 'theme-icon-dark hidden'}>
              🌙
            </span>
            <span className={theme === 'dark' ? 'theme-icon-dark' : 'theme-icon-dark hidden'}>
              ☀️
            </span>
          </button>
          {user.role === 'admin' && (
            <button
              className="btn btn-secondary"
              onClick={onRefresh}
              title="Refresh data"
            >
              <span>🔄</span> Refresh
            </button>
          )}
          {user.role !== 'admin' && (
            <button
              className="btn btn-secondary"
              onClick={onRefresh}
              title="Refresh data"
            >
              <span>🔄</span> Refresh
            </button>
          )}
          <button className="btn btn-secondary" onClick={onLogout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;


