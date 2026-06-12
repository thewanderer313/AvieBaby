import React, { useEffect, useState } from 'react';
import {
  listBooks, BookSummary, patchBook, replacePage, replaceVoice,
  addReader, appendPages, streamJob, PipelineEvent,
} from '../api';
import { ProgressOverlay } from '../components/ProgressOverlay';
import { DropZone } from '../components/DropZone';

interface Props { bookId: string; onDone: () => void; }

export const EditBook: React.FC<Props> = ({ bookId, onDone }) => {
  const [book, setBook] = useState<BookSummary | null>(null);
  const [title, setTitle] = useState('');
  const [readerNames, setReaderNames] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-reader sub-flow state
  const [addingReader, setAddingReader] = useState(false);
  const [newReaderName, setNewReaderName] = useState('');
  const [newReaderId, setNewReaderId] = useState('');
  const [newReaderVoices, setNewReaderVoices] = useState<File[]>([]);

  // Append-pages sub-flow state
  const [addingPages, setAddingPages] = useState(false);
  const [newPages, setNewPages] = useState<File[]>([]);
  const [newVoicesByReader, setNewVoicesByReader] = useState<Record<string, File[]>>({});

  const refresh = () => listBooks().then((books) => {
    const b = books.find((x) => x.id === bookId);
    if (b) {
      setBook(b);
      setTitle(b.title);
      const names: Record<string, string> = {};
      for (const r of b.readers) names[r.id] = r.name;
      setReaderNames(names);
    }
  });
  useEffect(() => { refresh(); }, [bookId]);

  const runJob = (jobId: string) => {
    setEvents([]); setDone(false); setError(null);
    streamJob(jobId, (e) => {
      setEvents((prev) => [...prev, e]);
      if (e.step === 'done') {
        setDone(true);
        if (e.status === 'failed') setError(e.stderr || 'Failed');
        refresh();
      }
    });
  };

  const saveMetadata = async () => {
    try {
      const jobId = await patchBook(bookId, { title, readers: readerNames });
      runJob(jobId);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const onReplacePage = async (n: number, file: File) => {
    try { runJob(await replacePage(bookId, n, file)); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const onReplaceVoice = async (n: number, rid: string, file: File, keepTail: boolean) => {
    try { runJob(await replaceVoice(bookId, n, rid, file, keepTail)); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const submitNewReader = async () => {
    if (!book) return;
    if (newReaderVoices.length !== book.pageCount) {
      alert(`Need ${book.pageCount} voice clips; got ${newReaderVoices.length}.`);
      return;
    }
    const fd = new FormData();
    fd.append('readerName', newReaderName);
    fd.append('readerId', newReaderId);
    fd.append('keepTail', JSON.stringify(newReaderVoices.map(() => false)));
    newReaderVoices.forEach((v, i) =>
      fd.append('voices', v, `voice-${String(i + 1).padStart(2, '0')}-${v.name}`),
    );
    try {
      const jobId = await addReader(bookId, fd);
      setAddingReader(false);
      setNewReaderName(''); setNewReaderId(''); setNewReaderVoices([]);
      runJob(jobId);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const submitNewPages = async () => {
    if (!book) return;
    for (const r of book.readers) {
      if ((newVoicesByReader[r.id]?.length || 0) !== newPages.length) {
        alert(`Reader ${r.name} needs ${newPages.length} new voice clips.`);
        return;
      }
    }
    const fd = new FormData();
    newPages.forEach((p, i) => fd.append(`page-${String(i + 1).padStart(2, '0')}`, p));
    for (const r of book.readers) {
      newVoicesByReader[r.id].forEach((v, i) =>
        fd.append(`voice-${r.id}-${String(i + 1).padStart(2, '0')}`, v),
      );
    }
    try {
      const jobId = await appendPages(bookId, fd);
      setAddingPages(false);
      setNewPages([]); setNewVoicesByReader({});
      runJob(jobId);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  if (!book) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={onDone}>← Back</button>
      <h2>Edit: {book.title}</h2>

      <h3>Title</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />

      <h3>Readers</h3>
      {book.readers.map((r) => (
        <div key={r.id} style={{ marginBottom: 8 }}>
          <label>
            {r.id}:{' '}
            <input
              value={readerNames[r.id] || ''}
              onChange={(e) => setReaderNames((prev) => ({ ...prev, [r.id]: e.target.value }))}
              style={{ padding: 4 }}
            />
          </label>
        </div>
      ))}
      <button onClick={saveMetadata}>Save title and reader names</button>
      <button onClick={() => setAddingReader(true)} style={{ marginLeft: 8 }}>+ Add a reader</button>

      <h3>Pages</h3>
      {Array.from({ length: book.pageCount }).map((_, idx) => {
        const pageNum = idx + 1;
        const pageNN = String(pageNum).padStart(2, '0');
        return (
          <div key={pageNum} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, padding: 8, background: '#fff', borderRadius: 8 }}>
            <div style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{pageNum}</div>
            <img src={`/assets/books/${bookId}/pages/page-${pageNN}.png?t=${events.length}`} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
            <label style={{ fontSize: 12 }}>
              Replace image:{' '}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onReplacePage(pageNum, e.target.files[0])} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {book.readers.map((r) => (
                <div key={r.id} style={{ fontSize: 12 }}>
                  <strong>{r.name}:</strong>{' '}
                  <audio src={`/assets/books/${bookId}/voices/${r.id}/page-${pageNN}.mp3?t=${events.length}`} controls style={{ height: 24 }} />
                  <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && onReplaceVoice(pageNum, r.id, e.target.files[0], false)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button onClick={() => setAddingPages(true)} style={{ marginTop: 16 }}>+ Add pages at the end</button>

      {addingReader && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Add a new reader</h3>
            <label>Name<br /><input value={newReaderName} onChange={(e) => setNewReaderName(e.target.value)} style={{ width: '100%', padding: 8 }} /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Id<br /><input value={newReaderId} onChange={(e) => setNewReaderId(e.target.value)} style={{ width: '100%', padding: 8 }} /></label>
            <p>Upload {book.pageCount} voice clip{book.pageCount === 1 ? '' : 's'}, one per page in order:</p>
            <DropZone accept="audio/*" onFiles={(f) => setNewReaderVoices((prev) => [...prev, ...f])} label={`Voices (${newReaderVoices.length}/${book.pageCount})`} />
            {newReaderVoices.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <strong>Page {i + 1}:</strong>
                <span style={{ flex: 1, fontSize: 12 }}>{v.name}</span>
                <button onClick={() => setNewReaderVoices((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddingReader(false)}>Cancel</button>
              <button onClick={submitNewReader} disabled={newReaderVoices.length !== book.pageCount || !newReaderName || !newReaderId} style={{ background: '#0a84ff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {addingPages && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 720, maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Add pages at the end</h3>
            <DropZone accept="image/*" onFiles={(f) => setNewPages((prev) => [...prev, ...f])} label={`New page images (${newPages.length})`} />
            {book.readers.map((r) => (
              <div key={r.id} style={{ marginTop: 16 }}>
                <h4>Voices for {r.name}</h4>
                <DropZone
                  accept="audio/*"
                  onFiles={(f) => setNewVoicesByReader((prev) => ({ ...prev, [r.id]: [...(prev[r.id] || []), ...f] }))}
                  label={`Voices for ${r.name} (${(newVoicesByReader[r.id]?.length || 0)}/${newPages.length})`}
                />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddingPages(false)}>Cancel</button>
              <button
                onClick={submitNewPages}
                disabled={newPages.length === 0 || book.readers.some((r) => (newVoicesByReader[r.id]?.length || 0) !== newPages.length)}
                style={{ background: '#0a84ff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {(events.length > 0 || done) && (
        <ProgressOverlay
          events={events}
          done={done}
          error={error}
          onClose={() => { setEvents([]); setDone(false); setError(null); }}
        />
      )}
    </div>
  );
};
