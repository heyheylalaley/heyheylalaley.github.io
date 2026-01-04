import { useState } from 'react';
import './Modal.css';

function EditUserNameModal({ userEmail, currentName, onSave, onCancel }) {
  const [name, setName] = useState(currentName);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(userEmail, name.trim());
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Edit User Name</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="userNameInput">Name:</label>
            <input
              type="text"
              id="userNameInput"
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
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserNameModal;

