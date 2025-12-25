import { FileFormat, ConversionResult, ConversionOptions } from '../types';

// ------------------------------------------------------------------
// CONFIGURATION: RAPID API
// ------------------------------------------------------------------
const RAPID_API_KEY: string = 'cc989ea7bbmsha43197738848936p17de93jsnf3a4db5b272d'; 
const RAPID_API_HOST = 'youtube-info-download-api.p.rapidapi.com';
// ------------------------------------------------------------------

// Updated list of public Cobalt instances (Fallback)
const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://cobalt.api.sc/api/json', 
  'https://on.cobalt.tools/api/json',
  'https://api.server.cobalt.tools/api/json'
];

/**
 * Helper to try fetching from RapidAPI with different path strategies
 * Includes CORS Proxy fallback for localhost/frontend usage.
 */
async function fetchRapidApi(url: string, apiKey: string, host: string): Promise<any> {
  const encodedUrl = encodeURIComponent(url);
  
  // 1. Define possible endpoint paths for this API
  const paths = [
     `https://${host}/download?url=${encodedUrl}`,
     `https://${host}/?url=${encodedUrl}`,
     `https://${host}/get?url=${encodedUrl}`,
     `https://${host}/dl?url=${encodedUrl}`
  ];

  // 2. Add CORS Proxy versions of those paths
  // This fixes "Failed to fetch" on localhost by bypassing browser CORS restrictions
  const proxyBase = 'https://corsproxy.io/?';
  const allEndpoints = [
      ...paths, // Try direct first (fastest)
      ...paths.map(p => `${proxyBase}${encodeURIComponent(p)}`) // Try proxied second (safer)
  ];

  let lastError;

  for (const endpoint of allEndpoints) {
    try {
      console.log(`Trying RapidAPI endpoint: ${endpoint}`);
      
      // Note: When using CORS proxy, we don't need some headers, but RapidAPI needs them.
      // We pass them normally.
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': host
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        // If 404, just try next path
        if (response.status === 404) continue;
        throw new Error(`RapidAPI Status: ${response.status}`);
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`Attempt failed for ${endpoint}: ${e.message}`);
      // Continue to next endpoint strategy
    }
  }
  
  throw lastError || new Error("RapidAPI endpoints failed.");
}

/**
 * Converts media using RapidAPI (Primary) with a robust Cobalt Fallback.
 */
export const convertMedia = async (url: string, format: FileFormat, options?: ConversionOptions): Promise<ConversionResult> => {
  if (!url || !url.includes('http')) {
      throw new Error("Invalid URL provided");
  }

  // 1. Direct File Handling
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.match(/\.(mp4|mp3|wav|ogg|webm|jpg|jpeg|png|webp|gif)$/)) {
    return {
      downloadUrl: url,
      filename: url.split('/').pop() || `file.${format.toLowerCase()}`,
      fileSize: "Unknown"
    };
  }

  // 2. PRIMARY: Try RapidAPI
  if (RAPID_API_KEY && RAPID_API_KEY !== 'MY KEY HERE') {
      try {
        console.log(`Attempting conversion via RapidAPI (${RAPID_API_HOST})...`);
        
        const data = await fetchRapidApi(url, RAPID_API_KEY, RAPID_API_HOST);
        
        // ADAPTER: Parse generic responses flexibly
        let finalUrl = null;
        let fileSize = "High Quality";
        let filename = `znyth_rapid_${Date.now()}.${format.toLowerCase()}`;

        // Check common properties
        if (typeof data.url === 'string') finalUrl = data.url;
        else if (typeof data.link === 'string') finalUrl = data.link;
        else if (data.data && typeof data.data.url === 'string') finalUrl = data.data.url;
        else if (data.data && typeof data.data.link === 'string') finalUrl = data.data.link;
        // Check array formats
        else if (Array.isArray(data) && data[0]?.url) finalUrl = data[0].url;
        else if (data.links && Array.isArray(data.links) && data.links[0]?.link) finalUrl = data.links[0].link;
        else if (data.videos && data.videos.items && data.videos.items[0]?.url) finalUrl = data.videos.items[0].url; 

        // Metadata extraction (if available)
        if (data.title) filename = `${data.title.replace(/[^a-z0-9]/gi, '_')}.${format.toLowerCase()}`;
        if (data.size) fileSize = data.size;
        if (data.filesize) fileSize = data.filesize;

        if (finalUrl) {
            return {
                downloadUrl: finalUrl,
                filename,
                fileSize
            };
        } else {
            console.warn("RapidAPI response structure not recognized:", data);
            throw new Error("RapidAPI response did not contain a recognizable download URL.");
        }
        
      } catch (e: any) {
         console.warn(`RapidAPI failed (${e.message}), falling back to Cobalt instances...`);
         // Fallback continues below
      }
  }

  // 3. FALLBACK: Cobalt API (Multi-Instance)
  let lastError: Error | null = null;

  for (const apiBase of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt instance: ${apiBase}`);
      const response = await fetch(apiBase, {
          method: 'POST',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              url: url,
              vCodec: 'h264',
              vQuality: options?.resolution === '4k' ? 'max' : options?.resolution === '720p' ? '720' : '1080',
              aFormat: format === FileFormat.MP3 ? 'mp3' : 'best',
              isAudioOnly: format === FileFormat.MP3,
          })
      });

      const data = await response.json();

      if (data.status === 'error' || !data.url) {
        if (data.text && (data.text.includes('private') || data.text.includes('invalid'))) {
             throw new Error(data.text); 
        }
        throw new Error(data.text || "Instance failed");
      }

      const finalUrl = data.url || (data.picker && data.picker[0]?.url);

      if (!finalUrl) {
        throw new Error("No media URL found in the response.");
      }

      return {
          downloadUrl: finalUrl,
          filename: data.filename || `znyth_cobalt_${Date.now()}.${format.toLowerCase()}`,
          fileSize: "Variable" 
      };

    } catch (error: any) {
       console.warn(`Cobalt fallback failed on ${apiBase}:`, error.message);
       lastError = error;
    }
  }

  // If all failed
  throw new Error("Network error. Please disable AdBlocker or try a different link.");
};