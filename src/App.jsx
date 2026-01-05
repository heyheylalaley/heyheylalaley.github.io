import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import { getSession, findUserByEmail, createUser } from './services/auth';
import { updateUserName } from './services/users';
import { loadUserLogs, loadAllLogs } from './services/logs';
import { loadUsers } from './services/users';
import { loadSettings } from './services/settings';
import { showToast, initToast } from './utils/toast';
import LoginScreen from './components/LoginScreen';
import MainApp from './components/MainApp';
import LoadingOverlay from './components/LoadingOverlay';
import EditNameModal from './components/modals/EditNameModal';
import './App.css';

function App() {
  const { currentUser, setUser, setLogs, setUsers, setMultiplier, reset, theme } = useStore();
  const [loading, setLoading] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  useEffect(() => {
    // Initialize theme
    document.documentElement.setAttribute('data-theme', theme);
    // Initialize toast
    initToast();
  }, [theme]);

  useEffect(() => {
    checkSession();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session) {
        await handleSignIn(session);
      } else if (event === 'SIGNED_OUT') {
        handleSignOut();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    if (isCheckingSession) return;
    setIsCheckingSession(true);
    
    try {
      const session = await getSession();
      
      if (session) {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            if (parsed.email?.toLowerCase() === session.user.email.toLowerCase()) {
              setUser(parsed);
              await loadUserData(parsed);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Error parsing saved user:', e);
          }
        }
        
        await handleSignIn(session);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Session check error:', error);
      setLoading(false);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleSignIn = async (session) => {
    try {
      const normalizedEmail = session.user.email.toLowerCase().trim();
      let userData = await findUserByEmail(normalizedEmail);
      
      if (!userData) {
        // Create user if not found
        const userName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        normalizedEmail.split('@')[0];
        
        userData = await createUser(normalizedEmail, userName);
      }
      
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role
      };
      
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      await loadUserData(user);
      
      // Check if name needs to be set (if it's just the email prefix or empty)
      const emailPrefix = normalizedEmail.split('@')[0];
      const needsName = !userData.name || 
                       userData.name.trim() === '' || 
                       userData.name.toLowerCase() === emailPrefix.toLowerCase();
      
      if (needsName) {
        setShowNamePrompt(true);
      }
      
      // Clean URL hash
      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      showToast('Login successful', 'success');
    } catch (error) {
      console.error('Error signing in:', error);
      showToast('Error signing in: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async (name) => {
    if (!currentUser || !name.trim()) return;
    
    try {
      await updateUserName(currentUser.email, name.trim());
      const updatedUser = { ...currentUser, name: name.trim() };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowNamePrompt(false);
      showToast('Name saved successfully', 'success');
    } catch (error) {
      console.error('Error saving name:', error);
      showToast('Error saving name: ' + error.message, 'error');
    }
  };

  const handleSignOut = () => {
    reset();
    localStorage.removeItem('user');
    setLoading(false);
  };

  const loadUserData = async (user) => {
    try {
      const multiplier = await loadSettings();
      setMultiplier(multiplier);
      
      if (user.role === 'admin') {
        const [logs, users] = await Promise.all([
          loadAllLogs(),
          loadUsers()
        ]);
        setLogs(logs);
        setUsers(users);
      } else {
        const logs = await loadUserLogs(user.email);
        setLogs(logs);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      showToast('Error loading data', 'error');
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <>
      {currentUser ? <MainApp /> : <LoginScreen />}
      {showNamePrompt && currentUser && (
        <EditNameModal
          currentName={currentUser.name || ''}
          onSave={handleSaveName}
          onCancel={() => setShowNamePrompt(false)}
          required={true}
        />
      )}
    </>
  );
}

export default App;

