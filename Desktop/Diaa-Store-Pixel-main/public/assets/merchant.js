// ===== Merchant Dashboard Logic =====

let activeCDK = localStorage.getItem('activeCDK') || '';
let cdkData = null;
let currentTab = 'dashboard';
let orders = [];
let orderFilter = 'all';
let pricing = {};

const API = '/api/v1';

// ===== API Helper =====
async function api(endpoint, body = {}) {
    try {
        const res = await fetch(API + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cdkey: activeCDK, ...body })
        });
        return await res.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}


// ===== Create Account Modal =====
let _createdCDKCode = '';

function showCreateAccountModal() {
    const modal = document.getElementById('create-account-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('create-form-view').style.display = 'block';
    document.getElementById('create-success-view').style.display = 'none';
    document.getElementById('create-error').style.display = 'none';
    document.getElementById('create-name-input').value = '';
    setTimeout(() => document.getElementById('create-name-input').focus(), 100);
}

function hideCreateAccountModal() {
    const modal = document.getElementById('create-account-modal');
    if (modal) modal.style.display = 'none';
}

async function doCreateAccount() {
    const nameInput = document.getElementById('create-name-input');
    const name = nameInput.value.trim();
    const btn = document.getElementById('create-account-btn');
    const errEl = document.getElementById('create-error');
    errEl.style.display = 'none';
    if (!name || name.length < 2) { errEl.textContent = 'Enter at least 2 characters'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
        const res = await fetch('/api/create-cdk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (data.success) {
            _createdCDKCode = data.code;
            document.getElementById('created-cdk-code').textContent = data.code;
            document.getElementById('create-form-view').style.display = 'none';
            document.getElementById('create-success-view').style.display = 'block';
        } else { errEl.textContent = data.error || 'Failed. Try a different name.'; errEl.style.display = 'block'; }
    } catch(e) { errEl.textContent = 'Network error. Try again.'; errEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = 'Create My Account';
}

function copyCreatedCDK() {
    if (_createdCDKCode) { navigator.clipboard.writeText(_createdCDKCode).catch(()=>{}); showToast('CDK key copied!', 'success'); }
}

function activateCreatedCDK() {
    if (!_createdCDKCode) return;
    hideCreateAccountModal();
    const inp = document.getElementById('cdk-input');
    if (inp) inp.value = _createdCDKCode;
    activeCDK = _createdCDKCode;
    activateCDK();
}

document.addEventListener('click', function(e) {
    const modal = document.getElementById('create-account-modal');
    if (modal && e.target === modal) hideCreateAccountModal();
});

// ===== Announcement =====
async function loadAnnouncement() {
    try {
        const res = await fetch('/api/announcement');
        const data = await res.json();
        const bar = document.getElementById('announcement-bar');
        const textEl = document.getElementById('announcement-text');
        const fixedBar = document.getElementById('announcement-fixed');
        const fixedTextEl = document.getElementById('announcement-fixed-text');

        // Scrolling announcement
        if (data.scrolling_enabled && data.text && data.text.trim()) {
            textEl.textContent = data.text;
            bar.className = 'announcement-bar';
            if (data.color && data.color !== 'default') {
                bar.classList.add('color-' + data.color);
            }
            const speedMap = { slow: 0.55, normal: 0.35, fast: 0.18 };
            const multiplier = speedMap[data.speed] || 0.35;
            const duration = Math.max(8, data.text.length * multiplier);
            textEl.style.setProperty('--ann-duration', duration + 's');
            bar.style.display = 'block';
        } else {
            bar.style.display = 'none';
        }

        // Fixed announcement
        if (data.fixed_enabled && data.fixed_text && data.fixed_text.trim()) {
            fixedTextEl.textContent = data.fixed_text;
            fixedBar.style.display = 'block';
        } else {
            fixedBar.style.display = 'none';
        }
    } catch(e) {}
}
// Only show announcements if no CDK stored (hero is visible)
if (!localStorage.getItem('activeCDK')) loadAnnouncement();

// ===== Site Info (Stock + Price + Branding) =====
let siteHasStock = true;

function applySiteInfo(data) {
    if (!data) return;
    window._siteInfo = data;
    siteHasStock = data.has_stock;
    const badge   = document.getElementById('stock-badge');
    const text    = document.getElementById('stock-text');
    const priceEl = document.getElementById('hero-price');
    const pointsAvailable = Math.floor((data.credits || 0) * 2);
    if (badge && text) {
        if (data.has_stock) {
            badge.className = 'stock-badge online';
            text.textContent = pointsAvailable + ' pts available';
        } else {
            badge.className = 'stock-badge offline';
            text.textContent = 'Out of Stock';
        }
    }
    if (priceEl && data.point_price != null) {
        priceEl.textContent = '$' + parseFloat(data.point_price).toFixed(2);
    }
    const b = data.branding || {};
    if (b.brand_name) {
        const brandEl = document.getElementById('nav-brand-text');
        if (brandEl) brandEl.innerHTML = b.brand_name + (b.brand_subtitle ? ' <span class="brand-sub">' + b.brand_subtitle + '</span>' : '');
    }
    if (b.hero_title)       { const el = document.getElementById('hero-title-main'); if (el) el.textContent = b.hero_title; }
    if (b.hero_subtitle)    { const el = document.getElementById('hero-title-sub');  if (el) el.textContent = b.hero_subtitle; }
    if (b.hero_description) { const el = document.getElementById('hero-desc');       if (el) el.textContent = b.hero_description; }
    if (b.logo_url) { document.querySelectorAll('.dragon-img,.hero-dragon-img,.hero-logo-img').forEach(img => img.src = b.logo_url); }
}

async function loadSiteInfo() {
    // Step 1: Show cached data INSTANTLY (zero delay on repeat visits)
    try {
        const cached = localStorage.getItem('_siteInfoCache');
        if (cached) applySiteInfo(JSON.parse(cached));
    } catch(e) {}
    // Step 2: Fetch fresh data in background
    try {
        const res  = await fetch('/api/site-info');
        const data = await res.json();
        localStorage.setItem('_siteInfoCache', JSON.stringify(data));
        applySiteInfo(data);
    } catch(e) {}
}
loadSiteInfo();
setInterval(loadSiteInfo, 60000);

// ===== Toast =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== CDK Activation =====
let _cdkDebounce = null;
function onCDKInput(e) {
    const val = (e.target.value || '').trim().toUpperCase();
    if (_cdkDebounce) clearTimeout(_cdkDebounce);
    if (val.length < 6) return;
    _cdkDebounce = setTimeout(() => activateCDK(val), 800);
}
async function activateCDK(codeOverride) {
    const input = document.getElementById('cdk-input');
    const code = (codeOverride || input.value || '').trim().toUpperCase();
    if (!code) return;


    const btn = document.getElementById('cdk-activate-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    const result = await api('/balance', { cdkey: code });

    if (result.success) {
        activeCDK = code;
        localStorage.setItem('activeCDK', code);
        cdkData = result;
        await loadDashboard();
    } else {
        showToast('Invalid or inactive CDK code. Please check and try again.', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `<span>Activate</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
}

// ===== Load Dashboard =====
async function loadDashboard() {
    document.getElementById('cdk-hero-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('active-cdk-display').textContent = activeCDK;

    // Hide announcements on dashboard
    const annBar = document.getElementById('announcement-bar');
    const fixedBar = document.getElementById('announcement-fixed');
    if (annBar) annBar.style.display = 'none';
    if (fixedBar) fixedBar.style.display = 'none';

    const [balanceRes, statsRes, ordersRes, pricingRes] = await Promise.all([
        api('/balance'),
        api('/stats'),
        api('/orders'),
        api('/pricing')
    ]);

    if (!balanceRes.success) {
        logout();
        showToast(t('msg_invalid_cdk'), 'error');
        return;
    }

    cdkData = { remaining: balanceRes.remaining_points ?? balanceRes.remaining_uses ?? 0 };
    if (statsRes.success) cdkData.stats = statsRes.stats;
    if (ordersRes.success) orders = ordersRes.orders || [];
    if (pricingRes.success) pricing = pricingRes.pricing || {};

    currentTab = getTabFromPath();
    // Fetch site info for full_activation_enabled flag
    fetch('/api/site-info').then(r=>r.json()).then(info=>{ window._siteInfo = info; }).catch(()=>{});
    renderUI();
    startPolling();
}

function logout() {
    stopPolling();
    activeCDK = '';
    localStorage.removeItem('activeCDK');
    cdkData = null;
    document.getElementById('cdk-hero-section').style.display = '';
    document.getElementById('dashboard-section').style.display = 'none';
    history.replaceState(null, '', '/');
    // Show announcements again
    loadAnnouncement();
}

// ===== Render UI =====
function renderUI() {
    renderNavbar();
    renderStats();
    renderTabs();
    renderTabContent();
}

function renderNavbar() {
    // English only — no language toggle
}

function renderStats() {
    const stats = cdkData?.stats || { total: 0, pending: 0, success: 0, failed: 0 };
    const remaining = cdkData?.remaining || 0;

    document.getElementById('stats-grid').innerHTML = `
        <div class="stat-card purple">
            <div class="stat-label">Remaining Points</div>
            <div class="stat-value">${remaining}</div>
            <div class="stat-bar"></div>
        </div>
        <div class="stat-card cyan">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">${stats.total || 0}</div>
            <div class="stat-bar"></div>
        </div>
        <div class="stat-card orange">
            <div class="stat-label">Pending / Running</div>
            <div class="stat-value">${stats.pending || 0}</div>
            <div class="stat-bar"></div>
        </div>
        <div class="stat-card green">
            <div class="stat-label">Success</div>
            <div class="stat-value">${stats.success || 0}</div>
            <div class="stat-bar"></div>
        </div>
        <div class="stat-card red">
            <div class="stat-label">Failed</div>
            <div class="stat-value">${stats.failed || 0}</div>
            <div class="stat-bar"></div>
        </div>
    `;
}

function renderTabs() {
    const tabs = ['dashboard', 'submit', 'orders', 'deposit', 'settings'];
    const labels = { dashboard: 'Dashboard', submit: 'Submit', orders: 'Orders', deposit: 'Deposit', settings: 'Settings' };
    const icons  = { dashboard: '📊', submit: '📝', orders: '📋', deposit: '💳', settings: '⚙️' };
    document.getElementById('dashboard-tabs').innerHTML = tabs.map(tab =>
        `<button class="tab ${tab === currentTab ? 'active' : ''}" onclick="switchTab('${tab}')">${icons[tab]} ${labels[tab]}</button>`
    ).join('');
}

function switchTab(tab) {
    currentTab = tab;
    history.replaceState(null, '', '/' + tab);
    renderTabs();
    renderTabContent();
}

// Handle URL routing on load
function getTabFromPath() {
    const path = window.location.pathname.replace('/', '').toLowerCase();
    const validTabs = ['dashboard', 'submit', 'orders', 'deposit', 'settings'];
    return validTabs.includes(path) ? path : 'dashboard';
}

function renderTabContent() {
    const c = document.getElementById('tab-content');
    switch (currentTab) {
        case 'dashboard': c.innerHTML = renderDashboardTab(); break;
        case 'submit':    c.innerHTML = renderSubmitTab();    break;
        case 'orders':    c.innerHTML = renderOrdersTab();    break;
        case 'deposit':   c.innerHTML = renderDepositTab();   break;
        case 'settings':  c.innerHTML = renderSettingsTab();  break;
        default: switchTab('dashboard');
    }
}

// ===== Dashboard Tab =====
function renderDashboardTab() {
    const recent = orders.slice(0, 10);
    const remaining = cdkData?.remaining || 0;
    return `
    <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(0,200,255,0.05),rgba(59,107,255,0.04));border-color:rgba(0,200,255,0.15);">
        <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:16px;">
                <div style="text-align:center;">
                    <div style="font-size:36px;font-weight:800;color:var(--cyan);line-height:1;">${remaining}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Remaining Points</div>
                </div>
                <div style="width:1px;height:40px;background:var(--border);"></div>
                <div style="font-size:12px;color:var(--text-secondary);">
                    <div>CDK: <code style="color:var(--cyan);">${activeCDK}</code></div>
                    <div style="margin-top:4px;">Each order costs <strong style="color:var(--cyan);">1 point</strong></div>
                </div>
            </div>
            <button class="btn btn-cyan btn-sm" onclick="checkMyBalance()" id="check-balance-btn" style="font-size:12px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Refresh Balance
            </button>
        </div>
    </div>
    ${recent.length === 0
        ? `<div class="card"><div class="card-body"><div class="empty-state"><div class="icon">📋</div><p>No orders yet. Go to Submit tab to get started!</p></div></div></div>`
        : `<div class="card"><div class="card-header"><h3>Recent Orders</h3><button class="btn btn-ghost btn-sm" onclick="refreshData()">🔄 Refresh</button></div><div class="card-body"><div class="table-wrapper">${renderOrderTable(recent)}</div></div></div>`
    }`;
}

async function checkMyBalance() {
    const btn = document.getElementById('check-balance-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
    const result = await api('/check-balance', { cdkey: activeCDK });
    if (result.success) {
        cdkData.remaining = result.remaining_points;
        renderStats();
        renderTabContent();
        showToast(`✅ Balance: ${result.remaining_points} points`, 'success');
    } else {
        showToast('Failed to check balance', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh Balance'; }
}

// ===== Submit Tab =====
// Stored selected task type (default: extract)
let selectedTaskType = 'extract';

function renderSubmitTab() {
    const remaining = cdkData?.remaining || 0;
    const hasBalance = remaining >= 1;
    const fullEnabled = window._siteInfo?.full_activation_enabled || false;
    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

        <!-- Single Submit -->
        <div class="card">
            <div class="card-header">
                <div><h3>New Order</h3><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">1 point per account</div></div>
                <div style="text-align:right;"><div style="font-size:24px;font-weight:800;color:${hasBalance?'var(--cyan)':'var(--red)'}">${remaining}</div><div style="font-size:10px;color:var(--text-muted);">pts left</div></div>
            </div>
            <div class="card-body">
                ${!hasBalance ? '<div style="padding:10px 14px;border-radius:8px;background:rgba(255,68,102,0.08);border:1px solid rgba(255,68,102,0.2);margin-bottom:14px;font-size:12px;color:var(--red);">❌ No points. Go to <strong>Deposit</strong> tab to top up.</div>' : ''}

                <!-- Task Type Selector -->
                <div style="margin-bottom:18px;">
                    <label style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:8px;">Activation Type</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">

                        <!-- Extract Link -->
                        <div class="task-type-card ${selectedTaskType==='extract'?'selected':''}" onclick="selectTaskType('extract')" id="type-extract">
                            <div class="task-type-icon">🔗</div>
                            <div>
                                <div class="task-type-label">Extract Link</div>
                                <div class="task-type-desc">Activation link only</div>
                            </div>
                            <div class="task-type-check" id="check-extract">${selectedTaskType==='extract'?'✓':''}</div>
                        </div>

                        <!-- Full Activation -->
                        <div class="task-type-card ${selectedTaskType==='full'?'selected':''} ${!fullEnabled?'disabled':''}"
                             onclick="${fullEnabled?'selectTaskType(\'full\')':'showToast(\'⛔ Full Activation is currently disabled by admin\',\'error\')'}"
                             id="type-full" title="${!fullEnabled?'Full Activation is disabled by admin':''}">
                            <div class="task-type-icon">${fullEnabled?'⚡':'🚫'}</div>
                            <div>
                                <div class="task-type-label" style="color:${!fullEnabled?'var(--text-muted)':''}">Full Activation</div>
                                <div class="task-type-desc">${fullEnabled?'Link + Visa binding':'Currently disabled'}</div>
                            </div>
                            <div class="task-type-check" id="check-full">${selectedTaskType==='full'?'✓':''}</div>
                        </div>

                    </div>
                </div>

                <div class="form-group"><label>Gmail Address</label><input type="email" class="form-control" id="submit-email" placeholder="example@gmail.com" style="font-size:14px;"></div>
                <div class="form-group"><label>Password</label><input type="text" class="form-control" id="submit-password" placeholder="Enter password" style="font-size:14px;"></div>
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:6px;">2FA Secret <span style="color:var(--text-muted);font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></label>
                    <input type="text" class="form-control" id="submit-twofa" placeholder="JBSWY3DPEHPK3PXP" style="font-size:13px;font-family:'JetBrains Mono',monospace;letter-spacing:1px;">
                    <div style="font-size:11px;color:var(--text-muted);margin-top:5px;">🔒 Leave empty if the account has no 2FA</div>
                </div>

                <button class="btn btn-primary" onclick="submitOrder()" id="submit-btn" style="width:100%;padding:14px;font-size:15px;font-weight:700;" ${!hasBalance?'disabled':''}>
                    ⚡ Submit Order
                </button>
            </div>
        </div>

        <!-- Bulk Import -->
        <div class="card">
            <div class="card-header">
                <div><h3>Bulk Import</h3><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Process many accounts at once</div></div>
                <span style="font-size:11px;color:var(--cyan);font-weight:700;background:rgba(0,200,255,0.08);padding:3px 10px;border-radius:20px;">1 pt each</span>
            </div>
            <div class="card-body">
                <!-- Bulk Task Type Selector -->
                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:6px;">Task Type</label>
                    <div style="display:flex;gap:6px;">
                        <button class="bulk-type-btn ${selectedTaskType==='extract'?'bulk-active':''}" onclick="selectTaskType('extract');document.querySelectorAll('.bulk-type-btn').forEach(b=>b.classList.remove('bulk-active'));this.classList.add('bulk-active')">🔗 Extract Link</button>
                        <button class="bulk-type-btn ${selectedTaskType==='full'&&fullEnabled?'bulk-active':''}" onclick="if(window._siteInfo?.full_activation_enabled){selectTaskType('full');document.querySelectorAll('.bulk-type-btn').forEach(b=>b.classList.remove('bulk-active'));this.classList.add('bulk-active');}else{showToast('⛔ Full Activation is disabled','error')}" ${!fullEnabled?'style="opacity:0.4;cursor:not-allowed;"':''}>⚡ Full Activation</button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Accounts <span style="color:var(--text-muted);font-weight:400;">(one per line)</span></label>
                    <textarea class="form-control" id="batch-input" rows="8" placeholder="email@gmail.com | password | 2fa_secret&#10;email2@gmail.com | password2&#10;email3@gmail.com | password3 | JBSWY3DP" style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;" oninput="updateBatchPreview()"></textarea>
                </div>
                <div id="batch-preview" style="font-size:12px;margin-bottom:12px;padding:8px 12px;background:rgba(0,0,0,0.2);border-radius:8px;display:none;"></div>
                <p style="font-size:11px;color:var(--text-muted);margin-bottom:14px;">Format: <code>email | password | 2fa</code> &nbsp;&mdash;&nbsp; 2FA is optional</p>
                <button class="btn btn-cyan" onclick="batchImport()" id="batch-btn" style="width:100%;padding:14px;font-size:15px;font-weight:700;">⚡ Start Bulk Import</button>
            </div>
        </div>

    </div>`;
}

function selectTaskType(type) {
    selectedTaskType = type;
    // Update extract card
    const extractCard = document.getElementById('type-extract');
    const fullCard    = document.getElementById('type-full');
    const checkExt    = document.getElementById('check-extract');
    const checkFull   = document.getElementById('check-full');
    if (extractCard) {
        extractCard.classList.toggle('selected', type === 'extract');
        if (checkExt) checkExt.textContent = type === 'extract' ? '✓' : '';
    }
    if (fullCard && !fullCard.classList.contains('disabled')) {
        fullCard.classList.toggle('selected', type === 'full');
        if (checkFull) checkFull.textContent = type === 'full' ? '✓' : '';
    }
}

function updateBatchPreview() {
    const text = document.getElementById('batch-input')?.value?.trim() || '';
    const preview = document.getElementById('batch-preview');
    if (!preview) return;
    if (!text) { preview.style.display = 'none'; return; }
    const lines = text.split('\n').filter(l => l.trim());
    const remaining = cdkData?.remaining || 0;
    const canProcess = Math.min(lines.length, remaining);
    preview.style.display = 'block';
    const color = canProcess >= lines.length ? 'var(--success)' : 'var(--amber)';
    preview.innerHTML = `<span style="color:var(--cyan);">&#128203; ${lines.length} account${lines.length>1?'s':''}</span> &nbsp;&middot;&nbsp; <span style="color:${color};">Can process: ${canProcess}/${lines.length}</span> &nbsp;&middot;&nbsp; <span style="color:var(--text-muted);">Cost: ${canProcess} pt${canProcess!==1?'s':''}</span>`;
}

// ===== Orders Tab =====
let selectedOrders = new Set();

function renderOrdersTab() {
    selectedOrders.clear();
    const statuses = ['all', 'pending', 'running', 'success', 'failed', 'cancelled'];
    const statusLabels = { all:'All', pending:'Pending', running:'Running', success:'Success', failed:'Failed', cancelled:'Cancelled' };
    const filtered = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
    const failedCount = orders.filter(o => o.status === 'failed').length;
    return `
    <div class="section-header">
        <h2>My Orders</h2>
        <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-ghost btn-sm" onclick="refreshData()">🔄 Refresh</button>
        </div>
    </div>
    <div class="tabs" style="border:none;margin-bottom:12px;">
        ${statuses.map(s => `<button class="tab ${s === orderFilter ? 'active' : ''}" onclick="filterOrders('${s}')">${statusLabels[s]}${s === 'failed' && failedCount ? ` (${failedCount})` : ''}</button>`).join('')}
    </div>
    <div id="orders-toolbar" style="display:none;margin-bottom:12px;padding:10px 16px;background:rgba(0,200,255,0.04);border:1px solid rgba(0,200,255,0.12);border-radius:12px;align-items:center;gap:10px;flex-wrap:wrap;">
        <span id="orders-selected-count" style="font-size:12px;color:var(--cyan);font-weight:700;min-width:90px;"></span>
        <button class="btn btn-ghost btn-sm" onclick="toggleSelectAll()" id="select-all-btn" style="font-size:11px;border-color:rgba(0,200,255,0.2);color:var(--cyan);">☑️ Select All</button>
        ${failedCount > 0 ? `<button class="btn btn-sm" style="background:rgba(255,184,0,0.1);color:var(--amber);border:1px solid rgba(255,184,0,0.25);font-size:11px;font-weight:600;" onclick="retryAllFailed()">🔄 Retry All Failed (${failedCount})</button>` : ''}
        <button class="btn btn-sm" style="background:rgba(0,200,255,0.08);color:var(--cyan);border:1px solid rgba(0,200,255,0.2);font-size:11px;font-weight:600;display:none;" id="retry-selected-btn" onclick="retrySelected()">🔄 Retry Selected</button>
        <button class="btn btn-sm" style="background:rgba(255,68,102,0.08);color:var(--red);border:1px solid rgba(255,68,102,0.2);font-size:11px;font-weight:600;display:none;" id="delete-selected-btn" onclick="deleteSelected()">🗑️ Delete Selected</button>
    </div>
    <div class="card">
        <div class="card-body">
            ${filtered.length === 0
                ? `<div class="empty-state"><div class="icon">📋</div><p>No orders yet. Submit your first order to get started!</p></div>`
                : `<div class="table-wrapper">${renderOrderTable(filtered)}</div>`}
        </div>
    </div>`;
}

function renderOrderTable(orderList) {
    return `<table><thead><tr>
        <th style="width:36px;"><input type="checkbox" id="select-all-checkbox" onchange="toggleSelectAll(this.checked)" style="cursor:pointer;width:16px;height:16px;"></th>
        <th>ID</th><th>Email</th><th>Status</th>
        <th>Type</th><th>Details</th><th>Time</th><th>Action</th>
    </tr></thead><tbody>
        ${orderList.map(o => `<tr id="order-row-${o.id}">
            <td><input type="checkbox" class="order-checkbox" data-id="${o.id}" data-status="${o.status}" onchange="onOrderCheckChange()" style="cursor:pointer;width:16px;height:16px;"></td>
            <td style="font-weight:600;color:var(--text-secondary);">#${o.id}</td>
            <td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.email}</td>
            <td><span class="badge badge-${o.status}">${o.status.toUpperCase()}</span></td>
            <td><span style="background:rgba(0,200,255,0.08);color:var(--cyan);padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;border:1px solid rgba(0,200,255,0.15);">${o.task_type}</span></td>
            <td style="max-width:240px;">${formatOrderDetails(o)}</td>
            <td style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${formatTime(o.created_at)}</td>
            <td style="white-space:nowrap;">${renderOrderActions(o)}</td>
        </tr>`).join('')}
    </tbody></table>`;
}

function onOrderCheckChange() {
    selectedOrders.clear();
    document.querySelectorAll('.order-checkbox:checked').forEach(cb => {
        selectedOrders.add(parseInt(cb.dataset.id));
    });
    updateToolbar();
}

function toggleSelectAll(checked) {
    if (checked === undefined) {
        // Toggle: if all selected, deselect all; otherwise select all
        const boxes = document.querySelectorAll('.order-checkbox');
        const allChecked = [...boxes].every(cb => cb.checked);
        checked = !allChecked;
    }
    document.querySelectorAll('.order-checkbox').forEach(cb => { cb.checked = checked; });
    const selectAllCb = document.getElementById('select-all-checkbox');
    if (selectAllCb) selectAllCb.checked = checked;
    onOrderCheckChange();
}

function updateToolbar() {
    const toolbar = document.getElementById('orders-toolbar');
    const countEl = document.getElementById('orders-selected-count');
    const retryBtn = document.getElementById('retry-selected-btn');
    const deleteBtn = document.getElementById('delete-selected-btn');
    if (!toolbar) return;

    toolbar.style.display = 'flex';

    if (selectedOrders.size > 0) {
        countEl.textContent = `${selectedOrders.size} selected`;
        // Check if any selected are retryable
        const retryable = [...selectedOrders].filter(id => {
            const o = orders.find(x => x.id === id);
            return o && ['failed', 'cancelled'].includes(o.status);
        });
        const deletable = [...selectedOrders].filter(id => {
            const o = orders.find(x => x.id === id);
            return o && ['success', 'failed', 'cancelled'].includes(o.status);
        });
        retryBtn.style.display = retryable.length > 0 ? '' : 'none';
        if (retryable.length > 0) retryBtn.textContent = `🔄 Retry Selected (${retryable.length})`;
        deleteBtn.style.display = deletable.length > 0 ? '' : 'none';
        if (deletable.length > 0) deleteBtn.textContent = `🗑️ Delete Selected (${deletable.length})`;
    } else {
        countEl.textContent = '';
        retryBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    }
}

function formatOrderDetails(order) {
    const msg = order.message || '';
    if (!msg) return '<span style="color:var(--text-muted);">—</span>';
    
    // Extract URL from message
    const urlMatch = msg.match(/(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : (order.offer_url || '');
    
    // Clean text (remove URL and Chinese prefix)
    let cleanMsg = msg.replace(/(https?:\/\/[^\s]+)/g, '').replace(/提取成功[:：]?\s*/g, '').trim();
    
    if (url) {
        // Show link as a nice compact element
        const domain = url.replace(/https?:\/\//, '').split('/')[0];
        const safeUrl = url.replace(/"/g, '&quot;');
        return `<div style="display:flex;flex-direction:column;gap:4px;">
            ${cleanMsg ? `<span style="font-size:11px;color:var(--success);font-weight:500;">✓ ${cleanMsg || 'Completed'}</span>` : '<span style="font-size:11px;color:var(--success);font-weight:500;">✓ Link Ready</span>'}
            <div style="display:flex;gap:4px;align-items:center;">
                <a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--accent-cyan-light);background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.12);padding:2px 8px;border-radius:6px;text-decoration:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${url}">🔗 ${domain}</a>
                <button class="copy-link-btn" data-url="${safeUrl}" onclick="copyOrderLink(this)" title="Copy Link" style="background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.2);border-radius:5px;color:#00e5a0;cursor:pointer;font-size:10px;padding:2px 6px;">📋</button>
            </div>
        </div>`;
    }
    
    // No URL - show clean message
    if (msg.length > 60) {
        return `<span style="font-size:11px;color:var(--text-secondary);" title="${msg.replace(/"/g, '&quot;')}">${msg.substring(0, 60)}…</span>`;
    }
    return `<span style="font-size:11px;color:var(--text-secondary);">${msg}</span>`;
}

function renderOrderActions(order) {
    let a = '';
    // Info button — always show (except retrying)
    if (order.status !== 'retrying') {
        const safeEmail = (order.email || '').replace(/'/g, "\\'");
        const safePass = (order.password || '').replace(/'/g, "\\'");
        const safe2fa = (order.twofa || '').replace(/'/g, "\\'");
        a += `<button class="btn btn-ghost btn-sm" onclick="showOrderInfo('${safeEmail}','${safePass}','${safe2fa}', ${order.id})" title="Account Info" style="font-size:12px;">ℹ️</button>`;
    }
    if (order.status === 'retrying') {
        a += `<span style="font-size:11px;color:var(--accent-amber);"><div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:4px;border-top-color:var(--accent-amber);"></div></span>`;
    }
    if (['failed', 'cancelled'].includes(order.status)) a += `<button class="btn btn-sm" style="background:linear-gradient(135deg,rgba(251,146,60,0.15),rgba(245,158,11,0.1));color:#fbbf24;border:1px solid rgba(251,146,60,0.25);font-size:11px;font-weight:600;" onclick="retryOrder(${order.id})" title="Retry">🔄</button>`;
    if (order.status === 'pending') a += `<button class="btn btn-danger btn-sm" onclick="cancelOrder(${order.id})">${t('cancel_btn')}</button>`;
    if (order.has_offer_url && order.status === 'failed') a += `<button class="btn btn-cyan btn-sm" onclick="purchaseLink(${order.id})">${t('buy_link')}</button>`;
    if (order.offer_url && order.status === 'success') a += `<button class="btn btn-sm" style="background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.2);font-size:12px;" onclick="copyText('${order.offer_url}')" title="Copy Link">📋</button>`;
    return a || '<span style="color:var(--text-muted);">—</span>';
}

function showOrderInfo(email, password, twofa, orderId) {
    // Remove existing modal if any
    const existing = document.getElementById('order-info-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'order-info-modal';
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
        <div class="modal" style="max-width:420px;">
            <div class="modal-header">
                <h3>📋 Account Info — Order #${orderId}</h3>
                <button class="modal-close" onclick="document.getElementById('order-info-modal').remove()">×</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">📧 Email</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <code style="flex:1;font-size:14px;color:var(--accent-cyan-light);word-break:break-all;">${email}</code>
                        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${email.replace(/'/g, "\\'")}');showToast('Copied!','success')" style="flex-shrink:0;">📋</button>
                    </div>
                </div>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">🔑 Password</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <code style="flex:1;font-size:14px;color:var(--accent-purple-light);word-break:break-all;">${password || '—'}</code>
                        ${password ? `<button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${password.replace(/'/g, "\\'")}');showToast('Copied!','success')" style="flex-shrink:0;">📋</button>` : ''}
                    </div>
                </div>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">🔐 2FA Secret</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <code style="flex:1;font-size:14px;color:var(--warning);word-break:break-all;">${twofa || '—'}</code>
                        ${twofa ? `<button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${twofa.replace(/'/g, "\\'")}');showToast('Copied!','success')" style="flex-shrink:0;">📋</button>` : ''}
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn btn-ghost" onclick="document.getElementById('order-info-modal').remove()">Close</button>
                <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${email.replace(/'/g, "\\'")}|${password.replace(/'/g, "\\'")}|${twofa.replace(/'/g, "\\'")}');showToast('All copied!','success')">📋 Copy All</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    // Close on overlay click
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ===== API Tab =====
function renderApiTab() {
    const baseUrl = window.location.origin + '/api/v1';
    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card">
            <div class="card-header"><h3>🔗 ${t('api_title')}</h3></div>
            <div class="card-body">
                <p style="color:var(--text-secondary);margin-bottom:20px;font-size:14px;line-height:1.7;">${t('api_description')}</p>
                <div class="form-group">
                    <label>${t('api_your_key')}</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <input class="form-control" value="${activeCDK}" readonly style="font-weight:700;color:var(--accent-purple-light);letter-spacing:1px;font-size:16px;">
                        <button class="btn btn-ghost btn-sm" onclick="copyText('${activeCDK}')">📋</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>${t('api_base_url')}</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <input class="form-control" value="${baseUrl}" readonly style="font-size:13px;font-family:monospace;">
                        <button class="btn btn-ghost btn-sm" onclick="copyText('${baseUrl}')">📋</button>
                    </div>
                </div>
                <a href="/docs" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;">📖 ${t('api_view_docs')}</a>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>💡 Quick Example</h3></div>
            <div class="card-body">
                <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:16px;font-size:12px;line-height:1.7;color:var(--text-primary);overflow-x:auto;">
<span style="color:var(--accent-cyan-light);">// Submit an order via API</span>
<span style="color:var(--accent-purple-light);">const</span> res = <span style="color:var(--accent-purple-light);">await</span> fetch(<span style="color:var(--success);">'${baseUrl}/submit'</span>, {
  method: <span style="color:var(--success);">'POST'</span>,
  headers: { <span style="color:var(--success);">'Content-Type'</span>: <span style="color:var(--success);">'application/json'</span> },
  body: JSON.stringify({
    cdkey: <span style="color:var(--success);">'${activeCDK}'</span>,
    email: <span style="color:var(--success);">'user@gmail.com'</span>,
    password: <span style="color:var(--success);">'pass123'</span>,
    twofa: <span style="color:var(--success);">'SECRET'</span>,
    task_type: <span style="color:var(--success);">'full'</span>
  })
});
<span style="color:var(--accent-purple-light);">const</span> data = <span style="color:var(--accent-purple-light);">await</span> res.json();
console.log(data.order_id);</pre>
            </div>
        </div>
    </div>`;
}

// ===== Deposit Tab =====
function renderDepositTab() {
    setTimeout(loadDepositInfo, 200);
    const rate = depositRate || 1;
    const packages = [
        { pts: 5,   label: 'Starter' },
        { pts: 10,  label: 'Basic' },
        { pts: 20,  label: 'Standard' },
        { pts: 50,  label: 'Pro' },
        { pts: 100, label: 'Business' },
        { pts: 200, label: 'Enterprise' }
    ];
    const pkgHtml = packages.map(p => {
        const usdt = (p.pts * rate).toFixed(2);
        return `
        <button class="pkg-card" onclick="selectPackage(${p.pts})" id="pkg-${p.pts}" style="
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            padding:16px 12px;border-radius:12px;border:2px solid var(--border);
            background:var(--bg-card);cursor:pointer;transition:all 0.2s;gap:4px;
            font-family:inherit;
        ">
            <div style="font-size:22px;font-weight:900;color:var(--cyan);">${p.pts}</div>
            <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:1px;">points</div>
            <div style="width:100%;height:1px;background:var(--border);margin:6px 0;"></div>
            <div style="font-size:13px;font-weight:700;color:var(--success);">$${usdt}</div>
            <div style="font-size:10px;color:var(--text-muted);">USDT</div>
            <div style="font-size:10px;color:var(--accent-purple-light);margin-top:2px;">${p.label}</div>
        </button>`;
    }).join('');

    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
            <div class="card-header"><h3>&#128179; Top Up Points</h3></div>
            <div class="card-body">
                <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Select how many points you want to buy. Pay via <strong>Binance Pay</strong>.</p>

                <!-- Point Rate -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(52,211,153,0.05);border:1px solid rgba(52,211,153,0.15);border-radius:10px;margin-bottom:18px;">
                    <div style="font-size:12px;color:var(--text-muted);">Rate</div>
                    <div id="dep-rate-display" style="font-size:16px;font-weight:800;color:#34d399;">$${rate} <span style="font-size:11px;font-weight:400;color:var(--text-muted);">per point</span></div>
                </div>

                <!-- Package Grid -->
                <div id="dep-pkg-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
                    ${pkgHtml}
                </div>

                <!-- Custom amount -->
                <div style="padding:14px;background:rgba(0,0,0,0.2);border-radius:10px;border:1px solid var(--border);margin-bottom:16px;">
                    <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">Custom Points</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <input type="number" id="custom-pts" min="1" placeholder="e.g. 30"
                            style="flex:1;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;font-family:inherit;"
                            oninput="onCustomPts()">
                        <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;">= <span id="custom-usdt-display" style="color:var(--success);font-weight:700;">$0.00</span></div>
                    </div>
                </div>

                <!-- Summary -->
                <div id="dep-summary" style="display:none;padding:12px 16px;border-radius:10px;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.18);margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:13px;color:var(--text-secondary);">You will receive</div>
                            <div id="dep-sum-pts" style="font-size:24px;font-weight:900;color:var(--cyan);">10 points</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px;color:var(--text-secondary);">You pay</div>
                            <div id="dep-sum-usdt" style="font-size:24px;font-weight:900;color:var(--success);">$10.00</div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-primary" onclick="createDeposit()" id="deposit-btn" style="width:100%;padding:14px;font-size:15px;font-weight:700;" disabled>
                    &#128179; Pay with Binance
                </button>
            </div>
        </div>

        <!-- History -->
        <div class="card">
            <div class="card-header"><h3>History</h3><button class="btn btn-ghost btn-sm" onclick="loadDepositInfo()">&#8635; Refresh</button></div>
            <div class="card-body" id="deposit-history"><div class="empty-state"><div class="icon">&#128203;</div><p>Loading...</p></div></div>
        </div>
    </div>`;
}

let _selectedPts = 0;

function selectPackage(pts) {
    _selectedPts = pts;
    // Highlight selected
    document.querySelectorAll('.pkg-card').forEach(el => {
        el.style.borderColor = 'var(--border)';
        el.style.background = 'var(--bg-card)';
        el.style.boxShadow = 'none';
    });
    const sel = document.getElementById('pkg-' + pts);
    if (sel) {
        sel.style.borderColor = 'var(--cyan)';
        sel.style.background = 'rgba(0,200,255,0.05)';
        sel.style.boxShadow = '0 0 0 2px rgba(0,200,255,0.15)';
    }
    // Clear custom
    const customInput = document.getElementById('custom-pts');
    if (customInput) customInput.value = '';
    const customDisplay = document.getElementById('custom-usdt-display');
    if (customDisplay) customDisplay.textContent = '$0.00';
    updateDepositSummary(pts);
}

function onCustomPts() {
    const val = parseInt(document.getElementById('custom-pts').value) || 0;
    _selectedPts = val;
    const usdt = (val * (depositRate || 1)).toFixed(2);
    const display = document.getElementById('custom-usdt-display');
    if (display) display.textContent = val > 0 ? '$' + usdt : '$0.00';
    // Deselect packages
    document.querySelectorAll('.pkg-card').forEach(el => {
        el.style.borderColor = 'var(--border)';
        el.style.background = 'var(--bg-card)';
        el.style.boxShadow = 'none';
    });
    updateDepositSummary(val);
}

function updateDepositSummary(pts) {
    const summary = document.getElementById('dep-summary');
    const btn = document.getElementById('deposit-btn');
    if (!summary) return;
    if (pts > 0) {
        const usdt = (pts * (depositRate || 1)).toFixed(2);
        document.getElementById('dep-sum-pts').textContent = pts + ' points';
        document.getElementById('dep-sum-usdt').textContent = '$' + usdt;
        summary.style.display = 'block';
        if (btn) btn.disabled = false;
    } else {
        summary.style.display = 'none';
        if (btn) btn.disabled = true;
    }
}

let depositRate = 1;

let depositPayId = '';

async function loadDepositInfo() {
    const res = await api('/deposit/history');
    if (res.success) {
        depositRate = res.rate || 1;
        depositPayId = res.pay_id || '';
        window._depositHistory = res.deposits;

        // Update rate display in new UI
        const rateDisplay = document.getElementById('dep-rate-display');
        if (rateDisplay) rateDisplay.innerHTML = `$${depositRate} <span style="font-size:11px;font-weight:400;color:var(--text-muted);">per point</span>`;

        // Rebuild package grid with real rate
        const pkgGrid = document.getElementById('dep-pkg-grid');
        if (pkgGrid) {
            const packages = [
                { pts: 5, label: 'Starter' }, { pts: 10, label: 'Basic' },
                { pts: 20, label: 'Standard' }, { pts: 50, label: 'Pro' },
                { pts: 100, label: 'Business' }, { pts: 200, label: 'Enterprise' }
            ];
            pkgGrid.innerHTML = packages.map(p => {
                const usdt = (p.pts * depositRate).toFixed(2);
                return `<button class="pkg-card" onclick="selectPackage(${p.pts})" id="pkg-${p.pts}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;border-radius:12px;border:2px solid var(--border);background:var(--bg-card);cursor:pointer;transition:all 0.2s;gap:4px;font-family:inherit;">
                    <div style="font-size:22px;font-weight:900;color:var(--cyan);">${p.pts}</div>
                    <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:1px;">points</div>
                    <div style="width:100%;height:1px;background:var(--border);margin:6px 0;"></div>
                    <div style="font-size:13px;font-weight:700;color:var(--success);">$${usdt}</div>
                    <div style="font-size:10px;color:var(--text-muted);">USDT</div>
                    <div style="font-size:10px;color:var(--accent-purple-light);margin-top:2px;">${p.label}</div>
                </button>`;
            }).join('');
        }

        // Render deposit history
        const el = document.getElementById('deposit-history');
        if (!el) return;
        if (!res.deposits || res.deposits.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No deposits yet</p></div>';
        } else {
            el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Points</th><th>Amount</th><th>Status</th><th>Time</th><th>Action</th></tr></thead><tbody>
                ${res.deposits.map(d => `<tr class="deposit-row" data-trade="${d.trade_no}" style="cursor:pointer;">
                    <td style="font-weight:800;color:var(--cyan);">${d.points_credited} pts</td>
                    <td style="color:var(--success);font-weight:700;">$${parseFloat(d.amount_usdt).toFixed(2)}</td>
                    <td><span class="badge badge-${d.status === 'paid' ? 'success' : d.status === 'expired' || d.status === 'cancelled' || d.status === 'rejected' ? 'failed' : 'running'}">${d.status.toUpperCase()}</span></td>
                    <td style="font-size:11px;color:var(--text-muted);">${formatTime(d.created_at)}</td>
                    <td>${d.status === 'pending' ? `<button class="btn btn-danger btn-sm cancel-dep-btn" data-trade="${d.trade_no}">&#10006; Cancel</button>` : '—'}</td>
                </tr>`).join('')}
            </tbody></table></div>`;
            el.querySelectorAll('.cancel-dep-btn').forEach(btn => {
                btn.addEventListener('click', function(e) { e.stopPropagation(); cancelDeposit(this.dataset.trade); });
            });
            el.querySelectorAll('.deposit-row').forEach(row => {
                row.addEventListener('click', function() { viewDepositDetail(this.dataset.trade); });
            });
        }
    }
}

function viewDepositDetail(tradeNo) {
    const d = (window._depositHistory || []).find(x => x.trade_no === tradeNo);
    if (!d) return;
    const payId = depositPayId;
    const amt = parseFloat(d.amount_usdt).toFixed(2);
    const statusClass = d.status === 'paid' ? 'success' : d.status === 'expired' || d.status === 'cancelled' || d.status === 'rejected' ? 'failed' : 'running';

    document.getElementById('tab-content').innerHTML = `
    <div class="card" style="max-width:560px;margin:0 auto;">
        <div class="card-header"><h3>📋 Deposit #${d.id}</h3></div>
        <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Amount</div>
                    <div style="font-size:22px;font-weight:800;color:var(--success);">$${amt}</div>
                </div>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Points</div>
                    <div style="font-size:22px;font-weight:800;color:var(--accent-cyan-light);">${d.points_credited}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Note/Memo</div>
                    <div style="font-size:18px;font-weight:800;color:var(--accent-purple-light);letter-spacing:2px;">${d.note || '—'}</div>
                </div>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Status</div>
                    <div style="margin-top:4px;"><span class="badge badge-${statusClass}" style="font-size:14px;padding:6px 14px;">${d.status.toUpperCase()}</span></div>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Pay ID</div>
                <div style="font-size:16px;font-weight:700;color:var(--accent-purple-light);">${payId}</div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">Created: ${formatTime(d.created_at)}${d.paid_at ? ' · Paid: ' + formatTime(d.paid_at) : ''}</div>
            ${d.status === 'pending' ? `
            <div id="deposit-check-status" style="margin-bottom:12px;"></div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-ghost" onclick="switchTab('deposit')">← Back</button>
                <button class="btn btn-primary" id="ive-paid-btn" onclick="checkMyDeposit('${d.trade_no}')">✅ I've Paid — Check Now</button>
                <button class="btn btn-danger" onclick="cancelDeposit('${d.trade_no}')">✖ Cancel</button>
            </div>` : `
            <div style="display:flex;gap:8px;justify-content:center;">
                <button class="btn btn-ghost" onclick="switchTab('deposit')">← Back to Deposits</button>
            </div>`}
        </div>
    </div>`;
}

function updateDepPreview() {
    const el = document.getElementById('deposit-rate-info');
    const input = document.getElementById('deposit-amount');
    if (!el || !input) return;
    const amount = parseFloat(input.value) || 0;
    const points = Math.floor(amount / depositRate);
    el.innerHTML = `<span style="font-size:16px;font-weight:700;color:var(--accent-cyan-light);">${points}</span> points for <span style="font-weight:700;color:var(--success);">$${amount}</span> USDT <span style="font-size:11px;">(Price: $${depositRate}/pt)</span>`;
}

async function createDeposit() {
    if (!_selectedPts || _selectedPts <= 0) return showToast('Please select a point package first', 'error');
    const amount = parseFloat((_selectedPts * depositRate).toFixed(2));
    const btn = document.getElementById('deposit-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Processing...';
    const res = await api('/deposit', { amount });
    if (res.success) {
        const payId = res.pay_id || depositPayId;
        const exactAmount = parseFloat(res.amount_usdt).toFixed(2);
        const tradeNo = res.trade_no;
        const note = res.note || '';
        // Show payment instructions
        document.getElementById('tab-content').innerHTML = `
        <div class="card" style="max-width:560px;margin:0 auto;">
            <div class="card-header"><h3>💳 Complete Your Deposit</h3></div>
            <div class="card-body" style="text-align:center;">
                <p style="color:var(--text-secondary);margin-bottom:24px;font-size:14px;">Send the amount below via <strong>Binance Pay</strong> to complete your deposit.</p>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Send To (Binance Pay ID)</div>
                    <div style="font-size:22px;font-weight:800;color:var(--accent-purple-light);letter-spacing:2px;margin-bottom:8px;">${payId}</div>
                    <button class="btn btn-ghost btn-sm" onclick="copyText('${payId}')">📋 Copy ID</button>
                </div>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--success);border-radius:12px;padding:20px;margin-bottom:16px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Amount (USDT)</div>
                    <div style="font-size:28px;font-weight:900;color:var(--success);">$${exactAmount}</div>
                    <button class="btn btn-ghost btn-sm" onclick="copyText('${exactAmount}')">📋 Copy Amount</button>
                </div>
                <div style="background:rgba(138,43,226,0.1);border:1px solid rgba(138,43,226,0.4);border-radius:12px;padding:20px;margin-bottom:16px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">⚠️ Note / Memo (REQUIRED)</div>
                    <div style="font-size:24px;font-weight:900;color:var(--accent-purple-light);letter-spacing:3px;margin-bottom:8px;">${note}</div>
                    <button class="btn btn-ghost btn-sm" onclick="copyText('${note}')">📋 Copy Note</button>
                </div>
                <div style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;text-align:left;">
                    <div style="font-weight:700;color:var(--text-primary);margin-bottom:10px;font-size:13px;">📝 Transfer Steps:</div>
                    <ol style="color:var(--text-secondary);font-size:12px;line-height:2;margin:0;padding-left:18px;">
                        <li>Open <strong>Binance App</strong> → Pay → Send</li>
                        <li>Enter Pay ID: <strong style="color:var(--accent-purple-light);">${payId}</strong></li>
                        <li>Enter Amount: <strong style="color:var(--success);">$${exactAmount} USDT</strong></li>
                        <li>In the <strong>Note/Memo</strong> field, paste: <strong style="color:var(--accent-purple-light);">${note}</strong></li>
                        <li>Confirm and send the payment</li>
                        <li>Click <strong>"I've Paid"</strong> below to verify</li>
                    </ol>
                </div>
                <div style="background:rgba(255,200,0,0.08);border:1px solid rgba(255,200,0,0.3);border-radius:10px;padding:12px;margin-bottom:16px;">
                    <p style="color:var(--warning);font-size:12px;font-weight:600;margin:0;">⚠️ You MUST include the note <strong>${note}</strong> in your transfer. Without it, your payment won't be detected automatically.</p>
                </div>
                <div id="deposit-check-status" style="margin-bottom:12px;"></div>
                <div style="display:flex;gap:8px;justify-content:center;">
                    <button class="btn btn-ghost" onclick="switchTab('deposit')">← Back</button>
                    <button class="btn btn-primary" id="ive-paid-btn" onclick="checkMyDeposit('${tradeNo}')">✅ I've Paid — Check Now</button>
                </div>
            </div>
        </div>`;
        showToast('Deposit created! Follow the instructions to pay.', 'success');
    } else {
        showToast(res.error || 'Failed to create deposit', 'error');
    }
    btn.disabled = false;
    btn.textContent = '💳 Pay with Binance';
}

async function checkMyDeposit(tradeNo) {
    const btn = document.getElementById('ive-paid-btn');
    const status = document.getElementById('deposit-check-status');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 Checking...'; }
    if (status) status.innerHTML = '<p style="color:var(--warning);font-size:13px;">⏳ Checking Binance for your payment...</p>';
    
    const res = await api('/deposit/check', { trade_no: tradeNo });
    
    if (res.success && res.status === 'paid') {
        if (status) status.innerHTML = '<p style="color:var(--success);font-size:14px;font-weight:700;">✅ Payment confirmed! Points credited.</p>';
        showToast('Payment confirmed! Points added.', 'success');
        setTimeout(() => { refreshData(); switchTab('deposit'); }, 2000);
    } else if (res.success && res.status === 'pending') {
        if (status) status.innerHTML = '<p style="color:var(--warning);font-size:13px;">⏳ Payment not detected yet. Try again in a moment.</p>';
        if (btn) { btn.disabled = false; btn.textContent = '✅ I\'ve Paid — Check Again'; }
    } else {
        if (status) status.innerHTML = `<p style="color:var(--error);font-size:13px;">${res.error || 'Check failed'}</p>`;
        if (btn) { btn.disabled = false; btn.textContent = '✅ I\'ve Paid — Check Again'; }
    }
}

async function cancelDeposit(tradeNo) {
    console.log('[CANCEL] clicked, trade_no:', tradeNo);
    showToast('Cancelling...', 'info');
    try {
        const res = await api('/deposit/cancel', { trade_no: tradeNo });
        console.log('[CANCEL] response:', JSON.stringify(res));
        if (res.success) {
            showToast('Deposit cancelled', 'success');
            switchTab('deposit');
        } else {
            showToast(res.error || 'Failed to cancel', 'error');
        }
    } catch (err) {
        console.error('[CANCEL] error:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ===== Settings Tab =====
function renderSettingsTab() {
    const remaining = cdkData?.remaining || 0;
    setTimeout(loadWebhookUrl, 100);
    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><h3>🔔 Webhook</h3></div>
                <div class="card-body">
                    <p style="color:var(--text-secondary);margin-bottom:14px;font-size:13px;line-height:1.7;">
                        Receive real-time notifications when an order completes.
                    </p>
                    <div class="form-group">
                        <label>Webhook URL</label>
                        <input type="url" class="form-control" id="webhook-url" placeholder="https://your-bot.com/webhook">
                    </div>
                    <button class="btn btn-primary" onclick="saveWebhook()" style="width:100%;">💾 Save Webhook</button>
                </div>
            </div>
        </div>
        <div>
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><h3>🎟️ CDK Info</h3></div>
                <div class="card-body">
                    <div style="display:grid;gap:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.2);border-radius:10px;">
                            <span style="color:var(--text-secondary);font-size:13px;">CDK Code</span>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <code style="font-weight:700;color:var(--cyan);font-size:14px;letter-spacing:1px;">${activeCDK}</code>
                                <button onclick="copyText('${activeCDK}')" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:13px;" title="Copy">📋</button>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.2);border-radius:10px;">
                            <span style="color:var(--text-secondary);font-size:13px;">Remaining Points</span>
                            <span style="font-weight:900;color:var(--cyan);font-size:24px;">${remaining}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.2);border-radius:10px;">
                            <span style="color:var(--text-secondary);font-size:13px;">Cost per Order</span>
                            <span style="font-weight:700;color:var(--success);">1 Point</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <button class="btn btn-ghost" onclick="logout()" style="width:100%;">🚪 Change CDK / Logout</button>
                </div>
            </div>
        </div>
    </div>`;
}

async function loadWebhookUrl() {
    try {
        const res = await api('/settings');
        if (res.success && res.webhook_url) {
            const el = document.getElementById('webhook-url');
            if (el) el.value = res.webhook_url;
        }
    } catch(e) {}
}

// Dead functions cleanup (no-op stubs for removed service settings)
async function loadServiceSettings() {}
async function toggleOutOfStock() {}
async function toggleFullActivation() {}

// ===== Actions =====
async function submitOrder() {
    const email    = document.getElementById('submit-email').value.trim();
    const password = document.getElementById('submit-password').value.trim();
    const twofa    = (document.getElementById('submit-twofa')?.value || '').trim();
    if (!email || !password) { showToast('Email & Password are required', 'error'); return; }

    const remaining = cdkData?.remaining || 0;
    if (remaining < 1) {
        showToast('No points left! Go to Deposit tab to top up.', 'error');
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    const result = await api('/submit', { email, password, twofa, task_type: selectedTaskType || 'extract' });
    if (result.success) {
        showToast('✅ Order submitted!', 'success');
        cdkData.remaining = result.remaining_points ?? result.remaining_uses ?? cdkData.remaining;
        // Clear fields
        document.getElementById('submit-email').value = '';
        document.getElementById('submit-password').value = '';
        if (document.getElementById('submit-twofa')) document.getElementById('submit-twofa').value = '';
        await refreshData();
        switchTab('orders');
    } else {
        showToast(result.error || 'Submission failed', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '&#9889; Submit Order';
}

async function batchImport() {
    const text = document.getElementById('batch-input').value.trim();
    const task_type = selectedTaskType || 'extract';
    if (!text) return showToast('Paste at least one account', 'error');

    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return showToast('No valid accounts found', 'error');

    const remaining = cdkData?.remaining || 0;
    if (remaining < 1) {
        showToast('No points left! Go to Deposit tab to top up.', 'error');
        return;
    }
    const maxAccounts = Math.min(lines.length, remaining);
    const toProcess = lines.slice(0, maxAccounts);
    if (toProcess.length < lines.length) {
        showToast(`Only enough points for ${maxAccounts}/${lines.length} accounts.`, 'info');
    }

    let submitted = 0, failed = 0;
    const btn = document.querySelector('[onclick="batchImport()"]');
    if (btn) btn.disabled = true;

    for (let i = 0; i < toProcess.length; i++) {
        const line = toProcess[i].trim();
        if (!line) continue;
        // Smart delimiter
        let parts;
        if (line.includes('|'))        parts = line.split('|').map(p => p.trim());
        else if (line.includes(';'))   parts = line.split(';').map(p => p.trim());
        else if (line.includes(','))   parts = line.split(',').map(p => p.trim());
        else if (line.includes('\t')) parts = line.split('\t').map(p => p.trim());
        else if (line.includes('--')) parts = line.split(/--+/).map(p => p.trim());
        else                          parts = line.split(/\s{2,}/).map(p => p.trim());
        parts = parts.filter(p => p.length > 0);
        if (parts.length < 2) { failed++; continue; }
        const [email, password, twofa] = parts;

        // Update progress
        if (btn) btn.textContent = `📥 Processing ${i+1}/${toProcess.length}...`;
        const preview = document.getElementById('batch-preview');
        if (preview) preview.innerHTML = `<span style="color:var(--cyan);">Processing ${i+1}/${toProcess.length}: ${email}</span>`;

        const result = await api('/submit', { email, password, twofa: twofa || '', task_type: 'extract' });
        if (result.success) {
            submitted++;
            if (result.remaining_uses !== undefined) cdkData.remaining = result.remaining_uses;
        } else {
            failed++;
        }
    }

    const preview = document.getElementById('batch-preview');
    if (preview) preview.innerHTML = `<span style="color:var(--success);">Done: ${submitted} submitted, ${failed} failed</span>`;
    showToast(`${submitted}/${toProcess.length} orders submitted` + (failed ? ` (${failed} failed)` : ''), submitted > 0 ? 'success' : 'error');
    if (btn) { btn.disabled = false; btn.textContent = '📥 Start Bulk Import'; }
    await refreshData();
}

async function cancelOrder(orderId) {
    const result = await api('/cancel', { order_id: orderId });
    if (result.success) { showToast(t('msg_cancelled'), 'success'); cdkData.remaining = result.remaining_uses; await refreshData(); }
    else showToast(result.error || t('msg_error'), 'error');
}

async function purchaseLink(orderId) {
    const result = await api('/purchase_link', { order_id: orderId });
    if (result.success) { showToast(t('msg_link_bought'), 'success'); copyText(result.offer_url); await refreshData(); }
    else showToast(result.error || t('msg_error'), 'error');
}

async function retryOrder(orderId) {
    showToast('Retrying...', 'info');
    const result = await api('/retry', { order_id: orderId });
    if (result.success) {
        showToast(`Order #${orderId} retried successfully!`, 'success');
        cdkData.remaining = result.remaining_uses;
        await refreshData();
    } else {
        showToast(result.error || 'Retry failed', 'error');
        await refreshData();
    }
}

async function retryAllFailed() {
    const failedOrders = orders.filter(o => o.status === 'failed');
    if (failedOrders.length === 0) return showToast('No failed orders to retry', 'error');
    if (!confirm(`Retry ${failedOrders.length} failed order(s)? This will charge points for each.`)) return;
    showToast(`Retrying ${failedOrders.length} orders...`, 'info');
    let success = 0, fail = 0;
    for (const o of failedOrders) {
        const result = await api('/retry', { order_id: o.id });
        if (result.success) { success++; cdkData.remaining = result.remaining_uses; }
        else fail++;
    }
    showToast(`Retried ${success}/${failedOrders.length}` + (fail ? ` (${fail} failed)` : ''), success > 0 ? 'success' : 'error');
    await refreshData();
}

async function retrySelected() {
    const retryable = [...selectedOrders].filter(id => {
        const o = orders.find(x => x.id === id);
        return o && ['failed', 'cancelled'].includes(o.status);
    });
    if (retryable.length === 0) return showToast('No retryable orders selected', 'error');
    if (!confirm(`Retry ${retryable.length} order(s)? This will charge points for each.`)) return;
    showToast(`Retrying ${retryable.length} orders...`, 'info');
    let success = 0, fail = 0;
    for (const id of retryable) {
        const result = await api('/retry', { order_id: id });
        if (result.success) { success++; cdkData.remaining = result.remaining_uses; }
        else fail++;
    }
    showToast(`Retried ${success}/${retryable.length}` + (fail ? ` (${fail} failed)` : ''), success > 0 ? 'success' : 'error');
    await refreshData();
}

async function deleteSelected() {
    const deletable = [...selectedOrders].filter(id => {
        const o = orders.find(x => x.id === id);
        return o && ['success', 'failed', 'cancelled'].includes(o.status);
    });
    if (deletable.length === 0) return showToast('No deletable orders selected (only completed orders can be deleted)', 'error');
    if (!confirm(`Delete ${deletable.length} order(s) from history? This cannot be undone.`)) return;
    showToast('Deleting...', 'info');
    const result = await api('/delete-orders', { order_ids: deletable });
    if (result.success) {
        showToast(`Deleted ${result.deleted} order(s)`, 'success');
        await refreshData();
    } else {
        showToast(result.error || 'Delete failed', 'error');
    }
}

async function saveWebhook() {
    const url = document.getElementById('webhook-url').value.trim();
    const result = await api('/webhook', { webhook_url: url });
    if (result.success) showToast(t('msg_webhook_saved'), 'success');
    else showToast(result.error || t('msg_error'), 'error');
}

async function refreshData() {
    const [b, s, o] = await Promise.all([api('/balance'), api('/stats'), api('/orders')]);
    if (b.success) cdkData.remaining = b.remaining_points ?? b.remaining_uses ?? cdkData.remaining;
    if (s.success) cdkData.stats = s.stats;
    if (o.success) orders = o.orders || [];
    renderStats();
    // Don't re-render submit or deposit tabs — user might be typing/selecting
    if (currentTab !== 'submit' && currentTab !== 'deposit') {
        renderTabContent();
    }
}

function filterOrders(status) { orderFilter = status; renderTabContent(); }

// ===== Real-Time Polling =====
let _pollingTimer = null;
function startPolling() {
    if (_pollingTimer) return;
    _pollingTimer = setInterval(async () => {
        if (!activeCDK || !cdkData) return;
        const [b, s, o] = await Promise.all([api('/balance'), api('/stats'), api('/orders')]);
        let changed = false;
        if (b.success) {
            const newPts = b.remaining_points ?? b.remaining_uses ?? cdkData.remaining;
            if (newPts !== cdkData.remaining) { cdkData.remaining = newPts; changed = true; }
        }
        if (s.success) { cdkData.stats = s.stats; changed = true; }
        if (o.success) {
            const newOrders = o.orders || [];
            // Check if any order status changed
            const hasChange = newOrders.some(no => {
                const old = orders.find(x => x.id === no.id);
                return !old || old.status !== no.status || old.message !== no.message || old.offer_url !== no.offer_url;
            });
            if (hasChange || newOrders.length !== orders.length) {
                orders = newOrders;
                if (currentTab === 'orders') renderTabContent();
                changed = true;
            }
        }
        if (changed) renderStats();
    }, 10000); // every 10 seconds
}
function stopPolling() { if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null; } }


// ===== Helpers =====
function formatTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
}

function copyOrderLink(btn) {
    const url = btn.getAttribute('data-url');
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
        showToast('✅ Link copied!', 'success');
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📋'; }, 2000);
    }).catch(() => showToast('Copy failed', 'error'));
}

// ===== Public CDK Creation =====
async function createPublicCDK() {
    // Check if already created one
    if (localStorage.getItem('cdk_created')) {
        const existingCode = localStorage.getItem('cdk_created');
        showToast(`You already created a CDK: ${existingCode}. Enter it above to activate.`, 'error');
        return;
    }

    const nameInput = document.getElementById('create-cdk-name');
    const name = nameInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name || name.length < 2) {
        showToast('Enter a name (at least 2 letters/numbers)', 'error');
        return;
    }

    const btn = document.getElementById('create-cdk-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        const res = await fetch('/api/create-cdk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();

        if (data.success) {
            // Save to localStorage to prevent creating another
            localStorage.setItem('cdk_created', data.code);
            
            // Show result
            const section = document.getElementById('create-cdk-section');
            section.innerHTML = `
                <div class="create-cdk-result">
                    <p style="font-size:13px;color:var(--success);font-weight:600;">✅ Your CDK has been created!</p>
                    <code>${data.code}</code>
                    <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
                        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${data.code}');showToast('Copied!','success')">📋 Copy</button>
                        <button class="btn btn-primary btn-sm" onclick="document.getElementById('cdk-input').value='${data.code}';activateCDK()">⚡ Activate Now</button>
                    </div>
                    <p class="hint">Save this code! You can deposit points after activating.</p>
                </div>`;
            
            showToast(`CDK created: ${data.code}`, 'success');
        } else {
            showToast(data.error || 'Failed to create CDK', 'error');
        }
    } catch (err) {
        showToast('Network error, try again', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<span>Create</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    if (currentLang === 'ar') {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
    }
    // Apply i18n to static elements
    setLang(currentLang);

    // Validate stored created CDK still exists on server
    const createSection = document.getElementById('create-cdk-section');
    const storedCreatedCDK = localStorage.getItem('cdk_created');
    if (createSection && storedCreatedCDK) {
        // Show it temporarily while checking
        createSection.innerHTML = `
            <div class="create-cdk-result">
                <p style="font-size:12px;color:var(--text-muted);">Your CDK</p>
                <code>${storedCreatedCDK}</code>
                <button class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="document.getElementById('cdk-input').value='${storedCreatedCDK}';activateCDK()">⚡ Activate</button>
            </div>`;
        // Verify it still exists on the server
        fetch('/api/v1/balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cdkey: storedCreatedCDK })
        }).then(r => r.json()).then(data => {
            if (!data.success) {
                // CDK was deleted — clear localStorage and restore create form
                localStorage.removeItem('cdk_created');
                createSection.innerHTML = `
                    <div class="create-cdk-divider"><span>or</span></div>
                    <div class="create-cdk-card" id="create-cdk-card">
                        <p class="create-cdk-label">Don't have a CDK? Create one with your name</p>
                        <div class="cdk-card-inner">
                            <input type="text" class="cdk-input" id="create-cdk-name" placeholder="Your Name" autocomplete="off" spellcheck="false" maxlength="12" style="text-transform:uppercase;">
                            <button class="cdk-btn create-cdk-btn" id="create-cdk-btn" onclick="createPublicCDK()">
                                <span>Create</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                        </div>
                    </div>`;
                // Re-attach Enter key listener
                const newInput = document.getElementById('create-cdk-name');
                if (newInput) newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createPublicCDK(); });
            }
        }).catch(() => {});
    }

    if (activeCDK) {
        document.getElementById('cdk-input').value = activeCDK;
        loadDashboard();
    }

    document.getElementById('cdk-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') activateCDK();
    });

    const createNameInput = document.getElementById('create-cdk-name');
    if (createNameInput) {
        createNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createPublicCDK();
        });
    }

    setInterval(() => { if (activeCDK && cdkData) refreshData(); }, 30000);
});
