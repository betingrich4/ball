/* ============================================================
   MOVIEBOX PRO — FRONTEND LOGIC (v2.2.0)
   ============================================================
   ⚠️  IMPORTANT: Update API_BASE_URL after deploying the Worker!
   ============================================================ */

const API_BASE_URL = 'https://ball.mariseltru.workers.dev/';

const AppState = {
    currentPage: 'home',
    currentPageNumber: 1,
    currentDetail: null,
    currentSources: null,
    currentSeason: 1,
    currentEpisode: 1,
    selectedQuality: null,
    banners: [],
    currentBannerIndex: 0,
    bannerTimer: null,
};

const DOM = {
    mainContent: document.getElementById('mainContent'),
    navLinks: document.getElementById('navLinks'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    searchResults: document.getElementById('searchResults'),
    detailModal: document.getElementById('detailModal'),
    modalBody: document.getElementById('modalBody'),
    toast: document.getElementById('toast'),
};

/* ============ UTILITIES ============ */
async function fetchData(endpoint) {
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { const e = await res.json(); msg = e.detail || msg; } catch (_) {}
            throw new Error(msg);
        }
        return await res.json();
    } catch (err) {
        console.error(`[API ERROR] ${endpoint}:`, err.message);
        return null;
    }
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeForAttr(str) {
    if (str == null) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const FALLBACK_POSTER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0NTAiIGZpbGw9IiMxMDEyMTgiLz48dGV4dCB4PSIxNTAiIHk9IjIyNSIgZmlsbD0iIzY2NyIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

const FALLBACK_BANNER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9IiMxMDEyMTgiLz48L3N2Zz4=';

function showToast(message, type = 'info') {
    if (!DOM.toast) return;
    DOM.toast.textContent = message;
    DOM.toast.className = `toast show ${type}`;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

function showLoader(text = 'Loading...') {
    DOM.mainContent.innerHTML = `
        <div class="loading-screen">
            <div class="loader"></div>
            <p class="loader-text">${escapeHtml(text)}</p>
        </div>`;
}

function getLoaderHTML(size = '') {
    return `<div class="loader ${size === 'sm' ? 'loader-sm' : ''}"></div>`;
}

function renderEmptyState(icon, title, text, retryAction = '') {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h2 class="empty-state-title">${escapeHtml(title)}</h2>
            <p class="empty-state-text">${escapeHtml(text)}</p>
            ${retryAction ? `<button class="retry-btn" onclick="${retryAction}">Try Again</button>` : ''}
        </div>`;
}

function setActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach((link) => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    AppState.currentPage = page;
}

function toggleMobileMenu() {
    if (DOM.navLinks) DOM.navLinks.classList.toggle('open');
}

/* ============ MOVIE CARD ============ */
function createMovieCard(item, index = 0) {
    const title = item.title || 'Untitled';
    const poster = item.poster_url || FALLBACK_POSTER;
    const slug = item.detail_path || '';
    const subjectId = String(item.subject_id || '');
    const year = item.year || '';
    const rating = item.rating || '';
    const badge = item.corner || '';
    const duration = item.duration_text || '';

    if (!slug || !subjectId) return '';

    const delay = Math.min(index * 0.03, 0.5);
    const safeSlug = escapeForAttr(slug);
    const safeId = escapeForAttr(subjectId);

    return `
        <div class="movie-card" style="animation-delay:${delay}s;" tabindex="0"
             onclick="showDetails('${safeId}','${safeSlug}')"
             onkeypress="if(event.key==='Enter')showDetails('${safeId}','${safeSlug}')">
            <div class="movie-card-poster">
                <img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" loading="lazy"
                     onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                ${badge ? `<span class="movie-badge">${escapeHtml(badge)}</span>` : ''}
                ${rating ? `<span class="movie-rating">⭐ ${escapeHtml(rating)}</span>` : ''}
                <div class="movie-play-overlay"><div class="play-icon-circle">▶</div></div>
            </div>
            <div class="movie-card-info">
                <h3 class="movie-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
                <div class="movie-card-meta">
                    ${year ? `<span>${escapeHtml(year)}</span>` : ''}
                    ${duration ? `<span>• ${escapeHtml(duration)}</span>` : ''}
                </div>
            </div>
        </div>`;
}

function createMovieGrid(items) {
    if (!items || items.length === 0) {
        return renderEmptyState('📭', 'No Content', 'No items to display.');
    }
    return `<div class="movie-grid">${items.map((i, idx) => createMovieCard(i, idx)).join('')}</div>`;
}

/* ============ BANNER CAROUSEL ============ */
function createBannerCarousel(banners) {
    if (!banners || banners.length === 0) return '';

    const slides = banners.map((b, i) => {
        const title = b.title || '';
        const description = (b.description || '').substring(0, 200);
        const bg = b.banner_image_url || b.poster_url || FALLBACK_BANNER;
        const trailer = b.trailer_url || '';
        const year = b.year || '';
        const rating = b.rating || '';
        const genres = (b.genres || []).slice(0, 3);
        const safeSlug = escapeForAttr(b.detail_path || '');
        const safeId = escapeForAttr(String(b.subject_id || ''));

        return `
            <div class="banner-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
                <div class="banner-bg" style="background-image:url('${escapeHtml(bg)}');"></div>
                <div class="banner-gradient"></div>
                <div class="banner-content">
                    <div class="banner-text">
                        <h1 class="banner-title">${escapeHtml(title)}</h1>
                        <div class="banner-meta">
                            ${year ? `<span>${escapeHtml(year)}</span>` : ''}
                            ${rating ? `<span class="banner-rating">⭐ ${escapeHtml(rating)}</span>` : ''}
                            ${genres.length ? `<span>${genres.map(escapeHtml).join(' • ')}</span>` : ''}
                        </div>
                        ${description ? `<p class="banner-desc">${escapeHtml(description)}</p>` : ''}
                        <div class="banner-actions">
                            <button class="banner-btn primary"
                                    onclick="showDetails('${safeId}','${safeSlug}')">
                                ▶ Watch Now
                            </button>
                            ${trailer ? `<button class="banner-btn secondary"
                                        onclick="showTrailer('${escapeForAttr(trailer)}','${escapeHtml(title)}')">
                                🎬 Trailer
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    const dots = banners.map((_, i) =>
        `<span class="banner-dot ${i === 0 ? 'active' : ''}" onclick="goToBanner(${i})"></span>`
    ).join('');

    return `
        <div class="banner-carousel" id="bannerCarousel">
            <div class="banner-slides">${slides}</div>
            <div class="banner-dots">${dots}</div>
        </div>`;
}

function goToBanner(index) {
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.banner-dot');
    if (!slides.length) return;

    slides.forEach((s) => s.classList.remove('active'));
    dots.forEach((d) => d.classList.remove('active'));

    slides[index]?.classList.add('active');
    dots[index]?.classList.add('active');

    AppState.currentBannerIndex = index;
}

function startBannerAutoRotate() {
    clearInterval(AppState.bannerTimer);
    if (AppState.banners.length <= 1) return;

    AppState.bannerTimer = setInterval(() => {
        const next = (AppState.currentBannerIndex + 1) % AppState.banners.length;
        goToBanner(next);
    }, 7000);
}

/* ============ PLATFORM STRIP ============ */
function createPlatformStrip(platforms) {
    if (!platforms || platforms.length === 0) return '';
    return `
        <div class="platform-strip">
            <div class="platform-label">Streaming Platforms</div>
            <div class="platform-list">
                ${platforms.map((p) => `
                    <span class="platform-chip">
                        <strong>${escapeHtml(p.name)}</strong>
                        <small>by ${escapeHtml(p.uploadBy || 'Staff')}</small>
                    </span>
                `).join('')}
            </div>
        </div>`;
}

/* ============ HOME PAGE ============ */
async function loadHomePage(event) {
    if (event) event.preventDefault();
    setActiveNav('home');
    showLoader('Loading MovieBox...');

    const data = await fetchData('/home');
    if (!data) {
        DOM.mainContent.innerHTML = renderEmptyState(
            '⚠️', 'Could Not Load Home',
            `Make sure the Worker is deployed at ${API_BASE_URL}`,
            'loadHomePage()'
        );
        return;
    }

    AppState.banners = data.banners || [];
    AppState.currentBannerIndex = 0;

    let html = '';

    if (AppState.banners.length > 0) {
        html += createBannerCarousel(AppState.banners);
    }

    if (data.platforms && data.platforms.length > 0) {
        html += createPlatformStrip(data.platforms);
    }

    (data.sections || []).forEach((section, idx) => {
        if (!section.items || section.items.length === 0) return;
        html += `
            <section class="section" style="animation-delay:${idx * 0.08}s">
                <div class="section-header">
                    <h2 class="section-title">${escapeHtml(section.section)}</h2>
                    <span class="section-count">${section.count} items</span>
                </div>
                ${createMovieGrid(section.items)}
            </section>`;
    });

    DOM.mainContent.innerHTML = html || renderEmptyState('📭', 'No Content', 'The API returned no sections.');

    startBannerAutoRotate();
}

/* ============ CATEGORY PAGES ============ */
function createCategoryPage(title, subtitle) {
    return `
        <div class="page-header">
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="page-subtitle">${escapeHtml(subtitle)}</p>
        </div>`;
}

function createPagination(currentPage, total, perPage, onPageChange) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (totalPages <= 1) return '';

    let btns = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">← Prev</button>`;

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        btns += `<button class="page-btn" onclick="${onPageChange}(1)">1</button>`;
        if (start > 2) btns += `<span class="page-info">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        btns += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) btns += `<span class="page-info">...</span>`;
        btns += `<button class="page-btn" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
    }
    btns += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">Next →</button>`;

    return `<div class="pagination">${btns}</div>`;
}

async function loadMoviesPage(event, page = 1) {
    if (event) event.preventDefault();
    setActiveNav('movies');
    AppState.currentPageNumber = page;
    showLoader('Loading Movies...');

    const data = await fetchData(`/movies?page=${page}`);
    if (!data || !data.items) {
        DOM.mainContent.innerHTML = renderEmptyState('⚠️', 'Failed', 'Could not load movies.', 'loadMoviesPage(null,1)');
        return;
    }

    DOM.mainContent.innerHTML = `
        ${createCategoryPage('🎬 Movies', `${data.total.toLocaleString()} movies available`)}
        ${createMovieGrid(data.items)}
        ${createPagination(data.page, data.total, data.per_page, 'loadMoviesPage')}
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadTvPage(event, page = 1) {
    if (event) event.preventDefault();
    setActiveNav('tv');
    AppState.currentPageNumber = page;
    showLoader('Loading TV Series...');

    const data = await fetchData(`/tv-series?page=${page}`);
    if (!data || !data.items) {
        DOM.mainContent.innerHTML = renderEmptyState('⚠️', 'Failed', 'Could not load TV series.', 'loadTvPage(null,1)');
        return;
    }

    DOM.mainContent.innerHTML = `
        ${createCategoryPage('📺 TV Series', `${data.total.toLocaleString()} series available`)}
        ${createMovieGrid(data.items)}
        ${createPagination(data.page, data.total, data.per_page, 'loadTvPage')}
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadAnimationPage(event, page = 1) {
    if (event) event.preventDefault();
    setActiveNav('animation');
    AppState.currentPageNumber = page;
    showLoader('Loading Animation...');

    const data = await fetchData(`/animation?page=${page}`);
    if (!data || !data.items) {
        DOM.mainContent.innerHTML = renderEmptyState('⚠️', 'Failed', 'Could not load animation.', 'loadAnimationPage(null,1)');
        return;
    }

    DOM.mainContent.innerHTML = `
        ${createCategoryPage('🎨 Animation', `${data.total.toLocaleString()} titles available`)}
        ${createMovieGrid(data.items)}
        ${createPagination(data.page, data.total, data.per_page, 'loadAnimationPage')}
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============ SEARCH ============ */
function initSearch() {
    let timer = null;

    DOM.searchInput.addEventListener('input', () => {
        const query = DOM.searchInput.value.trim();
        DOM.searchClear.style.display = query ? 'flex' : 'none';
        clearTimeout(timer);

        if (query.length < 2) {
            DOM.searchResults.classList.remove('active');
            return;
        }

        DOM.searchResults.innerHTML = `<div class="search-loading">${getLoaderHTML('sm')}</div>`;
        DOM.searchResults.classList.add('active');

        timer = setTimeout(async () => {
            const data = await fetchData(`/search?q=${encodeURIComponent(query)}`);
            if (!data || !data.items) {
                DOM.searchResults.innerHTML = `<div class="search-no-results">Search failed.</div>`;
                return;
            }
            if (data.items.length === 0) {
                DOM.searchResults.innerHTML = `<div class="search-no-results">No results for "${escapeHtml(query)}"</div>`;
                return;
            }
            DOM.searchResults.innerHTML = data.items.slice(0, 12).map((item) => {
                const safeSlug = escapeForAttr(item.detail_path || '');
                const safeId = escapeForAttr(String(item.subject_id || ''));
                const poster = item.poster_url || FALLBACK_POSTER;
                return `
                    <div class="search-result-item" onclick="showDetails('${safeId}','${safeSlug}')">
                        <img class="search-result-poster" src="${escapeHtml(poster)}" alt=""
                             onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                        <div class="search-result-info">
                            <div class="search-result-title">${escapeHtml(item.title || 'Untitled')}</div>
                            <div class="search-result-meta">
                                ${item.year ? escapeHtml(item.year) + ' • ' : ''}
                                ${item.rating ? '⭐ ' + escapeHtml(item.rating) : 'Click to view'}
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!DOM.searchResults.contains(e.target) && e.target !== DOM.searchInput) {
            DOM.searchResults.classList.remove('active');
        }
    });

    DOM.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            DOM.searchResults.classList.remove('active');
            DOM.searchInput.blur();
        }
    });
}

