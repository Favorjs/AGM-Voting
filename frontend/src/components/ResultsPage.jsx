import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Doughnut, Bar } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './ResultsPage.css';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
import { API_URL } from '../config';


export default function ResultsPage() {
  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const [results, setResults] = useState([]);
  const [activeResolution, setActiveResolution] = useState(null);
  const [activeAuditMember, setActiveAuditMember] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [votingStartedAt, setVotingStartedAt] = useState(null);
  const [votingActiveId, setVotingActiveId] = useState(null);
  const [votingDuration, setVotingDuration] = useState(60);
  const [proxyVotes, setProxyVotes] = useState(0);
  const [proxyHoldings, setProxyHoldings] = useState(0);
  const [voteCounts, setVoteCounts] = useState({ 
    yes: 0, 
    no: 0, 
    total: 0, 
    percentageYes: 0,
    percentageNo: 0,
    totalHoldings: 0,
    Proxy_votes: proxyVotes,
    totalproxyVotes:0,
    yesHoldings: 0,
    noHoldings: 0,
    percentageYesHoldings: 0,
    percentageNoHoldings: 0
  });
  const [auditResults, setAuditResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(API_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Connected to socket server'));
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Connection error. Some real-time features may not work.');
    });

    const fetchData = async () => {
      try {
        setLoading(true);
        const [,,,,, vsRes] = await Promise.all([
          fetchResults(),
          fetchActiveResolution(),
          fetchActiveAuditMember(),
          fetchAuditResults(),
          fetchProxySettings(),
          fetch(`${API_URL}/api/voting-state`).then(r => r.json()).catch(() => null),
        ]);
        if (vsRes) {
          setIsVotingOpen(vsRes.isOpen);
          setVotingStartedAt(vsRes.startedAt ?? null);
          setVotingActiveId(vsRes.activeId ?? null);
          if (vsRes.duration) setVotingDuration(vsRes.duration);
        }
      } catch (err) {
        console.error('Initial data load error:', err);
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    



    if (!socket) return;
    
    const handleVoteUpdate = (data) => {
      if (activeResolution && data.resolutionId === activeResolution.id) {
        setVoteCounts(prev => ({
          yes: data.yes,
          no: data.no,
          total: data.total,
          totalproxyVotes: data.total + proxyVotes,
          percentageYes: data.total > 0 ? Math.round((data.yes / data.total) * 100) : 0,
          percentageNo: data.total > 0 ? Math.round((data.no / data.total) * 100) : 0,
          totalHoldings: data.totalHoldings,
          yesHoldings: data.yesHoldings,
          noHoldings: data.noHoldings,
        }));
        fetchResults();
      }
    };
  
    const handleResolutionUpdate = (resolution) => {
      setActiveResolution(resolution);
      setActiveAuditMember(null); // clear audit context when switching to resolution
      if (resolution) {
        fetchVoteCounts(resolution.id);
      } else {
        setVoteCounts({ yes: 0, no: 0, total: 0, percentageYes: 0, percentageNo: 0 });
      }
    };

    const handleAuditVoteUpdate = (data) => {
      setAuditResults(prev => 
        prev.map(m => 
          m.id === data.committeeId ? { ...m, votesFor: data.votesFor } : m
        )
      );
      if (activeAuditMember?.id === data.committeeId) {
        setActiveAuditMember(prev => ({ ...prev, votesFor: data.votesFor }));
      }
    };
  
    socket.on('vote-updated', handleVoteUpdate);
    socket.on('resolution-update', handleResolutionUpdate);
    socket.on('resolution-activated', (resolution) => {
      handleResolutionUpdate(resolution);
    });
    socket.on('audit-member-activated', (member) => {
      setActiveAuditMember(member);
      setActiveResolution(null);
    });
    socket.on('voting-state', state => {
      setIsVotingOpen(state.isOpen);
      setVotingStartedAt(state.startedAt ?? null);
      setVotingActiveId(state.activeId ?? null);
      if (state.duration) setVotingDuration(state.duration);
      if (!state.isOpen) {
        setActiveAuditMember(null);
      } else if (state.type === 'resolution') {
        fetchActiveResolution();
        setActiveAuditMember(null);
      } else if (state.type === 'audit') {
        fetchActiveAuditMember();
        setActiveResolution(null);
      }
    });
    socket.on('audit-vote-updated', handleAuditVoteUpdate);
    socket.on('proxy-settings-updated', ({ proxyVotes: pv, proxyHoldings: ph }) => {
      setProxyVotes(pv);
      setProxyHoldings(ph);
    });

    return () => {
      socket.off('vote-updated', handleVoteUpdate);
      socket.off('resolution-update', handleResolutionUpdate);
      socket.off('audit-vote-updated', handleAuditVoteUpdate);
      socket.off('proxy-settings-updated');
    };
  }, [socket, activeResolution, activeAuditMember]);

  useEffect(() => {
    if (!isVotingOpen) {
      setTimeLeft(0);
      return;
    }
    const duration = votingDuration || 60;
    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // isVotingOpen + votingActiveId together cover every open/close/switch-resolution case
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVotingOpen, votingActiveId]);

  const downloadPDF = async () => {
    try {
      setLoading(true);
      const element = document.querySelector('.results-container');
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save('voting-results.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch(`${API_URL}/api/results`);
      if (!res.ok) throw new Error('Failed to fetch results');
      const { data } = await res.json();
      setResults(data);
    } catch (error) {
      console.error('Fetch results error:', error);
      setError('Failed to load voting results');
    }
  };
  const fetchActiveResolution = async () => {
    try {
      const res = await fetch(`${API_URL}/api/active-resolution`);
      if (res.status === 404) {
        // No active resolution – clear state without flagging an error
        setActiveResolution(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch active resolution');
      const json = await res.json();
      // API may return either {success,data} or the raw object
      const resolution = json?.success !== undefined ? json.data : json;
      setActiveResolution(resolution || null);
      if (resolution) await fetchVoteCounts(resolution.id);
    } catch (error) {
      console.error('Fetch active resolution error:', error);
      setError('Failed to load active resolution');
      setActiveResolution(null);
    }
  };
  


const fetchActiveAuditMember = async () => {
  try {
    const res = await fetch(`${API_URL}/api/audit-committee/active`);

    if (res.status === 404) {        // no active member
      setActiveAuditMember(null);
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch active audit member');

    const json = await res.json();
    // backend returns the raw member object (not wrapped)
    const member = json?.success !== undefined ? json.data : json;

    setActiveAuditMember(member || null);
  } catch (error) {
    console.error('Error fetching active audit member:', error);
    setActiveAuditMember(null);
  }
};
  const fetchAuditResults = async () => {
    try {
      const res = await fetch(`${API_URL}/api/audit-committee`);
      if (res.ok) {
        const data = await res.json();
        setAuditResults(data);
      }
    } catch (error) {
      console.error('Error fetching audit results:', error);
    }
  };



  const yesCount = Number(voteCounts.yes) + Number(proxyVotes);
  const noCount = Number(voteCounts.no);
  const totalPercentage = yesCount + noCount;
  
  const yesPercentage = totalPercentage > 0 ? ((yesCount / totalPercentage) * 100).toFixed(2) : "0.00";
  const noPercentage = totalPercentage > 0 ? ((noCount / totalPercentage) * 100).toFixed(2) : "0.00";
  
  // To display:
  console.log(`Yes: ${yesPercentage}%`);
  console.log(`No: ${noPercentage}%`);


  const fetchProxySettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/proxy-settings`);
      if (!res.ok) return;
      const data = await res.json();
      setProxyVotes(data.proxyVotes ?? 0);
      setProxyHoldings(data.proxyHoldings ?? 0);
    } catch (err) {
      console.error('Failed to fetch proxy settings:', err);
    }
  };

  const fetchVoteCounts = async (resolutionId) => {
    try {
      const res = await fetch(`${API_URL}/api/results/${resolutionId}`);
      if (!res.ok) throw new Error('Failed to fetch vote counts');
      const { data } = await res.json();
      
      setVoteCounts({
        yes: data.summary.yesVotes,
        no: data.summary.noVotes,
        total: data.summary.totalVotes,
        totalproxyVotes: data.summary.totalproxyVotes,
        percentageYes: data.summary.percentageYes,
        percentageNo: data.summary.percentageNo,
        totalHoldings: data.summary.totalHoldings,
        yesHoldings: data.summary.yesHoldings,
        noHoldings: data.summary.noHoldings,
      });
    } catch (error) {
      console.error('Fetch vote counts error:', error);
      setError('Failed to load vote counts');
    }
  };

  const resolutionChartData = {
    labels: ['For', 'Against'],
    datasets: [{
      data: [(Number(voteCounts.yes)+Number(proxyVotes)).toLocaleString(), (Number(voteCounts.no)).toLocaleString()],
      backgroundColor: ['#4CAF50', '#F44336'],
      hoverBackgroundColor: ['#66BB6A', '#EF5350'],
      borderWidth: 1,
    }],
  };

  const auditChartData = {
    labels: auditResults.map(m => m.name),
    datasets: [{
      label: 'Votes',
      data: auditResults.map(m => m.votesFor || 0),
      backgroundColor: '#4CAF50',
      borderColor: '#388E3C',
      borderWidth: 1
    }]
  };

  const resolutionChartOptions = {
    responsive: true,
    rotation: -180, 
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const total = voteCounts.total || 1;
            const value = context.raw || 0;
            const percentage = Math.round((value / total) * 100);
            return `${context.label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  const auditChartOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: {
        display: false
      }
    }
  };

  if (loading) {
    return (
      <div className="results-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-page">
        <div className="error-container">
          <div className="error-message">
            <h3>{error}</h3>
            <button onClick={() => window.location.reload()} className="back-button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeResolution && !activeAuditMember) {
    return (
      <div className="results-page">
        <div className="no-active-voting-message">
          <span role="img" aria-label="no results" style={{fontSize:'3em'}}>📊</span>
          <h3>No active voting at the moment.</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="header">
        <img src="/favicon.png" alt="Left Logo" />
        <img src="/lasaco.jpg" alt="Right Logo" />
      </div>
      
      <h2>Voting Results</h2>
      
      {activeAuditMember && (
        <div className="current-resolution">
          <h2>Audit Committee Election</h2>
          {/* <h1><span style={{fontSize:'0.8em',marginLeft:'10px'}}>
            {isVotingOpen ? (timeLeft>0?`(${formatTime(timeLeft)})`:'(Time\'s up)') : ''}
          </span></h1> */}
          
          <div className="results-display">
            <div className="chart-container audit-chart" style={{ height: '500px' }}>
              <Bar data={auditChartData} options={auditChartOptions} />
            </div>
            
            <div className="results-summary">
              <div className="summary-box for">
                {/* <h4>Leading Candidate</h4> */}
                <p>
                  {/* <span className="label">Name:</span> 
                  <strong>{auditResults.reduce((max, m) => 
                    (m.votesFor || 0) > (max.votesFor || 0) ? m : max, 
                    { votesFor: 0, name: 'None' }
                  ).name}</strong> */}
                  {/* Active audit committee member */}
                  <strong>{activeAuditMember ? activeAuditMember.name : 'N/A'}</strong>
                  <span className="label">Count:</span> 
                  <strong>{(auditResults.find(m => m.id === activeAuditMember?.id)?.votesFor || 0).toLocaleString()}</strong>
                </p>
                {/* <p>
                  <span className="label">Count:</span> 
                  <strong>{auditResults.reduce((max, m) => 
                    Math.max(max, m.votesFor || 0), 0
                  ).toLocaleString()}</strong>
                </p> */}
              </div>
              
              <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", marginTop: "20px" }}>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditResults.map(member => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td className={member.id === activeAuditMember.id ? 'for-column' : ''}>
                        {member.votesFor || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* <button onClick={downloadPDF} className="pdf-button">
            Download PDF
          </button> */}
        </div>
      )}

      {activeResolution && !activeAuditMember && (
        <div className="current-resolution">
        
          <h1><span style={{fontSize:'0.8em',marginLeft:'10px'}}>
            {isVotingOpen ? (timeLeft>0?`(${formatTime(timeLeft)})`:'(Time\'s up)') : ''}
          </span></h1>
          <h2>{activeResolution.title}</h2>
          <p>{activeResolution.description}</p>
          
          <div className="results-display">
            <div className="chart-container">
              <Doughnut data={resolutionChartData} options={resolutionChartOptions} />
            </div>
            
            <div className="results-summarytable">
              <div class="results-summary">
                <div className="summary-box for">
                  <h4>FOR</h4>
                  <p><span className="label">Percentage:</span> <strong>{yesPercentage}%</strong></p>
                  <p><span className="label">Count:</span> <strong>{(Number(voteCounts.yes)+Number(proxyVotes)).toLocaleString()}</strong></p>
                  <p><span className="label">Holdings:</span> <strong>{(Number(proxyHoldings)+Number(voteCounts.yesHoldings)).toLocaleString()}</strong></p>
                </div>
                <div className="summary-box against">
                  <h4>AGAINST</h4>
                  <p><span className="label">Percentage:</span> <strong>{noPercentage}%</strong></p>
                  <p><span className="label">Count:</span> <strong>{(Number(voteCounts.no)).toLocaleString()}</strong></p>
                  <p><span className="label">Holdings:</span> <strong>{(Number(voteCounts.noHoldings)).toLocaleString()}</strong></p>
                </div>
              </div>   
              
              <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", marginTop: "20px" }}>
                <thead>
                  <tr>
                    <th></th>
                    <th colSpan="3">FOR</th>
                    <th colSpan="3">AGAINST</th>
                  </tr>
                  <tr>
                    <th></th>
                    <th>Count</th>
                    <th>Holdings</th>
                    <th>percentage</th>
                    <th>Count</th>
                    <th>Holdings</th>
                    <th>percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Proxy</td>
                    <td className='for-column'>{(Number(proxyVotes)).toLocaleString()}</td>
                    <td className='for-column'>{(Number(proxyHoldings)).toLocaleString()}</td>
                    <td className='for-column'>100%</td>
                    <td className='against-column'>0</td>
                    <td className='against-column'>0</td>
                    <td className='against-column'>0%</td>
                  </tr>
                  <tr>                                                                                                                              
                    <td>Self</td>
                    <td className='for-column'>{(Number(voteCounts.yes)).toLocaleString()}</td>
                    <td className='for-column'>{(Number(voteCounts.yesHoldings)).toLocaleString()}</td>
                    <td className='for-column'>{voteCounts.percentageYes}%</td>
                    <td className='against-column'>{(Number(voteCounts.no)).toLocaleString()}</td>
                    <td className='against-column'>{(Number(voteCounts.noHoldings)).toLocaleString()}</td>
                    <td className='against-column'>{voteCounts.percentageNo}%</td>
                  </tr>
                  <tr>
                    <td><strong>TOTAL</strong></td>
                    <td className='for-column'><strong>{(Number(voteCounts.yes)+Number(proxyVotes)).toLocaleString()}</strong></td>
                    <td className='for-column'><strong>{(Number(proxyHoldings)+Number(voteCounts.yesHoldings)).toLocaleString()}</strong></td>
                    <td className='for-column'><strong>{yesPercentage}%</strong></td>
                    <td className='against-column'><strong>0</strong></td>
                    <td className='against-column'><strong>{(Number(voteCounts.noHoldings)).toLocaleString()}</strong></td>
                    <td className='against-column'><strong>{noPercentage}%</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
{/*           <button onClick={downloadPDF} className="pdf-button">
            Download PDF
          </button> */}
          <div className="proxy-toggle-buttons">
{/*             <button
              className="proxy-toggle-btn"
              onClick={() => {
                setProxyVotes(0);
                setProxyHoldings(0);
              }}
            >
              Disable Proxy Votes and Holdings
            </button> */}
{/*             <button
              className="proxy-toggle-btn"
              onClick={() => {
                setProxyVotes(DEFAULT_PROXY_VOTES);
                setProxyHoldings(DEFAULT_PROXY_HOLDINGS);
              }}
            >
              Enable Proxy Votes and Holdings
            </button> */}
          </div>
        </div>
      )}
    </div>
  );
}
