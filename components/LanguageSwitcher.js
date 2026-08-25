import React from 'react';
import { useLanguage } from '../lib/i18n';

/**
 * Reusable Multi-Language Switcher Component (English / தமிழ் / हिन्दी)
 */
export default function LanguageSwitcher({ style = {} }) {
  const { lang, changeLanguage } = useLanguage();

  const options = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'ta', label: '🇮🇳 தமிழ்' },
    { code: 'hi', label: '🇮🇳 हिन्दी' },
  ];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', ...style }}>
      {options.map((opt) => {
        const isActive = lang === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => changeLanguage(opt.code)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: isActive ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isActive ? '#16a34a' : 'transparent',
              color: isActive ? '#ffffff' : '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              whiteSpace: 'nowrap'
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