function clearSearch() {
    DOM.searchInput.value = '';
    DOM.searchClear.style.display = 'none';
    DOM.searchResults.classList.remove('active');
    DOM.searchInput.focus();
}

/* ============ TRAILER ============ */
function showTrailer(url, title) {
    DOM.modalBody.innerHTML = `
        <div class="player-wrapper">
            <video id="trailerPlayer" controls autoplay playsinline></video>
            <div style="padding:1.5rem;">
                <h2 style="font-weight:700;font-size:1.3rem;margin-bottom:.5rem;">${escapeHtml(title)} — Trailer</h2>
                <p style="color:var(--text-dim);font-size:.9rem;">Preview only. Click Watch Now for the full experience.</p>
            </div>
        </div>`;
    DOM.detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const v = document.getElementById('trailerPlayer');
    if (v) v.src = url;
}

/* ============ DETAIL MODAL ============ */
async function showDetails(subjectId, detailPath) {
    DOM.searchResults.classList.remove('active');

    DOM.modalBody.innerHTML = `
        <div class="loading-screen" style="min-height:400px;">
            <div class="loader"></div>
            <p class="loader-text">Loading details...</p>
        </div>`;
    DOM.detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    AppState.currentDetail = { subjectId, detailPath };
    AppState.currentSeason = 1;
    AppState.currentEpisode = 1;

    const data = await fetchData(`/detail/${encodeURIComponent(detailPath)}`);
    if (!data || !data.subject) {
        DOM.modalBody.innerHTML = `<div style="padding:4rem 2rem;">${renderEmptyState('⚠️', 'Failed', 'Could not fetch details.', 'closeModal()')}</div>`;
        return;
    }

    renderDetailView(data, subjectId, detailPath);
}

