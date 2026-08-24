import React from 'react';

/**
 * Official Easy Track Logo Component.
 * Pixel-perfect SVG vector rendering that seamlessly integrates across light and dark themes
 * with zero background box artifacts or image pixelation.
 *
 * @param {Object} props
 * @param {'light' | 'dark'} [props.variant='light'] - 'light' for light backgrounds, 'dark' for dark backgrounds
 * @param {number} [props.height=44] - Display height in pixels
 * @param {boolean} [props.showTagline=true] - Whether to display "Track. Manage. Grow."
 * @param {string} [props.className='']
 * @param {Object} [props.style={}]
 */
export default function Logo({
  variant = 'light',
  height = 44,
  showTagline = true,
  className = '',
  style = {}
}) {
  const isDark = variant === 'dark';

  // Exact Brand Colors
  const textColor = isDark ? '#ffffff' : '#0F172A';    // "Easy" Navy/White
  const greenColor = isDark ? '#22c55e' : '#16a34a';   // "Track" Delivery Green
  const taglineColor = isDark ? '#94a3b8' : '#475569'; // Tagline Slate
  const truckOutline = isDark ? '#ffffff' : '#0F172A';

  const scale = height / 44;
  const truckWidth = Math.round(52 * scale);
  const truckHeight = Math.round(height);

  return (
    <div
      className={`easy-track-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.max(8, Math.round(12 * scale))}px`,
        userSelect: 'none',
        ...style
      }}
    >
      {/* 🚚 Crisp Vector Truck Icon */}
      <svg
        width={truckWidth}
        height={truckHeight}
        viewBox="0 0 140 85"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Speed Lines (Green) */}
        <path d="M12 18H48" stroke={greenColor} strokeWidth="7" strokeLinecap="round" />
        <path d="M4 33H40" stroke={greenColor} strokeWidth="7" strokeLinecap="round" />
        <path d="M16 48H32" stroke={greenColor} strokeWidth="7" strokeLinecap="round" />

        {/* Truck Cargo Body */}
        <path
          d="M52 14H98C103.5 14 108 18.5 108 24V54H46V20C46 16.7 48.7 14 52 14Z"
          fill="none"
          stroke={truckOutline}
          strokeWidth="6.5"
        />

        {/* Truck Cab */}
        <path
          d="M108 26H124C128.4 26 132 29.6 132 34L136 46C137 49 137 54 137 54H108V26Z"
          fill="none"
          stroke={truckOutline}
          strokeWidth="6.5"
        />

        {/* Cab Window */}
        <path
          d="M114 31H122C124 31 125 32 126 34L128 41H114V31Z"
          fill={truckOutline}
        />

        {/* Ground Arch (Green) */}
        <path
          d="M4 68C40 60 100 60 136 68"
          stroke={greenColor}
          strokeWidth="5.5"
          strokeLinecap="round"
        />

        {/* Wheels */}
        <circle cx="62" cy="56" r="10" fill={textColor} stroke={truckOutline} strokeWidth="3" />
        <circle cx="62" cy="56" r="3.5" fill={isDark ? '#0f172a' : '#ffffff'} />

        <circle cx="118" cy="56" r="10" fill={textColor} stroke={truckOutline} strokeWidth="3" />
        <circle cx="118" cy="56" r="3.5" fill={isDark ? '#0f172a' : '#ffffff'} />
      </svg>

      {/* 🏷️ Typography & Tagline */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: "'Georgia', 'Times New Roman', 'Syne', serif",
            fontWeight: 700,
            fontSize: `${Math.round(24 * scale)}px`,
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px'
          }}
        >
          <span style={{ color: textColor }}>Easy</span>
          <span style={{ color: greenColor }}>Track</span>
        </div>

        {showTagline && (
          <span
            style={{
              fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
              fontSize: `${Math.max(9.5, Math.round(10.5 * scale))}px`,
              fontWeight: 500,
              color: taglineColor,
              letterSpacing: '0.04em',
              marginTop: '3px',
              whiteSpace: 'nowrap'
            }}
          >
            Track. Manage. Grow.
          </span>
        )}
      </div>
    </div>
  );
}
