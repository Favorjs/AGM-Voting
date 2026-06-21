import { useState, useEffect } from 'react';
import { FaSignOutAlt, FaInfoCircle } from 'react-icons/fa';
import { GiVote } from 'react-icons/gi';
import { BsCheckCircleFill, BsXCircleFill } from 'react-icons/bs';

export default function Dashboard({ userName, onLogout, onVoteComplete }) {
  const [resolutions, setResolutions] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchResolutions = async () => {
      try {
        const response = await fetch('${API_URL}/resolutions');
        const data = await response.json();
        setResolutions(data);
      } catch (err) {
        setMessage('Error fetching resolutions');
      }
    };
    fetchResolutions();
  }, []);

  const handleVote = async (resolutionId, decision) => {
    try {
      const response = await fetch('${API_URL}/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionId, decision }),
        credentials: 'include'
      });
      if (response.ok) {
        onVoteComplete();
      } else {
        setMessage(await response.text());
      }
    } catch (err) {
      setMessage('Error recording vote');
    }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {userName}!</h1>
        <button onClick={onLogout} className="logout-btn">
          <FaSignOutAlt /> Logout
        </button>
      </header>
      
      <div className="info-box">
        <FaInfoCircle className="info-icon" />
        <p>Please take a moment to read the voting instructions carefully before proceeding.</p>
      </div>
      
      <div className="resolutions-list">
        <h2><GiVote /> Active Resolutions</h2>
        {resolutions.map(res => (
          <div key={res.id} className="resolution-card">
            <h3>{res.title}</h3>
            <p>{res.description}</p>
            <div className="vote-buttons">
              <button onClick={() => handleVote(res.id, true)} className="vote-yes">
                <BsCheckCircleFill /> Yes
              </button>
              <button onClick={() => handleVote(res.id, false)} className="vote-no">
                <BsXCircleFill /> No
              </button>
            </div>
          </div>
        ))}
      </div>
      {message && <div className="message">{message}</div>}
    </div>
  );
}