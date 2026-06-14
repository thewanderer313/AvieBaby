import React from 'react';
import type { PipelineEvent } from '../api';

interface Props {
  events: PipelineEvent[];
  done: boolean;
  error: string | null;
  onClose: () => void;
}

export const ProgressOverlay: React.FC<Props> = ({ events, done, error, onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
  >
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>{done ? (error ? 'Failed' : 'Done') : 'Processing...'}</h3>
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {events.map((e, i) => (
          <div key={i} style={{ color: e.status === 'failed' ? '#c00' : '#333' }}>
            {e.step}: {e.status}
          </div>
        ))}
      </div>
      {error && <div style={{ marginTop: 12, color: '#c00' }}>{error}</div>}
      {done && (
        <button onClick={onClose} style={{ marginTop: 16 }}>
          Close
        </button>
      )}
    </div>
  </div>
);
