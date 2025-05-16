// ResolutionForm.jsx
import { useState, useEffect } from 'react';
import { FaPlus, FaSpinner } from 'react-icons/fa';

export default function ResolutionForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3000/api/admin/resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create resolution');
      }

      const result = await response.json();
      setSuccessMessage(`Resolution "${result.title}" created successfully!`);
      setFormData({ title: '', description: '' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="resolution-form">
      <h2>Create New Resolution</h2>
      
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
            minLength="5"
          />
        </div>

        <div className="form-group">
          <label>Description *</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
            minLength="10"
            rows={5}
          />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || !formData.title || !formData.description}
        >
          {isSubmitting ? (
            <>
              <FaSpinner className="spinner" /> Processing...
            </>
          ) : (
            <>
              <FaPlus /> Add Resolution
            </>
          )}
        </button>
      </form>
    </div>
  );
}