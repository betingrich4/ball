/**
 * ============================================================
 * MOVIEBOX API PRO - CLOUDFLARE WORKER
 * ============================================================
 * Pure JavaScript rewrite of the FastAPI backend.
 * Runs on Cloudflare's global edge network.
 *
 * Endpoints:
 *   GET /                        -> Dashboard HTML
 *   GET /health                  -> Health check
 *   GET /home                    -> Home page sections
 *   GET /movies?page=1           -> Movies catalog (paginated)
 *   GET /tv-series?page=1        -> TV Series catalog (paginated)
 *   GET /animation?page=1        -> Animation catalog (paginated)
 *   GET /search?q=...            -> Full search
 *   GET /search/suggest?q=...    -> Search suggestions
 *   GET /detail/{slug}           -> Full metadata
 *   GET /api/stream/{id}         -> Video stream sources
 *   GET /api/stream/{id}/captions -> Subtitles
 *
 * Author: Walter
 * Version: 2.1.5-js
 * ============================================================
 */

/* ============================================================
   CONSTANTS
   ============================================================ */
const API_BASE = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const DEFAULT_PLAYER_DOMAIN = 'https://netfilm.world';

// Tab IDs for the filter endpoint
const TAB_IDS = {
    movies: 2,
    tvSeries: 5,
    animation: 8,
};

// ---------- Headers for the main MovieBox API ----------
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Referer': 'https://moviebox.ph/',
    'Origin': 'https://moviebox.ph',
    'X-Client-Info': '{"timezone":"Asia/Dhaka"}',
    'X-Request-Lang': 'en',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
};

// ---------- Headers for the stream domain ----------
const PLAYER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'X-Client-Info': '{"timezone":"Asia/Dhaka"}',
    'X-Source': '',
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
};

/* ============================================================
   CORS HEADERS (applied to every response)
   ============================================================ */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

/* ============================================================
   JSON RESPONSE HELPER
   ============================================================ */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...CORS_HEADERS,
        },
    });
}

function errorResponse(message, status = 500) {
    return jsonResponse({ detail: message, status: 'error' }, status);
}

/* ============================================================
   BEARER TOKEN ACQUISITION
   ------------------------------------------------------------
   The MovieBox API issues a guest JWT on the first request
   to /home via the `x-user` response header. We cache it
   in memory (per Worker isolate) to reuse across requests.
   ============================================================ */
let _bearerToken = null;
let _tokenAcquiredAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // Refresh token every 10 minutes

async function getBearerToken() {
    const now = Date.now();
    if (_bearerToken && (now - _tokenAcquiredAt) < TOKEN_TTL_MS) {
        return _bearerToken;
    }

    try {
        const resp = await fetch(`${API_BASE}/home?host=moviebox.ph`, {
            method: 'GET',
            headers: DEFAULT_HEADERS,
        });

        // Preferred: read from x-user header
        const xUser = resp.headers.get('x-user');
        if (xUser) {
            try {
                const parsed = JSON.parse(xUser);
                if (parsed && parsed.token) {
                    _bearerToken = parsed.token;
                    _tokenAcquiredAt = now;
                    return _bearerToken;
                }
            } catch (_) { /* ignore parse errors */ }
        }

        // Fallback: read from set-cookie
        const setCookie = resp.headers.get('set-cookie') || '';
        const match = setCookie.match(/token=([^;]+)/);
        if (match) {
            _bearerToken = match[1];
            _tokenAcquiredAt = now;
        }
    } catch (err) {
        console.error('[WARN] Failed to acquire bearer token:', err.message);
    }

    return _bearerToken || '';
}

/* ============================================================
   GENERIC REQUEST WRAPPER
   ------------------------------------------------------------
   Similar to _make_request() in the Python version.
   Handles auth, token rotation, and JSON parsing.
   ============================================================ */
