/**
 * ============================================================
 * MOVIEBOX API PRO - CLOUDFLARE WORKER (v2.2.0)
 * ============================================================
 * A pure JavaScript rewrite of the MovieBox FastAPI backend.
 * Runs on Cloudflare's global edge network.
 *
 * Endpoints:
 *   GET /                            -> Dashboard HTML
 *   GET /health                      -> Health check
 *   GET /home                        -> Home sections, banners, platforms
 *   GET /banners                     -> Banner items only
 *   GET /platforms                   -> Streaming platform list
 *   GET /movies?page=1&sort=...      -> Movies catalog (paginated)
 *   GET /tv-series?page=1&sort=...   -> TV Series catalog (paginated)
 *   GET /animation?page=1&sort=...   -> Animation catalog (paginated)
 *   GET /search?q=...&page=1         -> Full-text search
 *   GET /search/suggest?q=...        -> Search autocomplete
 *   GET /detail/{slug}               -> Full metadata + seasons
 *   GET /api/stream/{id}             -> Video stream sources
 *   GET /api/stream/{id}/captions    -> Subtitle tracks
 * ============================================================
 */

/* ============ CONSTANTS ============ */
const API_BASE = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const DEFAULT_PLAYER_DOMAIN = 'https://netfilm.world';

const TAB_IDS = {
    movies: 2,
    tvSeries: 5,
    animation: 8,
};

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

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

/* ============ RESPONSE HELPERS ============ */
function jsonResponse(data, status = 200, cacheSeconds = 0) {
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        ...CORS_HEADERS,
    };
    if (cacheSeconds > 0) {
        headers['Cache-Control'] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
    }
    return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message, status = 500) {
    return jsonResponse({ detail: message, status: 'error' }, status);
}

/* ============ BEARER TOKEN MANAGEMENT ============ */
let _bearerToken = null;
let _tokenAcquiredAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000;

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

        const xUser = resp.headers.get('x-user');
        if (xUser) {
            try {
                const parsed = JSON.parse(xUser);
                if (parsed && parsed.token) {
                    _bearerToken = parsed.token;
                    _tokenAcquiredAt = now;
                    return _bearerToken;
                }
            } catch (_) {}
        }

        const setCookie = resp.headers.get('set-cookie') || '';
        const match = setCookie.match(/token=([^;]+)/);
        if (match) {
            _bearerToken = match[1];
            _tokenAcquiredAt = now;
        }
    } catch (err) {
        console.error('[WARN] Token fetch failed:', err.message);
    }

    return _bearerToken || '';
}

/* ============ GENERIC REQUEST ============ */
async function makeRequest(url, options = {}) {
    const { method = 'GET', payload = null, customHeaders = {} } = options;
    const token = await getBearerToken();

    const headers = {
        ...DEFAULT_HEADERS,
        'Authorization': token ? `Bearer ${token}` : '',
        ...customHeaders,
    };

    const fetchOptions = { method, headers };
    if (payload && method.toUpperCase() === 'POST') {
        fetchOptions.body = JSON.stringify(payload);
    }

    const resp = await fetch(url, fetchOptions);

    const xUser = resp.headers.get('x-user');
    if (xUser) {
        try {
            const parsed = JSON.parse(xUser);
            if (parsed && parsed.token) {
                _bearerToken = parsed.token;
                _tokenAcquiredAt = Date.now();
            }
        } catch (_) {}
    }

    if (!resp.ok) {
        throw new Error(`Upstream error: ${resp.status}`);
    }

    return await resp.json();
}

/* ============================================================
   DATA NORMALIZATION
   ============================================================ */

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function normalizeSubject(sub) {
    if (!sub) return null;

    const cover = sub.cover || {};
    const trailer = sub.trailer || {};
    const trailerVideo = trailer.videoAddress || {};
    const trailerCover = trailer.cover || {};

    return {
        subject_id: sub.subjectId || '',
        subject_type: sub.subjectType || 0,
        title: sub.title || '',
        description: sub.description || '',
        release_date: sub.releaseDate || '',
        year: sub.releaseDate ? String(sub.releaseDate).substring(0, 4) : '',
        duration: sub.duration || 0,
        duration_text: formatDuration(sub.duration || 0),
        genre: sub.genre || '',
        genres: sub.genre ? sub.genre.split(',').map(g => g.trim()).filter(Boolean) : [],
        country: sub.countryName || '',
        rating: sub.imdbRatingValue || '',
        rating_count: sub.imdbRatingCount || 0,
        subtitles: sub.subtitles || '',
        has_resource: sub.hasResource === true,
        corner: sub.corner || '',

        poster_url: cover.url || '',
        poster_blur: cover.blurHash || '',
        poster_width: cover.width || 0,
        poster_height: cover.height || 0,

        trailer_url: trailerVideo.url || '',
        trailer_duration: trailerVideo.duration || 0,
        trailer_cover_url: trailerCover.url || '',

        detail_path: sub.detailPath || '',
        season: sub.season || 0,
        dubs: sub.dubs || [],
    };
}

