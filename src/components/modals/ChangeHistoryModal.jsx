import { formatDateTime } from '../../utils/format';
import './Modal.css';

function ChangeHistoryModal({ log, onClose }) {
  if (!log || !log.changeHistory || log.changeHistory.length === 0) {
    return null;
  }

  return (
    <div className="modal">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3>Change History</h3>
        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
          Entry ID: {log.id} | Type: {log.type === 'overtime' ? 'Overtime' : 'Time Off'}
        </p>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {log.changeHistory.map((record, index) => (
            <div
              key={index}
              style={{
                padding: '12px',
                marginBottom: '12px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong>{record.changedBy}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {formatDateTime(record.changedAt)}
                </span>
              </div>
              {record.wasApproved && (
                <div style={{ fontSize: '12px', color: 'var(--warning)', marginBottom: '8px' }}>
                  ⚠️ Edited after approval by {record.approvedBy}
                </div>
              )}
              <div>
                {Object.entries(record.changes || {}).map(([field, change]) => (
                  <div key={field} style={{ marginTop: '8px', fontSize: '14px' }}>
                    <strong>{field}:</strong>{' '}
                    <span style={{ color: 'var(--text-muted)'}}>{change.from}</span> →{' '}
                    <span style={{ color: 'var(--success)'}}>{change.to}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeHistoryModal;

