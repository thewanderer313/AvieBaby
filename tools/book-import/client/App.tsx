import React, { useState } from 'react';
import { Library } from './screens/Library';
import { Titles } from './screens/Titles';
import { Readings } from './screens/Readings';

type Tab = 'library' | 'titles' | 'readings';

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('library');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#111' }}>
      <h1 style={{ margin: 0 }}>AvieBaby — Books</h1>
      <nav style={{ display: 'flex', gap: 8, margin: '16px 0 24px' }}>
        {(['library', 'titles', 'readings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background: tab === t ? '#111' : '#e5e5ea',
              color: tab === t ? '#fff' : '#111',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === 'library' && <Library />}
      {tab === 'titles' && <Titles />}
      {tab === 'readings' && <Readings />}
    </div>
  );
};
