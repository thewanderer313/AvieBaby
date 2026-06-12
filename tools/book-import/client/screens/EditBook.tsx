import React from 'react';
export const EditBook: React.FC<{ bookId: string; onDone: () => void }> = ({ bookId, onDone }) => (
  <div>Edit {bookId} — stub <button onClick={onDone}>Back</button></div>
);
