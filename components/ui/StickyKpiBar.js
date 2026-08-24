import React from 'react';

/**
 * Compact Sticky KPI Summary Bar for top of Owner Dashboard
 */
export default function StickyKpiBar({
  sales = 0,
  collected = 0,
  outstanding = 0,
  activeAgentsCount = 0,
  style = {}
}) {
  return (
    <div
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backgroundColor: '#0f172a',
        color: '#ffffff',
        padding: '10px 24px',
        borderBottom: '1px solid #1e293b',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: '13px',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL REVENUE</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8' }}>₹{parseFloat(sales || 0).toLocaleString('en-IN')}</div>
        </div>

        <div style={{ borderLeft: '1px solid #334155', paddingLeft: '24px' }}>
          <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>COLLECTED CASH</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#4ade80' }}>₹{parseFloat(collected || 0).toLocaleString('en-IN')}</div>
        </div>

        <div style={{ borderLeft: '1px solid #334155', paddingLeft: '24px' }}>
          <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>OUTSTANDING CREDIT</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#f87171' }}>₹{parseFloat(outstanding || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ backgroundColor: '#1e293b', color: '#cbd5e1', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #334155' }}>
          🟢 {activeAgentsCount} Active Agents Online
        </span>
      </div>
    </div>
  );
}
