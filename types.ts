

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
}

export enum FileFormat {
  MP3 = 'MP3',
  MP4 = 'MP4',
  JPEG = 'JPEG',
  PNG = 'PNG',
  WEBP = 'WEBP',
}

export enum Platform {
  YOUTUBE = 'YouTube',
  FACEBOOK = 'Facebook',
  INSTAGRAM = 'Instagram',
  TIKTOK = 'TikTok',
  TWITTER = 'X (Twitter)',
  UNKNOWN = 'Unknown',
}

export interface ConverterProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
}

export interface SceneProps {
  appState: AppState;
}

export interface HistoryItem {
  id: string;
  url: string;
  platform: Platform;
  format: FileFormat;
  timestamp: number;
}

export interface ConversionResult {
  downloadUrl: string;
  filename: string;
  fileSize: string;
}

export interface BatchItem {
  id: string;
  url: string;
  platform: Platform;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  error?: string;
  result?: ConversionResult;
}

// New Types for Advanced Settings
export type VideoResolution = '720p' | '1080p' | '4k';
export type AudioBitrate = '128k' | '192k' | '320k';
export type ImageQuality = 'LOW' | 'MEDIUM' | 'HIGH';
export type AudioCodec = 'AAC' | 'OPUS' | 'MP3';

export interface ConversionOptions {
  resolution?: VideoResolution;
  bitrate?: AudioBitrate;
  quality?: ImageQuality;
  codec?: AudioCodec;
  mute?: boolean;
  gpuAcceleration?: boolean;
}