import { useState } from 'react';
import './Modal.css';

function EditNameModal({ currentName, onSave, onCancel, required = false }) {
  const [name, setName] = useState(currentName);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !required) {
      onCancel();
    }
  };

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{required ? 'Please Enter Your Name' : 'Edit Name'}</h3>
        {required && (
          <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            We need your name to personalize your experience.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nameInput">Name:</label>
            <input
              type="text"
              id="nameInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength="100"
              required
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            {!required && (
              <button type="button" onClick={onCancel} className="btn btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditNameModal;


