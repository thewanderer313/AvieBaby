import React, { useEffect, useMemo, useState } from 'react';
import { Asset, listAssets, deleteAsset, setAssetArchived } from '../api';
import { UploadDialog } from '../components/UploadDialog';

type TypeFilter = 'all' | 'image' | 'audio';

export const Library: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [readerFilter, setReaderFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [uploadKind, setUploadKind] = useState<'image' | 'audio' | null>(null);
  const [zoomed, setZoomed] = useState<Asset | null>(null);

  const refresh = () => { listAssets().then(setAssets).catch(console.error); };
  useEffect(refresh, []);

  const sources = useMemo(() => Array.from(new Set(assets.map((a) => a.source))).sort(), [assets]);
  const readers = useMemo(() =>
    Array.from(new Set(assets.filter((a): a is Asset & { type: 'audio' } => a.type === 'audio').map((a) => a.reader))).sort(),
    [assets]);

  const filtered = assets
    .filter((a) => {
      if (!showArchived && a.archived) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (sourceFilter && a.source !== sourceFilter) return false;
      if (readerFilter && a.type === 'audio' && a.reader !== readerFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const an = (a.originalName ?? a.id).toLowerCase();
      const bn = (b.originalName ?? b.id).toLowerCase();
      return an.localeCompare(bn, undefined, { numeric: true });
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

  const onToggleArchive = async (a: Asset) => {
    try { await setAssetArchived(a.id, !a.archived); refresh(); }
    catch (err: any) { alert(`Archive toggle failed: ${err.message}`); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setUploadKind('image')} style={btnPrimary}>+ Upload images</button>
        <button onClick={() => setUploadKind('audio')} style={btnPrimary}>+ Upload audio</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
        <label style={{ marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          /> Show archived
        </label>
        <span style={{ color: '#666', fontSize: 12, marginLeft: 'auto' }}>{filtered.length} item(s)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map((a) => (
          <div key={a.id} style={{ ...card, opacity: a.archived ? 0.6 : 1, borderColor: a.archived ? '#bbb' : '#ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {a.originalName ?? a.id}
              </div>
              {a.archived && (
                <span style={{ fontSize: 10, padding: '2px 6px', background: '#888', color: 'white', borderRadius: 4 }}>ARCHIVED</span>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{a.id}</div>
            </div>
            {a.type === 'image' ? (
              <img
                src={`/assets/library/images/${a.filename}`}
                style={{ width: '100%', borderRadius: 4, cursor: 'zoom-in', objectFit: 'contain', maxHeight: 320, background: '#000' }}
                onClick={() => setZoomed(a)}
                title="Click to enlarge"
              />
            ) : (
              <audio src={`/assets/library/audio/${a.filename}`} controls style={{ width: '100%' }} />
            )}
            <div style={{ fontSize: 13 }}>Source: {a.source}</div>
            {a.type === 'audio' && <div style={{ fontSize: 13 }}>Reader: {a.reader}</div>}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onToggleArchive(a)} style={btnSecondary}>
                {a.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button onClick={() => onDelete(a.id)} style={btnDanger}>Delete</button>
            </div>
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
      {zoomed && zoomed.type === 'image' && (
        <div style={lightboxOverlay} onClick={() => setZoomed(null)}>
          <img
            src={`/assets/library/images/${zoomed.filename}`}
            style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, background: '#000' }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={lightboxCaption}>
            {zoomed.originalName ?? zoomed.id} &nbsp;·&nbsp; <span style={{ fontFamily: 'monospace' }}>{zoomed.id}</span> &nbsp;·&nbsp; Source: {zoomed.source}
            <button onClick={() => setZoomed(null)} style={{ marginLeft: 16 }}>Close</button>
          </div>
        </div>
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
const btnSecondary: React.CSSProperties = {
  padding: '6px 12px', background: '#e5e5ea', color: '#111',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: '#ff3b30', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
const lightboxOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, gap: 16, cursor: 'zoom-out',
};
const lightboxCaption: React.CSSProperties = {
  color: 'white', fontSize: 14,
  display: 'flex', alignItems: 'center',
};
