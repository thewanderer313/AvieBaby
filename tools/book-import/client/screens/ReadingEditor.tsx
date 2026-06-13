import React from 'react';
import type { Reading } from '../api';
export const ReadingEditor: React.FC<{ reading: Reading | null; onClose: () => void }> = ({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
    <div style={{ background: 'white', padding: 24, borderRadius: 12 }}>ReadingEditor — TODO Task 22</div>
  </div>
);
