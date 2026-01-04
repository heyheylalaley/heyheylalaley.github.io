import { useState, useEffect } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../services/auth';
import { showToast } from '../utils/toast';
import { CONFIG } from '../config';
import './LoginScreen.css';

function LoginScreen() {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize Google Sign-In
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        { theme: 'outline', size: 'large', width: '100%' }
      );

      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInButtonRegister'),
        { theme: 'outline', size: 'large', width: '100%' }
      );
    }
  }, [activeTab]);

  const handleGoogleSignIn = async (response) => {
    // This is handled by Supabase OAuth callback
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    const email = e.target.loginEmail.value;
    const password = e.target.loginPassword.value;

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // Auth state change will handle the rest
    } catch (error) {
      showToast(error.message, 'error', 'Login Error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (loading) return;

    const name = e.target.registerName.value;
    const email = e.target.registerEmail.value;
    const password = e.target.registerPassword.value;
    const confirmPassword = e.target.registerPasswordConfirm.value;

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error', 'Registration Error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error', 'Registration Error');
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password, name);
      showToast('Registration successful! Please check your email to verify your account.', 'success');
      setActiveTab('login');
    } catch (error) {
      showToast(error.message, 'error', 'Registration Error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      showToast(error.message, 'error', 'Google Sign-In Error');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <svg viewBox="0 0 100 100" width="80" height="80">
              <defs>
                <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#667eea' }} />
                  <stop offset="100%" style={{ stopColor: '#764ba2' }} />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#iconGradient)" strokeWidth="4" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="url(#iconGradient)" strokeWidth="2" opacity="0.3" />
              <line x1="50" y1="50" x2="50" y2="25" stroke="url(#iconGradient)" strokeWidth="4" strokeLinecap="round" />
              <line x1="50" y1="50" x2="68" y2="58" stroke="url(#iconGradient)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="50" cy="50" r="4" fill="url(#iconGradient)" />
              <circle cx="50" cy="15" r="2" fill="url(#iconGradient)" />
              <circle cx="85" cy="50" r="2" fill="url(#iconGradient)" />
              <circle cx="50" cy="85" r="2" fill="url(#iconGradient)" />
              <circle cx="15" cy="50" r="2" fill="url(#iconGradient)" />
            </svg>
          </div>
          <h1>Toil Tracker</h1>
          <p className="login-subtitle">Track your overtime & time off</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register
          </button>
        </div>

        {activeTab === 'login' ? (
          <div className="auth-form">
            <form onSubmit={handleEmailLogin}>
              <div className="form-group">
                <label htmlFor="loginEmail">Email</label>
                <input
                  type="email"
                  id="loginEmail"
                  name="loginEmail"
                  required
                  placeholder="your@email.com"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="loginPassword">Password</label>
                <input
                  type="password"
                  id="loginPassword"
                  name="loginPassword"
                  required
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-large"
                style={{ width: '100%', marginTop: '16px' }}
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <div id="googleSignInButton" className="google-signin-container"></div>
          </div>
        ) : (
          <div className="auth-form">
            <form onSubmit={handleEmailRegister}>
              <div className="form-group">
                <label htmlFor="registerName">Full Name</label>
                <input
                  type="text"
                  id="registerName"
                  name="registerName"
                  required
                  placeholder="John Doe"
                  maxLength="100"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="registerEmail">Email</label>
                <input
                  type="email"
                  id="registerEmail"
                  name="registerEmail"
                  required
                  placeholder="your@email.com"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="registerPassword">Password</label>
                <input
                  type="password"
                  id="registerPassword"
                  name="registerPassword"
                  required
                  placeholder="Minimum 6 characters"
                  minLength="6"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="registerPasswordConfirm">Confirm Password</label>
                <input
                  type="password"
                  id="registerPasswordConfirm"
                  name="registerPasswordConfirm"
                  required
                  placeholder="Confirm your password"
                  minLength="6"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-large"
                style={{ width: '100%', marginTop: '16px' }}
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <div id="googleSignInButtonRegister" className="google-signin-container"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;


