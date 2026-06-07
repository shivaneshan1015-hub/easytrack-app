export default function LowStockBanner({ products }) {
  if (!products || products.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px',
      padding: '14px 18px', marginBottom: '24px',
    }}>
      <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '14px', color: '#92400e' }}>
        ⚠️ Low Stock Alert — {products.length} product{products.length > 1 ? 's' : ''} running low
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {products.map(p => {
          const pct = p.low_stock_threshold > 0
            ? Math.min(100, Math.round((p.inventory_stock / p.low_stock_threshold) * 100))
            : 100;
          const barColor = p.inventory_stock === 0 ? '#dc2626' : '#f59e0b';
          return (
            <div key={p.id} style={{
              backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
              padding: '10px 14px', minWidth: '160px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: '#78350f' }}>{p.name}</p>
              <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#92400e' }}>
                {p.inventory_stock} left · threshold {p.low_stock_threshold}
              </p>
              <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#fde68a', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: '3px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