/* ============================================================
   ROUTE: GET /  — Dashboard
   ============================================================ */
function handleDashboard() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MovieBox API Pro — Worker v2.2.0</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#07080c;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background-image:radial-gradient(circle at 10% 10%,rgba(255,61,113,.15) 0,transparent 40%),radial-gradient(circle at 90% 90%,rgba(51,102,255,.15) 0,transparent 40%)}
  .card{max-width:820px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:3rem;backdrop-filter:blur(12px)}
  h1{font-size:2.5rem;background:linear-gradient(135deg,#fff,#ff3d71);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}
  p{color:#9ea3ac;margin-bottom:2rem;line-height:1.6}
  .badge{display:inline-block;padding:6px 14px;border-radius:20px;background:rgba(0,242,255,.15);color:#00f2ff;font-size:.8rem;font-weight:600;margin-bottom:1rem;border:1px solid rgba(0,242,255,.3)}
  .endpoints{display:grid;gap:.75rem}
  .endpoint{background:rgba(0,0,0,.4);padding:12px 18px;border-radius:10px;font-family:'Monaco',monospace;font-size:.9rem;color:#00f2ff;border-left:3px solid #ff3d71}
  .endpoint span{color:#ff3d71;font-weight:bold;margin-right:12px}
</style>
</head>
<body>
<div class="card">
  <div class="badge">⚡ Worker v2.2.0 — Live API</div>
  <h1>🎬 MovieBox API Pro</h1>
  <p>Full Pure REST API with rich metadata: trailers, ratings, genres, dubs, blur hashes.</p>
  <div class="endpoints">
    <div class="endpoint"><span>GET</span>/health</div>
    <div class="endpoint"><span>GET</span>/home</div>
    <div class="endpoint"><span>GET</span>/banners</div>
    <div class="endpoint"><span>GET</span>/platforms</div>
    <div class="endpoint"><span>GET</span>/movies?page=1</div>
    <div class="endpoint"><span>GET</span>/tv-series?page=1</div>
    <div class="endpoint"><span>GET</span>/animation?page=1</div>
    <div class="endpoint"><span>GET</span>/search?q=avatar</div>
    <div class="endpoint"><span>GET</span>/search/suggest?q=av</div>
    <div class="endpoint"><span>GET</span>/detail/{slug}</div>
    <div class="endpoint"><span>GET</span>/api/stream/{id}</div>
    <div class="endpoint"><span>GET</span>/api/stream/{id}/captions</div>
  </div>
</div>
</body>
</html>`;
    return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
    });
}

/* ============================================================
   ROUTE: GET /health
   ============================================================ */
function handleHealth() {
    return jsonResponse({
        status: 'healthy',
        service: 'MovieBox API Pro (Worker)',
        version: '2.2.0-js',
        runtime: 'cloudflare-workers',
        timestamp: new Date().toISOString(),
    });
}

/* ============================================================
   ROUTE: GET /home
   ============================================================ */
async function handleHome() {
    const url = `${API_BASE}/home?host=moviebox.ph`;
    const raw = await makeRequest(url);

    const data = raw.data || {};
    const operatingList = data.operatingList || [];
    const platformList = data.platformList || [];

    const banners = [];
    const sections = [];

    for (const op of operatingList) {
        const opType = op.type;
        const title = op.title || 'Featured';

        if (opType === 'BANNER') {
            const items = (op.banner && op.banner.items) || [];
            for (const item of items) {
                const subject = item.subject || {};
                const t = item.title || subject.title || '';
                if (!t || t.includes('Communities')) continue;

                const normalized = normalizeSubject(subject);

                banners.push({
                    banner_title: item.title || '',
                    banner_image_url: (item.image && item.image.url) || '',
                    banner_image_width: (item.image && item.image.width) || 0,
                    banner_image_height: (item.image && item.image.height) || 0,
                    banner_blur: (item.image && item.image.blurHash) || '',
                    ...normalized,
                    title: normalized.title || item.title || '',
                    detail_path: normalized.detail_path || item.detailPath || '',
                    subject_id: normalized.subject_id || item.subjectId || '',
                    subject_type: normalized.subject_type || item.subjectType || 0,
                });
            }
            continue;
        }

        if (['SUBJECTS_MOVIE', 'SUBJECTS_TV', 'SUBJECTS_ANIMATION'].includes(opType)) {
            const subjects = (op.subjects || []).map(normalizeSubject).filter(Boolean);
            if (subjects.length > 0) {
                sections.push({
                    section: title,
                    type: opType,
                    count: subjects.length,
                    items: subjects,
                    op_id: op.opId || '',
                    url: op.url || '',
                    path: op.path || '',
                });
            }
            continue;
        }

        if (opType === 'CUSTOM' && op.customData && op.customData.items) {
            const items = op.customData.items.map((item) => {
                const sub = item.subject || {};
                const normalized = normalizeSubject(sub);
                return {
                    ...normalized,
                    title: normalized.title || item.title || '',
                    detail_path: normalized.detail_path || item.detailPath || '',
                    subject_id: normalized.subject_id || item.subjectId || '',
                    subject_type: normalized.subject_type || item.subjectType || 0,
                    poster_url: normalized.poster_url || (item.image && item.image.url) || '',
                };
            }).filter((i) => i.subject_id || i.detail_path);

            if (items.length > 0) {
                sections.push({
                    section: title,
                    type: 'CUSTOM',
                    count: items.length,
                    items,
                });
            }
            continue;
        }

        if (Array.isArray(op.subjects) && op.subjects.length > 0) {
            const subjects = op.subjects.map(normalizeSubject).filter(Boolean);
            sections.push({
                section: title,
                type: opType,
                count: subjects.length,
                items: subjects,
            });
        }
    }

    return jsonResponse({
        status: 'success',
        banners,
        sections,
        platforms: platformList,
        meta: {
            banner_count: banners.length,
            section_count: sections.length,
            platform_count: platformList.length,
        },
    }, 200, 300);
}

/* ============================================================
   ROUTE: GET /banners
   ============================================================ */
async function handleBanners() {
    const url = `${API_BASE}/home?host=moviebox.ph`;
    const raw = await makeRequest(url);
    const operatingList = (raw.data && raw.data.operatingList) || [];

    const banners = [];
    for (const op of operatingList) {
        if (op.type !== 'BANNER') continue;
        const items = (op.banner && op.banner.items) || [];
        for (const item of items) {
            const t = item.title || (item.subject && item.subject.title) || '';
            if (!t || t.includes('Communities')) continue;
            const subject = item.subject || {};
            banners.push({
                title: subject.title || item.title || '',
                banner_image_url: (item.image && item.image.url) || '',
                banner_blur: (item.image && item.image.blurHash) || '',
                poster_url: (subject.cover && subject.cover.url) || '',
                trailer_url: (subject.trailer && subject.trailer.videoAddress && subject.trailer.videoAddress.url) || '',
                description: subject.description || '',
                genres: subject.genre ? subject.genre.split(',').map(g => g.trim()) : [],
                rating: subject.imdbRatingValue || '',
                year: subject.releaseDate ? String(subject.releaseDate).substring(0, 4) : '',
                detail_path: subject.detailPath || item.detailPath || '',
                subject_id: subject.subjectId || item.subjectId || '',
                subject_type: subject.subjectType || item.subjectType || 0,
            });
        }
    }

    return jsonResponse({ status: 'success', count: banners.length, banners }, 200, 300);
}

/* ============================================================
   ROUTE: GET /platforms
   ============================================================ */
async function handlePlatforms() {
    const url = `${API_BASE}/home?host=moviebox.ph`;
    const raw = await makeRequest(url);
    const platforms = (raw.data && raw.data.platformList) || [];
    return jsonResponse({ status: 'success', count: platforms.length, platforms }, 200, 3600);
}

/* ============================================================
   ROUTE: CATEGORY
   ============================================================ */
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

    const raw = await makeRequest(url, { method: 'POST', payload });
    const inner = raw.data || {};
    const rawItems = inner.items || inner.subjects || [];

    const items = rawItems.map(normalizeSubject).filter(Boolean);

    const pager = inner.pager || {};
    const total = pager.totalCount || inner.total || items.length;

    return { page, per_page: perPage, total, items };
}

async function handleMovies(url) {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const sort = url.searchParams.get('sort') || 'RECOMMEND';
    const data = await getCategoryData(TAB_IDS.movies, page, 24, sort);
    return jsonResponse({ status: 'success', ...data }, 200, 120);
}

async function handleTvSeries(url) {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const sort = url.searchParams.get('sort') || 'RECOMMEND';
    const data = await getCategoryData(TAB_IDS.tvSeries, page, 24, sort);
    return jsonResponse({ status: 'success', ...data }, 200, 120);
}

async function handleAnimation(url) {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const sort = url.searchParams.get('sort') || 'RECOMMEND';
    const data = await getCategoryData(TAB_IDS.animation, page, 24, sort);
    return jsonResponse({ status: 'success', ...data }, 200, 120);
}

/* ============================================================
   ROUTE: SEARCH
   ============================================================ */
async function handleSearch(url) {
    const q = url.searchParams.get('q');
    if (!q || q.length < 1) {
        return errorResponse('Query parameter "q" is required', 400);
    }
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    const apiUrl = `${API_BASE}/subject/search`;
    const raw = await makeRequest(apiUrl, {
        method: 'POST',
        payload: { keyword: q, page, perPage: 20 },
    });

    const inner = raw.data || {};
    const rawItems = inner.items || inner.list || [];
    const items = rawItems.map(normalizeSubject).filter(Boolean);

    const pager = inner.pager || {};
    const total = pager.totalCount || inner.total || items.length;

    return jsonResponse({ status: 'success', query: q, page, total, items });
}

async function handleSearchSuggest(url) {
    const q = url.searchParams.get('q');
    if (!q || q.length < 1) {
        return errorResponse('Query parameter "q" is required', 400);
    }

    const apiUrl = `${API_BASE}/subject/search-suggest`;
    const raw = await makeRequest(apiUrl, {
        method: 'POST',
        payload: { keyword: q, perPage: 10 },
    });

    const inner = raw.data || {};
    const rawItems = inner.items || inner.list || [];

    const suggestions = rawItems.map((item) => {
        const sub = item.subject || {};
        return {
            title: sub.title || item.word || item.title || '',
            slug: sub.detailPath || item.detailPath || '',
            subject_id: sub.subjectId || item.subjectId || '',
            poster_url: (sub.cover && sub.cover.url) || '',
            year: sub.releaseDate ? String(sub.releaseDate).substring(0, 4) : '',
        };
    }).filter(s => s.title);

    return jsonResponse({ status: 'success', suggestions });
}

/* ============================================================
   ROUTE: DETAIL
   ============================================================ */
async function handleDetail(slug) {
    if (!slug) return errorResponse('Slug is required', 400);

    const url = `${API_BASE}/detail?detailPath=${encodeURIComponent(slug)}`;
    const raw = await makeRequest(url);
    const inner = raw.data || raw;

    const subject = inner.subject ? normalizeSubject(inner.subject) : null;

    let seasons = [];
    if (Array.isArray(inner.seasons)) {
        seasons = inner.seasons.map((season) => ({
            se: season.se || season.season || 1,
            title: season.title || `Season ${season.se || 1}`,
            episodes: Array.isArray(season.episodes)
                ? season.episodes.map((ep) => ({
                    ep: ep.ep || ep.episode || 1,
                    title: ep.title || `Episode ${ep.ep || 1}`,
                    duration: ep.duration || 0,
                    has_resource: ep.hasResource === true,
                }))
                : [],
        }));
    }

    return jsonResponse({
        status: 'success',
        subject,
        seasons,
        raw: inner,
    }, 200, 300);
}

/* ============================================================
   ROUTE: STREAM SOURCES
   ============================================================ */
async function handleStream(subjectId, url) {
    const detailPath = url.searchParams.get('detail_path');
    if (!detailPath) {
        return errorResponse('Missing required query param: detail_path', 400);
    }
    const se = parseInt(url.searchParams.get('se') || '1', 10);
    const ep = parseInt(url.searchParams.get('ep') || '1', 10);

    const domData = await makeRequest(`${API_BASE}/media-player/get-domain`);
    const domain = (domData.data || DEFAULT_PLAYER_DOMAIN).replace(/\/$/, '');

    const playerReferer =
        `${domain}/spa/videoPlayPage/movies/${detailPath}` +
        `?id=${subjectId}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`;

    const playUrl =
        `${domain}/wefeed-h5api-bff/subject/play` +
        `?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(detailPath)}`;

    const playResp = await fetch(playUrl, {
        method: 'GET',
        headers: { ...PLAYER_HEADERS, 'Referer': playerReferer },
    });

    if (!playResp.ok) {
        return errorResponse(`Player API error: ${playResp.status}`, 502);
    }

    const playJson = await playResp.json();
    const data = playJson.data || {};
    const hasResource = data.hasResource || false;

    const streams = (data.streams || []).map((s) => ({
        id: s.id,
        resolution: s.resolutions ? `${s.resolutions}p` : 'Auto',
        resolution_raw: s.resolutions,
        format: s.format,
        url: s.url,
        size: s.size,
        duration: s.duration,
        codec: s.codecName,
    }));

    return jsonResponse({
        status: 'success',
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

/* ============================================================
   ROUTE: CAPTIONS
   ============================================================ */
async function handleCaptions(subjectId, url) {
    const detailPath = url.searchParams.get('detail_path');
    if (!detailPath) {
        return errorResponse('Missing required query param: detail_path', 400);
    }
    const se = parseInt(url.searchParams.get('se') || '1', 10);
    const ep = parseInt(url.searchParams.get('ep') || '1', 10);

    const domData = await makeRequest(`${API_BASE}/media-player/get-domain`);
    const domain = (domData.data || DEFAULT_PLAYER_DOMAIN).replace(/\/$/, '');

    const playerReferer =
        `${domain}/spa/videoPlayPage/movies/${detailPath}` +
        `?id=${subjectId}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`;

    const playUrl =
        `${domain}/wefeed-h5api-bff/subject/play` +
        `?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(detailPath)}`;

    const playResp = await fetch(playUrl, {
        method: 'GET',
        headers: { ...PLAYER_HEADERS, 'Referer': playerReferer },
    });

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
            status: 'success',
            subject_id: subjectId, se, ep,
            count: 0,
            captions: [],
        });
    }

    const capUrl =
        `${API_BASE}/subject/caption` +
        `?format=${encodeURIComponent(streamFormat)}&id=${encodeURIComponent(streamId)}` +
        `&subjectId=${encodeURIComponent(subjectId)}&detailPath=${encodeURIComponent(detailPath)}`;

    const capData = await makeRequest(capUrl);
    const inner = capData.data || {};
    const captions = Array.isArray(inner) ? inner : (inner.captions || []);

    return jsonResponse({
        status: 'success',
        subject_id: subjectId, se, ep,
        count: captions.length,
        captions,
    });
}

/* ============================================================
   ROUTER
   ============================================================ */
async function handleRequest(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
        if (path === '/' || path === '') return handleDashboard();
        if (path === '/health') return handleHealth();

        if (path === '/home') return await handleHome();
        if (path === '/banners') return await handleBanners();
        if (path === '/platforms') return await handlePlatforms();

        if (path === '/movies') return await handleMovies(url);
        if (path === '/tv-series') return await handleTvSeries(url);
        if (path === '/animation') return await handleAnimation(url);

        if (path === '/search/suggest') return await handleSearchSuggest(url);
        if (path === '/search') return await handleSearch(url);

        const detailMatch = path.match(/^\/detail\/(.+)$/);
        if (detailMatch) return await handleDetail(decodeURIComponent(detailMatch[1]));

        const captionsMatch = path.match(/^\/api\/stream\/([^/]+)\/captions$/);
        if (captionsMatch) return await handleCaptions(captionsMatch[1], url);

        const streamMatch = path.match(/^\/api\/stream\/([^/]+)$/);
        if (streamMatch) return await handleStream(streamMatch[1], url);

        return errorResponse(`Route not found: ${path}`, 404);

    } catch (err) {
        console.error('[ERROR]', err.message, err.stack);
        return errorResponse(err.message || 'Internal server error', 502);
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request));
});
