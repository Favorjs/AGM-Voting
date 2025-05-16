import { useState } from 'react';
import { FaVoteYea, FaSignInAlt, FaEnvelope, FaPhone, FaHeadphones } from 'react-icons/fa';
import './Login.css';

export default function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputType, setInputType] = useState('email'); // 'email' or 'phone'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
        credentials: 'include'
      });
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
      <header className="login-header">
        <div className="header-content">
          <div className="logo">
            <FaVoteYea className="logo-icon" />
            <span>E-Voting System</span>
          </div>
          <nav className="main-nav">
         
            <a href="#" className="nav-link"><FaHeadphones />     Support</a>
          </nav>
        </div>
      </header>
  
      <main className="login-main wide-layout">
        <div className="login-card">
          <div className="card-header">
            <div className="icon-circle">
              <FaSignInAlt className="login-icon" />
            </div>
            {/* <h2>Access Your Voting Portal</h2> */}
            <p className="subtext">Enter your credentials to participate in the election</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-container">
              <div className="input-type-selector">
                <button
                  type="button"
                  className={`type-btn ${inputType === 'email' ? 'active' : ''}`}
                  onClick={() => setInputType('email')}
                >
                  <FaEnvelope /> Email
                </button>
                <button
                  type="button"
                  className={`type-btn ${inputType === 'phone' ? 'active' : ''}`}
                  onClick={() => setInputType('phone')}
                >
                  <FaPhone /> Phone
                </button>
              </div>
              
              <div className="form-group">
                <label htmlFor="identifier">
                  {inputType === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <input
                  id="identifier"
                  type={inputType === 'email' ? 'email' : 'tel'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={inputType === 'email' ? 'your.email@example.com' : '+234 (123) 456-7890'}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}

            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <FaSignInAlt className="button-icon" />
                  <span>Continue to Voting</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="login-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} E-Voting System. All rights reserved. Apel Capital Registrars Limited</p>
          {/* <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact Us</a>
          </div> */}
        </div>
      </footer>
    </div>
  );
}