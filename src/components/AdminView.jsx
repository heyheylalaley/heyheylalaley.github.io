import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { createLog, updateLog, deleteLog, approveTimeOff, acknowledgeEdit } from '../services/logs';
import { updateUserName, updateUserRole, deleteUser } from '../services/users';
import { showToast } from '../utils/toast';
import { filterByDate, searchLogs, sortLogs, formatHours, calculateBalance, formatDate } from '../utils/format';
import BalanceCard from './user/BalanceCard';
import QuickAddButtons from './user/QuickAddButtons';
import AddLogForm from './user/AddLogForm';
import EditLogModal from './modals/EditLogModal';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import EditUserNameModal from './modals/EditUserNameModal';
import ChangeRoleModal from './modals/ChangeRoleModal';
import DeleteUserModal from './modals/DeleteUserModal';
import ChangeHistoryModal from './modals/ChangeHistoryModal';
import './AdminView.css';

function AdminView({ onRefresh }) {
  const {
    currentUser,
    logs,
    users,
    currentMultiplier,
    currentDateFilter,
    sortOrder,
    setLogs,
    setUsers,
    addLog,
    updateLog: updateLogStore,
    removeLog,
    updateUser: updateUserStore,
    removeUser: removeUserStore,
    setDateFilter,
    setSortOrder,
    setDeleteLogId,
    setEditLogId,
    deleteLogId,
    editLogId
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [editUserEmail, setEditUserEmail] = useState(null);
  const [editUserName, setEditUserName] = useState(null);
  const [changeRoleEmail, setChangeRoleEmail] = useState(null);
  const [changeRoleName, setChangeRoleName] = useState(null);
  const [changeRoleCurrent, setChangeRoleCurrent] = useState(null);
  const [changeRoleNew, setChangeRoleNew] = useState(null);
  const [deleteUserEmail, setDeleteUserEmail] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState(null);
  const [historyLogId, setHistoryLogId] = useState(null);

  // Calculate admin's balance
  const adminLogs = useMemo(() => 
    logs.filter(log => log.userEmail === currentUser.email),
    [logs, currentUser.email]
  );
  const adminBalance = useMemo(() => calculateBalance(adminLogs), [adminLogs]);
  const adminTotalOvertime = useMemo(() => 
    adminLogs.filter(log => log.type === 'overtime')
      .reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0),
    [adminLogs]
  );
  const adminTotalTimeOff = useMemo(() => 
    adminLogs.filter(log => log.type === 'timeoff')
      .reduce((sum, log) => sum + Math.abs(parseFloat(log.creditedHours) || 0), 0),
    [adminLogs]
  );

  // Filter logs by selected user
  const filteredLogs = useMemo(() => {
    let filtered = selectedUserEmail 
      ? logs.filter(log => log.userEmail === selectedUserEmail)
      : logs;
    
    filtered = filterByDate(filtered, currentDateFilter);
    filtered = searchLogs(filtered, searchTerm);
    return sortLogs(filtered, sortOrder);
  }, [logs, selectedUserEmail, currentDateFilter, searchTerm, sortOrder]);

  const handleQuickAdd = async (hours) => {
    if (loading) return;
    setLoading(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const log = await createLog(currentUser.email, today, 'overtime', hours, '', currentMultiplier);
      addLog(log);
      showToast(`Added ${hours} hour(s) of overtime`, 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = async (date, type, hours, comment) => {
    if (loading) return;
    setLoading(true);
    
    const targetEmail = selectedUserEmail || currentUser.email;
    
    try {
      const log = await createLog(targetEmail, date, type, hours, comment, currentMultiplier);
      addLog(log);
      setShowAddForm(false);
      showToast('Entry added successfully', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLog = async (logId, date, hours, comment) => {
    if (loading) return;
    setLoading(true);
    
    try {
      const log = filteredLogs.find(l => l.id === logId);
      const factHours = parseFloat(hours);
      const creditedHours = log.type === 'overtime'
        ? factHours * currentMultiplier
        : -factHours;
      
      const updated = await updateLog(
        logId,
        {
          date,
          fact_hours: factHours,
          credited_hours: creditedHours,
          comment: comment || null
        },
        currentUser,
        log
      );
      
      updateLogStore(logId, updated);
      setEditLogId(null);
      showToast('Entry updated successfully', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!deleteLogId || loading) return;
    setLoading(true);
    
    try {
      await deleteLog(deleteLogId);
      removeLog(deleteLogId);
      setDeleteLogId(null);
      showToast('Entry deleted successfully', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTimeOff = async (logId) => {
    if (loading) return;
    setLoading(true);
    
    try {
      await approveTimeOff(logId, currentUser.name);
      const updated = filteredLogs.find(l => l.id === logId);
      if (updated) {
        updateLogStore(logId, { ...updated, approvedBy: currentUser.name });
      }
      showToast('Time off approved', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeEdit = async (logId) => {
    if (loading) return;
    setLoading(true);
    
    try {
      await acknowledgeEdit(logId, currentUser.name);
      const updated = filteredLogs.find(l => l.id === logId);
      if (updated) {
        updateLogStore(logId, { ...updated, acknowledgedBy: currentUser.name });
      }
      showToast('Entry acknowledged', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserName = async (userEmail, newName) => {
    if (loading) return;
    setLoading(true);
    
    try {
      await updateUserName(userEmail, newName);
      updateUserStore(userEmail, { name: newName });
      setEditUserEmail(null);
      setEditUserName(null);
      showToast('User name updated successfully', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userEmail, newRole) => {
    if (loading) return;
    setLoading(true);
    
    try {
      if (userEmail === currentUser.email) {
        showToast('You cannot change your own role', 'error', 'Error');
        return;
      }
      
      await updateUserRole(userEmail, newRole);
      updateUserStore(userEmail, { role: newRole });
      setChangeRoleEmail(null);
      setChangeRoleName(null);
      setChangeRoleCurrent(null);
      setChangeRoleNew(null);
      showToast(`User role successfully changed to ${newRole === 'admin' ? 'administrator' : 'regular user'}`, 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserEmail || loading) return;
    setLoading(true);
    
    try {
      await deleteUser(deleteUserEmail);
      removeUserStore(deleteUserEmail);
      setDeleteUserEmail(null);
      setDeleteUserName(null);
      showToast('User deleted successfully', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const logToEdit = editLogId ? filteredLogs.find(l => l.id === editLogId) : null;
  const historyLog = historyLogId ? filteredLogs.find(l => l.id === historyLogId) : null;

  return (
    <div className="admin-view">
      <div className="container">
        {/* Admin Personal Section */}
        <div className="card">
          <h2 className="card-title">
            <span>👤</span> My Account
          </h2>
          <BalanceCard
            balance={adminBalance}
            multiplier={currentMultiplier}
            totalOvertime={adminTotalOvertime}
            totalTimeOff={adminTotalTimeOff}
          />
          <QuickAddButtons
            onQuickAdd={handleQuickAdd}
            onCustomClick={() => setShowAddForm(true)}
            loading={loading}
          />
          {showAddForm && (
            <AddLogForm
              onSubmit={handleAddLog}
              onCancel={() => setShowAddForm(false)}
              multiplier={currentMultiplier}
              loading={loading}
            />
          )}
        </div>

        {/* Employees List */}
        <div className="card">
          <h2 className="card-title">
            <span>👥</span> Employees
          </h2>
          <div className="users-list">
            {users.map(user => {
              const userLogs = logs.filter(log => log.userEmail === user.email);
              const userBalance = calculateBalance(userLogs);
              
              return (
                <div
                  key={user.email}
                  className={`user-card ${selectedUserEmail === user.email ? 'selected' : ''}`}
                  onClick={() => setSelectedUserEmail(selectedUserEmail === user.email ? null : user.email)}
                >
                  <div className="user-info">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                    <div className="user-balance-label">Balance: {formatHours(userBalance)}</div>
                    {user.role === 'admin' && (
                      <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '4px' }}>
                        👑 Administrator
                      </div>
                    )}
                  </div>
                  <div className="user-actions">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditUserEmail(user.email);
                        setEditUserName(user.name);
                      }}
                      title="Edit name"
                    >
                      ✏️
                    </button>
                    {user.email !== currentUser.email && (
                      <>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newRole = user.role === 'admin' ? 'user' : 'admin';
                            setChangeRoleEmail(user.email);
                            setChangeRoleName(user.name);
                            setChangeRoleCurrent(user.role);
                            setChangeRoleNew(newRole);
                          }}
                          title="Change role"
                        >
                          {user.role === 'admin' ? '👤' : '👑'}
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUserEmail(user.email);
                            setDeleteUserName(user.name);
                          }}
                          title="Delete user"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All Records */}
        <div className="card">
          <h2 className="card-title">
            <span>📋</span> {selectedUserEmail ? 'User Records' : 'All Records'}
          </h2>
          <div className="search-container">
            <div className="search-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, email, comments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div className="date-filters">
              {['all', 'today', 'week', 'month'].map(filter => (
                <button
                  key={filter}
                  className={`date-filter-btn ${currentDateFilter === filter ? 'active' : ''}`}
                  onClick={() => setDateFilter(filter)}
                >
                  {filter === 'all' ? 'All' : filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <span>{sortOrder === 'desc' ? '⬇️' : '⬆️'}</span>{' '}
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th className="text-right">Actual (hrs)</th>
                  <th className="text-right">Credited</th>
                  <th>Comment</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const credited = parseFloat(log.creditedHours) || 0;
                  const userName = users.find(u => u.email === log.userEmail)?.name || log.userEmail;
                  const hasHistory = log.changeHistory && log.changeHistory.length > 0;
                  const wasApproved = log.type === 'timeoff' && log.approvedBy;
                  const needsAcknowledgment = wasApproved && log.editedAt && !log.acknowledgedBy;
                  
                  return (
                    <tr key={log.id}>
                      <td>
                        {formatDate(log.date)}
                        {hasHistory && (
                          <span
                            className="history-badge"
                            onClick={() => setHistoryLogId(log.id)}
                            title={`View change history (${log.changeHistory.length} changes)`}
                            style={{ marginLeft: '8px', cursor: 'pointer' }}
                          >
                            📜 {log.changeHistory.length}
                          </span>
                        )}
                      </td>
                      <td>{userName}</td>
                      <td>
                        <span className={`log-badge ${log.type === 'overtime' ? 'badge-overtime' : 'badge-timeoff'}`}>
                          {log.type === 'overtime' ? 'Overtime' : 'Time Off'}
                        </span>
                      </td>
                      <td className="text-right">{log.factHours}</td>
                      <td className={`text-right ${credited > 0 ? 'positive' : 'negative'}`}>
                        {credited > 0 ? '+' : ''}{credited}
                      </td>
                      <td>
                        {log.comment || '-'}
                        {wasApproved && (
                          <div style={{ fontSize: '11px', color: 'var(--gray-600)', marginTop: '4px' }}>
                            Approved by: {log.approvedBy}
                            {log.editedAt && (
                              <span className="edited-badge" title="Edited after approval" style={{ marginLeft: '8px' }}>
                                ⚠️
                              </span>
                            )}
                            {log.acknowledgedBy && (
                              <span className="acknowledged-badge" title={`Acknowledged by ${log.acknowledgedBy}`} style={{ marginLeft: '8px' }}>
                                ✓ Acknowledged
                              </span>
                            )}
                          </div>
                        )}
                        {log.editedAt && !wasApproved && !hasHistory && (
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px' }}>
                            ✏️ edited
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => setEditLogId(log.id)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          {log.type === 'timeoff' && !log.approvedBy && (
                            <button
                              className="btn btn-success btn-small"
                              onClick={() => handleApproveTimeOff(log.id)}
                              title="Approve"
                            >
                              ✓
                            </button>
                          )}
                          {needsAcknowledgment && (
                            <button
                              className="btn btn-warning btn-small"
                              onClick={() => handleAcknowledgeEdit(log.id)}
                              title="Acknowledge changes"
                            >
                              ✓✓
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => setDeleteLogId(log.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-title">No entries found</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {editLogId && logToEdit && (
        <EditLogModal
          log={logToEdit}
          multiplier={currentMultiplier}
          onSave={handleEditLog}
          onCancel={() => setEditLogId(null)}
          loading={loading}
        />
      )}

      {deleteLogId && (
        <DeleteConfirmModal
          onConfirm={handleDeleteLog}
          onCancel={() => setDeleteLogId(null)}
          loading={loading}
        />
      )}

      {editUserEmail && editUserName && (
        <EditUserNameModal
          userEmail={editUserEmail}
          currentName={editUserName}
          onSave={handleUpdateUserName}
          onCancel={() => {
            setEditUserEmail(null);
            setEditUserName(null);
          }}
        />
      )}

      {changeRoleEmail && changeRoleName && changeRoleCurrent && changeRoleNew && (
        <ChangeRoleModal
          userEmail={changeRoleEmail}
          userName={changeRoleName}
          currentRole={changeRoleCurrent}
          newRole={changeRoleNew}
          onConfirm={() => handleUpdateUserRole(changeRoleEmail, changeRoleNew)}
          onCancel={() => {
            setChangeRoleEmail(null);
            setChangeRoleName(null);
            setChangeRoleCurrent(null);
            setChangeRoleNew(null);
          }}
        />
      )}

      {deleteUserEmail && deleteUserName && (
        <DeleteUserModal
          userEmail={deleteUserEmail}
          userName={deleteUserName}
          onConfirm={handleDeleteUser}
          onCancel={() => {
            setDeleteUserEmail(null);
            setDeleteUserName(null);
          }}
          loading={loading}
        />
      )}

      {historyLogId && historyLog && (
        <ChangeHistoryModal
          log={historyLog}
          onClose={() => setHistoryLogId(null)}
        />
      )}
    </div>
  );
}

export default AdminView;
