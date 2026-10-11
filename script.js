/* ============================================================
   MOVIEBOX PRO - APPLICATION LOGIC
   Author: Walter
   Description: All API integrations and UI interactions
   ============================================================ */

/* ============ CONFIGURATION ============ */
const API_BASE_URL = 'http://localhost:8000';

/* ============ APPLICATION STATE ============ */
const AppState = {
    currentPage: 'home',
    currentPageNumber: 1,
    currentSort: 'RECOMMEND',
    currentDetail: null,
    currentSources: null,
    currentSeason: 1,
    currentEpisode: 1,
    selectedQuality: null,
    searchAbortController: null,
};

/* ============ DOM REFERENCES ============ */
const DOM = {
    mainContent: document.getElementById('mainContent'),
    mainHeader: document.getElementById('mainHeader'),
    navLinks: document.getElementById('navLinks'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    searchResults: document.getElementById('searchResults'),
    detailModal: document.getElementById('detailModal'),
    modalBody: document.getElementById('modalBody'),
    modalContent: document.getElementById('modalContent'),
    toast: document.getElementById('toast'),
};

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/**
 * Fetch JSON data from the API with error handling.
 * @param {string} endpoint - API endpoint path (e.g., '/home')
 * @param {object} options - Fetch options
 * @returns {Promise<object|null>}
 */
async function fetchData(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: { 'Accept': 'application/json' },
            ...options,
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (_) { /* ignore JSON parse errors */ }
            throw new Error(errorMessage);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`[API ERROR] ${endpoint}:`, error.message);
        return null;
    }
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escape single quotes for inline onclick handlers.
 * @param {string} str
 * @returns {string}
 */
function escapeForAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Create a URL-safe placeholder for missing images.
 */
const FALLBACK_POSTER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0NTAiIGZpbGw9IiMxMDEyMTgiLz48dGV4dCB4PSIxNTAiIHk9IjIyNSIgZmlsbD0iIzY2NyIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

/**
 * Display a toast notification.
 * @param {string} message
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(message, type = 'info') {
    DOM.toast.textContent = message;
    DOM.toast.className = `toast show ${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 3000);
}

/**
 * Show a loading spinner inside the main content area.
 */
function showLoader() {
    DOM.mainContent.innerHTML = `
        <div class="loading-screen">
            <div class="loader"></div>
            <p class="loader-text">Loading...</p>
        </div>
    `;
}

/**
 * Show a loading spinner inline.
 * @param {number} size - 'sm' for small
 */
function getLoaderHTML(size = '') {
    return `<div class="loader ${size === 'sm' ? 'loader-sm' : ''}"></div>`;
}

/**
 * Render a "no results" or error state.
 * @param {string} icon
 * @param {string} title
 * @param {string} text
 * @param {string} retryAction - JS function name to call on retry
 */
