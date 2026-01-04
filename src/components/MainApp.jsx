import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { signOut } from '../services/auth';
import { loadUserLogs, loadAllLogs } from '../services/logs';
import { loadUsers } from '../services/users';
import { loadSettings } from '../services/settings';
import { showToast } from '../utils/toast';
import Header from './Header';
import UserView from './UserView';
import AdminView from './AdminView';
import './MainApp.css';

function MainApp() {
  const { currentUser, setLogs, setUsers, setMultiplier } = useStore();

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const multiplier = await loadSettings();
      setMultiplier(multiplier);

      if (currentUser.role === 'admin') {
        const [logs, users] = await Promise.all([
          loadAllLogs(),
          loadUsers()
        ]);
        setLogs(logs);
        setUsers(users);
      } else {
        const logs = await loadUserLogs(currentUser.email);
        setLogs(logs);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error loading data', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Error signing out:', error);
      showToast('Error signing out', 'error');
    }
  };

  const handleRefresh = () => {
    loadData();
    showToast('Data refreshed', 'success');
  };

  if (!currentUser) return null;

  return (
    <div className="main-app">
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
      />
      {currentUser.role === 'admin' ? (
        <AdminView onRefresh={loadData} />
      ) : (
        <UserView onRefresh={loadData} />
      )}
    </div>
  );
}

export default MainApp;


