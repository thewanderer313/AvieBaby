import React, { useEffect, useRef, useState } from 'react';
import type { Reading, Asset, ImageAsset, AudioAsset } from '../api';
import { listAssets } from '../api';

interface Props {
  reading: Reading;
  onClose: () => void;
}

export const PreviewOverlay: React.FC<Props> = ({ reading, onClose }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { listAssets().then(setAssets).catch(console.error); }, []);

  const page = reading.pages[pageIndex];
  if (!page) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={modal}>Reading has no pages.</div>
      </div>
    );
  }

  const image = assets.find((a): a is ImageAsset => a.id === page.image && a.type === 'image');
  const audio = assets.find((a): a is AudioAsset => a.id === page.audio && a.type === 'audio');

  const onTap = () => {
    setPageIndex((i) => (i + 1) % reading.pages.length);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>{reading.reader} — page {pageIndex + 1} of {reading.pages.length}</strong>
          <button onClick={onClose}>Close</button>
        </div>
        {image && (
          <img
            src={`/assets/library/images/${image.filename}`}
            style={{ width: '100%', borderRadius: 8, cursor: 'pointer' }}
            onClick={onTap}
          />
        )}
        {audio && (
          <audio
            ref={audioRef}
            src={`/assets/library/audio/${audio.filename}`}
            autoPlay
            controls
            style={{ width: '100%', marginTop: 12 }}
          />
        )}
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, width: 'min(900px, 95vw)', maxHeight: '90vh', overflow: 'auto' };