async function makeRequest(url, options = {}) {
    const { method = 'GET', payload = null, customHeaders = {} } = options;

    const token = await getBearerToken();

    const headers = {
        ...DEFAULT_HEADERS,
        'Authorization': token ? `Bearer ${token}` : '',
        ...customHeaders,
    };

    const fetchOptions = {
        method,
        headers,
    };

    if (payload && method.toUpperCase() === 'POST') {
        fetchOptions.body = JSON.stringify(payload);
    }

    let resp;
    try {
        resp = await fetch(url, fetchOptions);
    } catch (err) {
        throw new Error(`Network error: ${err.message}`);
    }

    // Refresh token if server rotated it
    const xUser = resp.headers.get('x-user');
    if (xUser) {
        try {
            const parsed = JSON.parse(xUser);
            if (parsed && parsed.token) {
                _bearerToken = parsed.token;
                _tokenAcquiredAt = Date.now();
            }
        } catch (_) { /* ignore */ }
    }

    if (!resp.ok) {
        throw new Error(`Upstream API error: ${resp.status}`);
    }

    try {
        return await resp.json();
    } catch (err) {
        throw new Error(`Invalid JSON from upstream: ${err.message}`);
    }
}

/* ============================================================
   ROUTE HANDLERS
   ============================================================ */

/* ---------- GET / ---------- */
function handleDashboard() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MovieBox API Pro</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #07080c;
    color: #fff;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background-image:
      radial-gradient(circle at 10% 10%, rgba(255,61,113,0.15) 0%, transparent 40%),
      radial-gradient(circle at 90% 90%, rgba(51,102,255,0.15) 0%, transparent 40%);
  }
  .card {
    max-width: 800px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 3rem;
    backdrop-filter: blur(12px);
  }
  h1 {
    font-size: 2.5rem;
    background: linear-gradient(135deg, #fff, #ff3d71);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 1rem;
  }
  p { color: #9ea3ac; margin-bottom: 2rem; line-height: 1.6; }
  .endpoints { display: grid; gap: 0.75rem; }
  .endpoint {
    background: rgba(0,0,0,0.4);
    padding: 12px 18px;
    border-radius: 10px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.9rem;
    color: #00f2ff;
    border-left: 3px solid #ff3d71;
  }
  .endpoint span { color: #ff3d71; font-weight: bold; margin-right: 12px; }
  .badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(0,242,255,0.15);
    color: #00f2ff;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 1rem;
    border: 1px solid rgba(0,242,255,0.3);
  }
</style>
</head>
<body>
<div class="card">
  <div class="badge">⚡ Powered by Cloudflare Workers</div>
  <h1>🎬 MovieBox API Pro</h1>
  <p>Full Pure REST API for moviebox.ph — Zero Scraping. JS Worker Edition v2.1.5</p>
  <div class="endpoints">
    <div class="endpoint"><span>GET</span>/home</div>
    <div class="endpoint"><span>GET</span>/movies?page=1</div>
    <div class="endpoint"><span>GET</span>/tv-series?page=1</div>
    <div class="endpoint"><span>GET</span>/animation?page=1</div>
    <div class="endpoint"><span>GET</span>/search?q=avatar</div>
    <div class="endpoint"><span>GET</span>/search/suggest?q=av</div>
    <div class="endpoint"><span>GET</span>/detail/{slug}</div>
    <div class="endpoint"><span>GET</span>/api/stream/{subject_id}</div>
    <div class="endpoint"><span>GET</span>/api/stream/{subject_id}/captions</div>
  </div>
</div>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
    });
}

/* ---------- GET /health ---------- */
function handleHealth() {
    return jsonResponse({
        status: 'healthy',
        service: 'MovieBox API Pro (Worker)',
        version: '2.1.5-js',
        runtime: 'cloudflare-workers',
        timestamp: new Date().toISOString(),
    });
}

