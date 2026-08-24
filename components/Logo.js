import React, { useState } from 'react';

/**
 * Official Easy Track Logo Component.
 * Uses the official user-provided high-resolution horizontal logo graphics (/logo-light.png & /logo-dark.png).
 *
 * @param {Object} props
 * @param {'light' | 'dark'} [props.variant='light'] - 'light' for light backgrounds, 'dark' for dark backgrounds
 * @param {number} [props.height=44] - Display height in pixels
 * @param {string} [props.className='']
 * @param {Object} [props.style={}]
 */
export default function Logo({
  variant = 'light',
  height = 44,
  className = '',
  style = {}
}) {
  const [imgError, setImgError] = useState(false);
  const isDark = variant === 'dark';
  const logoSrc = isDark ? '/logo-dark.png' : '/logo-light.png';

  if (!imgError) {
    return (
      <div
        className={`easy-track-logo ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          userSelect: 'none',
          ...style
        }}
      >
        <img
          src={logoSrc}
          alt="Easy Track — Track. Manage. Grow."
          style={{
            height: `${height}px`,
            width: 'auto',
            objectFit: 'contain',
            display: 'block'
          }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback SVG rendering if PNG image fails to load
  const textColor = isDark ? '#ffffff' : '#0F172A';
  const greenColor = isDark ? '#22c55e' : '#16a34a';
  const taglineColor = isDark ? '#94a3b8' : '#475569';
  const strokeColor = isDark ? '#ffffff' : '#0F172A';

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
      <svg
        width={Math.round(height * 1.5)}
        height={height}
        viewBox="0 0 140 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M10 20H45" stroke={greenColor} strokeWidth="8" strokeLinecap="round" />
        <path d="M4 35H38" stroke={greenColor} strokeWidth="8" strokeLinecap="round" />
        <path d="M16 50H32" stroke={greenColor} strokeWidth="8" strokeLinecap="round" />
        <path d="M52 16H98C103.5 16 108 20.5 108 26V58H46V22C46 18.7 48.7 16 52 16Z" fill="none" stroke={strokeColor} strokeWidth="7" />
        <path d="M108 30H124C128.4 30 132 33.6 132 38L136 50C137 53 137 58 137 58H108V30Z" fill="none" stroke={strokeColor} strokeWidth="7" />
        <path d="M4 72C40 64 100 64 136 72" stroke={greenColor} strokeWidth="6" strokeLinecap="round" />
        <circle cx="62" cy="60" r="11" fill={textColor} stroke={strokeColor} strokeWidth="3" />
        <circle cx="118" cy="60" r="11" fill={textColor} stroke={strokeColor} strokeWidth="3" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: `${Math.round(height * 0.5)}px`, display: 'flex', gap: '3px' }}>
          <span style={{ color: textColor }}>Easy</span>
          <span style={{ color: greenColor }}>Track</span>
        </div>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: `${Math.max(9, Math.round(height * 0.22))}px`, color: taglineColor }}>
          Track. Manage. Grow.
        </span>
      </div>
    </div>
  );
}
