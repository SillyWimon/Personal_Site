//JS File for MAP BLOG BETA!
// Map Blog™ — © 2025 Willy Simon. All rights reserved.
// Built with Leaflet; map data © OpenStreetMap contributors.


/********* MAP BASE *********/

// Define world bounds so the map can’t scroll infinitely
const WORLD_BOUNDS = L.latLngBounds([[-85, -180], [85, 180]]);

// Tile layers (note: add noWrap + bounds here)
const cartoLight = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
    attribution: '&copy; OSM contributors, &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    noWrap: true,
    bounds: WORLD_BOUNDS,
    }
);

const osmStandard = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    noWrap: true,
    bounds: WORLD_BOUNDS,
    }
);

// Map with max bounds & viscosity (so it "bounces" at edges)
const map = L.map('map', {
    center: [20, 0],
    zoom: 3,
    layers: [cartoLight],
    maxBounds: WORLD_BOUNDS,
    maxBoundsViscosity: 1.0,
    minZoom: 2,
});


// Basemap registry + persistence
const BASES = {
'Carto Light': cartoLight,
'OSM Standard': osmStandard,
};
let currentBase = cartoLight;

const baseSel = document.getElementById('basemap-select'); // <-- from the topbar
if (baseSel) {
// hydrate from localStorage
const savedBase = localStorage.getItem('mb_basemap');
if (savedBase && BASES[savedBase]) {
    map.removeLayer(currentBase);
    currentBase = BASES[savedBase];
    currentBase.addTo(map);
    baseSel.value = savedBase;
}

// handle user changes
baseSel.addEventListener('change', (e) => {
    const choice = e.target.value;
    if (!BASES[choice]) return;
    map.removeLayer(currentBase);
    currentBase = BASES[choice];
    currentBase.addTo(map);
    localStorage.setItem('mb_basemap', choice);
});
}


/********* DOM & PANEL HELPERS *********/
const app          = document.getElementById('app');
const panel        = document.getElementById('panel');
const panelContent = document.getElementById('panel-content');
const modeCue      = document.getElementById('add-cue');

// --- Option A: Leaflet helpers (simple, usually enough)
L.DomEvent.disableClickPropagation(panel);
L.DomEvent.disableScrollPropagation(panel);
L.DomEvent.disableClickPropagation(panelContent);
L.DomEvent.disableScrollPropagation(panelContent);

let currentPostId = null;
function refocusCurrent() {
    if (!currentPostId) return;
    const p = getPostById(currentPostId); if (!p) return;
    focusLatLng([p.lat, p.lng], { minZoom: 8 });
}

let suppressHistory = false;


function openPanel(html){ 
    if (html) panelContent.innerHTML = html; 
    panel.classList.add('open'); 
    panel.setAttribute('aria-hidden','false'); 
    app.classList.add('panel-open');
    panelContent.scrollTop = 0; 
}

function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
    app.classList.remove('panel-open');

    clearTempMarker()

    const u = new URL(location.href);
    const hadPost = u.searchParams.has('post');
    u.searchParams.delete('post');
    if (hadPost && !suppressHistory) {
    history.pushState({ postId: null }, '', u);
    }
}

// Color select for markers
const DEFAULT_COLOR = '#111111';

const COLOR_PRESETS = [
    
    ['#111111','Black'], ['#e74c3c','Red'], ['#ff8a00','Orange'], ['#f1c40f','Yellow'],
    ['#2ecc71','Green'], ['#3498db','Blue'], ['#9b59b6','Purple'], ['#e91e63','Pink'],
];

// helper: current choice or saved or default
// function getSelectedColor(){
//   const sel = document.getElementById('color-select');
//   return (sel && sel.value) || localStorage.getItem('mb_color') || DEFAULT_COLOR;
// }

function getSelectedColor(){
    const formSel = document.getElementById('f-color');
    const saved   = localStorage.getItem('mb_color');
    const valid   = (v) => COLOR_PRESETS.some(([hex]) => hex === v);
    return (formSel && valid(formSel.value) && formSel.value)
        || (valid(saved) ? saved : DEFAULT_COLOR);
}





// put this near your other helpers
function clearTempMarker(){
    if (tempMarker){
    map.removeLayer(tempMarker);
    tempMarker = null;
    }
}


window.closePanel = closePanel;

// Delegated actions inside panel
panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;

    if (action === 'edit')   openEditPostForm(id);
    if (action === 'delete') deletePost(id);
    if (action === 'close') {
    if (addMode || tempMarker) { removeTemp(); } else { closePanel(); }
    } 
    if (action === 'reposition')  startReposition(id);

    if (action === 'posts') openPostList();
    
    if (action === 'copylink') {
    const url = new URL(location.href);
    url.searchParams.set('post', id);
    const link = url.toString();
    try {
    await navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
    } catch (err) {
    // fallback if clipboard API blocked
    prompt('Copy this link:', link);
    }
}
    
});


function isMobile() { return window.matchMedia('(max-width: 899px)').matches; }

let _mapState = null;
function disableMapGestures() {
    if (_mapState) return;
    _mapState = {
    dragging:        map.dragging.enabled(),
    touchZoom:       map.touchZoom.enabled(),
    scrollWheelZoom: map.scrollWheelZoom.enabled(),
    doubleClickZoom: map.doubleClickZoom.enabled(),
    boxZoom:         map.boxZoom.enabled(),
    keyboard:        map.keyboard.enabled(),
    };
    map.dragging.disable();
    map.touchZoom.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
}
function restoreMapGestures() {
    if (!_mapState) return;
    if (_mapState.dragging)        map.dragging.enable();
    if (_mapState.touchZoom)       map.touchZoom.enable();
    if (_mapState.scrollWheelZoom) map.scrollWheelZoom.enable();
    if (_mapState.doubleClickZoom) map.doubleClickZoom.enable();
    if (_mapState.boxZoom)         map.boxZoom.enable();
    if (_mapState.keyboard)        map.keyboard.enable();
    _mapState = null;
}

const DATE_SEL = 'input[type="date"], input[type="datetime-local"]';