function closeModal() {
    clearInterval(AppState.bannerTimer);
    DOM.detailModal.classList.remove('active');
    document.body.style.overflow = '';

    const v = DOM.modalBody.querySelector('video');
    if (v) { v.pause(); v.src = ''; v.load(); }

    setTimeout(() => {
        DOM.modalBody.innerHTML = '';
        AppState.currentDetail = null;
        AppState.currentSources = null;
    }, 300);
}

function renderDetailView(data, subjectId, detailPath) {
    const s = data.subject;
    const seasons = data.seasons || [];
    const isSeries = s.subject_type === 2;

    const metaPills = [
        s.year ? `<span class="meta-pill">${escapeHtml(s.year)}</span>` : '',
        s.rating ? `<span class="meta-pill rating">⭐ ${escapeHtml(s.rating)}</span>` : '',
        s.duration_text ? `<span class="meta-pill">⏱ ${escapeHtml(s.duration_text)}</span>` : '',
        s.country ? `<span class="meta-pill">🌍 ${escapeHtml(s.country)}</span>` : '',
        isSeries ? `<span class="meta-pill">📺 Series</span>` : `<span class="meta-pill">🎬 Movie</span>`,
    ].filter(Boolean).join('');

    const genres = (s.genres || []).map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('');
    const poster = s.poster_url || FALLBACK_POSTER;
    const trailerBtn = s.trailer_url
        ? `<button class="banner-btn secondary" style="margin-top:1rem;"
               onclick="showTrailer('${escapeForAttr(s.trailer_url)}','${escapeForAttr(s.title)}')">
               🎬 Watch Trailer
           </button>`
        : '';

    DOM.modalBody.innerHTML = `
        <div class="player-wrapper" id="playerWrapper">
            <video id="videoPlayer" controls playsinline></video>
            <div class="player-loading" id="playerLoading">
                <div class="loader"></div>
                <p class="loader-text">Loading stream...</p>
            </div>
        </div>

        <div class="detail-body">
            <div class="detail-header">
                <img class="detail-poster" src="${escapeHtml(poster)}" alt="${escapeHtml(s.title)}"
                     onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                <div class="detail-info">
                    <h1 class="detail-title">${escapeHtml(s.title)}</h1>
                    <div class="detail-meta">${metaPills}</div>
                    ${s.description ? `<p class="detail-description">${escapeHtml(s.description)}</p>` : ''}
                    ${genres ? `<div class="detail-genres">${genres}</div>` : ''}
                    ${trailerBtn}
                </div>
            </div>
        </div>

        <div class="player-controls">
            ${isSeries ? `
                <div class="control-row">
                    <span class="control-label">Season:</span>
                    <select class="control-select" id="seasonSelect" onchange="onSeasonChange(this.value)"></select>
                </div>
                <div class="control-row">
                    <span class="control-label">Episodes:</span>
                    <div class="episode-list" id="episodeList"></div>
                </div>
            ` : ''}
            <div class="control-row" id="qualityRow" style="display:none;">
                <span class="control-label">Quality:</span>
                <div class="quality-list" id="qualityList"></div>
            </div>
            <div class="captions-section" id="captionsSection" style="display:none;">
                <div class="captions-title">Subtitles / Captions</div>
                <div class="captions-list" id="captionsList"></div>
            </div>
        </div>
    `;

    if (isSeries && seasons.length > 0) {
        initSeriesPlayer(seasons);
    } else {
        loadStream(subjectId, detailPath, 1, 1);
    }
}

