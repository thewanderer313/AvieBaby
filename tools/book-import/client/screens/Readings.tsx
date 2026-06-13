import React, { useEffect, useMemo, useState } from 'react';
import {
  Reading, TitleGroup, listReadings, listTitles, deleteReading,
} from '../api';
import { ReadingEditor } from './ReadingEditor';

export const Readings: React.FC = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [titles, setTitles] = useState<TitleGroup[]>([]);
  const [editing, setEditing] = useState<Reading | 'new' | null>(null);

  const refresh = () => {
    listReadings().then(setReadings).catch(console.error);
    listTitles().then(setTitles).catch(console.error);
  };
  useEffect(refresh, []);

  const titleById = useMemo(() => Object.fromEntries(titles.map((t) => [t.id, t])), [titles]);
  const grouped = useMemo(() => {
    const map = new Map<string, Reading[]>();
    for (const r of readings) {
      if (!map.has(r.titleId)) map.set(r.titleId, []);
      map.get(r.titleId)!.push(r);
    }
    return map;
  }, [readings]);

  const onDelete = async (r: Reading) => {
    if (!confirm(`Delete reading ${r.id} (${r.reader})?`)) return;
    try { await deleteReading(r.id); refresh(); }
    catch (err: any) { alert(`Delete failed: ${err.message}`); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setEditing('new')} style={btnPrimary}>+ New reading</button>
      </div>
      {Array.from(grouped.entries()).map(([titleId, list]) => (
        <section key={titleId} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px' }}>{titleById[titleId]?.displayName ?? titleId}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {list.map((r) => (
              <div key={r.id} style={card}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{r.reader}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{r.id} · {r.pages.length} pages</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditing(r)} style={btnSecondary}>Edit</button>
                  <button onClick={() => onDelete(r)} style={btnDanger}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {readings.length === 0 && <div style={{ color: '#666' }}>No readings yet.</div>}
      {editing && (
        <ReadingEditor
          reading={editing === 'new' ? null : editing}
          onClose={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
};

const card: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#0a84ff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#e5e5ea', color: '#111', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#ff3b30', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
