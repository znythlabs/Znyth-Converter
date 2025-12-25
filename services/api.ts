import { FileFormat, ConversionResult, ConversionOptions } from '../types';

// ------------------------------------------------------------------
// API Configuration
// ------------------------------------------------------------------
// Render backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://znyth-backend.onrender.com';
const API_ENDPOINT = `${BACKEND_URL}/api/convert`;

// ------------------------------------------------------------------
// MAIN API FUNCTION
// ------------------------------------------------------------------

/**
 * Converts media from a URL using the Railway backend
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

  console.log('[Znyth] Calling Railway backend...');

  try {
    const response = await fetch(API_ENDPOINT, {
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
      console.warn('[Znyth] Backend error:', data.error);
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    if (!data.success || !data.downloadUrl) {
      throw new Error(data.error || 'Failed to get download URL');
    }

    console.log('[Znyth] Success! Got download URL');
    return {
      downloadUrl: data.downloadUrl,
      filename: data.filename || `znyth_${Date.now()}.${format.toLowerCase()}`,
      fileSize: data.fileSize || 'Unknown'
    };
  } catch (error: any) {
    console.error('[Znyth] Error:', error.message);
    throw error;
  }
};

// ------------------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------------------

/**
 * Fetch video metadata (thumbnail, title, duration)
 */
export const fetchMediaInfo = async (url: string): Promise<{
  title?: string;
  thumbnail?: string;
  duration?: string;
} | null> => {
  // Future: implement preview endpoint
  return null;
};