function initSeriesPlayer(seasons) {
    const sel = document.getElementById('seasonSelect');
    sel.innerHTML = seasons.map((s) =>
        `<option value="${s.se}">Season ${s.se}</option>`
    ).join('');
    AppState.currentSeason = seasons[0].se;
    renderEpisodes(seasons[0]);

    if (seasons[0].episodes && seasons[0].episodes.length > 0) {
        const firstEp = seasons[0].episodes[0].ep;
        setTimeout(() => playEpisode(seasons[0].se, firstEp), 50);
    } else {
        setTimeout(() => loadStream(
            AppState.currentDetail.subjectId,
            AppState.currentDetail.detailPath,
            seasons[0].se, 1
        ), 50);
    }
}

function renderEpisodes(seasonData) {
    const list = document.getElementById('episodeList');
    const eps = seasonData.episodes || [];

    if (eps.length === 0) {
        list.innerHTML = Array.from({ length: 12 }, (_, i) => {
            const n = i + 1;
            return `<button class="episode-btn ${n === 1 ? 'active' : ''}" onclick="playEpisode(${seasonData.se},${n})">${n}</button>`;
        }).join('');
    } else {
        list.innerHTML = eps.map((ep) =>
            `<button class="episode-btn ${ep.ep === 1 ? 'active' : ''}" onclick="playEpisode(${seasonData.se},${ep.ep})">${ep.ep}</button>`
        ).join('');
    }
}

