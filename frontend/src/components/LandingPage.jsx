import { FaSignOutAlt, FaInfoCircle, FaVoteYea } from 'react-icons/fa';
// import VotingPage from './VotingPage';
// import { useNavigate } from 'react-router-dom';
// import { useState } from 'react';
import './LandingPage.css'
export default function LandingPage({ userName, onLogout, onStartVoting }) {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="header-content">
          <div className="user-greeting">
            <h1 className="welcome-message">Welcome back,</h1>
            <p className="username">{userName}</p>
          </div>
          <button onClick={onLogout} className="logout-button">
            <FaSignOutAlt className="button-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>
      
      <main className="landing-main">
        <div className="info-card">
          <div className="card-header">
            <div className="icon-wrapper">
              <FaInfoCircle className="info-icon" />
            </div>
            <h2 className="card-title">Voting Guidelines</h2>
          </div>
          <div className="card-body">
            <ol className="instructions-list">
              <li className="instruction-item">
                <div className="instruction-marker"></div>
                <div className="instruction-content">
                  <h3>Careful Consideration</h3>
                  <p>Read each resolution thoroughly before casting your vote</p>
                </div>
              </li>

              <li className="instruction-item">
                <div className="instruction-marker"></div>
                <div className="instruction-content">
                  <h3>Voting Selection</h3>
                  <p>Vote either For or Against for respective resolution</p>
                </div>
              </li>

              <li className="instruction-item">
                <div className="instruction-marker"></div>
                <div className="instruction-content">
                  <h3>Single Submission</h3>
                  <p>You may only vote once per resolution</p>
                </div>
              </li>
              <li className="instruction-item">
                <div className="instruction-marker"></div>
                <div className="instruction-content">
                  <h3>Final Decisions</h3>
                  <p>Votes cannot be modified after submission</p>
                </div>
              </li>
             
            </ol>
          </div>
        </div>
        
        <div className="action-section">
          <button onClick={onStartVoting} className="primary-button">
            <FaVoteYea className="button-icon" />
            <span>Begin Voting Process</span>
          </button>
        </div>
      </main>
      
      {/* <footer className="landing-footer">
        <p>Secure E-Voting Platform • {new Date().getFullYear()}</p>
      </footer> */}
    </div>
  );
}