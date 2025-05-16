import { useState, useEffect } from 'react';
import { FaSignOutAlt, FaVoteYea, FaCheck, FaTimes } from 'react-icons/fa';
import { io } from 'socket.io-client';
import './VotingPage.css';

const socket = io('http://localhost:3000');

export default function VotingPage({ userName, onLogout }) {
  const [activeResolution, setActiveResolution] = useState(null);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ yes: 0, no: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const authCheck = await fetch('http://localhost:3000/api/check-vote', {
          credentials: 'include'
        });

        if (authCheck.status === 401) {
          setError('Session expired. Please login again.');
          setIsLoading(false);
          return;
        }

        await fetchActiveResolution();
        await checkVoteStatus();
        setIsLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize voting page');
        setIsLoading(false);
      }
    };

    checkAuthAndFetchData();

    socket.on('resolution-update', (res) => {
      setActiveResolution(res);
      if (res) checkVoteStatus();
    });

    socket.on('voting-state', (state) => {
      setIsVotingOpen(state);
    });

    socket.on('vote-updated', ({ yes, no }) => {
      setVoteCounts({ yes, no });
    });

    return () => {
      socket.off('resolution-update');
      socket.off('voting-state');
      socket.off('vote-updated');
    };
  }, []);

  const fetchActiveResolution = async () => {
    const res = await fetch('http://localhost:3000/api/active-resolution');
    const data = await res.json();
    setActiveResolution(data || null);
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const checkVoteStatus = async () => {
    const res = await fetch('http://localhost:3000/api/check-vote', {
      credentials: 'include'
    });
    const data = await res.json();
    setHasVoted(data.hasVoted);
  };

  const handleVote = async (decision) => {
    if (!isVotingOpen || !activeResolution || hasVoted) return;
  
    try {
      setIsSubmitting(true);
      
      if (!activeResolution?.id) {
        throw new Error('No active resolution selected');
      }
  
      const response = await fetch('http://localhost:3000/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resolutionId: activeResolution.id,
          decision
        })
      });
  
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit vote');
      }
  
      setHasVoted(true);
    } catch (error) {
      console.error('Vote submission error:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading voting session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h3>{error}</h3>
          <button onClick={handleLogout} className="back-button">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!activeResolution) {
    return (
      <div className="no-resolution">
        <div className="no-resolution-content">
          <h3>No active resolutions</h3>
          <p>There are currently no resolutions available for voting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voting-container">
      <header className="voting-header">
        <div className="header-content">
          <div className="logo-section">
          <img src="/favicon.png" alt="E-Voting Logo" className="logo-image" />
            <h1>E-Voting Platform</h1>
            
          </div>
          <div className="user-section">
            <span className="username">{userName}</span>
            <button onClick={handleLogout} className="logout-button">
              <FaSignOutAlt /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="voting-main">
        <div className={`resolution-card ${isVotingOpen ? 'voting-open' : ''}`}>
          <div className="card-header">
            <h2>{activeResolution.title}</h2>
            {/* <div className={`voting-status ${isVotingOpen ? 'open' : 'closed'}`}>
              {isVotingOpen ? 'Voting Open' : 'Voting Closed'}
            </div> */}
          </div>
          
          <div className="resolution-content">
            <p>{activeResolution.description}</p>
          </div>

          {isVotingOpen && (
            <div className="voting-interface">
              {hasVoted ? (
                <div className="vote-confirmation">
                  <FaCheck className="confirmation-icon" />
                  <h3>Thank you for voting!</h3>
                  {/* <div className="vote-counts">
                    <span className="yes-count">Yes: {voteCounts.yes}</span>
                    <span className="no-count">No: {voteCounts.no}</span>
                  </div> */}
                </div>
              ) : (
                <div className="vote-buttons">
                  <button 
                    className="vote-btn yes-btn"
                    onClick={() => handleVote(true)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : (
                      <>
                        <FaCheck /> For
                      </>
                    )}
                  </button>
                  <button 
                    className="vote-btn no-btn"
                    onClick={() => handleVote(false)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : (
                      <>
                        <FaTimes /> Against
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="voting-footer">
        <p>&copy; {new Date().getFullYear()} E-Voting System. All rights reserved. Apel Capital Registrars Limited</p>
      </footer>
    </div>
  );
}