async function onSeasonChange(season) {
    AppState.currentSeason = parseInt(season, 10);
    AppState.currentEpisode = 1;

    const { detailPath } = AppState.currentDetail;
    const data = await fetchData(`/detail/${encodeURIComponent(detailPath)}`);
    if (data && data.seasons) {
        const seasonData = data.seasons.find((s) => s.se === AppState.currentSeason);
        if (seasonData) renderEpisodes(seasonData);
    }
    playEpisode(AppState.currentSeason, 1);
}

async function playEpisode(season, episode) {
    AppState.currentSeason = season;
    AppState.currentEpisode = episode;

    document.querySelectorAll('.episode-btn').forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.textContent.trim(), 10) === episode);
    });

    const { subjectId, detailPath } = AppState.currentDetail;
    await loadStream(subjectId, detailPath, season, episode);
}

async function loadStream(subjectId, detailPath, season, episode) {
    const video = document.getElementById('videoPlayer');
    const playerLoading = document.getElementById('playerLoading');
    const qualityRow = document.getElementById('qualityRow');
    const qualityList = document.getElementById('qualityList');

    if (!video) return;

    video.pause();
    video.removeAttribute('src');
    video.load();
    if (playerLoading) playerLoading.style.display = 'flex';
    if (qualityRow) qualityRow.style.display = 'none';

    const endpoint = `/api/stream/${encodeURIComponent(subjectId)}?detail_path=${encodeURIComponent(detailPath)}&se=${season}&ep=${episode}`;
    const data = await fetchData(endpoint);

    if (playerLoading) playerLoading.style.display = 'none';

    if (!data || !data.has_resource || !data.sources || data.sources.length === 0) {
        showPlayerError(data && data.note ? data.note : 'No stream available for this episode yet.');
        return;
    }

    AppState.currentSources = data.sources;

    if (qualityList) {
        qualityList.innerHTML = data.sources.map((source, idx) =>
            `<button class="quality-btn ${idx === 0 ? 'active' : ''}" onclick="selectQuality(${idx})">
                ${escapeHtml(source.resolution || 'Auto')} ${escapeHtml(source.format || 'MP4')}
            </button>`
        ).join('');
        qualityRow.style.display = 'flex';
    }

    selectQuality(0);
    loadCaptions(subjectId, detailPath, season, episode);
}

