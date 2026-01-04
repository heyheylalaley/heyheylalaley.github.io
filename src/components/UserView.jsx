import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { createLog, updateLog, deleteLog } from '../services/logs';
import { updateUserName } from '../services/users';
import { showToast } from '../utils/toast';
import { filterByDate, searchLogs, sortLogs, formatHours, calculateBalance } from '../utils/format';
import BalanceCard from './user/BalanceCard';
import QuickAddButtons from './user/QuickAddButtons';
import StatsChart from './user/StatsChart';
import AddLogForm from './user/AddLogForm';
import LogsList from './user/LogsList';
import EditNameModal from './modals/EditNameModal';
import EditLogModal from './modals/EditLogModal';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import ChangeHistoryModal from './modals/ChangeHistoryModal';
import './UserView.css';

function UserView({ onRefresh }) {
  const { currentUser, logs, currentMultiplier, currentDateFilter, sortOrder, setLogs, addLog, updateLog: updateLogStore, removeLog, setDateFilter, setSortOrder, setDeleteLogId, setEditLogId, deleteLogId, editLogId } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [historyLogId, setHistoryLogId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Calculate balance and stats
  const balance = useMemo(() => calculateBalance(logs), [logs]);
  const totalOvertime = useMemo(() => 
    logs.filter(log => log.type === 'overtime')
      .reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0),
    [logs]
  );
  const totalTimeOff = useMemo(() => 
    logs.filter(log => log.type === 'timeoff')
      .reduce((sum, log) => sum + Math.abs(parseFloat(log.creditedHours) || 0), 0),
    [logs]
  );

  // Filter and sort logs
  const filteredAndSortedLogs = useMemo(() => {
    let filtered = filterByDate(logs, currentDateFilter);
    filtered = searchLogs(filtered, searchTerm);
    return sortLogs(filtered, sortOrder);
  }, [logs, currentDateFilter, searchTerm, sortOrder]);

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
    
    try {
      const log = await createLog(currentUser.email, date, type, hours, comment, currentMultiplier);
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
      const factHours = parseFloat(hours);
      const creditedHours = filteredAndSortedLogs.find(l => l.id === logId)?.type === 'overtime'
        ? factHours * currentMultiplier
        : -factHours;
      
      const log = filteredAndSortedLogs.find(l => l.id === logId);
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

  const handleUpdateName = async (name) => {
    if (loading) return;
    setLoading(true);
    
    try {
      await updateUserName(currentUser.email, name);
      const updatedUser = { ...currentUser, name };
      useStore.getState().setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowEditNameModal(false);
      showToast('Name updated successfully', 'success');
      onRefresh();
    } catch (error) {
      showToast(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const logToEdit = editLogId ? filteredAndSortedLogs.find(l => l.id === editLogId) : null;

  return (
    <div className="user-view">
      <div className="container">
        <BalanceCard
          balance={balance}
          multiplier={currentMultiplier}
          totalOvertime={totalOvertime}
          totalTimeOff={totalTimeOff}
          onEditName={() => setShowEditNameModal(true)}
        />

        <QuickAddButtons
          onQuickAdd={handleQuickAdd}
          onCustomClick={() => setShowAddForm(true)}
          loading={loading}
        />

        <StatsChart logs={logs} />

        {showAddForm && (
          <AddLogForm
            onSubmit={handleAddLog}
            onCancel={() => setShowAddForm(false)}
            multiplier={currentMultiplier}
            loading={loading}
          />
        )}

        <div className="card">
          <div className="card-header-with-actions">
            <h2 className="card-title">
              <span>📅</span> Your History
            </h2>
          </div>
          <div className="search-container">
            <div className="search-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search by comments..."
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
              title="Toggle sort order"
            >
              <span>{sortOrder === 'desc' ? '⬇️' : '⬆️'}</span>{' '}
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
          <LogsList
            logs={filteredAndSortedLogs}
            currentUser={currentUser}
            onEdit={(id) => setEditLogId(id)}
            onDelete={(id) => setDeleteLogId(id)}
            onViewHistory={(id) => setHistoryLogId(id)}
          />
        </div>
      </div>

      {showEditNameModal && (
        <EditNameModal
          currentName={currentUser.name}
          onSave={handleUpdateName}
          onCancel={() => setShowEditNameModal(false)}
        />
      )}

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

      {historyLogId && (
        <ChangeHistoryModal
          log={filteredAndSortedLogs.find(l => l.id === historyLogId)}
          onClose={() => setHistoryLogId(null)}
        />
      )}
    </div>
  );
}

export default UserView;

