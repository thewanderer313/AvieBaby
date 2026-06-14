export type AssetType = 'image' | 'audio';

export interface ImageAsset {
  id: string;
  type: 'image';
  source: string;
  filename: string;
}

export interface AudioAsset {
  id: string;
  type: 'audio';
  source: string;
  reader: string;
  filename: string;
}

export type Asset = ImageAsset | AudioAsset;

export interface LibraryFile {
  assets: Asset[];
}

export interface TitleGroup {
  id: string;
  displayName: string;
  cover?: string;
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
