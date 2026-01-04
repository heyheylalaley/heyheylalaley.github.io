import { useMemo } from 'react';
import { formatHours, calculateBalance } from '../../utils/format';
import { subDays, parseISO, format } from 'date-fns';
import './StatsChart.css';

function StatsChart({ logs }) {
  const stats = useMemo(() => {
    const last30Days = logs.filter(log => {
      try {
        const logDate = parseISO(log.date);
        const thirtyDaysAgo = subDays(new Date(), 30);
        return logDate >= thirtyDaysAgo;
      } catch {
        return false;
      }
    });

    const totalOvertime = last30Days
      .filter(log => log.type === 'overtime')
      .reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0);
    
    const totalTimeOff = last30Days
      .filter(log => log.type === 'timeoff')
      .reduce((sum, log) => sum + Math.abs(parseFloat(log.creditedHours) || 0), 0);
    
    const netChange = totalOvertime - totalTimeOff;

    return { totalOvertime, totalTimeOff, netChange };
  }, [logs]);

  return (
    <div className="card">
      <h3 className="card-title">
        <span>📊</span> Last 30 Days
      </h3>
      <div className="stats-chart">
        {/* Simple visual representation */}
        <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '4px', padding: '20px' }}>
          {Array.from({ length: 30 }, (_, i) => {
            const date = subDays(new Date(), 29 - i);
            const dayLogs = logs.filter(log => {
              try {
                return format(parseISO(log.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              } catch {
                return false;
              }
            });
            const dayTotal = dayLogs.reduce((sum, log) => sum + (parseFloat(log.creditedHours) || 0), 0);
            const height = Math.min(Math.abs(dayTotal) * 5, 100);
            
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${height}%`,
                  backgroundColor: dayTotal > 0 ? 'var(--success)' : dayTotal < 0 ? 'var(--danger)' : 'var(--gray-300)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: '2px'
                }}
                title={`${format(date, 'MMM dd')}: ${formatHours(dayTotal)}`}
              />
            );
          })}
        </div>
      </div>
      <div className="stats-summary">
        <div className="stats-item">
          <span className="stats-label">Total Overtime</span>
          <span className="stats-value positive">{formatHours(stats.totalOvertime)}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Total Time Off</span>
          <span className="stats-value negative">{formatHours(-stats.totalTimeOff)}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Net Change</span>
          <span className="stats-value">{formatHours(stats.netChange)}</span>
        </div>
      </div>
    </div>
  );
}

export default StatsChart;


