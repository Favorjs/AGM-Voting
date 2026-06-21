import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import VotingPage from './components/VotingPage';
import Results from './components/Results';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import ResultsPage from './components/ResultsPage';
import { API_URL } from './config';

function AdminRoute() {
  const [adminUser, setAdminUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/auth/me`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.authenticated) setAdminUser(data.username); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Montserrat,sans-serif', color: '#64748b' }}>
        Loading…
      </div>
    );
  }

  if (!adminUser) return <AdminLogin onLogin={setAdminUser} />;
  return <AdminPanel adminUser={adminUser} onAdminLogout={() => setAdminUser(null)} />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');

  const handleLogin = (userName) => {
    setUser(userName);
    setCurrentPage('landing');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { credentials: 'include' });
      setUser(null);
      setCurrentPage('login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/:tab?" element={<AdminRoute />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/" element={
            currentPage === 'login' ? <Login onLogin={handleLogin} /> :
            currentPage === 'landing' ? <LandingPage userName={user} onLogout={handleLogout} onStartVoting={() => setCurrentPage('voting')} /> :
            currentPage === 'voting' ? <VotingPage userName={user} onLogout={handleLogout} onVoteComplete={() => setCurrentPage('results')} /> :
            <Results onLogout={handleLogout} />
          } />
        </Routes>
      </div>
    </Router>
  );
}
