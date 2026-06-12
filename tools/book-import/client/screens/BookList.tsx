import React, { useEffect, useState } from 'react';
import { listBooks, deleteBook, streamJob, BookSummary, PipelineEvent } from '../api';
import { DeleteConfirm } from '../components/DeleteConfirm';
import { ProgressOverlay } from '../components/ProgressOverlay';

interface Props {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
}

export const BookList: React.FC<Props> = ({ onAdd, onEdit, onPreview }) => {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [deleting, setDeleting] = useState<BookSummary | null>(null);
  const [jobEvents, setJobEvents] = useState<PipelineEvent[]>([]);
  const [jobDone, setJobDone] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const refresh = () => listBooks().then(setBooks).catch(console.error);
  useEffect(() => { refresh(); }, []);

  const runJob = (jobId: string) => {
    setJobEvents([]);
    setJobDone(false);
    setJobError(null);
    streamJob(jobId, (e) => {
      setJobEvents((prev) => [...prev, e]);
      if (e.step === 'done') {
        setJobDone(true);
        if (e.status === 'failed') setJobError(e.stderr || 'Pipeline failed');
        refresh();
      }
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
        <button onClick={onAdd} style={{ padding: '8px 16px', background: '#0a84ff', color: '#fff', border: 'none', borderRadius: 8 }}>
          + Add a book
        </button>
      </div>
      {books.length === 0 && <p>No books yet. Add one to get started.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {books.map((b) => (
          <div key={b.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e5ea' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {b.hasCover && (
                <img src={`/assets/books/${b.id}/cover.png`} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px' }}>{b.title}</h3>
                <div style={{ fontSize: 13, color: '#555' }}>
                  {b.pageCount} page{b.pageCount === 1 ? '' : 's'} • {b.readers.map((r) => r.name).join(', ') || 'no readers'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => onPreview(b.id)}>Preview</button>
              <button onClick={() => onEdit(b.id)}>Edit</button>
              <button onClick={() => setDeleting(b)} style={{ color: '#c00' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {deleting && (
        <DeleteConfirm
          title={deleting.title}
          pageCount={deleting.pageCount}
          readerCount={deleting.readers.length}
          onCancel={() => setDeleting(null)}
          onConfirm={async (typed) => {
            try {
              const jobId = await deleteBook(deleting.id, typed);
              setDeleting(null);
              runJob(jobId);
            } catch (e) {
              alert(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      )}
      {(jobEvents.length > 0 || jobDone) && (
        <ProgressOverlay
          events={jobEvents}
          done={jobDone}
          error={jobError}
          onClose={() => { setJobEvents([]); setJobDone(false); setJobError(null); }}
        />
      )}
    </div>
  );
};
