import React, { useEffect, useMemo, useState } from 'react';
import { Asset, listAssets, deleteAsset } from '../api';
import { UploadDialog } from '../components/UploadDialog';

type TypeFilter = 'all' | 'image' | 'audio';

export const Library: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [readerFilter, setReaderFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [uploadKind, setUploadKind] = useState<'image' | 'audio' | null>(null);

  const refresh = () => { listAssets().then(setAssets).catch(console.error); };
  useEffect(refresh, []);

  const sources = useMemo(() => Array.from(new Set(assets.map((a) => a.source))).sort(), [assets]);
  const readers = useMemo(() =>
    Array.from(new Set(assets.filter((a): a is Asset & { type: 'audio' } => a.type === 'audio').map((a) => a.reader))).sort(),
    [assets]);

  const filtered = assets.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (sourceFilter && a.source !== sourceFilter) return false;
    if (readerFilter && a.type === 'audio' && a.reader !== readerFilter) return false;
    return true;
  });

  const onDelete = async (id: string) => {
    if (!confirm(`Delete ${id}?`)) return;
    try { await deleteAsset(id); refresh(); }
    catch (err: any) {
      if (err.status === 409) {
        const refs = err.body.referencedBy?.map((r: any) => r.readingId).join(', ');
        alert(`Cannot delete — referenced by readings: ${refs}`);
      } else alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setUploadKind('image')} style={btnPrimary}>+ Upload images</button>
        <button onClick={() => setUploadKind('audio')} style={btnPrimary}>+ Upload audio</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <label>Source:&nbsp;
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Reader:&nbsp;
          <select
            value={readerFilter}
            onChange={(e) => setReaderFilter(e.target.value)}
            disabled={typeFilter === 'image'}
          >
            <option value="">All</option>
            {readers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Type:&nbsp;
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">All</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {filtered.map((a) => (
          <div key={a.id} style={card}>
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.id}</div>
            {a.type === 'image' ? (
              <img src={`/assets/library/images/${a.filename}`} style={{ width: '100%', borderRadius: 4 }} />
            ) : (
              <audio src={`/assets/library/audio/${a.filename}`} controls style={{ width: '100%' }} />
            )}
            <div style={{ fontSize: 13 }}>Source: {a.source}</div>
            {a.type === 'audio' && <div style={{ fontSize: 13 }}>Reader: {a.reader}</div>}
            <button onClick={() => onDelete(a.id)} style={btnDanger}>Delete</button>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', color: '#666' }}>No assets match.</div>}
      </div>
      {uploadKind && (
        <UploadDialog
          kind={uploadKind}
          existingSources={sources}
          existingReaders={readers}
          onClose={() => { setUploadKind(null); refresh(); }}
        />
      )}
    </div>
  );
};

const card: React.CSSProperties = {
  border: '1px solid #ddd', borderRadius: 8, padding: 12,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#0a84ff', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: '#ff3b30', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
