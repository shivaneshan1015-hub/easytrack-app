import React from 'react';

/**
 * Official Easy Track Logo component.
 * @param {Object} props
 * @param {'light' | 'dark'} [props.variant='light'] - 'light' for light backgrounds (Navy text), 'dark' for dark backgrounds (White text)
 * @param {number} [props.size=36] - Height in px of the truck icon
 * @param {boolean} [props.showTagline=true] - Whether to display "Track. Manage. Grow."
 * @param {string} [props.className='']
 * @param {Object} [props.style={}]
 */
export default function Logo({
  variant = 'light',
  size = 36,
  showTagline = true,
  className = '',
  style = {}
}) {
  const isDark = variant === 'dark';

  // Colors based on official logo
  const textColor = isDark ? '#ffffff' : '#0F172A'; // Navy Blue / White for "Easy"
  const greenColor = isDark ? '#22c55e' : '#16a34a'; // Delivery Green for "Track"
  const taglineColor = isDark ? '#94a3b8' : '#475569';
  const strokeColor = isDark ? '#ffffff' : '#0F172A';

  const scale = size / 36;
  const logoWidth = Math.round(54 * scale);
  const logoHeight = Math.round(size);

  return (
    <div
      className={`easy-track-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        ...style
      }}
    >
      {/* Truck Vector Graphic matching exact official logo */}
      <svg
        width={logoWidth}
        height={logoHeight}
        viewBox="0 0 140 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Motion Speed Lines (Green) */}
        <path d="M10 20H45" stroke={greenColor} strokeWidth="8" strokeLinecap="round" />
        <path d="M4 35H38" stroke={greenColor} strokeWidth="8" strokeLinecap="round" />
        <path d="M16 50H32" stroke={greenColor} strokeWidth="8" strokeLinecap="round" />

        {/* Truck Cargo Body */}
        <path
          d="M52 16H98C103.523 16 108 20.4772 108 26V58H46V22C46 18.6863 48.6863 16 52 16Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
        />

        {/* Truck Front Cab */}
        <path
          d="M108 30H124C128.418 30 132 33.5817 132 38L136 50C137 53 137 58 137 58H108V30Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
        />

        {/* Cab Window */}
        <path
          d="M114 36H122C124 36 125 37 126 39L128 46H114V36Z"
          fill={strokeColor}
        />

        {/* Ground Arch (Green) */}
        <path
          d="M4 72C40 64 100 64 136 72"
          stroke={greenColor}
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Wheels */}
        <circle cx="62" cy="60" r="11" fill={textColor} stroke={strokeColor} strokeWidth="3" />
        <circle cx="62" cy="60" r="4" fill="#ffffff" />

        <circle cx="118" cy="60" r="11" fill={textColor} stroke={strokeColor} strokeWidth="3" />
        <circle cx="118" cy="60" r="4" fill="#ffffff" />
      </svg>

      {/* Typography & Tagline */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: "'Syne', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: `${Math.round(20 * scale)}px`,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'baseline',
            gap: '3px'
          }}
        >
          <span style={{ color: textColor }}>Easy</span>
          <span style={{ color: greenColor }}>Track</span>
        </div>

        {showTagline && (
          <span
            style={{
              fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
              fontSize: `${Math.max(9, Math.round(9.5 * scale))}px`,
              fontWeight: 600,
              color: taglineColor,
              letterSpacing: '0.05em',
              marginTop: '2px'
            }}
          >
            Track. Manage. Grow.
          </span>
        )}
      </div>
    </div>
  );
}