/* While a date field is focused on mobile: fix sheet & lock background */
panel.addEventListener('focusin', (e) => {
    if (!isMobile() || !e.target.matches(DATE_SEL)) return;
    panel.classList.add('sheet-fixed');
    document.documentElement.classList.add('lock-scroll');
    document.body.classList.add('lock-scroll');
    disableMapGestures();
    setTimeout(() => {
    try { e.target.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch {}
    }, 150);
});

panel.addEventListener('focusout', (e) => {
    if (!isMobile() || !e.target.matches(DATE_SEL)) return;
    setTimeout(() => {
    const ae = document.activeElement;
    const stillOnDate = ae && ae.matches && ae.matches(DATE_SEL);
    if (stillOnDate) return;
    panel.classList.remove('sheet-fixed');
    document.documentElement.classList.remove('lock-scroll');
    document.body.classList.remove('lock-scroll');
    restoreMapGestures();
    }, 300);
});

/* Prevent ancestors (map/panel) from swallowing the tap that opens the picker */
panel.addEventListener('pointerdown', (e) => {
    if (!isMobile()) return;
    if (e.target && e.target.matches(DATE_SEL)) {
    e.stopPropagation();
    }
}, true);

/* On Chrome/Android, explicitly open the native picker and keep it open */
panel.addEventListener('click', (e) => {
    if (!isMobile()) return;
    const el = e.target;
    if (el && el.matches(DATE_SEL)) {
    e.stopPropagation();
    if (typeof el.showPicker === 'function') {
        e.preventDefault();
        setTimeout(() => { try { el.showPicker(); } catch {} }, 0);
    }
    }
}, true);





function getTopPad() {
    const tb = document.getElementById('topbar');
    const gutter = 12;
    if (!tb) return gutter;

    // Use the bar’s bottom relative to the MAP container top
    const tbRect  = tb.getBoundingClientRect();
    const mapRect = map.getContainer().getBoundingClientRect();
    // bar bottom (viewport) - map top (viewport) = pixels from map’s top to bar’s bottom
    const pad = (tbRect.bottom - mapRect.top) + gutter;
    return Math.max(gutter, pad);
}


// Compute safe area occupied by the panel (left on desktop, bottom on mobile)
function getPanelPads() {
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    const gutter = 24;
    let leftPad = gutter, bottomPad = gutter;

    if (panel.classList.contains('open')) {
    if (isDesktop) {
        leftPad = panel.getBoundingClientRect().width + gutter;
    } else {
        const sheetVH = parseFloat(getComputedStyle(panel).getPropertyValue('--sheetH')) || 62;
        bottomPad = (window.innerHeight * (sheetVH / 100)) + gutter;
    }
    }
    return { leftPad, bottomPad, gutter, topPad: getTopPad()};
}

// Pan so the point *lands* somewhere comfortably right of the panel,
// using exact pixel delta (no padding heuristics).
function focusLatLng(latlng, { minZoom = 8, leftInset = 200 } = {}) {
    const target = L.latLng(latlng);

    const afterZoom = () => {
    map.stop();
    map.invalidateSize();

    // ⬇️ include topPad here
    const { leftPad, bottomPad, topPad, gutter } = getPanelPads();
    const size = map.getSize();

    const desiredX = Math.min(Math.max(leftPad + leftInset, leftPad + gutter), size.x - gutter);
    const p = map.latLngToContainerPoint(target);

    const minY = topPad;                            // keep below top bar
    const maxY = size.y - bottomPad - gutter;       // keep above mobile sheet
    const desiredY = Math.min(Math.max(p.y, minY), maxY);

    const delta = L.point(desiredX - p.x, desiredY - p.y);
    if (delta.x !== 0 || delta.y !== 0) map.panBy(delta.multiplyBy(-1), { animate: true });
    };

    if (map.getZoom() < minZoom) {
    map.once('moveend', afterZoom);
    map.setView(target, minZoom, { animate: true, duration: 0.35 });
    } else {
    if (!map.getBounds().pad(0.1).contains(target)) map.setView(target, map.getZoom(), { animate: false });
    afterZoom();
    }
}



// Call focus AFTER the panel’s transition so width/height are correct.
function focusPostAfterPanelOpens(latlng, opts) {
    const doFocus = () => focusLatLng(latlng, opts);
    if (panel.classList.contains('open')) { doFocus(); return; }
    const onDone = (e) => { if (e.target !== panel) return; panel.removeEventListener('transitionend', onDone); doFocus(); };
    panel.addEventListener('transitionend', onDone, { once: true });
}

// can turn on debug box to see the borders around the map and how our attempts to keep the point within the map work
// function debugSafeBox() {
//   const { leftPad, bottomPad, topPad, gutter } = getPanelPads();
//   const box = document.getElementById('safe-box') || Object.assign(document.createElement('div'), { id:'safe-box' });
//   Object.assign(box.style, {
//     position:'absolute',
//     top:    topPad + 'px',         // ⬅️ was gutter
//     left:   leftPad + 'px',
//     right:  gutter + 'px',
//     bottom: bottomPad + 'px',
//     border:'1px dashed rgba(0,0,0,.3)', pointerEvents:'none', zIndex: 2000
//   });
//   document.body.appendChild(box);
// }


// window.addEventListener('resize', debugSafeBox);
// panel.addEventListener('transitionend', debugSafeBox);
// debugSafeBox();

function flashFocusMarker(id){
    const m = markersById.get(id); if (!m) return;
    const el = m.getElement(); if (!el) return;
    const dot = el.querySelector('.post-dot') || el;
    dot.classList.add('pulse');
    setTimeout(() => dot.classList.remove('pulse'), 500);
}



/********* RESIZER *********/
(function initResizer(){
    const WKEY = 'mb_panelW';
    const HKEY = 'mb_sheetH';
    const savedW = parseInt(localStorage.getItem(WKEY), 10);
    if (!isNaN(savedW)) panel.style.setProperty('--panelW', savedW + 'px');
    const savedH = parseFloat(localStorage.getItem(HKEY));
    if (!isNaN(savedH)) panel.style.setProperty('--sheetH', savedH + 'vh');
    const resizer = document.getElementById('panel-resizer');
    resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault(); panel.classList.add('dragging');
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    function onMove(ev){
        if (isDesktop){
        const min = 300, max = Math.min(window.innerWidth * 0.8, 900);
        let w = Math.max(min, Math.min(max, ev.clientX));
        panel.style.setProperty('--panelW', w + 'px');
        } else {
        const vh = Math.max(30, Math.min(90, ((window.innerHeight - ev.clientY) / window.innerHeight) * 100));
        panel.style.setProperty('--sheetH', vh + 'vh');
        }
    }
    function onUp(){
        panel.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const isDesktopNow = window.matchMedia('(min-width: 900px)').matches;
        if (isDesktopNow){ const val = parseInt(getComputedStyle(panel).getPropertyValue('--panelW')); if (!isNaN(val)) localStorage.setItem(WKEY, String(val)); }
        else { const val = parseFloat(getComputedStyle(panel).getPropertyValue('--sheetH')); if (!isNaN(val)) localStorage.setItem(HKEY, String(val)); }
        refocusCurrent(); // after you save --panelW/--sheetH

    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    });
})();