function renderEmptyState(icon, title, text, retryAction = '') {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h2 class="empty-state-title">${escapeHtml(title)}</h2>
            <p class="empty-state-text">${escapeHtml(text)}</p>
            ${retryAction ? `<button class="retry-btn" onclick="${retryAction}">Try Again</button>` : ''}
        </div>
    `;
}

/**
 * Update the active navigation link.
 * @param {string} page
 */
function setActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    AppState.currentPage = page;
    AppState.currentPageNumber = 1;
}

/**
 * Toggle the mobile navigation menu.
 */
function toggleMobileMenu() {
    DOM.navLinks.classList.toggle('open');
}

/* ============================================================
   MOVIE CARD RENDERING
   ============================================================ */

/**
 * Build HTML for a single movie card.
 * @param {object} item - Movie item from API
 * @param {number} index - For staggered animation
 * @returns {string}
 */
function createMovieCard(item, index = 0) {
    const title = item.name || item.title || 'Untitled';
    const poster = item.poster_url || FALLBACK_POSTER;
    const slug = item.slug || item.detailPath || '';
    const subjectId = item.subject_id || item.subjectId || '';
    const year = item.year || (item.releaseDate ? String(item.releaseDate).substring(0, 4) : '');
    const rating = item.rating || item.imdbRatingValue || '';
    const badge = item.badge || item.corner || '';
    
    if (!slug || !subjectId) return ''; // Skip invalid entries
    
    const safeSlug = escapeForAttr(slug);
    const safeId = escapeForAttr(String(subjectId));
    const animationDelay = Math.min(index * 0.03, 0.5);
    
    return `
        <div class="movie-card"
             style="animation-delay: ${animationDelay}s;"
             tabindex="0"
             onclick="showDetails('${safeId}', '${safeSlug}')"
             onkeypress="if(event.key==='Enter') showDetails('${safeId}', '${safeSlug}')">
            <div class="movie-card-poster">
                <img src="${escapeHtml(poster)}" 
                     alt="${escapeHtml(title)}" 
                     loading="lazy"
                     onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                ${badge ? `<span class="movie-badge">${escapeHtml(badge)}</span>` : ''}
                ${rating ? `<span class="movie-rating">⭐ ${escapeHtml(rating)}</span>` : ''}
                <div class="movie-play-overlay">
                    <div class="play-icon-circle">▶</div>
                </div>
            </div>
            <div class="movie-card-info">
                <h3 class="movie-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
                <div class="movie-card-meta">
                    ${year ? `<span>${escapeHtml(year)}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Build HTML for a row of movie cards.
 * @param {Array} items
 * @returns {string}
 */
function createMovieGrid(items) {
    if (!items || items.length === 0) {
        return renderEmptyState('📭', 'No Content', 'No items to display in this section.');
    }
    return `<div class="movie-grid">${items.map((item, i) => createMovieCard(item, i)).join('')}</div>`;
}

/* ============================================================
   HOME PAGE
   ============================================================ */

/**
 * Load the home page with all featured sections.
 * Calls: GET /home
 */
async function loadHomePage(event) {
    if (event) event.preventDefault();
    setActiveNav('home');
    showLoader();
    
    const data = await fetchData('/home');
    
    if (!data || !data.sections) {
        DOM.mainContent.innerHTML = renderEmptyState(
            '⚠️',
            'Could Not Load Home',
            `Make sure the backend API is running at ${API_BASE_URL}`,
            'loadHomePage()'
        );
        return;
    }
    
    let html = '';
    const seenSections = new Set();
    
    data.sections.forEach(section => {
        const sectionName = section.section || 'Featured';
        if (seenSections.has(sectionName)) return;
        if (!section.items || section.items.length === 0) return;
        seenSections.add(sectionName);
        
        html += `
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">${escapeHtml(sectionName)}</h2>
                    <span class="section-count">${section.count || section.items.length} items</span>
                </div>
                ${createMovieGrid(section.items)}
            </section>
        `;
    });
    
    if (!html) {
        html = renderEmptyState('📭', 'No Sections', 'The API returned no content sections.');
    }
    
    DOM.mainContent.innerHTML = html;
}

/* ============================================================
   CATEGORY PAGES (Movies / TV / Animation)
   ============================================================ */

/**
 * Build a category page with pagination.
 * @param {string} title
 * @param {string} subtitle
 * @param {Function} loadFn - Page loader function reference
 */
function createCategoryPage(title, subtitle, loadFn) {
    return `
        <div class="page-header">
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="page-subtitle">${escapeHtml(subtitle)}</p>
        </div>
    `;
}

/**
 * Build pagination controls.
 * @param {number} currentPage
 * @param {number} total
 * @param {number} perPage
 * @param {Function} onPageChange - Function name to call with page number
 */
function createPagination(currentPage, total, perPage, onPageChange) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (totalPages <= 1) return '';
    
    let buttons = '';
    
    // Previous
    buttons += `
        <button class="page-btn" 
                ${currentPage <= 1 ? 'disabled' : ''}
                onclick="${onPageChange}(${currentPage - 1})">
            ← Prev
        </button>
    `;
    
    // Page numbers (show up to 5 around current)
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    if (start > 1) {
        buttons += `<button class="page-btn" onclick="${onPageChange}(1)">1</button>`;
        if (start > 2) buttons += `<span class="page-info">...</span>`;
    }
    
    for (let i = start; i <= end; i++) {
        buttons += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}"
                    onclick="${onPageChange}(${i})">
                ${i}
            </button>
        `;
    }
    
    if (end < totalPages) {
        if (end < totalPages - 1) buttons += `<span class="page-info">...</span>`;
        buttons += `<button class="page-btn" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
    }
    
    // Next
    buttons += `
        <button class="page-btn"
                ${currentPage >= totalPages ? 'disabled' : ''}
                onclick="${onPageChange}(${currentPage + 1})">
            Next →
        </button>
    `;
    
    return `<div class="pagination">${buttons}</div>`;
}

/**
 * Load Movies page.
 * Calls: GET /movies?page=N
 */
async function loadMoviesPage(event, page = 1) {
    if (event) event.preventDefault();
    setActiveNav('movies');
    AppState.currentPageNumber = page;
    showLoader();
    
    const data = await fetchData(`/movies?page=${page}`);
    
    if (!data || !data.items) {
        DOM.mainContent.innerHTML = renderEmptyState('⚠️', 'Failed to Load Movies', 'Could not fetch movies.', 'loadMoviesPage(null, 1)');
        return;
    }
    
    const html = `
        ${createCategoryPage('🎬 Movies', `Browse ${data.total || 0} movies across all genres`)}
        ${createMovieGrid(data.items)}
        ${createPagination(data.page, data.total, data.per_page, 'loadMoviesPage')}
    `;
    
    DOM.mainContent.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Load TV Series page.
 * Calls: GET /tv-series?page=N
 */
async function loadTvPage(event, page = 1) {
    if (event) event.preventDefault();
    setActiveNav('tv');
    AppState.currentPageNumber = page;
    showLoader();
    
    const data = await fetchData(`/tv-series?page=${page}`);
    
    if (!data || !data.items) {
        DOM.mainContent.innerHTML = renderEmptyState('⚠️', 'Failed to Load TV Series', 'Could not fetch TV series.', 'loadTvPage(null, 1)');
        return;
    }
    
    const html = `
        ${createCategoryPage('📺 TV Series', `Browse ${data.total || 0} TV series`)}
        ${createMovieGrid(data.items)}
        ${createPagination(data.page, data.total, data.per_page, 'loadTvPage')}
    `;
    
    DOM.mainContent.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Load Animation page.
 * Calls: GET /animation?page=N
 */
async function loadAnimationPage(event, page = 1) {
    if (event) event.preventDefault();
    setActiveNav('animation');
    AppState.currentPageNumber = page;
    showLoader();
    
    const data = await fetchData(`/animation?page=${page}`);
    
    if (!data || !data.items) {
        DOM.mainContent.innerHTML = renderEmptyState('⚠️', 'Failed to Load Animation', 'Could not fetch animation.', 'loadAnimationPage(null, 1)');
        return;
    }
    
    const html = `
        ${createCategoryPage('🎨 Animation', `Browse ${data.total || 0} animated titles`)}
        ${createMovieGrid(data.items)}
        ${createPagination(data.page, data.total, data.per_page, 'loadAnimationPage')}
    `;
    
    DOM.mainContent.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   SEARCH FUNCTIONALITY
   ============================================================ */

/**
 * Initialize search with debounce.
 * Calls: GET /search?q=...
 */
function initSearch() {
    let debounceTimer = null;
    
    DOM.searchInput.addEventListener('input', () => {
        const query = DOM.searchInput.value.trim();
        DOM.searchClear.style.display = query ? 'flex' : 'none';
        
        clearTimeout(debounceTimer);
        
        if (query.length < 2) {
            DOM.searchResults.classList.remove('active');
            return;
        }
        
        // Show loading state
        DOM.searchResults.innerHTML = `<div class="search-loading">${getLoaderHTML('sm')}</div>`;
        DOM.searchResults.classList.add('active');
        
        debounceTimer = setTimeout(async () => {
            // Cancel previous in-flight request
            if (AppState.searchAbortController) {
                AppState.searchAbortController.abort();
            }
            AppState.searchAbortController = new AbortController();
            
            const data = await fetchData(`/search?q=${encodeURIComponent(query)}`);
            
            if (!data || !data.items) {
                DOM.searchResults.innerHTML = `<div class="search-no-results">Search failed. Try again.</div>`;
                return;
            }
            
            if (data.items.length === 0) {
                DOM.searchResults.innerHTML = `<div class="search-no-results">No results for "${escapeHtml(query)}"</div>`;
                return;
            }
            
            DOM.searchResults.innerHTML = data.items.slice(0, 12).map(item => {
                const safeSlug = escapeForAttr(item.slug || '');
                const safeId = escapeForAttr(String(item.subject_id || ''));
                const poster = item.poster_url || FALLBACK_POSTER;
                return `
                    <div class="search-result-item" onclick="showDetails('${safeId}', '${safeSlug}')">
                        <img class="search-result-poster" 
                             src="${escapeHtml(poster)}" 
                             alt="${escapeHtml(item.name || '')}"
                             onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                        <div class="search-result-info">
                            <div class="search-result-title">${escapeHtml(item.name || 'Untitled')}</div>
                            <div class="search-result-meta">Click to view details</div>
                        </div>
                    </div>
                `;
            }).join('');
        }, 300);
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!DOM.searchResults.contains(e.target) && e.target !== DOM.searchInput) {
            DOM.searchResults.classList.remove('active');
        }
    });
    
    // Close on Escape
    DOM.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            DOM.searchResults.classList.remove('active');
            DOM.searchInput.blur();
        }
    });
}

/**
 * Clear the search input and results.
 */
function clearSearch() {
    DOM.searchInput.value = '';
    DOM.searchClear.style.display = 'none';
    DOM.searchResults.classList.remove('active');
    DOM.searchInput.focus();
}

/* ============================================================
   DETAIL MODAL
   ============================================================ */

/**
 * Open the detail modal for a movie/series.
 * Calls: GET /detail/{slug}
 * @param {string} subjectId
 * @param {string} detailPath
 */
async function showDetails(subjectId, detailPath) {
    // Close search dropdown
    DOM.searchResults.classList.remove('active');
    
    // Show modal with loader
    DOM.modalBody.innerHTML = `
        <div class="loading-screen" style="min-height: 400px;">
            <div class="loader"></div>
            <p class="loader-text">Loading details...</p>
        </div>
    `;
    DOM.detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    AppState.currentDetail = { subjectId, detailPath };
    AppState.currentSeason = 1;
    AppState.currentEpisode = 1;
    AppState.selectedQuality = null;
    
    const data = await fetchData(`/detail/${encodeURIComponent(detailPath)}`);
    
    if (!data) {
        DOM.modalBody.innerHTML = `
            <div style="padding: 4rem 2rem;">
                ${renderEmptyState('⚠️', 'Failed to Load', 'Could not fetch details for this title.', 'closeModal()')}
            </div>
        `;
        return;
    }
    
    renderDetailView(data.data || data, subjectId, detailPath);
}

/**
 * Close the detail modal and stop playback.
 */
function closeModal() {
    DOM.detailModal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Stop video playback
    const video = DOM.modalBody.querySelector('video');
    if (video) {
        video.pause();
        video.src = '';
        video.load();
    }
    
    // Clear content after a short delay
    setTimeout(() => {
        DOM.modalBody.innerHTML = '';
        AppState.currentDetail = null;
        AppState.currentSources = null;
    }, 300);
}

/**
 * Render the full detail view with player.
 * @param {object} data - Detail response from API
 * @param {string} subjectId
 * @param {string} detailPath
 */
function renderDetailView(data, subjectId, detailPath) {
    // The API may nest under `subject` or return direct fields
    const subject = data.subject || data;
    
    if (!subject || !subject.title) {
        DOM.modalBody.innerHTML = `
            <div style="padding: 4rem 2rem;">
                ${renderEmptyState('📭', 'Not Found', 'No details available for this title.', 'closeModal()')}
            </div>
        `;
        return;
    }
    
    const title = subject.title || 'Untitled';
    const description = subject.description || 'No description available.';
    const poster = subject.cover?.url || subject.poster_url || FALLBACK_POSTER;
    const releaseDate = subject.releaseDate || '';
    const year = releaseDate ? String(releaseDate).substring(0, 4) : '';
    const rating = subject.imdbRatingValue || '';
    const genres = subject.genre ? subject.genre.split(',').map(g => g.trim()) : [];
    const country = subject.countryName || '';
    const duration = subject.duration ? formatDuration(subject.duration) : '';
    const subtitles = subject.subtitles || '';
    
    // Determine if this is a TV series (subjectType 2) or movie (1)
    const isSeries = subject.subjectType === 2 || subject.subjectType === 5 || subject.subjectType === 6;
    
    // Build metadata pills
    const metaPills = [
        year ? `<span class="meta-pill">${escapeHtml(year)}</span>` : '',
        rating ? `<span class="meta-pill rating">⭐ ${escapeHtml(rating)}</span>` : '',
        duration ? `<span class="meta-pill">⏱ ${escapeHtml(duration)}</span>` : '',
        country ? `<span class="meta-pill">🌍 ${escapeHtml(country)}</span>` : '',
        isSeries ? `<span class="meta-pill">📺 Series</span>` : `<span class="meta-pill">🎬 Movie</span>`,
    ].filter(Boolean).join('');
    
    // Build genre tags
    const genreTags = genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('');
    
    // Build the HTML
    DOM.modalBody.innerHTML = `
        <!-- Video Player -->
        <div class="player-wrapper" id="playerWrapper">
            <video id="videoPlayer" controls playsinline></video>
            <div class="player-loading" id="playerLoading">
                <div class="loader"></div>
                <p class="loader-text">Loading stream...</p>
            </div>
        </div>
        
        <!-- Detail Info -->
        <div class="detail-body">
            <div class="detail-header">
                <img class="detail-poster" 
                     src="${escapeHtml(poster)}" 
                     alt="${escapeHtml(title)}"
                     onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                <div class="detail-info">
                    <h1 class="detail-title">${escapeHtml(title)}</h1>
                    <div class="detail-meta">${metaPills}</div>
                    <p class="detail-description">${escapeHtml(description)}</p>
                    ${genreTags ? `<div class="detail-genres">${genreTags}</div>` : ''}
                </div>
            </div>
        </div>
        
        <!-- Player Controls -->
        <div class="player-controls" id="playerControls">
            ${isSeries ? `
                <div class="control-row" id="seasonRow">
                    <span class="control-label">Season:</span>
                    <select class="control-select" id="seasonSelect" onchange="onSeasonChange(this.value)"></select>
                </div>
                <div class="control-row" id="episodeRow">
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
    
    // Initialize player for either movie or first episode of series
    if (isSeries) {
        initSeriesPlayer(data);
    } else {
        loadStream(subjectId, detailPath, 1, 1);
    }
}

/**
 * Format duration (seconds) into readable string.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Initialize the series player with season/episode selectors.
 * @param {object} data - Detail data
 */
function initSeriesPlayer(data) {
    // Try to find seasons data
    const seasons = data.seasons || data.resource?.seasons || [];
    const seasonSelect = document.getElementById('seasonSelect');
    
    if (seasons.length > 0) {
        seasonSelect.innerHTML = seasons.map(s => 
            `<option value="${s.se}">Season ${s.se}</option>`
        ).join('');
        AppState.currentSeason = seasons[0].se;
        renderEpisodes(seasons[0]);
    } else {
        // Fallback: assume single season with common episode count
        seasonSelect.innerHTML = `<option value="1">Season 1</option>`;
        AppState.currentSeason = 1;
        renderEpisodes({ se: 1, episodes: [] });
    }
}

/**
 * Render episode buttons for a season.
 * @param {object} seasonData
 */
function renderEpisodes(seasonData) {
    const episodeList = document.getElementById('episodeList');
    const episodes = seasonData.episodes || [];
    
    if (episodes.length === 0) {
        // Fallback: create 12 episode buttons
        episodeList.innerHTML = Array.from({ length: 12 }, (_, i) => {
            const epNum = i + 1;
            return `<button class="episode-btn ${epNum === 1 ? 'active' : ''}" 
                            onclick="playEpisode(${seasonData.se}, ${epNum})">${epNum}</button>`;
        }).join('');
    } else {
        episodeList.innerHTML = episodes.map(ep => 
            `<button class="episode-btn ${ep.ep === 1 ? 'active' : ''}"
                     onclick="playEpisode(${seasonData.se}, ${ep.ep})">
                ${ep.ep}
            </button>`
        ).join('');
    }
}

/**
 * Handle season change.
 * @param {string|number} season
 */
async function onSeasonChange(season) {
    AppState.currentSeason = parseInt(season);
    AppState.currentEpisode = 1;
    
    // Re-fetch detail data to get episodes for this season
    if (!AppState.currentDetail) return;
    
    const { subjectId, detailPath } = AppState.currentDetail;
    const data = await fetchData(`/detail/${encodeURIComponent(detailPath)}`);
    
    if (data) {
        const detailData = data.data || data;
        const seasons = detailData.seasons || detailData.resource?.seasons || [];
        const seasonData = seasons.find(s => s.se === AppState.currentSeason);
        
        if (seasonData) {
            renderEpisodes(seasonData);
        } else {
            renderEpisodes({ se: AppState.currentSeason, episodes: [] });
        }
    }
    
    // Auto-play first episode of new season
    playEpisode(AppState.currentSeason, 1);
}

/**
 * Play a specific episode.
 * @param {number} season
 * @param {number} episode
 */
async function playEpisode(season, episode) {
    if (!AppState.currentDetail) return;
    
    AppState.currentSeason = season;
    AppState.currentEpisode = episode;
    
    // Update active button
    document.querySelectorAll('.episode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.episode-btn').forEach(btn => {
        if (parseInt(btn.textContent.trim()) === episode) {
            btn.classList.add('active');
        }
    });
    
    const { subjectId, detailPath } = AppState.currentDetail;
    await loadStream(subjectId, detailPath, season, episode);
}

/**
 * Load the stream for a given subject/season/episode.
 * Calls: GET /api/stream/{subject_id}?detail_path=...&se=...&ep=...
 * 
 * @param {string} subjectId
 * @param {string} detailPath
 * @param {number} season
 * @param {number} episode
 */
async function loadStream(subjectId, detailPath, season, episode) {
    const video = document.getElementById('videoPlayer');
    const playerLoading = document.getElementById('playerLoading');
    const qualityRow = document.getElementById('qualityRow');
    const qualityList = document.getElementById('qualityList');
    
    if (!video) return;
    
    // Reset video
    video.pause();
    video.removeAttribute('src');
    video.load();
    
    if (playerLoading) playerLoading.style.display = 'flex';
    if (qualityRow) qualityRow.style.display = 'none';
    
    const endpoint = `/api/stream/${encodeURIComponent(subjectId)}?detail_path=${encodeURIComponent(detailPath)}&se=${season}&ep=${episode}`;
    const data = await fetchData(endpoint);
    
    if (playerLoading) playerLoading.style.display = 'none';
    
    if (!data) {
        showPlayerError('Failed to load stream. Please try again.');
        return;
    }
    
    if (!data.has_resource || (!data.sources || data.sources.length === 0)) {
        showPlayerError('No stream available for this episode yet.');
        return;
    }
    
    AppState.currentSources = data.sources;
    
    // Render quality buttons
    if (qualityList) {
        qualityList.innerHTML = data.sources.map((source, idx) => {
            const resolution = source.resolution || 'Auto';
            const format = source.format || 'MP4';
            const isFirst = idx === 0;
            return `
                <button class="quality-btn ${isFirst ? 'active' : ''}"
                        onclick="selectQuality(${idx})">
                    ${escapeHtml(resolution)} ${escapeHtml(format)}
                </button>
            `;
        }).join('');
        qualityRow.style.display = 'flex';
    }
    
    // Load the first (usually highest) quality
    selectQuality(0);
    
    // Load captions
    loadCaptions(subjectId, detailPath, season, episode);
}

/**
 * Select a specific quality stream.
 * @param {number} index
 */
function selectQuality(index) {
    const sources = AppState.currentSources;
    if (!sources || !sources[index]) return;
    
    const source = sources[index];
    const video = document.getElementById('videoPlayer');
    
    AppState.selectedQuality = index;
    
    // Update active button
    document.querySelectorAll('.quality-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    
    if (video && source.url) {
        const wasPlaying = !video.paused;
        video.src = source.url;
        video.load();
        if (wasPlaying) {
            video.play().catch(() => {});
        }
    }
}

/**
 * Display a player error message.
 * @param {string} message
 */
function showPlayerError(message) {
    const playerWrapper = document.getElementById('playerWrapper');
    if (!playerWrapper) return;
    
    // Remove existing error
    const existing = playerWrapper.querySelector('.player-error');
    if (existing) existing.remove();
    
    const errorEl = document.createElement('div');
    errorEl.className = 'player-error';
    errorEl.innerHTML = `
        <div class="player-error-icon">📡</div>
        <p>${escapeHtml(message)}</p>
    `;
    playerWrapper.appendChild(errorEl);
}

/**
 * Load captions/subtitles for a stream.
 * Calls: GET /api/stream/{subject_id}/captions?detail_path=...&se=...&ep=...
 * 
 * @param {string} subjectId
 * @param {string} detailPath
 * @param {number} season
 * @param {number} episode
 */
async function loadCaptions(subjectId, detailPath, season, episode) {
    const captionsSection = document.getElementById('captionsSection');
    const captionsList = document.getElementById('captionsList');
    
    if (!captionsSection || !captionsList) return;
    
    const endpoint = `/api/stream/${encodeURIComponent(subjectId)}/captions?detail_path=${encodeURIComponent(detailPath)}&se=${season}&ep=${episode}`;
    const data = await fetchData(endpoint);
    
    if (!data || !data.captions || data.captions.length === 0) {
        captionsSection.style.display = 'none';
        return;
    }
    
    captionsList.innerHTML = data.captions.map(cap => {
        const lang = cap.lanName || cap.lan || cap.language || 'Unknown';
        const url = cap.url || '';
        if (!url) return '';
        return `
            <button class="caption-btn" 
                    onclick="addSubtitleTrack('${escapeForAttr(url)}', '${escapeForAttr(lang)}')">
                ${escapeHtml(lang)}
            </button>
        `;
    }).filter(Boolean).join('');
    
    captionsSection.style.display = captionsList.innerHTML ? 'block' : 'none';
}

/**
 * Add a subtitle track to the video element.
 * @param {string} url
 * @param {string} lang
 */
function addSubtitleTrack(url, lang) {
    const video = document.getElementById('videoPlayer');
    if (!video) return;
    
    // Remove existing tracks
    video.querySelectorAll('track').forEach(t => t.remove());
    
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = lang;
    track.srclang = lang.toLowerCase().substring(0, 2);
    track.src = url;
    track.default = true;
    
    video.appendChild(track);
    
    // Enable the track
    setTimeout(() => {
        if (video.textTracks.length > 0) {
            video.textTracks[0].mode = 'showing';
        }
    }, 100);
    
    showToast(`Subtitles loaded: ${lang}`, 'success');
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

/**
 * Initialize the application on page load.
 */
function initApp() {
    // Initialize search
    initSearch();
    
    // Load home page
    loadHomePage();
    
    // Handle ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (DOM.detailModal.classList.contains('active')) {
                closeModal();
            }
        }
    });
    
    // Close modal on overlay click
    DOM.detailModal.addEventListener('click', (e) => {
        if (e.target === DOM.detailModal) {
            closeModal();
        }
    });
    
    console.log('%c🎬 MovieBox Pro', 'color: #ff3d71; font-size: 20px; font-weight: bold;');
    console.log(`%cAPI: ${API_BASE_URL}`, 'color: #00f2ff;');
    console.log('%cReady to stream!', 'color: #9ea3ac;');
}

// Boot the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

/* ============================================================
   GLOBAL EXPORTS (for inline onclick handlers)
   ============================================================ */
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
