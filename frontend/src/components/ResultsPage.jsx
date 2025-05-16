import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Doughnut } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import './ResultsPage.css';
ChartJS.register(ArcElement, Tooltip, Legend);
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// import{  ChartDataLabels as Chart } from 'chartjs-plugin-datalabels';

// Chart.register(ChartDataLabels);

const Proxy_votes = 120;
const Proxy_Holdings  =136789566;

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [activeResolution, setActiveResolution] = useState(null);
  const [voteCounts, setVoteCounts] = useState({ 
    yes: 0, 
    no: 0, 
    total: 0, 
    percentageYes: 0,
    percentageNo: 0,
    totalHoldings: 0,
    Proxy_votes,
    totalproxyVotes:0,
    yesHoldings: 0,
    noHoldings: 0,
    percentageYesHoldings: 0,
    percentageNoHoldings: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3000', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    // Debug socket connection
    newSocket.on('connect', () => console.log('Connected to socket server'));
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Connection error. Some real-time features may not work.');
    });

    // Fetch initial data
    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchResults(),
          fetchActiveResolution(),
        ]);
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
          totalproxyVotes: data.total + Proxy_votes,
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
      if (resolution) {
        fetchVoteCounts(resolution.id);
      } else {
        setVoteCounts({ yes: 0, no: 0, total: 0, percentageYes: 0, percentageNo: 0 });
      }
    };
  
    socket.on('vote-updated', handleVoteUpdate);
    socket.on('resolution-update', handleResolutionUpdate);
  
    return () => {
      socket.off('vote-updated', handleVoteUpdate);
      socket.off('resolution-update', handleResolutionUpdate);
    };
  }, [socket, activeResolution]);


  const downloadPDF = async () => {
    try {
      // Show loading state
      setLoading(true);
      
      // Get the element you want to convert to PDF
      const element = document.querySelector('.results-container');
      
      // Use html2canvas to capture the element as an image
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY // Fix for scrolling issues
      });
      
      // Create a new PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate the PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add the first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Download the PDF
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
      const res = await fetch('http://localhost:3000/api/results');
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
      const res = await fetch('http://localhost:3000/api/active-resolution');
      if (!res.ok) throw new Error('Failed to fetch active resolution');
      const data = await res.json();
      setActiveResolution(data || null);
      if (data) await fetchVoteCounts(data.id);
    } catch (error) {
      console.error('Fetch active resolution error:', error);
      setError('Failed to load active resolution');
    }
  };

  const fetchVoteCounts = async (resolutionId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/results/${resolutionId}`);
      if (!res.ok) throw new Error('Failed to fetch vote counts');
      const { data } = await res.json();
      
      setVoteCounts({
        yes: data.summary.yesVotes,
        no: data.summary.noVotes,
        total: data.summary.totalVotes,
        totalproxyVotes:data.summary.totalproxyVotes,
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

  const chartData = {
    labels: ['For', 'Against'],
    datasets: [{
      data: [voteCounts.yes, voteCounts.no],
      backgroundColor: ['#4CAF50', '#F44336'],
      hoverBackgroundColor: ['#66BB6A', '#EF5350'],
      borderWidth: 1,
    }],
  };

  const chartOptions = {
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

  if (loading) {
    return <div className="loading-spinner">Loading results...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="results-container">
<div className="header">
  <img src="/favicon.png" alt="Left Logo" />
  <img src="/sahco.png" alt="Right Logo" />
</div>

      
      <h2>Voting Results</h2>
      
      {/* Current Resolution Section */}
      {activeResolution && (
        <div className="current-resolution">
          <h2> {activeResolution.title}</h2>
          <p>{activeResolution.description}</p>
          
          <div className="results-display">
            <div className="chart-container">
              <Doughnut data={chartData} options={chartOptions} />
            </div>
            
            <div className="results-summarytable">
          

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
      <th >percentage</th>
    
    
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Proxy</td>
      <td  className='for-column'>{(Number(Proxy_votes)).toLocaleString()}</td>
      <td  className='for-column'>{(Number(Proxy_Holdings)).toLocaleString()}</td>
    <td  className='for-column'>100%</td>
      <td  className='against-column'>0</td>
      <td className='against-column'>0</td>
      <td className='against-column'>0%</td>
    </tr>
    <tr>                                                                                                                              
      <td>Self</td>
      <td  className='for-column'>{(Number(voteCounts.yes)).toLocaleString()}</td>
      <td  className='for-column'>{(Number(voteCounts.yesHoldings)).toLocaleString()}</td>
      <td  className='for-column'>{voteCounts.percentageYes}%</td>
      <td className='against-column'>{(Number(voteCounts.no)).toLocaleString()}</td>
      <td className='against-column'>{(Number(voteCounts.noHoldings)).toLocaleString()}</td>
      <td className='against-column'>{voteCounts.percentageNo}%</td>
    </tr>
    <tr>
      <td><strong>TOTAL</strong></td>
      <td  className='for-column'><strong>{(Number(voteCounts.yes)+Number(Proxy_votes)).toLocaleString()}</strong></td>
      <td  className='for-column'><strong>{(Number(Proxy_Holdings)+Number(voteCounts.yesHoldings)).toLocaleString()}</strong></td>
      {/* <td>100%</td> */}
      <td  className='for-column'><strong></strong></td>
      <td className='against-column'><strong>0</strong></td>
      <td className='against-column'><strong>{(Number(voteCounts.noHoldings)).toLocaleString()}</strong></td>
    </tr>
  </tbody>
</table>

{/* <p style={{ fontSize: "12px", marginTop: "10px" }}>
  Please note that 220 Shareholders Abstained on this Resolution.
</p> */}


<h3>Voting Summary</h3>

{/* <p>Total Number of people Present by person and proxy: <strong>{(Number(voteCounts.yes)+Number(Proxy_votes)).toLocaleString()}</strong> </p>
<p>Total Number of Shares Voted on the Resolution:  <strong>{(Number(Proxy_Holdings)+Number(voteCounts.yesHoldings)+Number(voteCounts.noHoldings)).toLocaleString()} </strong>  </p>
<p>Total Percentage in Favour:<strong> {voteCounts.percentageYes}%</strong></p>
<p>Total Percentage Against: <strong>{voteCounts.percentageNo}%</strong></p> */}



<div class="results-summary">
  <div class="summary-box">
    <p>Total Number of people Present by person and proxy: <strong>{(Number(voteCounts.yes)+Number(Proxy_votes)).toLocaleString()}</strong></p>
  </div>
  <div class="summary-box">
    <p>Total Number of Shares Voted on the Resolution: <strong>{(Number(Proxy_Holdings)+Number(voteCounts.yesHoldings)+Number(voteCounts.noHoldings)).toLocaleString()}</strong></p>
  </div>
  <div class="summary-box">
    <p>Total Percentage in Favour:<strong> {voteCounts.percentageYes}%</strong></p>
  </div>
  <div class="summary-box">
    <p>Total Percentage Against: <strong>{voteCounts.percentageNo}%</strong></p>
  </div>
</div>

              



            </div>
          </div>
          <button onClick={downloadPDF} className="pdf-button">
  Download PDF
</button>
        </div>
        
      )}

      {/* All Resolutions Section */}
      {/* <div className="all-resolutions">
        <h2>All Resolutions</h2>
        <div className="resolution-list">
          {results.map((result) => (
            <div key={result.id} className={`resolution-card ${result.isActive ? 'active' : ''}`}>
              <h3>{result.title}</h3>
              <p>{result.description}</p>
              <div className="resolution-stats">
                <span className="yes-stat">{result.yesVotes} Yes</span>
                <span className="no-stat">{result.noVotes} No</span>
                <span className="total-stat">{result.totalVotes} Total</span>
                <span className={`status-badge ${result.status.toLowerCase()}`}>
                  {result.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
}