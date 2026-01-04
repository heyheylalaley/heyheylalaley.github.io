import { formatDate, formatHours } from '../../utils/format';
import { parseISO, differenceInMinutes } from 'date-fns';
import './LogsList.css';

function LogsList({ logs, currentUser, onEdit, onDelete, onViewHistory }) {
  const canDelete = (log) => {
    try {
      const createdAt = parseISO(log.createdAt);
      const now = new Date();
      const minutesDiff = differenceInMinutes(now, createdAt);
      return minutesDiff <= 5;
    } catch {
      return false;
    }
  };

  if (logs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-title">No entries</div>
        <div className="empty-state-description">Start adding overtime and time off entries to track your balance</div>
      </div>
    );
  }

  return (
    <div className="logs-list">
      {logs.map((log) => {
        const credited = parseFloat(log.creditedHours) || 0;
        const canDeleteLog = canDelete(log);
        const hasHistory = log.changeHistory && log.changeHistory.length > 0;

        return (
          <div key={log.id} className="log-item">
            <div className="log-item-left">
              <div>
                <span className={`log-badge ${log.type === 'overtime' ? 'badge-overtime' : 'badge-timeoff'}`}>
                  {log.type === 'overtime' ? 'Overtime' : 'Time Off'}
                </span>
                <span className="log-date">{formatDate(log.date)}</span>
                {hasHistory && (
                  <span
                    className="history-badge"
                    onClick={() => onViewHistory && onViewHistory(log.id)}
                    title={`View change history (${log.changeHistory.length} changes)`}
                    style={{ cursor: onViewHistory ? 'pointer' : 'default' }}
                  >
                    📜 {log.changeHistory.length}
                  </span>
                )}
              </div>
              <div className="log-details">
                Actual: <strong>{log.factHours} hrs</strong>
              </div>
              {log.comment && <div className="log-comment">{log.comment}</div>}
              {log.type === 'timeoff' && log.approvedBy && (
                <div className="log-approved-by" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--gray-600)' }}>
                  Approved By: <strong>{log.approvedBy}</strong>
                  {log.editedAt && !hasHistory && (
                    <span className="edited-badge" title="Edited after approval">
                      ⚠️ edited
                    </span>
                  )}
                </div>
              )}
              {log.editedAt && !(log.type === 'timeoff' && log.approvedBy) && !hasHistory && (
                <div className="log-edited" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--gray-500)' }}>
                  ✏️ edited
                </div>
              )}
            </div>
            <div className="log-item-right">
              <div className={`log-credited ${credited > 0 ? 'positive' : 'negative'}`}>
                {credited > 0 ? '+' : ''}{credited} hrs
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="log-edit-btn"
                  onClick={() => onEdit(log.id)}
                  title="Edit entry"
                >
                  ✏️
                </button>
                {canDeleteLog && (
                  <button
                    className="log-delete-btn"
                    onClick={() => onDelete(log.id)}
                    title="Delete entry (within 5 minutes)"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default LogsList;