/********* STORAGE *********/
const STORAGE_KEY = 'mb_posts_v1';
function loadPosts(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } }

function savePosts(arr){
    const json = JSON.stringify(arr);
    try {
    localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
    const isQuota = err && (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
    let msg = 'Failed to save.';
    if (isQuota) {
        msg = 'Save failed: browser storage is full. Try exporting, deleting large photos, or enabling image compression.';
    }
    console.error(err);
    alert(msg);
    throw err; // rethrow so callers can react if needed
    }
}


let posts = loadPosts();

function migratePost(p){
    if (!p.dateMode){
    if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)){
        p.dateMode = 'single';
        p.dateStart = p.date;
        p.dateEnd = '';
        p.dateText = '';
    } else if (p.date){
        p.dateMode = 'text';
        p.dateText = p.date;
        p.dateStart = '';
        p.dateEnd = '';
    } else {
        p.dateMode = 'text';
        p.dateText = '';
        p.dateStart = '';
        p.dateEnd = '';
    }
    }
    if (!p.color) p.color = DEFAULT_COLOR;

    // ensure numeric lat/lng
    const _lat = Number(p.lat);
    const _lng = Number(p.lng);
    if (Number.isFinite(_lat) && Number.isFinite(_lng)) {
    p.lat = _lat;
    p.lng = _lng;
    }

    if (p.photo && p.photo.dataUrl) {
    const u = safeImgUrl(p.photo.dataUrl);
    if (!u) delete p.photo; else p.photo.dataUrl = u;
    }

    return p;

}

posts = posts.map(migratePost);
savePosts(posts);


let sortState = localStorage.getItem('mb_sort') || 'date_desc';
const markersById = new Map();

/********* UTILS *********/
function escapeHTML(s){ return (s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escapeAttr(s){ return (s||'').replace(/[&"]/g, c => ({'&':'&amp;','"':'&quot;'}[c])); }

function dateToKey(d){ // YYYY-MM-DD → number; else 0
    if (!d) return 0;
    const t = Date.parse(d);
    return isNaN(t) ? 0 : t;
}

function safeImgUrl(u){
    if (typeof u !== 'string') return '';
    return /^data:image\/|^https?:\/\//i.test(u) ? u : '';
}

/********* MARKERS *********/
function renderPostMarker(p){
    const dot = `<div class="post-dot" style="--dot:${p.color || DEFAULT_COLOR}"></div>`;
    const icon = L.divIcon({ className: '', html: dot, iconSize:[10,10], iconAnchor:[5,5] });
    const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    m.on('click', () => openPostView(p));
    markersById.set(p.id, m);
    return m;
}


function renderAllMarkers(){ markersById.forEach(m => map.removeLayer(m)); markersById.clear(); posts.forEach(renderPostMarker); }


function hexToRgba(hex, a=0.12){
    let h = (hex || '').replace('#','').trim();
    if (h.length === 3) h = h.split('').map(ch => ch+ch).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return `rgba(17,17,17,${a})`;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}


/********* TEMP MARKER *********/
let tempMarker = null;

function makeTempMarker(lat, lng, color = DEFAULT_COLOR){
    if (tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
    const icon = L.divIcon({
    className:'',
    html:`<div class="temp-dot" style="--dot:${color}"></div>`,
    iconSize:[14,14], iconAnchor:[7,7]
    });
    tempMarker = L.marker([lat, lng], { icon, draggable:true }).addTo(map);
    tempMarker.on('dragend', (ev) => {
    const ll = ev.target.getLatLng();
    openNewPostForm(ll, document.getElementById('f-place')?.value || '');
    });
}


function updateTempMarkerColor(){
    if (!tempMarker) return;
    const color = getSelectedColor();
    // easiest: swap icon (Leaflet-safe)
    const icon = L.divIcon({
    className:'',
    html:`<div class="temp-dot" style="--dot:${color}"></div>`,
    iconSize:[14,14], iconAnchor:[7,7]
    });
    tempMarker.setIcon(icon);
}


function removeTemp(){ if (tempMarker){ map.removeLayer(tempMarker); tempMarker = null; } closePanel(); cancelAddMode(); }
window.removeTemp = removeTemp;

function formatPostDate(p){
    if (p.dateMode === 'range' && p.dateStart && p.dateEnd) return `${p.dateStart} – ${p.dateEnd}`;
    if (p.dateMode === 'single' && p.dateStart) return p.dateStart;
    if (p.dateMode === 'text'   && p.dateText)  return p.dateText;
    // legacy fallback
    return p.date || '';
}

function getDateSortKey(p, asc=false){
    // For ranges: use end for DESC (newest first), start for ASC (oldest first)
    const target =
    p.dateMode === 'range' ? (asc ? p.dateStart : p.dateEnd) :
    p.dateMode === 'single' ? p.dateStart :
    p.dateMode === 'text'   ? '' : p.date;
    return dateToKey(target);
}

// Update fmt so list/search use the formatted date
const fmt = (p) => ({
    title: (p.title||'').trim(),
    date:  formatPostDate(p),
    place: (p.placeName||'').trim(),
    text:  (p.body||'').trim(),
});

// Compress photos
async function downscaleImage(file, {maxW=1600, maxH=1600, quality=0.8}={}){
    // Read file → Image
    const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
    });

    // Try to draw to canvas (also converts HEIC/PNG → JPEG if the browser can decode)
    const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null); // fallback below if decode fails
    i.src = dataUrl;
    });

    if (!img) return dataUrl; // fallback: save original if we couldn't decode

    let w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * scale); h = Math.round(h * scale);

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Export as JPEG to keep size small
    return c.toDataURL('image/jpeg', quality);
}



