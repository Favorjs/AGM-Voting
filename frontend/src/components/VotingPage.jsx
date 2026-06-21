import { useState, useEffect, useCallback } from 'react';
import { LogOut, Vote, CheckCircle2, XCircle, Hand, Loader2, AlertCircle, Clock } from 'lucide-react';
import { io } from 'socket.io-client';
import './VotingPage.css';
import { API_URL } from '../config';

const socket = io(API_URL);

export default function VotingPage({ userName, onLogout }) {
  const [thankYouMsg, setThankYouMsg] = useState(null);
  const [activeResolution, setActiveResolution] = useState(null);
  const [activeAuditMember, setActiveAuditMember] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const [votingState, setVotingState] = useState({ isOpen: false, type: null });
  const [hasVoted, setHasVoted] = useState(false);
  const [hasVotedAudit, setHasVotedAudit] = useState(false);
  const [auditVotesLeft, setAuditVotesLeft] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingSide, setSubmittingSide] = useState(null);

  const checkAuditVoteStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/check-audit-vote`, {
        credentials: 'include'
      });
      const data = await res.json();
      setHasVotedAudit(data.hasVoted);
      if (data.totalVotes !== undefined) {
        setAuditVotesLeft(Math.max(0, 3 - data.totalVotes));
      }
    } catch (error) {
      console.error('Error checking audit vote status:', error);
    }
  }, []);

  const updateVotingState = useCallback(async (state) => {
    setVotingState(state);
    
    if (!state.isOpen) {
      setActiveResolution(null);
      setActiveAuditMember(null);
      setHasVoted(false);
      setHasVotedAudit(false);
      return;
    }

    if (state.type === 'resolution') {
      try {
        const res = await fetch(`${API_URL}/api/active-resolution`);
        const json = await res.json();
        const resolution = json?.success !== undefined ? json.data : json;
        setActiveResolution(resolution || null);
        setActiveAuditMember(null);
        
        const voteRes = await fetch(`${API_URL}/api/check-vote`, {
          credentials: 'include'
        });
        const voteData = await voteRes.json();
        setHasVoted(voteData.hasVoted);
      } catch (err) {
        console.error('Error fetching resolution:', err);
      }
    } else if (state.type === 'audit') {
      try {
        const res = await fetch(`${API_URL}/api/audit-committee/active`);
        if (res.ok) {
          const data = await res.json();
          setActiveAuditMember(data);
        }
        setActiveResolution(null);
        await checkAuditVoteStatus();
      } catch (err) {
        console.error('Error fetching audit member:', err);
      }
    }
  }, [checkAuditVoteStatus]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const authCheck = await fetch(`${API_URL}/api/check-vote`, {
          method: 'GET',
          credentials: 'include'
        });

        if (authCheck.status === 401) {
          setError('Session expired. Please login again.');
          setIsLoading(false);
          return;
        }

        try {
          const stateRes = await fetch(`${API_URL}/api/voting-state`);
          if (stateRes.ok) {
            const state = await stateRes.json();
            await updateVotingState(state);
          }
        } catch (err) {
          console.error('Error fetching voting state:', err);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize voting page');
        setIsLoading(false);
      }
    };

    initializeApp();

    const handleVotingState = (state) => {
      updateVotingState(state);
    };

    const handleResolutionUpdate = (res) => {
      if (votingState.type === 'resolution') {
        setActiveResolution(res);
        if (res) {
          fetch(`${API_URL}/api/check-vote`, {
            credentials: 'include'
          })
            .then(res => res.json())
            .then(data => setHasVoted(data.hasVoted))
            .catch(console.error);
        }
      }
    };

    const handleAgmFinished = ({ message }) => {
      setThankYouMsg(message);
      updateVotingState({ isOpen: false, type: null });
      setTimeLeft(0);
    };

    socket.on('voting-state', handleVotingState);
    socket.on('resolution-update', handleResolutionUpdate);
    socket.on('agm-finished', handleAgmFinished);

    return () => {
      socket.off('voting-state', handleVotingState);
      socket.off('resolution-update', handleResolutionUpdate);
      socket.off('agm-finished', handleAgmFinished);
    };
  }, []);

  useEffect(() => {
    if (!votingState.isOpen) {
      setTimeLeft(0);
      return;
    }
    const duration = votingState.duration || 60;
    setTimeLeft(duration);
    const int = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(int); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(int);
  // sessionKey is a server counter that increments each time voting opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votingState.isOpen, votingState.sessionKey]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleVote = async (decision) => {
    if (!votingState.isOpen || !activeResolution || hasVoted) return;
    const side = decision ? 'for' : 'against';
    try {
      setSubmittingSide(side);
      const response = await fetch(`${API_URL}/api/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resolutionId: activeResolution.id,
          decision
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit vote');
      }
      setHasVoted(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmittingSide(null);
    }
  };

  const handleAuditVote = async () => {
    if (!votingState.isOpen || !activeAuditMember || hasVotedAudit) return;
    
    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_URL}/api/audit-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ committeeId: activeAuditMember.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit vote');
      }
  
      const newVotesLeft = auditVotesLeft - 1;
      setAuditVotesLeft(newVotesLeft);
      setHasVotedAudit(true);
      
      await checkAuditVoteStatus();
      
    } catch (error) {
      setError(error.message);
      await checkAuditVoteStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <Loader2 className="loading-spinner" />
        <p>Loading voting session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <AlertCircle className="error-icon" />
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button onClick={handleLogout} className="back-button">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (thankYouMsg) {
    return (
      <div className="voting-page">
        <div className="thankyou-banner">
          <CheckCircle2 className="success-icon" />
          <h2>Thank You</h2>
          <p>{thankYouMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voting-page">
      <nav className="voting-navbar">
        <div className="nav-content">
          <div className="brand">
            <Vote className="brand-icon" />
            <span className="brand-text">E-Voting Portal</span>
          </div>
          <div className="user-section">
            <span className="username">{userName}</span>
            <button onClick={handleLogout} className="logout-button" aria-label="Sign Out">
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="voting-main">
        {!activeResolution && !activeAuditMember ? (
          <div className="waiting-card">
            <div className="waiting-content">
              <Clock className="waiting-icon" />
              <h3>Waiting for Session</h3>
              <p>There are currently no active resolutions or committee elections.</p>
              <div className="pulse-indicator">
                <span className="pulse-dot"></span>
                Waiting for admin to start voting...
              </div>
            </div>
          </div>
        ) : activeAuditMember ? (
          <div className={`voting-card ${votingState.isOpen ? 'active' : ''}`}>
            <div className="card-header">
              <div className="header-badge">Audit Election</div>
              <h2>Audit Committee Election</h2>
              {votingState.isOpen && (
                <div className="timer-badge">
                  <Clock size={16} />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
            
            <div className="card-content">
              <div className="candidate-info">
                <h3>{activeAuditMember.name}</h3>
                <p>{activeAuditMember.bio}</p>
              </div>

              {votingState.isOpen && (
                <div className="voting-actions">
                  {auditVotesLeft === 0 ? (
                    hasVotedAudit ? (
                      <div className="vote-status success">
                        <CheckCircle2 size={32} />
                        <h3>Vote Recorded</h3>
                        <p>You have exhausted your voting power</p>
                      </div>
                    ) : (
                      <div className="vote-status error">
                        <AlertCircle size={32} />
                        <h3>Voting Limit Reached</h3>
                        <p>You have exhausted your voting power</p>
                      </div>
                    )
                  ) : hasVotedAudit ? (
                    <div className="vote-status success">
                      <CheckCircle2 size={32} />
                      <h3>Vote Submitted</h3>
                      <p>Thank you for voting!</p>
                    </div>
                  ) : (
                    <button 
                      className="audit-vote-btn"
                      onClick={handleAuditVote}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="spinner" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Hand /> Vote for Candidate
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`voting-card ${votingState.isOpen ? 'active' : ''}`}>
            <div className="card-header">
              <div className="header-badge">Resolution</div>
              <h2>{activeResolution.title}</h2>
              {votingState.isOpen && (
                <div className="timer-badge">
                  <Clock size={16} />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
            
            <div className="card-content">
              <p className="resolution-description">{activeResolution.description}</p>

              {votingState.isOpen && (
                <div className="voting-actions">
                  {hasVoted ? (
                    <div className="vote-status success">
                      <CheckCircle2 size={32} />
                      <h3>Vote Submitted</h3>
                      <p>Your vote has been recorded securely.</p>
                    </div>
                  ) : (
                    <div className="decision-buttons">
                      <button 
                        className={`decision-btn yes-btn ${submittingSide && submittingSide !== 'for' ? 'dimmed' : ''}`}
                        onClick={() => handleVote(true)}
                        disabled={!!submittingSide}
                      >
                        {submittingSide === 'for' ? (
                          <Loader2 className="spinner" />
                        ) : (
                          <CheckCircle2 />
                        )}
                        <span>For</span>
                      </button>
                      
                      <button 
                        className={`decision-btn no-btn ${submittingSide && submittingSide !== 'against' ? 'dimmed' : ''}`}
                        onClick={() => handleVote(false)}
                        disabled={!!submittingSide}
                      >
                        {submittingSide === 'against' ? (
                          <Loader2 className="spinner" />
                        ) : (
                          <XCircle />
                        )}
                        <span>Against</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
