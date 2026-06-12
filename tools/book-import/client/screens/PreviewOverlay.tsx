import React from 'react';
export const PreviewOverlay: React.FC<{ bookId: string; onClose: () => void }> = ({ bookId, onClose }) => (
  <div>Preview {bookId} — stub <button onClick={onClose}>Close</button></div>
);
