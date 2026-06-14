import React, { useState } from 'react';

interface Props {
  title: string;
  pageCount: number;
  readerCount: number;
  onConfirm: (typedTitle: string) => void;
  onCancel: () => void;
}

export const DeleteConfirm: React.FC<Props> = ({ title, pageCount, readerCount, onConfirm, onCancel }) => {
  const [typed, setTyped] = useState('');
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480 }}>
        <h3 style={{ marginTop: 0 }}>Delete "{title}"?</h3>
        <p>This will permanently delete {pageCount} page{pageCount === 1 ? '' : 's'} and {readerCount} reader recording{readerCount === 1 ? '' : 's'}. This cannot be undone.</p>
        <p>Type the book's title to confirm:</p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          style={{ width: '100%', padding: 8, fontSize: 14 }}
          placeholder={title}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={() => onConfirm(typed)}
            disabled={typed !== title}
            style={{ background: typed === title ? '#c00' : '#888', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
