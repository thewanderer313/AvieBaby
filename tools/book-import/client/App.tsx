import React, { useState } from 'react';
import { BookList } from './screens/BookList';
import { AddBookWizard } from './screens/AddBookWizard';
import { EditBook } from './screens/EditBook';
import { PreviewOverlay } from './screens/PreviewOverlay';

type Screen =
  | { name: 'list' }
  | { name: 'add' }
  | { name: 'edit'; bookId: string }
  | { name: 'preview'; bookId: string };

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>({ name: 'list' });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ margin: 0 }}>AvieBaby — Books</h1>
      {screen.name === 'list' && (
        <BookList
          onAdd={() => setScreen({ name: 'add' })}
          onEdit={(id) => setScreen({ name: 'edit', bookId: id })}
          onPreview={(id) => setScreen({ name: 'preview', bookId: id })}
        />
      )}
      {screen.name === 'add' && (
        <AddBookWizard onDone={() => setScreen({ name: 'list' })} />
      )}
      {screen.name === 'edit' && (
        <EditBook bookId={screen.bookId} onDone={() => setScreen({ name: 'list' })} />
      )}
      {screen.name === 'preview' && (
        <PreviewOverlay bookId={screen.bookId} onClose={() => setScreen({ name: 'list' })} />
      )}
    </div>
  );
};
