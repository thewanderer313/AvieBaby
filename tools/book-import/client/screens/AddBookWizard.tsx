import React from 'react';
export const AddBookWizard: React.FC<{ onDone: () => void }> = ({ onDone }) => (
  <div>Add — stub <button onClick={onDone}>Back</button></div>
);
