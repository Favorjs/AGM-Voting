// ResolutionModal.jsx
export default function ResolutionModal({ resolutions, onClose, onActivate }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Manage Resolutions</h2>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <div className="resolution-list">
          {resolutions.map(resolution => (
            <div key={resolution.id} className="resolution-item">
              <h3>{resolution.title}</h3>
              <button 
                onClick={() => onActivate(resolution.id)}
                disabled={resolution.isActive}
              >
                {resolution.isActive ? 'Active' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}