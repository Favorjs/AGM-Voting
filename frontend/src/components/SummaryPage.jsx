import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { API_URL } from '../config';

const socket = io(API_URL);
export default function SummaryPage() {
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetchResults();
    socket.on('vote-updated', fetchResults);

    return () => {
      socket.off('vote-updated', fetchResults);
    };
  }, []);

  const fetchResults = async () => {
    const response = await fetch('/api/active-resolution');
    const data = await response.json();
    setResults(data);
  };

  const chartData = {
    labels: ['Yes', 'No'],
    datasets: [{
      label: 'Votes',
      data: [results?.yes || 0, results?.no || 0],
      backgroundColor: ['#4CAF50', '#F44336']
    }]
  };

  return (
    <div className="summary-container">
      <h1>Voting Summary</h1>
      
      {results ? (
        <>
          <h2>{results.title}</h2>
          <div className="chart-wrapper">
            <Bar data={chartData} options={{ responsive: true }} />
          </div>
          <div className="vote-counts">
            <p>Yes Votes: {results.yes}</p>
            <p>No Votes: {results.no}</p>
          </div>
        </>
      ) : (
        <p>No voting results available</p>
      )}
    </div>
  );
}