import React, { useState } from 'react';
import { uploadImages, uploadAudio, streamJob, PipelineEvent } from '../api';

interface Props {
  kind: 'image' | 'audio';
  existingSources: string[];
  existingReaders: string[];
  onClose: () => void;
}

export const UploadDialog: React.FC<Props> = ({ kind, existingSources, existingReaders, onClose }) => {
  const [source, setSource] = useState('');
  const [reader, setReader] = useState('');
  const [keepTail, setKeepTail] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return alert('Source required');
    if (kind === 'audio' && !reader.trim()) return alert('Reader required');
    if (files.length === 0) return alert('Pick at least one file');
    setBusy(true);
    setEvents([]);
    try {
      const jobId = kind === 'image'
        ? await uploadImages(source.trim(), files)
        : await uploadAudio(source.trim(), reader.trim(), keepTail, files);
      streamJob(
        jobId,
        (ev) => setEvents((es) => [...es, ev]),
        () => { setDone(true); setBusy(false); },
      );
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <div style={overlay} onClick={done ? onClose : undefined}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2>Upload {kind === 'image' ? 'images' : 'audio'}</h2>
        {!done ? (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label>Source (required):<br/>
                <input
                  list="sources"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  style={{ width: '100%' }}
                />
                <datalist id="sources">
                  {existingSources.map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
            </div>
            {kind === 'audio' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label>Reader (required):<br/>
                    <input
                      list="readers"
                      value={reader}
                      onChange={(e) => setReader(e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <datalist id="readers">
                      {existingReaders.map((r) => <option key={r} value={r} />)}
                    </datalist>
                  </label>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={keepTail}
                      onChange={(e) => setKeepTail(e.target.checked)}
                    /> Keep tail (preserve soft trailing word)
                  </label>
                </div>
              </>
            )}
            <div style={{ marginBottom: 12 }}>
              <input
                type="file"
                multiple
                accept={kind === 'image' ? 'image/*' : 'audio/*'}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
            </div>
            {events.length > 0 && (
              <pre style={progressStyle}>{events.map((e) => `${e.step}: ${e.status}`).join('\n')}</pre>
            )}
          </form>
        ) : (
          <>
            <p>Done!</p>
            <pre style={progressStyle}>{events.map((e) => `${e.step}: ${e.status}`).join('\n')}</pre>
            <button onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: 'white', borderRadius: 12, padding: 24, minWidth: 420, maxWidth: 640,
};
const progressStyle: React.CSSProperties = {
  background: '#f4f4f4', padding: 8, borderRadius: 4, fontSize: 11,
  maxHeight: 160, overflow: 'auto', marginTop: 8,
};