/* ---------- GET /home ---------- */
async function handleHome() {
    const url = `${API_BASE}/home?host=moviebox.ph`;
    const data = await makeRequest(url);

    const operatingList = (data.data && data.data.operatingList) || [];
    const sections = [];

    for (const op of operatingList) {
        const opType = op.type;
        const title = op.title || 'Featured';

        // ---- BANNER ----
        if (opType === 'BANNER') {
            const bannerItems = (op.banner && op.banner.items) || [];
            const items = bannerItems
                .filter((item) => {
                    const t = item.title || '';
                    return item.title && !t.includes('Communities');
                })
                .map((item) => {
                    const subject = item.subject || {};
                    return {
                        name: item.title || subject.title,
                        poster_url: (item.image && item.image.url) || (subject.cover && subject.cover.url),
                        slug: item.detailPath || subject.detailPath,
                        subject_id: subject.subjectId,
                        badge: subject.corner,
                    };
                });

            sections.push({ section: 'Banner', count: items.length, items });
        }
        // ---- GRID SECTIONS ----
        else if (['SUBJECTS_MOVIE', 'SUBJECTS_TV', 'SUBJECTS_ANIMATION'].includes(opType)) {
            const subjects = op.subjects || [];
            const items = subjects.map((sub) => ({
                name: sub.title,
                poster_url: sub.cover && sub.cover.url,
                slug: sub.detailPath,
                subject_id: sub.subjectId,
                badge: sub.corner,
                rating: sub.imdbRatingValue,
                year: sub.releaseDate ? String(sub.releaseDate).substring(0, 4) : null,
            }));

            if (items.length > 0) {
                sections.push({ section: title, count: items.length, items });
            }
        }
    }

    return jsonResponse({ status: 'success', sections });
}

/* ---------- CATEGORY FETCHER (shared by movies/tv/animation) ---------- */
async function getCategoryData(tabId, page = 1, perPage = 24, sort = 'RECOMMEND') {
    const url = `${API_BASE}/subject/filter`;
    const payload = {
        tabId,
        filter: {
            sort,
            genre: 'ALL',
            country: 'ALL',
            year: 'ALL',
            language: 'ALL',
        },
        page,
        perPage,
    };

    const data = await makeRequest(url, { method: 'POST', payload });
    const inner = data.data || {};
    const rawItems = inner.items || inner.subjects || [];

    const items = rawItems.map((sub) => ({
        name: sub.title,
        poster_url: sub.cover && sub.cover.url,
        slug: sub.detailPath,
        subject_id: sub.subjectId,
        badge: sub.corner,
        rating: sub.imdbRatingValue,
        year: sub.releaseDate ? String(sub.releaseDate).substring(0, 4) : null,
    }));

    const pager = inner.pager || {};
    const total = pager.totalCount || inner.total || items.length;

    return { page, per_page: perPage, total, items };
}

/* ---------- GET /movies ---------- */
async function handleMovies(url) {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const sort = url.searchParams.get('sort') || 'RECOMMEND';
    return jsonResponse(await getCategoryData(TAB_IDS.movies, page, 24, sort));
}

/* ---------- GET /tv-series ---------- */
async function handleTvSeries(url) {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const sort = url.searchParams.get('sort') || 'RECOMMEND';
    return jsonResponse(await getCategoryData(TAB_IDS.tvSeries, page, 24, sort));
}

/* ---------- GET /animation ---------- */
async function handleAnimation(url) {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const sort = url.searchParams.get('sort') || 'RECOMMEND';
    return jsonResponse(await getCategoryData(TAB_IDS.animation, page, 24, sort));
}

/* ---------- GET /search/suggest ---------- */
async function handleSearchSuggest(url) {
    const q = url.searchParams.get('q');
    if (!q || q.length < 1) {
        return errorResponse('Query parameter "q" is required', 400);
    }

    const apiUrl = `${API_BASE}/subject/search-suggest`;
    const data = await makeRequest(apiUrl, {
        method: 'POST',
        payload: { keyword: q, perPage: 10 },
    });

    const inner = data.data || {};
    const raw = inner.items || inner.list || [];

    const suggestions = raw.map((item) => {
        const sub = item.subject || {};
        return {
            title: sub.title || item.word || item.title,
            slug: sub.detailPath || item.detailPath,
            subject_id: sub.subjectId || item.subjectId,
        };
    });

    return jsonResponse({ suggestions });
}