/********* VIEWS *********/
// function openPostView(p){
//   clearTempMarker();
//   const title = escapeHTML(p.title || 'Untitled');
//   const body = escapeHTML(p.body || '');

//   const img   = p.photo?.dataUrl ? `<a href="${p.photo.dataUrl}" target="_blank" rel="noopener"><img class="post-img" src="${p.photo.dataUrl}" alt="${escapeAttr(p.title||'Photo')}"></a>` : '';
//   openPanel(`
//     <div class="toolbar" style="display:flex; gap:8px; float:right;">
//       <button class="btn" data-action="edit" data-id="${p.id}">Edit</button>
//       <button class="btn" data-action="copylink" data-id="${p.id}">Copy link</button>
//       <button class="btn" data-action="delete" data-id="${p.id}">Delete</button>
//       <button class="btn" data-action="close">Close</button>
//     </div>
//     <h2>${title}</h2>
//     <div class="meta">${[escapeHTML(p.placeName), escapeHTML(formatPostDate(p))].filter(Boolean).join(', ')}</div>
//     ${img}
//     <p style="white-space: pre-wrap">${body}</p>
//     <div class="meta" style="margin-top:10px;">Lat: ${p.lat.toFixed(5)}, Lng: ${p.lng.toFixed(5)}</div>
//   `);
//   if (!suppressHistory) {
//     const currId = new URLSearchParams(location.search).get('post');
//     const u = new URL(location.href);
//     u.searchParams.set('post', p.id);

//     if (currId === p.id) {
//       // same post → don’t add a new entry
//       history.replaceState({ postId: p.id }, '', u);
//     } else {
//       // different post → add a new entry
//       history.pushState({ postId: p.id }, '', u);
//     }
//   }
//   currentPostId = p.id;

//   const latlng = L.latLng(p.lat, p.lng);
//   focusPostAfterPanelOpens(latlng, { minZoom: 8 });
//   flashFocusMarker(p.id);

// }

function openPostView(p){
    clearTempMarker();
    const title = escapeHTML(p.title || 'Untitled');
    const body  = escapeHTML(p.body  || '');

    const imgURL = safeImgUrl(p.photo?.dataUrl);
    const img = imgURL
    ? `<a href="${imgURL}" target="_blank" rel="noopener noreferrer">
        <img class="post-img" src="${imgURL}" alt="${escapeAttr(p.title||'Photo')}">
        </a>`
    : '';


    openPanel(`
    <header class="post-header">
        <h2>${title}</h2>
        <div class="post-head-actions">
        <details class="menu">
            <summary class="iconbtn" aria-label="More">⋯</summary>
            <div class="menu-pop">
            <button class="btn small"  data-action="edit"     data-id="${p.id}">Edit</button>
            <button class="btn small"  data-action="copylink" data-id="${p.id}">Copy link</button>
            <button class="btn small danger" data-action="delete"   data-id="${p.id}">Delete</button>
            </div>
        </details>
        <button class="iconbtn" data-action="close" aria-label="Close">✕</button>
        </div>
    </header>

    <div class="meta">${[escapeHTML(p.placeName), escapeHTML(formatPostDate(p))].filter(Boolean).join(', ')}</div>
    ${img}
    <p style="white-space: pre-wrap">${body}</p>
    <div class="meta" style="margin-top:10px;">Lat: ${p.lat.toFixed(5)}, Lng: ${p.lng.toFixed(5)}</div>

    <div class="panel-actions">
        <button class="btn"        data-action="posts">Posts</button>
        <button class="btn primary" data-action="edit" data-id="${p.id}">Edit</button>
    </div>
    `);

    // history + focus logic you already have…
    if (!suppressHistory) {
    const currId = new URLSearchParams(location.search).get('post');
    const u = new URL(location.href); u.searchParams.set('post', p.id);
    if (currId === p.id) history.replaceState({ postId: p.id }, '', u);
    else                 history.pushState    ({ postId: p.id }, '', u);
    }
    currentPostId = p.id;

    const latlng = L.latLng(p.lat, p.lng);
    focusPostAfterPanelOpens(latlng, { minZoom: 8 });
    flashFocusMarker(p.id);
}


