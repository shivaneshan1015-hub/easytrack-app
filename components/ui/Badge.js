import React from 'react';

/**
 * Clean status pill badge component
 * @param {Object} props
 * @param {'draft' | 'approved' | 'delivered' | 'paid' | 'hold' | 'pending' | 'active' | 'success' | 'warning' | 'danger'} [props.status='pending']
 * @param {React.ReactNode} [props.children]
 * @param {string} [props.className='']
 * @param {Object} [props.style={}]
 */
export default function Badge({ status = 'pending', children, className = '', style = {} }) {
  const statusConfig = {
    draft: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Draft' },
    pending: { bg: '#fffbebe', color: '#b45309', border: '#fde68a', label: 'Pending' },
    approved: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Approved' },
    delivered: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Delivered' },
    paid: { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', label: 'Paid' },
    hold: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Credit Hold' },
    active: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Active' },
    success: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Success' },
    warning: { bg: '#fffbebe', color: '#b45309', border: '#fde68a', label: 'Warning' },
    danger: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Alert' },
  };

  const key = (status || 'pending').toLowerCase();
  const cfg = statusConfig[key] || statusConfig.pending;

  return (
    <span
      className={`et-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: cfg.color,
          display: 'inline-block'
        }}
      />
      {children || cfg.label}
    </span>
  );
}
