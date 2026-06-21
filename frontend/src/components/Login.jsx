import { useState } from 'react';
import { FaVoteYea, FaEnvelope, FaPhone, FaArrowRight, FaHeadphones } from 'react-icons/fa';
import './Login.css';
import { API_URL } from '../config';

export default function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputIcon, setInputIcon] = useState(<FaEnvelope />);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setIdentifier(value);
    
    // Auto-detect input type
    if (/@/.test(value)) {
      setInputIcon(<FaEnvelope />);
    } else if (/^[\d+() -]+$/.test(value)) {
      setInputIcon(<FaPhone />);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
        credentials: 'include'
      });
      if (response.status === 409) {
        const data = await response.json();
        setError(data.error || 'User is already logged in elsewhere.');
        setIsSubmitting(false);
        return;
      }
      const data = await response.json();
      if (data.success) {
        onLogin(data.message.replace('Welcome ', ''));
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <header className="login-nav">
        <div className="nav-content">
          <div className="brand">
            <img src="/logo.png" alt="APEL Logo" className="brand-logo" />
          </div>
          <a href="https://wa.me/2347046126698" className="help-link">
            <FaHeadphones /> Support
          </a>
        </div>
      </header>

      <main className="login-body">
        <div className="login-content">
          <div className="login-header">
            <h1>Welcome</h1>
            <p>Enter your details to access the AGM portal</p>
          </div>

          <form onSubmit={handleSubmit} className="modern-form">
            <div className="input-group">
              <label htmlFor="identifier">Email or Phone Number</label>
              <div className="input-wrapper">
                <span className="input-icon-left">{inputIcon}</span>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={handleInputChange}
                  placeholder="name@example.com"
                  required
                  className="modern-input"
                />
              </div>
            </div>

            {error && (
              <div className="error-banner">
                {error}
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? <span className="loader"></span> : (
                <>
                  Continue <FaArrowRight />
                </>
              )}
            </button>
          </form>
          
          <div className="login-footer-note">
            <p></p>
          </div>
        </div>
      </main>
    </div>
  );
}