function openNewPostForm(latlng, placeName=''){
    openPanel(`
    <button class="btn" style="float:right" onclick="removeTemp()">Cancel</button>
    <h2>New Post</h2>
    <div class="meta">Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}</div>
    <form id="post-form">
        <div class="row">
        <label><span>Title</span><input type="text" id="f-title" placeholder="e.g., Chiang Mai – Night Market" required></label>

        <label><span>Date type</span>
            <select id="f-date-mode">
            <option value="single" selected>Single day</option>
            <option value="range">Date range</option>
            <option value="text">Text</option>
            </select>
        </label>

        <div id="date-single" class="date-block">
            <label><span>Date</span><input type="date" id="f-date-single"></label>
        </div>

        <div id="date-range" class="date-block" style="display:none">
            <label><span>Start</span><input type="date" id="f-date-start"></label>
            <label><span>End</span><input type="date" id="f-date-end"></label>
        </div>

        <div id="date-text" class="date-block" style="display:none">
            <label><span>Date (text)</span><input type="text" id="f-date-text" placeholder="e.g., Spring 2024 or 'Sometime in 2019'"></label>
        </div>

        <label><span>Place (optional)</span><input type="text" id="f-place" value="${escapeAttr(placeName||'')}" placeholder="City, Region"></label>

        <label><span>Marker color</span>
            <select id="f-color"></select>
        </label>

        </div>

        <div class="row">
        <label><span>Photo</span><input type="file" id="f-photo" accept="image/*"></label>
        <img id="f-preview" class="post-img" style="display:none" alt="">
        </div>

        <div class="row">
        <label><span>Story</span><textarea id="f-body" placeholder="Write about your experience..."></textarea></label>
        </div>

        <div class="row" style="display:flex; gap:8px;">
        <button type="button" class="btn" onclick="removeTemp()">Cancel</button>
        <button type="submit" class="btn">Save Post</button>
        </div>
    </form>
    `);

    // Color picker (new post)
    const fColor = document.getElementById('f-color');
    if (fColor){
    // fill options
    fColor.innerHTML = '';
    COLOR_PRESETS.forEach(([val,label])=>{
        const o = document.createElement('option');
        o.value = val; o.textContent = label;
        fColor.appendChild(o);
    });

    // seed from localStorage (fallback to DEFAULT_COLOR if invalid/missing)
    const saved = localStorage.getItem('mb_color');
    const valid = (v) => COLOR_PRESETS.some(([hex]) => hex === v);
    fColor.value = valid(saved) ? saved : DEFAULT_COLOR;

    // persist + live update temp marker
    fColor.addEventListener('change', (e)=>{
        localStorage.setItem('mb_color', e.target.value);
        updateTempMarkerColor();
    });

    // make sure the temp pin matches the initial selection
    updateTempMarkerColor();
    }


    // show/hide date blocks
    const modeSel = document.getElementById('f-date-mode');
    const blocks = {
    single: document.getElementById('date-single'),
    range:  document.getElementById('date-range'),
    text:   document.getElementById('date-text'),
    };
    function updateBlocks(){
    Object.values(blocks).forEach(el => el.style.display = 'none');
    blocks[modeSel.value].style.display = 'grid';
    }
    modeSel.addEventListener('change', updateBlocks);
    updateBlocks();

    // photo preview
    const fi = document.getElementById('f-photo');
    const pv = document.getElementById('f-preview');
    fi.addEventListener('change', (e)=>{
    const file = e.target.files?.[0];
    if (!file){ pv.style.display='none'; pv.src=''; return; }
    const fr = new FileReader();
    fr.onload = () => { pv.src = fr.result; pv.style.display='block'; };
    fr.readAsDataURL(file);
    });

    document.getElementById('post-form').addEventListener('submit', async (e)=>{
    e.preventDefault();

    const mode = modeSel.value;
    let dateStart='', dateEnd='', dateText='', dateDisplay='';
    if (mode === 'single'){
        dateStart = document.getElementById('f-date-single').value.trim();
        dateDisplay = dateStart;
    } else if (mode === 'range'){
        dateStart = document.getElementById('f-date-start').value.trim();
        dateEnd   = document.getElementById('f-date-end').value.trim();
        if (dateStart && dateEnd && dateToKey(dateEnd) < dateToKey(dateStart)){
        alert('End date must be on/after start date.');
        return;
        }
        dateDisplay = (dateStart && dateEnd) ? `${dateStart} – ${dateEnd}` : (dateStart || dateEnd);
    } else {
        dateText = document.getElementById('f-date-text').value.trim();
        dateDisplay = dateText;
    }

    const file = document.getElementById('f-photo').files?.[0];
    let photo = null;
    if (file){
        try {
        const dataUrl = await downscaleImage(file, {maxW: 1600, maxH: 1600, quality: 0.8});
        photo = { name: file.name, dataUrl };
        } catch (err) {
        console.error(err);
        alert('Could not process image.');
        }
    }

    const color = getSelectedColor();

    const postBase = {
        id: 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
        title: document.getElementById('f-title').value.trim(),
        placeName: document.getElementById('f-place').value.trim(),
        lat: latlng.lat, lng: latlng.lng,
        body: document.getElementById('f-body').value.trim(),
        // ▼ canonical date fields
        dateMode: mode,
        dateStart, dateEnd, dateText,
        // ▼ legacy/display string (kept for compatibility and quick rendering)
        date: dateDisplay || '',
        color,
        photo, // I think ChatGPT wanted me to take away : NULL here - yes we can becuase we declared let photo = null above - so it exists
        createdAt: Date.now(), updatedAt: Date.now(),
    };

    const finalize = (p) => {
        posts.push(p);
        savePosts(posts);                  // keep the quota-safe try/catch version
        if (tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
        renderPostMarker(p);
        cancelAddMode();
        openPostView(p);
    };

    finalize(postBase); 
    });
}



/* Edit/Delete */
function getPostById(id){ return posts.find(p => p.id === id); }

function deletePost(id){
    if (!confirm('Delete this post?')) return;
    const idx = posts.findIndex(p => p.id === id); if (idx < 0) return;
    posts.splice(idx, 1); savePosts(posts);
    if (markersById.has(id)) { map.removeLayer(markersById.get(id)); markersById.delete(id); }
    closePanel();
}
window.deletePost = deletePost;

// 

function openEditPostForm(id){
    const p = getPostById(id); if (!p) return;

    // Prefill helpers
    const mode = p.dateMode || (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? 'single' : (p.date ? 'text' : 'single'));
    const pre = {
    mode,
    single: p.dateStart || (mode==='single' ? p.date : ''),
    start:  p.dateStart || '',
    end:    p.dateEnd   || '',
    text:   p.dateText  || (mode==='text' ? p.date : ''),
    };

    openPanel(`
    <div class="toolbar" style="display:flex; gap:8px; float:right;">
        <button class="btn" data-action="close">Cancel</button>
        <button class="btn" data-action="reposition" data-id="${p.id}">Reposition</button>
    </div>
    <h2>Edit Post</h2>
    <div class="meta">Lat: <span id="latlbl">${p.lat.toFixed(5)}</span>, Lng: <span id="lnglbl">${p.lng.toFixed(5)}</span></div>
    <form id="post-form">
        <input type="hidden" id="f-lat" value="${p.lat}">
        <input type="hidden" id="f-lng" value="${p.lng}">

        <div class="row">
        <label><span>Title</span><input type="text" id="f-title" value="${escapeAttr(p.title||'')}" required></label>

        <label><span>Date type</span>
            <select id="f-date-mode">
            <option value="single">Single day</option>
            <option value="range">Date range</option>
            <option value="text">Text</option>
            </select>
        </label>

        <div id="date-single" class="date-block">
            <label><span>Date</span><input type="date" id="f-date-single" value="${escapeAttr(pre.single||'')}"></label>
        </div>

        <div id="date-range" class="date-block" style="display:none">
            <label><span>Start</span><input type="date" id="f-date-start" value="${escapeAttr(pre.start||'')}"></label>
            <label><span>End</span><input type="date" id="f-date-end" value="${escapeAttr(pre.end||'')}"></label>
        </div>

        <div id="date-text" class="date-block" style="display:none">
            <label><span>Date (text)</span><input type="text" id="f-date-text" value="${escapeAttr(pre.text||'')}"></label>
        </div>

        <label><span>Place (optional)</span><input type="text" id="f-place" value="${escapeAttr(p.placeName||'')}"></label>

        <label><span>Marker color</span>
            <select id="f-color"></select>
        </label>

        </div>

        <div class="row">
        <label><span>Photo (choose to replace)</span><input type="file" id="f-photo" accept="image/*"></label>
        ${p.photo?.dataUrl
        ? `<img id="f-preview" class="post-img" src="${safeImgUrl(p.photo.dataUrl)}" alt="">`
        : `<img id="f-preview" class="post-img" style="display:none" alt="">`}
        </div>

        <div class="row">
        <label><span>Story</span><textarea id="f-body">${escapeHTML(p.body||'')}</textarea></label>
        </div>

        <div class="row" style="display:flex; gap:8px;">
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn">Save Changes</button>
        </div>
    </form>
    `);

    //Chaz said to put this right after"openPanel(...)" so I think it meant here
    const fColor = document.getElementById('f-color');
    if (fColor){
    COLOR_PRESETS.forEach(([val,label])=>{
        const o = document.createElement('option');
        o.value = val; o.textContent = label; fColor.appendChild(o);
    });
    fColor.value = p.color || DEFAULT_COLOR;
    }


    // date block toggling
    const modeSel = document.getElementById('f-date-mode');
    modeSel.value = pre.mode;
    const blocks = {
    single: document.getElementById('date-single'),
    range:  document.getElementById('date-range'),
    text:   document.getElementById('date-text'),
    };
    function updateBlocks(){
    Object.values(blocks).forEach(el => el.style.display = 'none');
    blocks[modeSel.value].style.display = 'grid';
    }
    modeSel.addEventListener('change', updateBlocks);
    updateBlocks();

    // photo preview
    const fi = document.getElementById('f-photo');
    const pv = document.getElementById('f-preview');
    fi.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file){ if (!p.photo) pv.style.display='none'; return; }
    const fr = new FileReader(); fr.onload = () => { pv.src = fr.result; pv.style.display='block'; }; fr.readAsDataURL(file);
    });

    document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // collect dates (same logic as in New form)
    const mode = modeSel.value;
    let dateStart='', dateEnd='', dateText='', dateDisplay='';
    if (mode === 'single'){
        dateStart = document.getElementById('f-date-single').value.trim();
        dateDisplay = dateStart;
    } else if (mode === 'range'){
        dateStart = document.getElementById('f-date-start').value.trim();
        dateEnd   = document.getElementById('f-date-end').value.trim();
        if (dateStart && dateEnd && dateToKey(dateEnd) < dateToKey(dateStart)){
        alert('End date must be on/after start date.');
        return;
        }
        dateDisplay = (dateStart && dateEnd) ? `${dateStart} – ${dateEnd}` : (dateStart || dateEnd);
    } else {
        dateText = document.getElementById('f-date-text').value.trim();
        dateDisplay = dateText;
    }

    // optional new photo -> compress
    const file = document.getElementById('f-photo').files?.[0];
    let photoObj;
    if (file){
        try {
        const dataUrl = await downscaleImage(file, { maxW: 1600, maxH: 1600, quality: 0.8 });
        photoObj = { name: file.name, dataUrl };
        } catch (err) {
        console.error(err);
        alert('Could not process image.');
        }
    }

    // apply edits
    p.title = document.getElementById('f-title').value.trim();
    p.placeName = document.getElementById('f-place').value.trim();
    p.body = document.getElementById('f-body').value.trim();
    p.lat = parseFloat(document.getElementById('f-lat').value);
    p.lng = parseFloat(document.getElementById('f-lng').value);

    p.dateMode = mode;
    p.dateStart = dateStart;
    p.dateEnd   = dateEnd;
    p.dateText  = dateText;
    p.date = dateDisplay || '';
    p.color = document.getElementById('f-color')?.value || DEFAULT_COLOR;

    if (photoObj) p.photo = photoObj; // only replace if a new file was chosen

    p.updatedAt = Date.now();
    savePosts(posts); // quota-safe version

    const m = markersById.get(p.id);
    if (m){
        const dot = `<div class="post-dot" style="--dot:${p.color || DEFAULT_COLOR}"></div>`;
        m.setIcon(L.divIcon({ className:'', html: dot, iconSize:[10,10], iconAnchor:[5,5] }));
        m.setLatLng([p.lat, p.lng]);
    }

    clearTempMarker();
    openPostView(p);
    });
    
}


