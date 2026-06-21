import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Doughnut, Bar } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './ResultsPage.css';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const Proxy_votes = 120;
const Proxy_Holdings = 136789566;

export default function ResultsPage() {
  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const [results, setResults] = useState([]);
  const [activeResolution, setActiveResolution] = useState(null);
  const [activeAuditMember, setActiveAuditMember] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [votingState, setVotingState] = useState({ isOpen: false, type: null });
  const [voteCounts, setVoteCounts] = useState({ 
    yes: 0, no: 0, total: 0, percentageYes: 0,
    percentageNo: 0, totalHoldings: 0, yesHoldings: 0,
    noHoldings: 0, percentageYesHoldings: 0, percentageNoHoldings: 0
  });
  const [auditResults, setAuditResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('${API_URL}');
    setSocket(newSocket);

    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchResults(),
          fetchActiveResolution(),
          fetchActiveAuditMember(),
          fetchAuditResults(),
        ]);
      } catch (err) {
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    newSocket.on('voting-state', (state) => {
      setVotingState(state);
      if (state.isOpen && state.type === 'resolution') {
        fetchActiveResolution();
      } else if (state.isOpen && state.type === 'audit') {



        fetchActiveAuditMember();
      }
    });

    newSocket.on('resolution-activated', (resolution) => {
      setActiveResolution(resolution);
      setActiveAuditMember(null);
      if (resolution) fetchVoteCounts(resolution.id);
    });

    newSocket.on('audit-member-activated', (member) => {
      setActiveAuditMember(member);
      setActiveResolution(null);
    });

    newSocket.on('vote-updated', (data) => {
      if (activeResolution && data.resolutionId === activeResolution.id) {
        setVoteCounts(prev => ({
          ...prev,
          yes: data.yes,
          no: data.no,
          total: data.total,
          totalproxyVotes: data.total + Proxy_votes,
          percentageYes: data.total > 0 ? Math.round((data.yes / data.total) * 100) : 0,
          percentageNo: data.total > 0 ? Math.round((data.no / data.total) * 100) : 0,
          totalHoldings: data.totalHoldings,
          yesHoldings: data.yesHoldings,
          noHoldings: data.noHoldings,
        }));
      }
    });

    newSocket.on('audit-vote-updated', (data) => {
      setAuditResults(prev => 
        prev.map(m => 
          m.id === data.committeeId ? { ...m, votesFor: data.votesFor } : m
        )
      );
      if (activeAuditMember?.id === data.committeeId) {
        setActiveAuditMember(prev => ({ ...prev, votesFor: data.votesFor }));
      }
    });

    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    if (!votingState.isOpen || !(activeResolution || activeAuditMember)) {
      setTimeLeft(0);
      return;
    }
    setTimeLeft(60);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [votingState.isOpen, activeResolution, activeAuditMember]);

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
      const res = await fetch('${API_URL}/api/results');
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
      const res = await fetch('${API_URL}/api/active-resolution');
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch active resolution');
      }
      const data = await res.json();
      setActiveResolution(data || null);
      if (data) await fetchVoteCounts(data.id);
    } catch (error) {
      console.error('Fetch active resolution error:', error);
      setActiveResolution(null);
    }
  };

  const fetchActiveAuditMember = async () => {
    try {
      const res = await fetch('${API_URL}/api/admin/audit-committee/active');
      if (res.status === 404) {
        setActiveAuditMember(null);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch active audit member');
      }
      const { success, data } = await res.json();
      if (success) {
        setActiveAuditMember(data || null);
      }
    } catch (error) {
      console.error('Error fetching active audit member:', error);
      setActiveAuditMember(null);
    }
  };

  const fetchAuditResults = async () => {
    try {
      const res = await fetch('${API_URL}/api/audit-committee');
      if (res.ok) {
        const data = await res.json();
        setAuditResults(data);
      }
    } catch (error) {
      console.error('Error fetching audit results:', error);
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
      data: [voteCounts.yes, voteCounts.no],
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

  if (loading) return <div className="loading-spinner">Loading results...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="results-container">
      <div className="header">
        <img src="/favicon.png" alt="Left Logo" />
        <img src="/intbrew.png" alt="Right Logo" />
      </div>
      
      <h2>Voting Results</h2>
      
      {!activeResolution && !activeAuditMember ? (
        <div className="no-active-session">
          <p>There is currently no active voting session.</p>
        </div>
      ) : activeAuditMember ? (
        <div className="current-resolution">
          <h2>Audit Committee Election</h2>
          <h1>
            {activeAuditMember.name}
            <span style={{fontSize:'0.8em',marginLeft:'10px'}}>
              {votingState.isOpen ? (timeLeft>0?`(${formatTime(timeLeft)})`:'(Time\'s up)') : ''}
            </span>
          </h1>
          
          <div className="results-display">
            <div className="chart-container" style={{ height: '400px' }}>
              <Bar data={auditChartData} options={{
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } }
              }} />
            </div>
            
            <div className="results-summary">
              <div className="summary-box for">
                <h4>Leading Candidate</h4>
                <p>
                  <span className="label">Name:</span> 
                  <strong>{auditResults.reduce((max, m) => 
                    (m.votesFor || 0) > (max.votesFor || 0) ? m : max, 
                    { votesFor: 0, name: 'None' }
                  ).name}</strong>
                </p>
                <p>
                  <span className="label">Votes:</span> 
                  <strong>{auditResults.reduce((max, m) => 
                    Math.max(max, m.votesFor || 0), 0
                  ).toLocaleString()}</strong>
                </p>
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
          <button onClick={downloadPDF} className="pdf-button">
            Download PDF
          </button>
        </div>
      ) : (
        <div className="current-resolution">
          <h1>
            {activeResolution.title}
            <span style={{fontSize:'0.8em',marginLeft:'10px'}}>
              {votingState.isOpen ? (timeLeft>0?`(${formatTime(timeLeft)})`:'(Time\'s up)') : ''}
            </span>
          </h1>
          <p>{activeResolution.description}</p>
          
          <div className="results-display">
            <div className="chart-container">
              <Doughnut data={resolutionChartData} options={{
                responsive: true,
                rotation: -180,
                plugins: {
                  legend: { position: 'bottom' },
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
              }} />
            </div>
            
            <div className="results-summarytable">
              <div className="results-summary">
                <div className="summary-box for">
                  <h4>FOR</h4>
                  <p><span className="label">Percentage:</span> <strong>{voteCounts.percentageYes}%</strong></p>
                  <p><span className="label">Units:</span> <strong>{(Number(voteCounts.yes)+Number(Proxy_votes)).toLocaleString()}</strong></p>
                  <p><span className="label">Holdings:</span> <strong>{(Number(Proxy_Holdings)+Number(voteCounts.yesHoldings)).toLocaleString()}</strong></p>
                </div>
                <div className="summary-box against">
                  <h4>AGAINST</h4>
                  <p><span className="label">Percentage:</span> <strong>{voteCounts.percentageNo}%</strong></p>
                  <p><span className="label">Units:</span> <strong>{(Number(voteCounts.no)).toLocaleString()}</strong></p>
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
                    <td className='for-column'>{(Number(Proxy_votes)).toLocaleString()}</td>
                    <td className='for-column'>{(Number(Proxy_Holdings)).toLocaleString()}</td>
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
                    <td className='for-column'><strong>{(Number(voteCounts.yes)+Number(Proxy_votes)).toLocaleString()}</strong></td>
                    <td className='for-column'><strong>{(Number(Proxy_Holdings)+Number(voteCounts.yesHoldings)).toLocaleString()}</strong></td>
                    <td className='for-column'><strong></strong></td>
                    <td className='against-column'><strong>0</strong></td>
                    <td className='against-column'><strong>{(Number(voteCounts.noHoldings)).toLocaleString()}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          // In your JSX render:
{activeResolution ? (
  <div className="current-resolution">
    {/* Your resolution display code */}
  </div>
) : (
  <div className="no-active-resolution">
    <h3>No Active Resolution</h3>
    <p>There is currently no resolution being voted on.</p>
  </div>
)}
          <button onClick={downloadPDF} className="pdf-button">
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}