/* ---------- GET /search ---------- */
async function handleSearch(url) {
    const q = url.searchParams.get('q');
    if (!q || q.length < 1) {
        return errorResponse('Query parameter "q" is required', 400);
    }
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    const apiUrl = `${API_BASE}/subject/search`;
    const data = await makeRequest(apiUrl, {
        method: 'POST',
        payload: { keyword: q, page, perPage: 20 },
    });

    const inner = data.data || {};
    const raw = inner.items || inner.list || [];

    const items = raw.map((sub) => ({
        name: sub.title,
        poster_url: sub.cover && sub.cover.url,
        slug: sub.detailPath,
        subject_id: sub.subjectId,
    }));

    const pager = inner.pager || {};
    const total = pager.totalCount || inner.total || items.length;

    return jsonResponse({ query: q, page, total, items });
}

/* ---------- GET /detail/{slug} ---------- */
async function handleDetail(slug) {
    if (!slug) return errorResponse('Slug is required', 400);

    const url = `${API_BASE}/detail?detailPath=${encodeURIComponent(slug)}`;
    const data = await makeRequest(url);
    return jsonResponse(data);
}

/* ---------- GET /api/stream/{subject_id} ---------- */
async function handleStream(subjectId, url) {
    const detailPath = url.searchParams.get('detail_path');
    if (!detailPath) {
        return errorResponse('Missing required query param: detail_path', 400);
    }
    const se = parseInt(url.searchParams.get('se') || '1', 10);
    const ep = parseInt(url.searchParams.get('ep') || '1', 10);

    // Step 1: Get the current player domain
    const domData = await makeRequest(`${API_BASE}/media-player/get-domain`);
    const domain = (domData.data || DEFAULT_PLAYER_DOMAIN).replace(/\/$/, '');

    // Step 2: Build the same Referer a real browser player uses
    const playerReferer =
        `${domain}/spa/videoPlayPage/movies/${detailPath}` +
        `?id=${subjectId}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`;

    const playUrl =
        `${domain}/wefeed-h5api-bff/subject/play` +
        `?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(detailPath)}`;

    // Step 3: Call the player endpoint
    let playResp;
    try {
        playResp = await fetch(playUrl, {
            method: 'GET',
            headers: { ...PLAYER_HEADERS, 'Referer': playerReferer },
        });
    } catch (err) {
        return errorResponse(`Player request failed: ${err.message}`, 502);
    }

    if (!playResp.ok) {
        return errorResponse(`Player API error: ${playResp.status}`, 502);
    }

    let playJson;
    try {
        playJson = await playResp.json();
    } catch (err) {
        return errorResponse(`Invalid player JSON: ${err.message}`, 502);
    }

    const data = playJson.data || {};
    const hasResource = data.hasResource || false;

    // Step 4: Normalize streams
    const streams = (data.streams || []).map((s) => ({
        resolution: `${s.resolutions}p`,
        format: s.format,
        url: s.url,
        size: s.size,
        duration: s.duration,
        codec: s.codecName,
    }));

    return jsonResponse({
        subject_id: subjectId,
        se,
        ep,
        has_resource: hasResource,
        sources: streams,
        hls: data.hls || [],
        dash: data.dash || [],
        free_episodes: data.freeNum,
        limited: data.limited || false,
        note: hasResource ? null : 'No stream found for this episode.',
    });
}

