import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './VotingPage.css'; // Make sure to create this CSS file

const socket = io('http://localhost:3000', {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default function VotingPage({ userName }) {
  const [activeResolution, setActiveResolution] = useState(null);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ yes: 0, no: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Debug socket connection
    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Connection error. Please refresh the page.');
    });

    const fetchInitialData = async () => {
      try {
        setLoading(true);
        await fetchActiveResolution();
        if (activeResolution) {
          await checkVoteStatus();
        }
      } catch (err) {
        console.error('Initial data fetch error:', err);
        setError('Failed to load voting data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    socket.on('resolution-update', (res) => {
      console.log('Received resolution update:', res);
      setActiveResolution(res || null);
      if (res) checkVoteStatus();
    });

    socket.on('voting-state', (state) => {
      console.log('Voting state changed:', state);
      setIsVotingOpen(state);
    });

    socket.on('vote-updated', (data) => {
      console.log('Vote counts updated:', data);
      setVoteCounts(prev => ({ ...prev, ...data }));
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('resolution-update');
      socket.off('voting-state');
      socket.off('vote-updated');
    };
  }, []);

  const fetchActiveResolution = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/active-resolution');
      if (!res.ok) throw new Error('Failed to fetch active resolution');
      const data = await res.json();
      setActiveResolution(data || null);
    } catch (err) {
      console.error('Fetch active resolution error:', err);
      throw err;
    }
  };

  const checkVoteStatus = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/check-vote', {
        credentials: 'include' // Important for session cookies
      });
      if (!res.ok) throw new Error('Failed to check vote status');
      const data = await res.json();
      setHasVoted(data.hasVoted);
    } catch (err) {
      console.error('Check vote status error:', err);
      throw err;
    }
  };

  const handleVote = async (decision) => {
    if (!isVotingOpen || hasVoted || !activeResolution) return;

    try {
      const res = await fetch('http://localhost:3000/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resolutionId: activeResolution.id,
          decision
        })
      });

      if (!res.ok) throw new Error('Vote failed');

      setHasVoted(true);
      socket.emit('new-vote', { resolutionId: activeResolution.id });
    } catch (error) {
      console.error('Vote failed:', error);
      setError('Failed to submit vote. Please try again.');
    }
  };

  if (loading) {
    return <div className="loading">Loading voting information...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!activeResolution) {
    return <div className="no-resolution">No active resolution at this time</div>;
  }

  return (
    <div className="voting-page">
      <div className={`resolution-card ${isVotingOpen ? 'voting-open' : ''}`}>
        <h2>{activeResolution.title}</h2>
        <p>{activeResolution.description}</p>

        {isVotingOpen ? (
          <div className="voting-interface">
            {hasVoted ? (
              <div className="already-voted">
                <p>Thank you for voting!</p>
                <div className="vote-counts">
                  <span className="yes-count">Yes: {voteCounts.yes || 0}</span>
                  <span className="no-count">No: {voteCounts.no || 0}</span>
                </div>
              </div>
            ) : (
              <div className="vote-buttons">
                <button 
                  className="vote-btn yes-btn"
                  onClick={() => handleVote(true)}
                  disabled={!isVotingOpen || hasVoted}
                >
                  Yes
                </button>
                <button 
                  className="vote-btn no-btn"
                  onClick={() => handleVote(false)}
                  disabled={!isVotingOpen || hasVoted}
                >
                  No
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="voting-closed">
            <p>Voting is currently closed</p>
            <div className="vote-counts">
              <span className="yes-count">Yes: {voteCounts.yes || 0}</span>
              <span className="no-count">No: {voteCounts.no || 0}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}