import React, { useMemo, useState } from 'react';
import { postBook, streamJob, PipelineEvent } from '../api';
import { DropZone } from '../components/DropZone';
import { PageTile } from '../components/PageTile';
import { VoiceTile } from '../components/VoiceTile';
import { ProgressOverlay } from '../components/ProgressOverlay';

function toId(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const AddBookWizard: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [title, setTitle] = useState('');
  const [bookId, setBookId] = useState('');
  const [readerName, setReaderName] = useState('');
  const [readerId, setReaderId] = useState('');
  const [pages, setPages] = useState<File[]>([]);
  const [voices, setVoices] = useState<File[]>([]);
  const [keepTail, setKeepTail] = useState<boolean[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoBookId = useMemo(() => toId(title), [title]);
  const autoReaderId = useMemo(() => toId(readerName), [readerName]);
  const effectiveBookId = bookId || autoBookId;
  const effectiveReaderId = readerId || autoReaderId;

  const canSubmit =
    title && readerName && effectiveBookId && effectiveReaderId &&
    pages.length > 0 && voices.length === pages.length;

  const dragSrc = React.useRef<number | null>(null);
  const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    return next;
  };

  const submit = async () => {
    setSubmitting(true);
    const fd = new FormData();
    fd.append('title', title);
    fd.append('bookId', effectiveBookId);
    fd.append('readerName', readerName);
    fd.append('readerId', effectiveReaderId);
    fd.append('keepTail', JSON.stringify(keepTail));
    pages.forEach((p, i) => fd.append('pages', p, `page-${String(i + 1).padStart(2, '0')}-${p.name}`));
    voices.forEach((v, i) => fd.append('voices', v, `voice-${String(i + 1).padStart(2, '0')}-${v.name}`));
    if (cover) fd.append('cover', cover);

    try {
      const jobId = await postBook(fd);
      streamJob(jobId, (e) => {
        setEvents((prev) => [...prev, e]);
        if (e.step === 'done') {
          setDone(true);
          if (e.status === 'failed') setError(e.stderr || 'Failed');
        }
      });
    } catch (e) {
      setSubmitting(false);
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <button onClick={onDone}>← Back</button>
      <h2>Add a book</h2>
      <label>Title<br /><input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} /></label>
      <label style={{ display: 'block', marginTop: 8 }}>Book id<br />
        <input value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder={autoBookId} style={{ width: '100%', padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>Reader display name<br />
        <input value={readerName} onChange={(e) => setReaderName(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>Reader id<br />
        <input value={readerId} onChange={(e) => setReaderId(e.target.value)} placeholder={autoReaderId} style={{ width: '100%', padding: 8 }} />
      </label>

      <h3>Pages</h3>
      <DropZone
        accept="image/*"
        onFiles={(f) => setPages((prev) => [...prev, ...f])}
        label="Page images"
      />
      {pages.map((p, i) => (
        <PageTile
          key={i}
          file={p}
          pageNumber={i + 1}
          onRemove={() => setPages((prev) => prev.filter((_, j) => j !== i))}
          onDragStart={() => { dragSrc.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragSrc.current === null) return;
            setPages((prev) => reorder(prev, dragSrc.current!, i));
            dragSrc.current = null;
          }}
        />
      ))}

      <h3>Voices ({voices.length} / {pages.length})</h3>
      <DropZone
        accept="audio/*"
        onFiles={(f) => {
          setVoices((prev) => [...prev, ...f]);
          setKeepTail((prev) => [...prev, ...f.map(() => false)]);
        }}
        label="Voice recordings (one per page, in order)"
      />
      {voices.map((v, i) => (
        <VoiceTile
          key={i}
          file={v}
          pageNumber={i + 1}
          keepTail={keepTail[i] || false}
          onToggleKeepTail={() => setKeepTail((prev) => prev.map((k, j) => j === i ? !k : k))}
          onRemove={() => {
            setVoices((prev) => prev.filter((_, j) => j !== i));
            setKeepTail((prev) => prev.filter((_, j) => j !== i));
          }}
          onDragStart={() => { dragSrc.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragSrc.current === null) return;
            setVoices((prev) => reorder(prev, dragSrc.current!, i));
            setKeepTail((prev) => reorder(prev, dragSrc.current!, i));
            dragSrc.current = null;
          }}
        />
      ))}

      <h3>Cover (optional)</h3>
      <DropZone accept="image/*" multiple={false} onFiles={(f) => setCover(f[0])} label="Cover image" />
      {cover && <div>{cover.name}</div>}

      <div style={{ marginTop: 24 }}>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          style={{ background: canSubmit ? '#0a84ff' : '#888', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8 }}
        >
          Import book
        </button>
      </div>

      {(events.length > 0 || done) && (
        <ProgressOverlay
          events={events}
          done={done}
          error={error}
          onClose={onDone}
        />
      )}
    </div>
  );
};
