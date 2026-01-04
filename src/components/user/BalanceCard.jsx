import { formatHours } from '../../utils/format';
import './BalanceCard.css';

function BalanceCard({ balance, multiplier, totalOvertime, totalTimeOff, onEditName }) {
  const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero';

  return (
    <div className="balance-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p className="balance-label">Your Current Balance</p>
        <button
          className="btn btn-secondary btn-small"
          onClick={onEditName}
          title="Edit your name"
        >
          <span>✏️</span> Edit Name
        </button>
      </div>
      <p className={`balance-value ${balanceClass}`}>
        {formatHours(balance)}
      </p>
      <p className="balance-multiplier">
        Overtime Multiplier: <span>{multiplier}</span>x
      </p>
      <div className="balance-stats">
        <div className="balance-stat-item">
          <div className="balance-stat-label">Total Overtime</div>
          <div className="balance-stat-value positive">
            {formatHours(totalOvertime)}
          </div>
        </div>
        <div className="balance-stat-item">
          <div className="balance-stat-label">Total Time Off</div>
          <div className="balance-stat-value negative">
            {formatHours(-totalTimeOff)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BalanceCard;


