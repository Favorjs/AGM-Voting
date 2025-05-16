import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './AdminPanel.css'

const socket = io('http://localhost:3000');

export default function AdminPanel() {
  const [resolutions, setResolutions] = useState([]);
  const [activeResolution, setActiveResolution] = useState(null);
  const [isVotingOpen, setIsVotingOpen] = useState(false);

  useEffect(() => {
    fetchResolutions();
    fetchVotingState();

    socket.on('resolution-update', (res) => {
      setActiveResolution(res);
    });

    socket.on('voting-state', (state) => {
      setIsVotingOpen(state);
    });

    return () => {
      socket.off('resolution-update');
      socket.off('voting-state');
    };
  }, []);

  const fetchResolutions = async () => {
    const res = await fetch('/api/resolutions');
    const data = await res.json();
    setResolutions(data);
  };

  const fetchVotingState = async () => {
    const res = await fetch('http://localhost:3000/api/admin/voting/state');
    const data = await res.json();
    setIsVotingOpen(data.isOpen);
  };

  const activateResolution = async (id) => {
    await fetch(`http://localhost:3000/api/admin/resolutions/${id}/activate`, {
      method: 'PUT'
    });
  };

  const closeResolution = async () => {
    await fetch('http://localhost:3000/api/admin/resolutions/close', { method: 'POST' });
  };

// Replace your toggleVoting function with this:
const toggleVoting = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/voting/toggle', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to toggle voting');
      }
    } catch (error) {
      console.error('Error toggling voting:', error);
      alert('Error toggling voting');
    }
  };
  
  

  return (
    <div className="admin-panel">
      <h1>Voting Control Panel</h1>

      <div className="active-resolution-controls">
        {activeResolution && (
          <div className="resolution-controls">
          <button 
            onClick={closeResolution}
            className="close-resolution-btn"
          >
            Close Resolution
          </button>
          <button
            onClick={toggleVoting}
            className={`voting-toggle-btn ${isVotingOpen ? 'open' : 'closed'}`}
          >
            {isVotingOpen ? 'Close Voting' : 'Open Voting'}
          </button>
        </div>
        )}
      </div>

      <div className="resolution-list">
        <h3>Available Resolutions</h3>
        {resolutions.map((res) => (
          <div
            key={res.id}
            className={`resolution-item ${activeResolution?.id === res.id ? 'active' : ''}`}
            style={{
              padding: '10px',
              margin: '10px 0',
              border: '1px solid #ccc',
              backgroundColor: activeResolution?.id === res.id ? '#e7ffe7' : '#f9f9f9'
            }}
          >
            <h4>{res.title}</h4>
            <p>{res.description}</p>
            {activeResolution?.id !== res.id && (
              <button onClick={() => activateResolution(res.id)}>
                Activate
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}