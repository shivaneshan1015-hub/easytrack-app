import React from 'react';

/**
 * Clean UI Card container with elevation and optional title header
 */
export default function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  style = {},
  headerStyle = {}
}) {
  return (
    <div
      className={`et-card ${className}`}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        ...style
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '12px',
            borderBottom: '1px solid #f1f5f9',
            ...headerStyle
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.01em'
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