window.openEditPostForm = openEditPostForm;

function startReposition(id){
    const p = getPostById(id); if (!p) return;
    clearTempMarker();
    const icon = L.divIcon({ className:'', html:'<div class="temp-dot"></div>', iconSize:[14,14], iconAnchor:[7,7] });
    tempMarker = L.marker([p.lat, p.lng], { icon, draggable:true }).addTo(map);
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 8));
    tempMarker.on('dragend', (ev) => {
    const ll = ev.target.getLatLng();
    const fl = document.getElementById('f-lat');
    const fg = document.getElementById('f-lng');
    const latlbl = document.getElementById('latlbl');
    const lnglbl = document.getElementById('lnglbl');
    if (fl && fg){ fl.value = ll.lat; fg.value = ll.lng; }
    if (latlbl && lnglbl){ latlbl.textContent = ll.lat.toFixed(5); lnglbl.textContent = ll.lng.toFixed(5); }
    });
}

/* Export / Import */
function download(filename, text){ 
    const blob = new Blob([text], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0); }


function toGeoJSON(arr){
    return {
    type: 'FeatureCollection',
    features: arr.map(p => ({
        type:'Feature',
        geometry:{ type:'Point', coordinates:[p.lng, p.lat] },
        properties:{
        id:p.id, title:p.title, placeName:p.placeName, body:p.body,
        photo:p.photo, createdAt:p.createdAt, updatedAt:p.updatedAt,
        // dates
        dateMode:p.dateMode, dateStart:p.dateStart, dateEnd:p.dateEnd, dateText:p.dateText,
        // legacy display (kept for compatibility)
        date:p.date, color:p.color
        }
    }))
    };
}

