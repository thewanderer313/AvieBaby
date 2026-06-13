import React, { useEffect, useState } from 'react';
import {
  TitleGroup, listTitles, createTitle, renameTitle, uploadTitleCover, deleteTitle,
} from '../api';

export const Titles: React.FC = () => {
  const [titles, setTitles] = useState<TitleGroup[]>([]);
  const [editing, setEditing] = useState<TitleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const refresh = () => { listTitles().then(setTitles).catch(console.error); };
  useEffect(refresh, []);

  const onDelete = async (t: TitleGroup) => {
    if (!confirm(`Delete title "${t.displayName}"?`)) return;
    try { await deleteTitle(t.id); refresh(); }
    catch (err: any) {
      if (err.status === 409) {
        const ids = err.body.referencedBy?.map((r: any) => r.readingId).join(', ');
        alert(`Cannot delete — readings still reference this title: ${ids}`);
      } else alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setCreating(true)} style={btnPrimary}>+ New title</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {titles.map((t) => (
          <div key={t.id} style={card}>
            {t.cover && <img src={`/assets/titles/${t.id}/${t.cover}`} style={{ width: '100%', borderRadius: 4 }} />}
            <div style={{ fontSize: 16, fontWeight: 600 }}>{t.displayName}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{t.id}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setEditing(t)} style={btnSecondary}>Edit</button>
              <button onClick={() => onDelete(t)} style={btnDanger}>Delete</button>
            </div>
          </div>
        ))}
        {titles.length === 0 && <div style={{ gridColumn: '1/-1', color: '#666' }}>No titles yet.</div>}
      </div>
      {creating && <TitleEditDialog mode="create" onClose={() => { setCreating(false); refresh(); }} />}
      {editing && <TitleEditDialog mode="edit" title={editing} onClose={() => { setEditing(null); refresh(); }} />}
    </div>
  );
};

interface DialogProps {
  mode: 'create' | 'edit';
  title?: TitleGroup;
  onClose: () => void;
}

const TitleEditDialog: React.FC<DialogProps> = ({ mode, title, onClose }) => {
  const [displayName, setDisplayName] = useState(title?.displayName ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return alert('Display name required');
    setBusy(true);
    try {
      let id: string;
      if (mode === 'create') {
        const t = await createTitle(displayName.trim());
        id = t.id;
      } else {
        if (displayName.trim() !== title!.displayName) {
          await renameTitle(title!.id, displayName.trim());
        }
        id = title!.id;
      }
      if (coverFile) await uploadTitleCover(id, coverFile);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'create' ? 'New title' : `Edit "${title!.displayName}"`}</h2>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Display name:<br/>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Cover image (optional):<br/>
              <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#0a84ff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#e5e5ea', color: '#111', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#ff3b30', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, minWidth: 420 };
