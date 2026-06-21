import React from 'react';
import { LogOut, Info, CheckCircle2, Hand, AlertCircle, FileText, Send, Vote } from 'lucide-react';
import './LandingPage.css';

export default function LandingPage({ userName, onLogout, onStartVoting }) {
  const instructions = [
    {
      title: "Careful Consideration",
      description: "Read each resolution thoroughly before casting your vote.",
      icon: <FileText className="instruction-icon" />
    },
    {
      title: "Voting Selection",
      description: "Vote either \"For\" or \"Against\" for the respective resolution.",
      icon: <CheckCircle2 className="instruction-icon" />
    },
    {
      title: "Audit Committee",
      description: "Click the hand-raise button when it's time to vote for the announced Audit committee member.",
      icon: <Hand className="instruction-icon" />
    },
    {
      title: "Single Submission",
      description: "You can only vote once per resolution.",
      icon: <AlertCircle className="instruction-icon" />
    },
    {
      title: "Final Submission",
      description: "Votes cannot be modified after submission.",
      icon: <Send className="instruction-icon" />
    }
  ];

  return (
    <div className="landing-container">
      <nav className="landing-navbar">
        <div className="nav-content">
          <div className="brand">
            <Vote className="brand-icon" />
            <span className="brand-text">E-Voting Portal</span>
          </div>
          <button onClick={onLogout} className="logout-button" aria-label="Sign Out">
            <LogOut className="button-icon" size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
      
      <main className="landing-main">
        <div className="content-wrapper">
          <div className="welcome-section">
            <h1 className="welcome-title">Welcome, <span className="highlight-name">{userName}</span></h1>
            <p className="welcome-subtitle">Please review the guidelines below before proceeding to the voting session.</p>
          </div>

          <div className="guidelines-card">
            {/* <div className="card-header">
              <div className="header-icon-wrapper">
                <Info className="header-icon" size={24} />
              </div>
              <h2>Voting Guidelines</h2>
            </div> */}
            
            <div className="instructions-grid">
              {instructions.map((item, index) => (
                <div key={index} className="instruction-item">
                  <div className="icon-wrapper">
                    {item.icon}
                  </div>
                  <div className="instruction-text">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="action-section">
              <button onClick={onStartVoting} className="start-voting-btn">
                Start Voting
                <Send className="btn-icon-right" size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