function fromGeoJSON(fc){
    if (fc?.type !== 'FeatureCollection') return [];
    return (fc.features || [])
    .map(f => {
        const [lng, lat] = f.geometry?.coordinates || [null, null];
        const props = f.properties || {};
        return {
        id: props.id || ('p_'+Math.random().toString(36).slice(2)+Date.now().toString(36)),
        lat, lng,
        title: props.title || '',
        placeName: props.placeName || '',
        body: props.body || '',
        photo: props.photo || null,
        createdAt: props.createdAt || Date.now(),
        updatedAt: props.updatedAt || Date.now(),
        dateMode: props.dateMode,
        dateStart: props.dateStart,
        dateEnd: props.dateEnd,
        dateText: props.dateText,
        date: props.date || '',
        color: props.color || DEFAULT_COLOR,
        };
    })
    .map(migratePost) // <-- coerce here
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}



const dataSel = document.getElementById('data-select');
if (dataSel) {
    const resetDataSelect = () => { dataSel.value = ''; };

    dataSel.addEventListener('change', (e) => {
        const v = e.target.value;
        if (v === 'export') {
        download('map-blog-posts.json', JSON.stringify(posts, null, 2));
        resetDataSelect();
        } else if (v === 'exportgeo') {
        download('map-blog-posts.geojson', JSON.stringify(toGeoJSON(posts), null, 2));
        resetDataSelect();
        } else if (v === 'import') {

        // open file picker; your existing #file-import change handler does the work
            document.getElementById('file-import')?.click();
        // reset the select immediately so the same choice can be made again later
            setTimeout(resetDataSelect, 0);
        }
});
}

let rezT;
window.addEventListener('resize', () => {
    clearTimeout(rezT);
    rezT = setTimeout(refocusCurrent, 120);
});


document.getElementById('file-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; 
    if (!file) return; 
    
    const text = await file.text(); 
    let incoming;
    try { incoming = JSON.parse(text); } 
    catch { alert('Invalid JSON file'); return; }

    let newPosts = Array.isArray(incoming)
    ? incoming.map(migratePost).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    : fromGeoJSON(incoming);

    if (!Array.isArray(newPosts) || !newPosts.length) { alert('No posts found in file'); return; }

    const replace = confirm('Replace existing posts with imported file? (Cancel = merge)');
    if (replace) {
    posts = newPosts;
    } else { 
    const byId = new Map(posts.map(p => [p.id, p])); 
    for (const p of newPosts) byId.set(p.id, p); 
    posts = Array.from(byId.values()); }
    savePosts(posts); 
    renderAllMarkers(); 
    e.target.value='';
});

/********* ADD MODE (prevents accidental markers) *********/
let addMode = false;

function setAddMode(on, { preserveTemp = false } = {}) {
    addMode = !!on;

    if (!on && !preserveTemp) clearTempMarker();

    const btnAdd = document.getElementById('btn-add');
    if (btnAdd){
    btnAdd.setAttribute('aria-pressed', String(addMode));
    btnAdd.textContent = addMode ? 'Exit' : 'Add Post';
    btnAdd.title = addMode ? 'Exit add mode (Esc)' : 'Click to place a new post on the map';
    }

    app.classList.toggle('app-add-mode', addMode);

    if (addMode){
    modeCue.textContent = 'Add mode: click the map to place. Click Exit or press Esc to exit add mode.';
    modeCue.style.opacity = 1;
    setTimeout(()=>{ modeCue.style.opacity = 0.9; }, 0);
    updateTempMarkerColor();
    } else {
    modeCue.style.opacity = 0;
    }
}

function toggleAddMode(){ setAddMode(!addMode); }
function cancelAddMode(opts){ setAddMode(false, opts); }


// Map click → only when addMode is true
map.on('click', (e) => { 
    if (!addMode) return; 
    makeTempMarker(e.latlng.lat, e.latlng.lng); 
    openNewPostForm(e.latlng);
    cancelAddMode({ preserveTemp: true });
    });

// Geocoder → always opens add form explicitly (opt-in)
L.Control.geocoder({ defaultMarkGeocode:false }).on('markgeocode', (e) => {
    map.fitBounds(e.geocode.bbox);
    const c = e.geocode.center;
    setAddMode(true);
    makeTempMarker(c.lat, c.lng);
    openNewPostForm(c, e.geocode.name);
    cancelAddMode({ preserveTemp: true }); // <- add this line
    const pulse = L.circleMarker(c, { radius:8, weight:2, fillOpacity:0, color:'#111' }).addTo(map).bringToFront();
    setTimeout(()=>{ map.removeLayer(pulse); }, 1200);
}).addTo(map);


// Esc closes panel and exits add mode
// document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape'){ closePanel(); cancelAddMode(); } if (e.key.toLowerCase() === 'a'){ toggleAddMode(); } });

// Trying to rewire the esc and a keys so that they don't unintentially toggle add mode when you are typing a post
function isFormField(el){
    return el &&
    (el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable);
}

document.addEventListener('keydown', (e) => {
    // ignore shortcuts while typing in any form control
    if (isFormField(e.target)) return;

    if (e.key === 'Escape') {
    closePanel();
    cancelAddMode();
    }

    if (e.key.toLowerCase() === 'a') {
    e.preventDefault();
    toggleAddMode();
    }
});



// Topbar controls
document.getElementById('btn-add').addEventListener('click', toggleAddMode);
document.getElementById('btn-list').addEventListener('click', () => openPostList());
document.getElementById('global-search').addEventListener('keydown', (e) => { if (e.key === 'Enter'){ openPostList(e.target.value.trim()); }});


