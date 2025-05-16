// App.jsx
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import VotingPage from './components/VotingPage';
import Results from './components/Results';
import ResolutionManager from './components/ResolutionManager';
import AdminPanel from './components/AdminPanel';
import SummaryPage from './components/summaryPage';
import ResultsPage from './components/ResultsPage';
import ResolutionModal from './components/ResolutionModal';


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
        {/* <nav className="admin-nav">
          {user && (
            <Link to="/manage" className="admin-link">
              Manage Resolutions
            </Link>
          )}
        </nav> */}

        <Routes>
          <Route path="/manage" element={
            <ResolutionManager />
          } />
          
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/adminControl" element={<AdminPanel />} />
        <Route path="/results" element={<ResultsPage />} />
        {/* <Route path="/control" element={<ResolutionModal/>} /> */}
          
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