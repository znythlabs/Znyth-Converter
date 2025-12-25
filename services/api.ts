
import { FileFormat, ConversionResult, ConversionOptions } from '../types';

// ------------------------------------------------------------------
// API Configuration
// ------------------------------------------------------------------
// In production, this points to /api/convert (Vercel serverless function)
// In development, it uses local fallback with Cobalt
const API_BASE_URL = import.meta.env.PROD ? '/api' : '';
const USE_LOCAL_FALLBACK = !import.meta.env.PROD;

// Cobalt instances for local development fallback
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt-api.kwiatekmiki.com'
];

// ------------------------------------------------------------------
// MAIN API FUNCTION
// ------------------------------------------------------------------

/**
 * Converts media from a URL using the backend API
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

  // In production, use the serverless API
  if (!USE_LOCAL_FALLBACK) {
    try {
      const response = await fetch(`${API_BASE_URL}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          format,
          quality: options?.resolution || '1080p'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (!data.success || !data.downloadUrl) {
        throw new Error(data.error || 'Failed to get download URL');
      }

      return {
        downloadUrl: data.downloadUrl,
        filename: data.filename || `znyth_${Date.now()}.${format.toLowerCase()}`,
        fileSize: data.fileSize || 'Unknown'
      };
    } catch (error: any) {
      // If rate limited, show helpful message
      if (error.message?.includes('Rate limit')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      throw error;
    }
  }

  // Local development: Use Cobalt directly
  return fetchWithCobalt(url, format, options);
};

// ------------------------------------------------------------------
// LOCAL DEVELOPMENT FALLBACK
// ------------------------------------------------------------------

async function fetchWithCobalt(
  url: string,
  format: FileFormat,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const isAudio = format === FileFormat.MP3;
  let lastError: Error | null = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`[Dev] Trying Cobalt: ${instance}`);

      const response = await fetch(instance, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          downloadMode: isAudio ? 'audio' : 'auto',
          audioFormat: isAudio ? 'mp3' : 'best',
          videoQuality: options?.resolution === '4k' ? '2160' :
            options?.resolution === '720p' ? '720' : '1080',
          filenameStyle: 'basic'
        })
      });

      const data = await response.json();

      // Handle successful responses
      if (data.status === 'tunnel' || data.status === 'redirect') {
        return {
          downloadUrl: data.url,
          filename: data.filename || `znyth_${Date.now()}.${format.toLowerCase()}`,
          fileSize: 'Variable'
        };
      }

      // Handle picker responses (multiple options)
      if (data.status === 'picker' && data.picker?.length > 0) {
        return {
          downloadUrl: data.picker[0].url,
          filename: `znyth_${Date.now()}.${format.toLowerCase()}`,
          fileSize: 'Variable'
        };
      }

      // Handle specific errors
      if (data.status === 'error') {
        const errorCode = data.error?.code || '';
        if (errorCode.includes('unavailable') || errorCode.includes('private')) {
          throw new Error('This video is unavailable or private');
        }
        throw new Error(data.error?.text || 'Conversion failed');
      }

    } catch (error: any) {
      console.warn(`Cobalt ${instance} failed:`, error.message);
      lastError = error;

      // Don't retry on definitive errors
      if (error.message?.includes('unavailable') || error.message?.includes('private')) {
        throw error;
      }
    }
  }

  throw lastError || new Error('All conversion services are busy. Please try again.');
}

// ------------------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------------------

/**
 * Fetch video metadata (thumbnail, title, duration)
 * For future use with preview feature
 */
export const fetchMediaInfo = async (url: string): Promise<{
  title?: string;
  thumbnail?: string;
  duration?: string;
} | null> => {
  // This can be implemented later with a dedicated endpoint
  // For now, return null to indicate no preview available
  return null;
};
