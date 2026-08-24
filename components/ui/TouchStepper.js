import React from 'react';

/**
 * Mobile Touch Quantity Stepper with large - and + buttons
 */
export default function TouchStepper({ value = 0, onChange, min = 0, max = 9999, step = 1 }) {
  const handleDecrement = () => {
    const nextVal = Math.max(min, Number(value || 0) - step);
    if (onChange) onChange(nextVal);
  };

  const handleIncrement = () => {
    const nextVal = Math.min(max, Number(value || 0) + step);
    if (onChange) onChange(nextVal);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '3px', border: '1px solid #cbd5e1', userSelect: 'none' }}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: value <= min ? '#e2e8f0' : '#ffffff',
          color: value <= min ? '#94a3b8' : '#0f172a',
          border: 'none',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: value <= min ? 'not-allowed' : 'pointer',
          boxShadow: value <= min ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        -
      </button>

      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
        style={{
          width: '44px',
          textAlign: 'center',
          border: 'none',
          backgroundColor: 'transparent',
          fontSize: '15px',
          fontWeight: 700,
          color: '#0f172a',
          outline: 'none',
          appearance: 'textfield'
        }}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: value >= max ? '#e2e8f0' : '#16a34a',
          color: value >= max ? '#94a3b8' : '#ffffff',
          border: 'none',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: value >= max ? 'not-allowed' : 'pointer',
          boxShadow: value >= max ? 'none' : '0 1px 2px rgba(0,0,0,0.1)'
        }}
      >
        +
      </button>
    </div>
  );
}
