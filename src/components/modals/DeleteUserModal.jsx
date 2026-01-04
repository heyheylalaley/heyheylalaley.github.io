import './Modal.css';

function DeleteUserModal({ userEmail, userName, onConfirm, onCancel, loading }) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Confirm User Deletion</h3>
        <p>
          Are you sure you want to delete user <strong>{userName}</strong> ({userEmail})?
          <br />
          <br />
          This action cannot be undone. All entries for this user will also be deleted.
        </p>
        <div className="modal-actions">
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteUserModal;

