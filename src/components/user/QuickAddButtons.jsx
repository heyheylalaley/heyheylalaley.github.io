import './QuickAddButtons.css';

function QuickAddButtons({ onQuickAdd, onCustomClick, loading }) {
  return (
    <div className="card quick-add-card">
      <h3 className="quick-add-title">Quick Add Overtime</h3>
      <div className="quick-add-buttons">
        <button
          className="quick-add-btn"
          onClick={() => onQuickAdd(1)}
          disabled={loading}
          title="Add 1 hour overtime"
        >
          <span className="quick-add-hours">+1</span>
          <span className="quick-add-label">hour</span>
        </button>
        <button
          className="quick-add-btn"
          onClick={() => onQuickAdd(2)}
          disabled={loading}
          title="Add 2 hours overtime"
        >
          <span className="quick-add-hours">+2</span>
          <span className="quick-add-label">hours</span>
        </button>
        <button
          className="quick-add-btn"
          onClick={() => onQuickAdd(3)}
          disabled={loading}
          title="Add 3 hours overtime"
        >
          <span className="quick-add-hours">+3</span>
          <span className="quick-add-label">hours</span>
        </button>
        <button
          className="quick-add-btn quick-add-custom"
          onClick={onCustomClick}
          disabled={loading}
          title="Custom entry"
        >
          <span className="quick-add-hours">...</span>
          <span className="quick-add-label">custom</span>
        </button>
      </div>
    </div>
  );
}

export default QuickAddButtons;


