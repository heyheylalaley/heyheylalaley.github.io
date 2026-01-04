import './Modal.css';

function ChangeRoleModal({ userEmail, userName, currentRole, newRole, onConfirm, onCancel }) {
  const roleText = newRole === 'admin' ? 'administrator' : 'regular user';

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Change User Role</h3>
        <p>
          Are you sure you want to change <strong>{userName}</strong>'s role from{' '}
          <strong>{currentRole === 'admin' ? 'administrator' : 'user'}</strong> to{' '}
          <strong>{roleText}</strong>?
        </p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirm
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeRoleModal;

