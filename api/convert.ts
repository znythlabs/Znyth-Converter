import type { VercelRequest, VercelResponse } from '@vercel/node';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
const RAPID_API_KEY = process.env.RAPID_API_KEY || '';
const RAPID_API_HOST = process.env.RAPID_API_HOST || 'youtube-media-downloader.p.rapidapi.com';

// Rate limiting (in-memory for serverless - resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

// Allowed platforms (security: only allow known video platforms)
const ALLOWED_DOMAINS = [
    'youtube.com', 'youtu.be', 'www.youtube.com',
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
    'instagram.com', 'www.instagram.com',
    'twitter.com', 'x.com', 'www.twitter.com',
    'facebook.com', 'www.facebook.com', 'fb.watch',
    'reddit.com', 'www.reddit.com',
    'vimeo.com', 'www.vimeo.com',
    'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
    'soundcloud.com', 'www.soundcloud.com',
    'open.spotify.com'
];

// Cobalt API instances (free fallback)
const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kwiatekmiki.com'
];

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

function getClientIp(req: VercelRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (record.count >= RATE_LIMIT) {
        return false;
    }

    record.count++;
    return true;
}

function isValidUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        const hostname = url.hostname.toLowerCase();
        return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch {
        return false;
    }
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 100);
}

// ------------------------------------------------------------------
// API HANDLERS
// ------------------------------------------------------------------

async function fetchWithRapidAPI(url: string, format: string, quality: string): Promise<any> {
    if (!RAPID_API_KEY) throw new Error('RapidAPI key not configured');

    const encodedUrl = encodeURIComponent(url);
    const isAudio = format === 'MP3' || format === 'AUDIO';

    // YouTube Info & Download API endpoint format
    // /ajax/download.php?format=mp3&add_info=0&url=...
    const audioQuality = quality === '320k' ? 320 : quality === '192k' ? 192 : 128;
    const videoQuality = quality === '4k' ? '2160' : quality === '720p' ? '720' : '1080';

    const endpoint = isAudio
        ? `https://${RAPID_API_HOST}/ajax/download.php?format=mp3&add_info=0&url=${encodedUrl}&audio_quality=${audioQuality}&allow_extended_duration=false&no_merge=false&audio_language=en`
        : `https://${RAPID_API_HOST}/ajax/download.php?format=mp4&add_info=0&url=${encodedUrl}&quality=${videoQuality}&allow_extended_duration=false&no_merge=false`;

    console.log('[RapidAPI] Calling:', endpoint.substring(0, 100) + '...');

    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'x-rapidapi-key': RAPID_API_KEY,
            'x-rapidapi-host': RAPID_API_HOST
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[RapidAPI] Error:', response.status, errorText);
        throw new Error(`RapidAPI error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[RapidAPI] Response:', JSON.stringify(data).substring(0, 200));

    return data;
}

async function fetchWithCobalt(url: string, format: string, quality: string): Promise<any> {
    const isAudio = format === 'MP3' || format === 'AUDIO';

    for (const instance of COBALT_INSTANCES) {
        try {
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
                    videoQuality: quality === '4k' ? '2160' : quality === '720p' ? '720' : '1080',
                    filenameStyle: 'basic'
                })
            });

            const data = await response.json();

            if (data.status === 'tunnel' || data.status === 'redirect') {
                return {
                    success: true,
                    url: data.url,
                    filename: data.filename || `download.${isAudio ? 'mp3' : 'mp4'}`
                };
            }

            if (data.status === 'picker' && data.picker?.length > 0) {
                return {
                    success: true,
                    url: data.picker[0].url,
                    filename: `download.${isAudio ? 'mp3' : 'mp4'}`
                };
            }

            if (data.status === 'error') {
                if (data.error?.code === 'content.video.unavailable') {
                    throw new Error('Video is unavailable or private');
                }
                continue;
            }
        } catch (error: any) {
            if (error.message?.includes('unavailable') || error.message?.includes('private')) {
                throw error;
            }
            continue;
        }
    }

    throw new Error('All Cobalt instances failed');
}

function extractDownloadUrl(data: any): { url: string; filename: string; size?: string } | null {
    // Handle various API response formats
    if (typeof data.url === 'string') {
        return { url: data.url, filename: data.filename || 'download', size: data.size };
    }
    if (typeof data.link === 'string') {
        return { url: data.link, filename: data.title || 'download', size: data.size };
    }
    if (data.data?.url) {
        return { url: data.data.url, filename: data.data.title || 'download', size: data.data.size };
    }
    if (Array.isArray(data) && data[0]?.url) {
        return { url: data[0].url, filename: data[0].title || 'download' };
    }
    if (data.videos?.items?.[0]?.url) {
        return { url: data.videos.items[0].url, filename: 'download' };
    }
    if (data.formats && Array.isArray(data.formats)) {
        const best = data.formats.find((f: any) => f.url) || data.formats[0];
        if (best?.url) return { url: best.url, filename: data.title || 'download' };
    }
    return null;
}

// ------------------------------------------------------------------
// MAIN HANDLER
// ------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Rate limiting
        const clientIp = getClientIp(req);
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Please wait a moment before trying again.',
                retryAfter: 60
            });
        }

        // Parse and validate request
        const { url, format = 'MP4', quality = '1080p' } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                error: 'Invalid or unsupported URL. Supported platforms: YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Vimeo, Twitch, SoundCloud, Spotify'
            });
        }

        let downloadData: { url: string; filename: string; size?: string } | null = null;

        // Try RapidAPI first
        if (RAPID_API_KEY) {
            try {
                const rapidData = await fetchWithRapidAPI(url, format, quality);
                downloadData = extractDownloadUrl(rapidData);
            } catch (error: any) {
                console.log('RapidAPI failed:', error.message, '- falling back to Cobalt');
            }
        }

        // Fallback to Cobalt
        if (!downloadData) {
            try {
                const cobaltData = await fetchWithCobalt(url, format, quality);
                if (cobaltData.success) {
                    downloadData = {
                        url: cobaltData.url,
                        filename: cobaltData.filename
                    };
                }
            } catch (error: any) {
                return res.status(400).json({ error: error.message || 'Failed to process video' });
            }
        }

        if (!downloadData) {
            return res.status(500).json({ error: 'Unable to extract download URL from any service' });
        }

        // Sanitize filename and add extension
        const ext = format.toLowerCase();
        let filename = sanitizeFilename(downloadData.filename);
        if (!filename.endsWith(`.${ext}`)) {
            filename = `${filename}.${ext}`;
        }

        return res.status(200).json({
            success: true,
            downloadUrl: downloadData.url,
            filename,
            fileSize: downloadData.size || 'Unknown'
        });

    } catch (error: any) {
        console.error('Conversion error:', error);
        return res.status(500).json({
            error: error.message || 'An unexpected error occurred'
        });
    }
}