/* ---------- GET /api/stream/{subject_id}/captions ---------- */
async function handleCaptions(subjectId, url) {
    const detailPath = url.searchParams.get('detail_path');
    if (!detailPath) {
        return errorResponse('Missing required query param: detail_path', 400);
    }
    const se = parseInt(url.searchParams.get('se') || '1', 10);
    const ep = parseInt(url.searchParams.get('ep') || '1', 10);

    // Step 1: Get the player domain
    const domData = await makeRequest(`${API_BASE}/media-player/get-domain`);
    const domain = (domData.data || DEFAULT_PLAYER_DOMAIN).replace(/\/$/, '');

    const playerReferer =
        `${domain}/spa/videoPlayPage/movies/${detailPath}` +
        `?id=${subjectId}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`;

    const playUrl =
        `${domain}/wefeed-h5api-bff/subject/play` +
        `?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(detailPath)}`;

    // Step 2: Fetch stream metadata to find the stream ID
    let playResp;
    try {
        playResp = await fetch(playUrl, {
            method: 'GET',
            headers: { ...PLAYER_HEADERS, 'Referer': playerReferer },
        });
    } catch (err) {
        return errorResponse(`Player request failed: ${err.message}`, 502);
    }

    if (!playResp.ok) {
        return errorResponse(`Player API error: ${playResp.status}`, 502);
    }

    const playJson = await playResp.json();
    const playData = playJson.data || {};

    const streams = playData.streams || [];
    const dash = playData.dash || [];

    let streamId = null;
    let streamFormat = null;

    if (streams.length > 0) {
        streamId = streams[0].id;
        streamFormat = streams[0].format || 'MP4';
    } else if (dash.length > 0) {
        streamId = dash[0].id;
        streamFormat = dash[0].format || 'DASH';
    }

    if (!streamId) {
        return jsonResponse({
            subject_id: subjectId,
            se,
            ep,
            count: 0,
            captions: [],
        });
    }

    // Step 3: Fetch captions
    const capUrl =
        `${API_BASE}/subject/caption` +
        `?format=${encodeURIComponent(streamFormat)}&id=${encodeURIComponent(streamId)}` +
        `&subjectId=${encodeURIComponent(subjectId)}&detailPath=${encodeURIComponent(detailPath)}`;

    const capData = await makeRequest(capUrl);
    const inner = capData.data || {};
    const captions = Array.isArray(inner) ? inner : (inner.captions || []);

    return jsonResponse({
        subject_id: subjectId,
        se,
        ep,
        count: captions.length,
        captions,
    });
}

/* ============================================================
   ROUTER
   ============================================================ */
async function handleRequest(request) {
    // Preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Route table
    try {
        // Root & health
        if (path === '/' || path === '') return handleDashboard();
        if (path === '/health') return handleHealth();

        // Home & categories
        if (path === '/home') return await handleHome();
        if (path === '/movies') return await handleMovies(url);
        if (path === '/tv-series') return await handleTvSeries(url);
        if (path === '/animation') return await handleAnimation(url);

        // Search
        if (path === '/search/suggest') return await handleSearchSuggest(url);
        if (path === '/search') return await handleSearch(url);

        // Detail: /detail/{slug}
        const detailMatch = path.match(/^\/detail\/(.+)$/);
        if (detailMatch) {
            const slug = decodeURIComponent(detailMatch[1]);
            return await handleDetail(slug);
        }

        // Captions: /api/stream/{id}/captions
        const captionsMatch = path.match(/^\/api\/stream\/([^/]+)\/captions$/);
        if (captionsMatch) {
            const subjectId = captionsMatch[1];
            return await handleCaptions(subjectId, url);
        }

        // Stream: /api/stream/{id}
        const streamMatch = path.match(/^\/api\/stream\/([^/]+)$/);
        if (streamMatch) {
            const subjectId = streamMatch[1];
            return await handleStream(subjectId, url);
        }

        // 404 fallback
        return errorResponse(`Route not found: ${path}`, 404);

    } catch (err) {
        console.error('[ERROR]', err.message, err.stack);
        return errorResponse(err.message || 'Internal server error', 502);
    }
}

/* ============================================================
   WORKER EXPORT
   ============================================================ */
addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request));
});
