import { FileFormat, ConversionResult, ConversionOptions } from '../types';

// ------------------------------------------------------------------
// COBALT API INSTANCES (From instances.cobalt.best - updated Dec 2025)
// ------------------------------------------------------------------
const COBALT_INSTANCES = [
  'https://cobalt-backend.canine.tools',  // 96% uptime
  'https://kityune.imput.net',            // 76% uptime
  'https://blossom.imput.net',            // 76% uptime  
  'https://capi.3kh0.net',                // 76% uptime
  'https://nachos.imput.net',             // 72% uptime
  'https://sunny.imput.net'               // 72% uptime
];

// ------------------------------------------------------------------
// MAIN API FUNCTION  
// ------------------------------------------------------------------

/**
 * Converts media from a URL using Cobalt API instances
 * Note: YouTube downloads may be temporarily unavailable due to restrictions
 */
export const convertMedia = async (
  url: string,
  format: FileFormat,
  options?: ConversionOptions
): Promise<ConversionResult> => {
  // Validate URL
  if (!url || !url.includes('http')) {
    throw new Error('Please enter a valid URL');
  }

  // Check for direct media files (no conversion needed)
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.match(/\.(mp4|mp3|wav|ogg|webm|jpg|jpeg|png|webp|gif)$/)) {
    return {
      downloadUrl: url,
      filename: url.split('/').pop() || `file.${format.toLowerCase()}`,
      fileSize: 'Direct Link'
    };
  }

  // Check if it's a YouTube URL - show warning
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    console.warn('[Znyth] YouTube downloads may be temporarily unavailable');
  }

  // Try Cobalt instances
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`[Znyth] Trying Cobalt instance: ${instance}`);
      const result = await fetchWithCobalt(instance, url, format, options);
      if (result) {
        return result;
      }
    } catch (error) {
      console.warn(`[Znyth] Instance ${instance} failed:`, error);
      continue;
    }
  }

  throw new Error(
    'Unable to process this video. YouTube downloads may be temporarily unavailable due to platform restrictions. Try TikTok, Instagram, or Twitter instead.'
  );
};

// ------------------------------------------------------------------
// COBALT API
// ------------------------------------------------------------------

async function fetchWithCobalt(
  instance: string,
  url: string,
  format: FileFormat,
  options?: ConversionOptions
): Promise<ConversionResult | null> {
  const isAudio = format === 'MP3';

  const requestBody: Record<string, any> = {
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
    throw new Error(`Cobalt returned ${response.status}`);
  }

  const data = await response.json();

  // Handle different Cobalt response formats
  let downloadUrl = data.url || data.stream?.url;

  if (data.status === 'tunnel' || data.status === 'redirect') {
    downloadUrl = data.url;
  } else if (data.status === 'picker' && data.picker?.length > 0) {
    downloadUrl = data.picker[0].url;
  } else if (data.status === 'error') {
    throw new Error(data.error?.message || 'Cobalt returned an error');
  }

  if (!downloadUrl) {
    throw new Error('No download URL in response');
  }

  // Extract filename
  const filename = data.filename ||
    extractFilename(downloadUrl) ||
    `znyth_${Date.now()}.${format.toLowerCase()}`;

  return {
    downloadUrl,
    filename,
    fileSize: 'Unknown'
  };
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
