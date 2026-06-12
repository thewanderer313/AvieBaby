import React, { useEffect, useRef, useState } from 'react';
import { listBooks, BookSummary } from '../api';

interface Props { bookId: string; onClose: () => void; }

export const PreviewOverlay: React.FC<Props> = ({ bookId, onClose }) => {
  const [book, setBook] = useState<BookSummary | null>(null);
  const [readerId, setReaderId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    listBooks().then((books) => {
      const b = books.find((x) => x.id === bookId);
      if (b) {
        setBook(b);
        if (b.readers.length > 0) setReaderId(b.readers[0].id);
      }
    });
  }, [bookId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [currentPage, readerId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!book) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentPage((p) => (p + 1) % book.pageCount);
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(0, p - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [book, onClose]);

  if (!book || !readerId) return <div>Loading preview...</div>;

  const pageNN = String(currentPage + 1).padStart(2, '0');

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 12, background: '#1c1c1e', color: '#fff', display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>{book.title}</strong>
        {book.readers.length > 1 && (
          <select value={readerId} onChange={(e) => { setReaderId(e.target.value); setCurrentPage(0); }} style={{ padding: 4 }}>
            {book.readers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <span style={{ marginLeft: 'auto' }}>Page {currentPage + 1} / {book.pageCount}</span>
        <button onClick={onClose} style={{ background: '#3a3a3c', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4 }}>× Close</button>
      </div>
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={() => book && setCurrentPage((p) => (p + 1) % book.pageCount)}
        onContextMenu={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(0, p - 1)); }}
      >
        <img
          src={`/assets/books/${bookId}/pages/page-${pageNN}.png`}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
      <audio ref={audioRef} src={`/assets/books/${bookId}/voices/${readerId}/page-${pageNN}.mp3`} autoPlay />
      <div style={{ padding: 8, background: '#1c1c1e', color: '#888', fontSize: 12, textAlign: 'center' }}>
        Click image or → to advance • Right-click or ← to go back • Esc to close
      </div>
    </div>
  );
};
