export interface TitleGroup {
  id: string;
  displayName: string;
  cover?: number;
}

export interface ReadingPage {
  image: string;
  audio: string;
}

export interface Reading {
  id: string;
  titleId: string;
  reader: string;
  pages: ReadingPage[];
}

export interface BookRegistry {
  titles: TitleGroup[];
  readingsByTitleId: Record<string, Reading[]>;
  assets: Record<string, number>;
}
