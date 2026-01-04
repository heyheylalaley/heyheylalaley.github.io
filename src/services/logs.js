import { supabase } from '../lib/supabase';

export const loadUserLogs = async (userEmail) => {
  const { data, error } = await supabase
    .from('logs')
    .select(`
      *,
      users!logs_user_email_fkey(name)
    `)
    .eq('user_email', userEmail)
    .order('date', { ascending: false });
  
  if (error) throw error;
  
  return data.map(log => ({
    id: log.id,
    userEmail: log.user_email,
    userName: log.users?.name || '',
    date: log.date,
    type: log.type,
    factHours: log.fact_hours,
    creditedHours: log.credited_hours,
    comment: log.comment || '',
    approvedBy: log.approved_by || '',
    acknowledgedBy: log.acknowledged_by || '',
    editedAt: log.edited_at,
    changeHistory: log.change_history || [],
    createdAt: log.created_at
  }));
};

export const loadAllLogs = async () => {
  const { data, error } = await supabase
    .from('logs')
    .select(`
      *,
      users!logs_user_email_fkey(name)
    `)
    .order('date', { ascending: false });
  
  if (error) throw error;
  
  return data.map(log => ({
    id: log.id,
    userEmail: log.user_email,
    userName: log.users?.name || '',
    date: log.date,
    type: log.type,
    factHours: log.fact_hours,
    creditedHours: log.credited_hours,
    comment: log.comment || '',
    approvedBy: log.approved_by || '',
    acknowledgedBy: log.acknowledged_by || '',
    editedAt: log.edited_at,
    changeHistory: log.change_history || [],
    createdAt: log.created_at
  }));
};

export const createLog = async (userEmail, date, type, hours, comment, multiplier) => {
  const factHours = parseFloat(hours);
  const creditedHours = type === 'overtime' 
    ? factHours * multiplier 
    : -factHours;
  
  const { data, error } = await supabase
    .from('logs')
    .insert({
      user_email: userEmail,
      date,
      type,
      fact_hours: factHours,
      credited_hours: creditedHours,
      comment: comment || null
    })
    .select(`
      *,
      users!logs_user_email_fkey(name)
    `)
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    userEmail: data.user_email,
    userName: data.users?.name || '',
    date: data.date,
    type: data.type,
    factHours: data.fact_hours,
    creditedHours: data.credited_hours,
    comment: data.comment || '',
    approvedBy: data.approved_by || '',
    acknowledgedBy: data.acknowledged_by || '',
    editedAt: data.edited_at,
    changeHistory: data.change_history || [],
    createdAt: data.created_at
  };
};

export const updateLog = async (logId, updates, currentUser, oldLog) => {
  // If change_history is provided, use it; otherwise build it from oldLog
  let updateData = { ...updates };
  
  if (oldLog && currentUser) {
    const editedAt = new Date().toISOString();
    updateData.edited_at = editedAt;
    
    // Build change history if not provided
    if (!updateData.change_history) {
      const wasApproved = oldLog.type === 'timeoff' && oldLog.approvedBy;
      const oldChangeHistory = oldLog.changeHistory || [];
      
      // Build changes object
      const changes = {};
      if (updates.date && updates.date !== oldLog.date) {
        changes.date = { from: oldLog.date, to: updates.date };
      }
      if (updates.fact_hours && updates.fact_hours !== oldLog.factHours) {
        changes.hours = { from: oldLog.factHours, to: updates.fact_hours };
      }
      if (updates.comment !== undefined && updates.comment !== (oldLog.comment || '')) {
        changes.comment = { from: oldLog.comment || '', to: updates.comment || '' };
      }
      
      // Create history record
      const historyRecord = {
        changedAt: editedAt,
        changedBy: currentUser.name,
        changedByEmail: currentUser.email,
        wasApproved: wasApproved,
        approvedBy: oldLog.approvedBy || null,
        changes: changes
      };
      
      // Append to change history
      const newChangeHistory = [...oldChangeHistory, historyRecord];
      updateData.change_history = newChangeHistory;
      
      // If entry was acknowledged and is being edited, reset acknowledged_by
      if (oldLog.acknowledgedBy && wasApproved) {
        updateData.acknowledged_by = null;
      }
    }
  }
  
  const { data, error } = await supabase
    .from('logs')
    .update(updateData)
    .eq('id', logId)
    .select(`
      *,
      users!logs_user_email_fkey(name)
    `)
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    userEmail: data.user_email,
    userName: data.users?.name || '',
    date: data.date,
    type: data.type,
    factHours: data.fact_hours,
    creditedHours: data.credited_hours,
    comment: data.comment || '',
    approvedBy: data.approved_by || '',
    acknowledgedBy: data.acknowledged_by || '',
    editedAt: data.edited_at,
    changeHistory: data.change_history || [],
    createdAt: data.created_at
  };
};

export const deleteLog = async (logId) => {
  const { error } = await supabase
    .from('logs')
    .delete()
    .eq('id', logId);
  
  if (error) throw error;
};

export const approveTimeOff = async (logId, adminName) => {
  const { data, error } = await supabase
    .from('logs')
    .update({ approved_by: adminName })
    .eq('id', logId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const acknowledgeEdit = async (logId, adminName) => {
  const { data, error } = await supabase
    .from('logs')
    .update({ acknowledged_by: adminName })
    .eq('id', logId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};