/********* POST LIST (search/sort + jump) *********/
function getSortedFilteredPosts(q){
    const query = (q||'').toLowerCase();
    const sortVal = sortState;

    let arr = posts.slice();
    if (query){
    arr = arr.filter(p => {
        const {title, place, text, date} = fmt(p);
        const hay = (title + ' ' + place + ' ' + text + ' ' + date + ' ' + (p.dateText||'') + ' ' + (p.dateStart||'') + ' ' + (p.dateEnd||'')).toLowerCase();
        return hay.includes(query);
    });
    }
    const byTitle = (a,b) => fmt(a).title.localeCompare(fmt(b).title);
    const byPlace = (a,b) => fmt(a).place.localeCompare(fmt(b).place);
    const byDateDesc = (a,b) => getDateSortKey(b, /*asc=*/false) - getDateSortKey(a, /*asc=*/false);
    const byDateAsc  = (a,b) => getDateSortKey(a, /*asc=*/true)  - getDateSortKey(b, /*asc=*/true);
    if (sortVal === 'title_asc') arr.sort(byTitle);
    else if (sortVal === 'place_asc') arr.sort(byPlace);
    else if (sortVal === 'date_asc') arr.sort(byDateAsc);
    else arr.sort(byDateDesc);
    return arr;
}

function openPostList(initialQuery=''){
    const listHTML = `
    <div class="list-toolbar">
        <input id="list-search" type="search" placeholder="Search posts…" value="${escapeAttr(initialQuery)}" />
        <select id="list-sort">
        <option value="date_desc">Date (new → old)</option>
        <option value="date_asc">Date (old → new)</option>
        <option value="title_asc">Title (A→Z)</option>
        <option value="place_asc">Place (A→Z)</option>
        </select>
        <button class="btn" data-action="close">Close</button>
    </div>
    <div id="list-container" class="post-list"></div>
    `;
    openPanel(listHTML);
    // Sync dropdown with topbar selection
    const ls = document.getElementById('list-sort');
    ls.value = sortState;

    function renderList(){
    const q = document.getElementById('list-search').value.trim();
    const arr = getSortedFilteredPosts(q);
    const box = document.getElementById('list-container');
    if (!arr.length){ box.innerHTML = '<div class="meta">No posts match.</div>'; return; }
    box.innerHTML = arr.map(p => {
        const f = fmt(p);
        const tint = hexToRgba(p.color || DEFAULT_COLOR, 0.12); // soft background
        const meta = [escapeHTML(f.place), escapeHTML(f.date)].filter(Boolean).join(', ');
        return `<button class="post-item" data-id="${p.id}" style="--cardBg:${tint}">
        <h3>${escapeHTML(f.title || 'Untitled')}</h3>
        <p class="meta">${meta}</p>
        </button>`;
    }).join('');

    }
    renderList();

    document.getElementById('list-search').addEventListener('input', renderList);
    document.getElementById('list-sort').addEventListener('change', (e)=>{
    sortState = e.target.value;
    localStorage.setItem('mb_sort', sortState);
    renderList();
    });

    document.getElementById('list-container').addEventListener('click', (e)=>{
    const btn = e.target.closest('button.post-item'); if (!btn) return;
    const p = getPostById(btn.dataset.id); if (!p) return;
    // jump map and open the post
    // map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 8), { duration: 0.6 });
    openPostView(p);
    });
}

window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('post');
    suppressHistory = true;
    clearTempMarker();
    if (!id) { closePanel(); currentPostId = null; }
    else {
    const p = getPostById(id);
    if (p) openPostView(p); else closePanel();
    }
    suppressHistory = false;
});

// Mobile controls below:
// Wire up once
/* ===== Mobile controls (FABs & add bar) ===== */
const fabAdd     = document.getElementById('fabAdd');
const fabPosts   = document.getElementById('fabPosts');
const gpsBtn     = document.getElementById('gpsBtn');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn  = document.getElementById('cancelBtn');

fabAdd.onclick = () => {
    closePanel();          // hide sheet if open
    setAddMode(true);      // shows crosshair + add bar via CSS
};

cancelBtn.onclick = () => {
    cancelAddMode();       // your helper toggles .app-add-mode off and clears temp
};

confirmBtn.onclick = () => {
    const c = map.getCenter();
    makeTempMarker(c.lat, c.lng); // optional visual pin before form
    openNewPostForm(c);           // <-- open the form at the center
    cancelAddMode({ preserveTemp: true});
};

gpsBtn.onclick = () => {
    map.locate({ setView: true, maxZoom: 18 });
};

fabPosts.onclick = () => {
    cancelAddMode();
    openPostList();        // <-- use your existing list/sheet opener
};

// --- Fit-to-posts helpers ---
function getPostsBounds(list = posts) {
    let b = null;
    for (const p of list) {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const ll = L.latLng(lat, lng); // no wrap needed with noWrap tiles
    b = b ? b.extend(ll) : L.latLngBounds(ll, ll);
    }
    return b;
}


/**
 * Fit map to all posts.
 * @param {Object} opts
 * @param {number[]} opts.pad  [x,y] px padding around bounds
 * @param {number}  opts.maxZoom cap the zoom-in level when fitting
 * @returns {boolean} true if fitted, false if no valid posts
 */
function fitToPosts(opts = {}) {
    const { pad = [40, 40], maxZoom = 8 } = opts;
    const b = getPostsBounds(posts);
    if (!b || !b.isValid()) return false;

    // If only one point (or identical points), set a reasonable zoom
    if (b.getNorthEast().equals(b.getSouthWest())) {
    map.setView(b.getCenter(), Math.min(maxZoom, map.getMaxZoom() || 18));
    } else {
    map.fitBounds(b, { padding: L.point(pad[0], pad[1]), maxZoom });
    }
    return true;
}

map.whenReady(() => {
    renderAllMarkers();
    const params = new URLSearchParams(location.search);
    const qid = params.get('post');
    if (qid) {
    const p = posts.find(x => x.id === qid);
    if (p) { map.setView([p.lat, p.lng], Math.max(map.getZoom(), 8)); openPostView(p); }
    else { params.delete('post'); history.replaceState(null, '', `${location.pathname}?${params.toString()}`); fitToPosts(); }
    } else {
    fitToPosts();
    }
});

// Badge: year + mode label (keep Leaflet/OSM attribution separate)
(function(){
    const y = document.getElementById('app-year');
    if (y) y.textContent = new Date().getFullYear();
  
    const modeEl = document.getElementById('badge-mode');
    if (modeEl) {
      const READONLY = new URLSearchParams(location.search).get('readonly') === '1';
      modeEl.textContent = READONLY ? 'Read-only demo' : 'Beta sandbox';
    }
  })();
  


