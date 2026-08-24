import React, { useRef, useState, useEffect } from 'react';

/**
 * Touch HTML5 Canvas Signature Pad for Proof of Delivery (POD)
 */
export default function SignaturePad({ onSave, onCancel, title = 'Retailer Proof of Delivery (Signature)' }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      e.preventDefault();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    if (!hasSignature) return alert('Please provide a signature before saving.');
    const dataUrl = canvasRef.current.toDataURL('image/png');
    if (onSave) onSave(dataUrl);
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>Sign below to confirm goods received in good condition.</p>

      <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc', overflow: 'hidden', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={370}
          height={180}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ width: '100%', height: '180px', display: 'block', cursor: 'crosshair' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '10px' }}>
        <button
          type="button"
          onClick={clearCanvas}
          style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          🗑️ Clear
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: '10px 16px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            ✓ Save POD
          </button>
        </div>
      </div>
    </div>
  );
}
