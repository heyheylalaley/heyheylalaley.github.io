import { useState, useEffect } from 'react';
import './Modal.css';

function EditLogModal({ log, multiplier, onSave, onCancel, loading }) {
  const [date, setDate] = useState(log.date.split('T')[0]);
  const [hours, setHours] = useState(log.factHours.toString());
  const [comment, setComment] = useState(log.comment || '');

  const creditedPreview = log.type === 'overtime'
    ? `Credited: +${(parseFloat(hours) * multiplier).toFixed(1)} hrs`
    : `Credited: -${parseFloat(hours).toFixed(1)} hrs`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hours && parseFloat(hours) >= 0.25) {
      onSave(log.id, date, hours, comment);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <h3>Edit Entry</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="editLogDate">Date</label>
            <input
              type="date"
              id="editLogDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="editLogHours">Hours</label>
            <input
              type="number"
              id="editLogHours"
              step="0.25"
              min="0.25"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
            <p className="credited-preview">{creditedPreview}</p>
          </div>
          <div className="form-group">
            <label htmlFor="editLogComment">
              Comment <span style={{ color: 'var(--gray-400)', fontWeight: 'normal' }}>(optional)</span>
            </label>
            <input
              type="text"
              id="editLogComment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Project X, urgent task"
              maxLength="200"
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditLogModal;


