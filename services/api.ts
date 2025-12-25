import { FileFormat, ConversionResult, ConversionOptions } from '../types';

// ------------------------------------------------------------------
// API CONFIGURATION
// ------------------------------------------------------------------

// RapidAPI for YouTube
const RAPIDAPI_KEY = 'cc989ea7bbmsha43197738848936p17de93jsnf3a4db5b272d';
const RAPIDAPI_HOST = 'youtube-video-fast-downloader-24-7.p.rapidapi.com';

// Cobalt instances for other platforms (from instances.cobalt.best)
const COBALT_INSTANCES = [
  'https://cobalt-backend.canine.tools',  // 96% uptime
  'https://kityune.imput.net',            // 76% uptime
  'https://blossom.imput.net',            // 76% uptime  
  'https://capi.3kh0.net',                // 76% uptime
];

// ------------------------------------------------------------------
// MAIN API FUNCTION  
// ------------------------------------------------------------------

export const convertMedia = async (
  url: string,
  format: FileFormat,
  options?: ConversionOptions
): Promise<ConversionResult> => {
  // Validate URL
  if (!url || !url.includes('http')) {
    throw new Error('Please enter a valid URL');
  }

  // Check for direct media files
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.match(/\.(mp4|mp3|wav|ogg|webm|jpg|jpeg|png|webp|gif)$/)) {
    return {
      downloadUrl: url,
      filename: url.split('/').pop() || `file.${format.toLowerCase()}`,
      fileSize: 'Direct Link'
    };
  }

  // Check if it's YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    console.log('[Znyth] Using RapidAPI for YouTube');
    return await fetchWithRapidAPI(url, format, options);
  }

  // Use Cobalt for other platforms
  console.log('[Znyth] Using Cobalt for non-YouTube');
  return await fetchWithCobalt(url, format, options);
};

// ------------------------------------------------------------------
// RAPIDAPI (YouTube)
// ------------------------------------------------------------------

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchWithRapidAPI(
  url: string,
  format: FileFormat,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const videoId = extractVideoId(url);

  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Map quality to API format
  // For Video: 247 = 720p, 248 = 1080p, 137 = 1080p, 136 = 720p, 135 = 480p
  // For Audio: 251 = 160kbps (High), 140 = 128kbps (Med)
  const isAudio = format === 'MP3';
  let quality: string;

  if (isAudio) {
    quality = '251'; // Default to high quality audio
  } else {
    const qualityMap: Record<string, string> = {
      '1080p': '248',
      '720p': '247',
      '480p': '135',
      '360p': '134'
    };
    quality = qualityMap[options?.resolution || '720p'] || '247';
  }

  const endpoint = isAudio ? 'download_audio' : 'download_video';

  const response = await fetch(
    `https://${RAPIDAPI_HOST}/${endpoint}/${videoId}?quality=${quality}`,
    {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    }
  );

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RapidAPI] Response fields:', Object.keys(data));

  // The API returns: { size, bitrate, type, quality, mime, comment, file, reserved_file }
  // Download URL is in the 'file' field
  const downloadUrl = data.file || data.reserved_file;

  if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
    console.error('[RapidAPI] Invalid response:', data);
    throw new Error('Could not get download URL from RapidAPI');
  }

  // Format file size
  const fileSizeMB = data.size ? `${Math.round(data.size / 1024 / 1024)} MB` : 'Unknown';

  const ext = isAudio ? 'mp3' : 'mp4';
  const filename = `youtube_${videoId}.${ext}`;

  return {
    downloadUrl,
    filename,
    fileSize: fileSizeMB
  };
}

async function fetchWithCobalt(
  url: string,
  format: FileFormat,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const isAudio = format === 'MP3';

  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`[Cobalt] Trying: ${instance}`);

      const requestBody = {
        url: url,
        downloadMode: isAudio ? 'audio' : 'auto',
        audioFormat: 'mp3',
        videoQuality: options?.resolution?.replace('p', '') || '720'
      };

      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.warn(`[Cobalt] ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      let downloadUrl = data.url || data.stream?.url;

      if (data.status === 'tunnel' || data.status === 'redirect') {
        downloadUrl = data.url;
      } else if (data.status === 'picker' && data.picker?.length > 0) {
        downloadUrl = data.picker[0].url;
      } else if (data.status === 'error') {
        console.warn(`[Cobalt] ${instance} error:`, data.error?.message);
        continue;
      }

      if (!downloadUrl) {
        continue;
      }

      const filename = data.filename ||
        extractFilename(downloadUrl) ||
        `download_${Date.now()}.${format.toLowerCase()}`;

      return {
        downloadUrl,
        filename,
        fileSize: 'Unknown'
      };
    } catch (error) {
      console.warn(`[Cobalt] ${instance} failed:`, error);
      continue;
    }
  }

  throw new Error('Unable to process this video. All Cobalt instances failed.');
}

function extractFilename(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      return decodeURIComponent(lastPart);
    }
  } catch { }
  return null;
}

// ------------------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------------------

export const fetchMediaInfo = async (url: string): Promise<{
  title?: string;
  thumbnail?: string;
  duration?: string;
} | null> => {
  return null;
};
