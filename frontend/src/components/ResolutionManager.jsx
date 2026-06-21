import { useState, useEffect } from 'react';
import { API_URL } from '../config';

export default function ResolutionForm({ resolution = null, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resolution) {
      setFormData({ title: resolution.title || '', description: resolution.description || '' });
    }
  }, [resolution]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const url = resolution
        ? `${API_URL}/api/resolutions/${resolution.id}`
        : `${API_URL}/api/admin/resolutions`;
      const method = resolution ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save resolution');
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="ap-modal-title">{resolution ? 'Edit Resolution' : 'Create Resolution'}</h2>

      {error && (
        <div style={{
          background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2',
          borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.875rem',
          marginBottom: '1.25rem', textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="ap-audit-form">
        <div className="ap-field">
          <label>Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter resolution title"
            required
            minLength="5"
          />
        </div>

        <div className="ap-field">
          <label>Description *</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter resolution description"
            required
            minLength="10"
            rows={5}
          />
        </div>

        <div className="ap-form-actions">
          <button
            type="submit"
            className="ap-btn ap-btn-primary"
            disabled={isSubmitting || !formData.title || !formData.description}
          >
            {isSubmitting ? 'Saving…' : resolution ? 'Save Changes' : 'Create Resolution'}
          </button>
          {onCancel && (
            <button type="button" className="ap-btn ap-btn-outline" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