function selectQuality(index) {
    const sources = AppState.currentSources;
    if (!sources || !sources[index]) return;

    const source = sources[index];
    const video = document.getElementById('videoPlayer');
    AppState.selectedQuality = index;

    document.querySelectorAll('.quality-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    if (video && source.url) {
        const wasPlaying = !video.paused;
        video.src = source.url;
        video.load();
        if (wasPlaying) video.play().catch(() => {});
    }
}

function showPlayerError(message) {
    const wrapper = document.getElementById('playerWrapper');
    if (!wrapper) return;
    const old = wrapper.querySelector('.player-error');
    if (old) old.remove();

    const err = document.createElement('div');
    err.className = 'player-error';
    err.innerHTML = `<div class="player-error-icon">📡</div><p>${escapeHtml(message)}</p>`;
    wrapper.appendChild(err);
}

async function loadCaptions(subjectId, detailPath, season, episode) {
    const section = document.getElementById('captionsSection');
    const list = document.getElementById('captionsList');
    if (!section || !list) return;

    const endpoint = `/api/stream/${encodeURIComponent(subjectId)}/captions?detail_path=${encodeURIComponent(detailPath)}&se=${season}&ep=${episode}`;
    const data = await fetchData(endpoint);

    if (!data || !data.captions || data.captions.length === 0) {
        section.style.display = 'none';
        return;
    }

    list.innerHTML = data.captions.map((cap) => {
        const lang = cap.lanName || cap.lan || cap.language || 'Unknown';
        const url = cap.url || '';
        if (!url) return '';
        return `<button class="caption-btn" onclick="addSubtitleTrack('${escapeForAttr(url)}','${escapeForAttr(lang)}')">${escapeHtml(lang)}</button>`;
    }).filter(Boolean).join('');

    section.style.display = list.innerHTML ? 'block' : 'none';
}

function addSubtitleTrack(url, lang) {
    const video = document.getElementById('videoPlayer');
    if (!video) return;
    video.querySelectorAll('track').forEach((t) => t.remove());

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = lang;
    track.srclang = lang.toLowerCase().substring(0, 2);
    track.src = url;
    track.default = true;
    video.appendChild(track);

    setTimeout(() => {
        if (video.textTracks.length > 0) video.textTracks[0].mode = 'showing';
    }, 100);
    showToast(`Subtitles: ${lang}`, 'success');
}

/* ============ BOOT ============ */
function initApp() {
    initSearch();
    loadHomePage();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.detailModal.classList.contains('active')) closeModal();
    });

    DOM.detailModal.addEventListener('click', (e) => {
        if (e.target === DOM.detailModal) closeModal();
    });

    console.log('%c🎬 MovieBox Pro v2.2', 'color:#ff3d71;font-size:18px;font-weight:bold;');
    console.log(`%cAPI: ${API_BASE_URL}`, 'color:#00f2ff;');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

/* ============ GLOBAL EXPORTS ============ */
window.loadHomePage = loadHomePage;
window.loadMoviesPage = loadMoviesPage;
window.loadTvPage = loadTvPage;
window.loadAnimationPage = loadAnimationPage;
window.showDetails = showDetails;
window.closeModal = closeModal;
window.clearSearch = clearSearch;
window.toggleMobileMenu = toggleMobileMenu;
window.onSeasonChange = onSeasonChange;
window.playEpisode = playEpisode;
window.selectQuality = selectQuality;
window.addSubtitleTrack = addSubtitleTrack;
window.showTrailer = showTrailer;
window.goToBanner = goToBanner;
