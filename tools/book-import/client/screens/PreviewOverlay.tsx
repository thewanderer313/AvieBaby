import React from 'react';

export const PreviewOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}
    onClick={onClose}
  >
    <div style={{ background: 'white', padding: 24, borderRadius: 12 }}>PreviewOverlay — TODO Task 23</div>
  </div>
);
