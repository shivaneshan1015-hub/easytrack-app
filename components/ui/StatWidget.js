import React from 'react';

/**
 * KPI Metric stat tile component
 */
export default function StatWidget({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = '#2563eb',
  bgTint = '#eff6ff',
  className = '',
  style = {}
}) {
  return (
    <div
      className={`et-stat-widget ${className}`}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '18px 20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        justify: 'space-between',
        gap: '12px',
        ...style
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {title}
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {value}
          </div>
        </div>

        {icon && (
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: bgTint,
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
          {trend && (
            <span
              style={{
                fontWeight: 700,
                color: trend.startsWith('+') ? '#16a34a' : '#dc2626',
                backgroundColor: trend.startsWith('+') ? '#f0fdf4' : '#fef2f2',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              {trend}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
