import React from 'react';
export const BookList: React.FC<{
  onAdd: () => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
}> = () => <div>Book list — stub</div>;
