
import { FileFormat, ConversionResult, ConversionOptions } from '../types';

// ------------------------------------------------------------------
// CONFIGURATION: RAPID API
// ------------------------------------------------------------------
// The user's provided key and host
const RAPID_API_KEY: string = 'MY KEY HERE'; 
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
 */
async function fetchRapidApi(url: string, apiKey: string, host: string): Promise<any> {
  const encodedUrl = encodeURIComponent(url);
  
  // Strategy: Try common endpoint patterns. 
  // If the specific API expects /download?url=... instead of /?url=..., this catches it.
  const endpoints = [
     `https://${host}/?url=${encodedUrl}`,           // Standard root
     `https://${host}/download?url=${encodedUrl}`,    // Common /download path
     `https://${host}/get?url=${encodedUrl}`,         // Common /get path
     `https://${host}/dl?url=${encodedUrl}`           // Common /dl path
  ];

  let lastError;

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying RapidAPI endpoint: ${endpoint}`);
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
        // If 404, it might just be the wrong path, continue loop to try next one
        if (response.status === 404) continue;
        throw new Error(`RapidAPI Status: ${response.status}`);
      }
    } catch (e: any) {
      lastError = e;
      // If network error (CORS), we continue loop but it likely affects all paths.
      // We will eventually throw and let the Cobalt fallback handle it.
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
        // Many APIs return deep objects, we try to find a valid URL string
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
         // We do NOT throw here; we let execution continue to step 3 (Cobalt fallback)
      }
  }

  // 3. FALLBACK: Cobalt API (Multi-Instance)
  // This is the most reliable fallback for YouTube/Social Media if the paid API fails.
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
             // If it's definitely a bad URL, stop trying
             throw new Error(data.text); 
        }
        // Otherwise try next instance
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
  throw lastError || new Error("All conversion services are busy. Please check the URL or try again later.");
};
