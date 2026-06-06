const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const adminAuth = require('../middleware/adminAuth');
const db = require('../database/db');
const AiDoneClient = require('../services/aidone');
const { generateCDK, generateMultipleCDKs } = require('../services/cdkGenerator');

// ==================== AUTH ====================

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
    const admin = await db.getAdmin(username);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, username: admin.username });
});

router.post('/change-password', adminAuth, async (req, res) => {
    const { current_password, new_password } = req.body;
    const admin = await db.getAdminById(req.admin.id);
    if (!bcrypt.compareSync(current_password, admin.password_hash)) return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    const hash = bcrypt.hashSync(new_password, 10);
    await db.updateAdminPassword(hash, req.admin.id);
    res.json({ success: true, message: 'Password updated' });
});

// ==================== STATS ====================

router.get('/stats', adminAuth, async (req, res) => {
    const [orderStats, revenue, todayOrders, activeCDKs, sourceKeys, sourceBalance, merchantIssued, merchantRemaining, merchantUsed] = await Promise.all([
        db.getOrderStats(), db.getTotalRevenue(), db.getTodayOrders(), db.getActiveCDKCount(),
        db.getAllSourceCDKeys(), db.getTotalSourceBalance(), db.getTotalMerchantPointsIssued(),
        db.getTotalMerchantPointsRemaining(), db.getTotalMerchantPointsUsed()
    ]);
    res.json({ success: true, stats: {
        orders: orderStats, total_revenue: revenue.total_revenue, today_orders: todayOrders.count,
        active_cdks: activeCDKs.count, source_keys_count: sourceKeys.length, source_balance: sourceBalance.total,
        merchant_points_issued: merchantIssued.total, merchant_points_remaining: merchantRemaining.total,
        merchant_points_used: merchantUsed.total
    }});
});

router.get('/activity', adminAuth, async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await db.getRecentLogs(limit);
    res.json({ success: true, logs });
});

// ==================== SOURCE CDKEYS ====================

router.get('/source-cdkeys', adminAuth, async (req, res) => {
    const keys = await db.getAllSourceCDKeys();
    res.json({ success: true, cdkeys: keys });
});

router.post('/source-cdkeys', adminAuth, async (req, res) => {
    const { name, cdkey } = req.body;
    if (!name || !cdkey) return res.status(400).json({ success: false, error: 'Name and CDKey required' });
    try {
        const result = await db.insertSourceCDKey(name, cdkey);
        res.json({ success: true, id: result.id, message: 'Source CDKey added' });
    } catch (err) {
        if (err.message?.includes('duplicate') || err.code === '23505') return res.status(400).json({ success: false, error: 'This CDKey already exists' });
        throw err;
    }
});

router.post('/source-cdkeys/:id/check-balance', adminAuth, async (req, res) => {
    const key = await db.getSourceCDKey(req.params.id);
    if (!key) return res.status(404).json({ success: false, error: 'CDKey not found' });
    const result = await AiDoneClient.getBalance(key.cdkey);
    if (result.success) {
        await db.updateSourceCDKeyBalance(result.remaining_uses, key.id);
        return res.json({ success: true, balance: result.remaining_uses });
    }
    res.status(500).json({ success: false, error: result.error || 'Failed to check balance' });
});

router.post('/source-cdkeys/check-all', adminAuth, async (req, res) => {
    const keys = (await db.getAllSourceCDKeys()).filter(k => k.is_active);
    const results = [];
    for (const key of keys) {
        try {
            const result = await AiDoneClient.getBalance(key.cdkey);
            if (result.success) {
                await db.updateSourceCDKeyBalance(result.remaining_uses, key.id);
                results.push({ id: key.id, name: key.name, balance: result.remaining_uses, status: 'ok' });
            } else {
                results.push({ id: key.id, name: key.name, balance: key.cached_balance, status: 'error', error: result.error });
            }
        } catch (err) {
            results.push({ id: key.id, name: key.name, balance: key.cached_balance, status: 'error', error: err.message });
        }
    }
    res.json({ success: true, results, total_balance: results.reduce((s, r) => s + (r.balance || 0), 0) });
});

router.post('/source-cdkeys/:id/toggle', adminAuth, async (req, res) => {
    const key = await db.getSourceCDKey(req.params.id);
    if (!key) return res.status(404).json({ success: false, error: 'CDKey not found' });
    await db.toggleSourceCDKey(!key.is_active, key.id);
    res.json({ success: true, is_active: !key.is_active });
});

router.delete('/source-cdkeys/:id', adminAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    console.log('[DELETE] Attempting to delete source key:', id);
    
    const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve({ error: null }), ms))
    ]);

    try {
        // Nullify FK refs with timeout (may hang if 0 rows match)
        await withTimeout(db.supabase.from('orders').update({ source_cdkey_id: null }).eq('source_cdkey_id', id), 3000);
        await withTimeout(db.supabase.from('platform_cdks').update({ source_cdkey_id: null }).eq('source_cdkey_id', id), 3000);
        
        // Delete the source key
        const { data, error } = await db.supabase.from('source_cdkeys').delete().eq('id', id).select();
        console.log('[DELETE] Result:', { data, error });
        if (error) throw error;
        
        db.insertLog(null, null, 'source_key_deleted', `Source CDKey #${id} deleted`).catch(() => {});
        res.json({ success: true, message: 'Source CDKey deleted' });
    } catch (err) {
        console.error('[DELETE] Error:', err);
        res.status(500).json({ success: false, error: 'Delete failed: ' + (err.message || JSON.stringify(err)) });
    }
});

// ==================== PLATFORM CDKs ====================

router.get('/platform-cdks', adminAuth, async (req, res) => {
    const cdks = await db.getAllPlatformCDKs();
    res.json({ success: true, cdks });
});

router.post('/platform-cdks', adminAuth, async (req, res) => {
    const { points, count = 1, label = '', source_cdkey_id, prefix = 'DS' } = req.body;
    if (!points || points <= 0) return res.status(400).json({ success: false, error: 'Points must be > 0' });

    let sourceId = source_cdkey_id;
    if (!sourceId) {
        const activeKey = await db.getActiveSourceCDKey();
        if (!activeKey) return res.status(400).json({ success: false, error: 'No active source CDKey available' });
        sourceId = activeKey.id;
    }

    const codes = generateMultipleCDKs(Math.min(count, 100), prefix);
    const created = [];
    for (const code of codes) {
        try {
            const result = await db.insertPlatformCDK(code, label, points, points, sourceId);
            created.push({ id: result.id, code, points });
            await db.insertLog(null, null, 'cdk_created', `CDK ${code} created with ${points} points`);
        } catch (err) { console.error('[Admin] CDK creation error:', err.message); }
    }
    res.json({ success: true, created, count: created.length });
});

router.post('/platform-cdks/:id/add-points', adminAuth, async (req, res) => {
    const { points } = req.body;
    if (!points || points <= 0) return res.status(400).json({ success: false, error: 'Points must be > 0' });
    const cdk = await db.getPlatformCDK(req.params.id);
    if (!cdk) return res.status(404).json({ success: false, error: 'CDK not found' });
    await db.addPointsToCDK(points, points, cdk.id);
    await db.insertLog(cdk.id, null, 'points_added', `Added ${points} points to CDK ${cdk.code}`);
    const updated = await db.getPlatformCDK(cdk.id);
    res.json({ success: true, cdk: updated });
});

router.put('/platform-cdks/:id', adminAuth, async (req, res) => {
    const { label, source_cdkey_id } = req.body;
    const cdk = await db.getPlatformCDK(req.params.id);
    if (!cdk) return res.status(404).json({ success: false, error: 'CDK not found' });
    await db.updatePlatformCDK(label ?? cdk.label, source_cdkey_id ?? cdk.source_cdkey_id, cdk.id);
    await db.insertLog(cdk.id, null, 'cdk_edited', `CDK ${cdk.code} edited`);
    res.json({ success: true, message: 'CDK updated' });
});

router.post('/platform-cdks/:id/status', adminAuth, async (req, res) => {
    const { status } = req.body;
    if (!['active', 'suspended', 'expired'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
    await db.updatePlatformCDKStatus(status, req.params.id);
    await db.insertLog(parseInt(req.params.id), null, 'cdk_status_changed', `CDK status changed to ${status}`);
    res.json({ success: true, message: `CDK status updated to ${status}` });
});

router.delete('/platform-cdks/:id', adminAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    console.log('[DELETE] Attempting to delete platform CDK:', id);
    try {
        const cdk = await db.getPlatformCDK(id);
        if (!cdk) return res.status(404).json({ success: false, error: 'CDK not found' });
        await db.deletePlatformCDK(id);
        await db.insertLog(null, null, 'cdk_deleted', `CDK ${cdk.code} deleted`).catch(() => {});
        console.log('[DELETE] Platform CDK deleted:', cdk.code);
        res.json({ success: true, message: 'CDK deleted' });
    } catch (err) {
        console.error('[DELETE] Error:', err);
        res.status(500).json({ success: false, error: 'Delete failed: ' + (err.message || JSON.stringify(err)) });
    }
});

// ==================== ORDERS ====================

router.get('/orders', adminAuth, async (req, res) => {
    const { q } = req.query; // search query
    let orders = await db.getAllOrders();
    if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        orders = orders.filter(o =>
            (o.email || '').toLowerCase().includes(term) ||
            (o.cdk_code || '').toLowerCase().includes(term) ||
            (o.status || '').toLowerCase().includes(term) ||
            String(o.id) === term
        );
    }
    orders = orders.map(o => ({ ...o, password_encrypted: '***' }));
    res.json({ success: true, orders });
});

// ==================== PRICING ====================

router.get('/pricing', adminAuth, async (req, res) => {
    const pricing = await db.getAllPricing();
    const rateSetting = await db.getSetting('deposit_rate');
    const rate = rateSetting ? parseFloat(rateSetting.value) : 1;
    res.json({ success: true, pricing, deposit_rate: rate });
});

router.put('/pricing/:type', adminAuth, async (req, res) => {
    const { points_cost } = req.body;
    if (points_cost === undefined || points_cost < 0) return res.status(400).json({ success: false, error: 'Valid points_cost required' });
    await db.updatePricing(points_cost, req.params.type);
    res.json({ success: true, message: 'Pricing updated' });
});

router.put('/deposit-rate', adminAuth, async (req, res) => {
    const { rate } = req.body;
    if (!rate || rate <= 0) return res.status(400).json({ success: false, error: 'Price must be > 0' });
    await db.setSetting('deposit_rate', rate.toString());
    res.json({ success: true, message: `Point price set to $${rate}` });
});

// ==================== ANNOUNCEMENT ====================

router.get('/announcement', adminAuth, async (req, res) => {
    const setting = await db.getSetting('announcement');
    if (setting && setting.value) {
        try {
            const d = JSON.parse(setting.value);
            res.json({ success: true, text: d.text || '', fixed_text: d.fixed_text || '', color: d.color || 'default', speed: d.speed || 'normal', scrolling_enabled: d.scrolling_enabled !== false, fixed_enabled: d.fixed_enabled !== false });
        } catch {
            res.json({ success: true, text: setting.value, fixed_text: '', color: 'default', speed: 'normal', scrolling_enabled: true, fixed_enabled: true });
        }
    } else {
        res.json({ success: true, text: '', fixed_text: '', color: 'default', speed: 'normal', scrolling_enabled: true, fixed_enabled: true });
    }
});

router.put('/announcement', adminAuth, async (req, res) => {
    const { text, fixed_text, color, speed, scrolling_enabled, fixed_enabled } = req.body;
    await db.setSetting('announcement', JSON.stringify({
        text: text || '', fixed_text: fixed_text || '',
        color: color || 'default', speed: speed || 'normal',
        scrolling_enabled: scrolling_enabled !== false,
        fixed_enabled: fixed_enabled !== false
    }));
    res.json({ success: true, message: 'Announcement updated' });
});

// ==================== SITE STATUS ====================

router.get('/site-status', adminAuth, async (req, res) => {
    const setting = await db.getSetting('site_status');
    res.json({ success: true, status: setting ? setting.value : 'maintenance' });
});

router.put('/site-status', adminAuth, async (req, res) => {
    const { status } = req.body;
    if (!['open', 'maintenance', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Status must be open, maintenance, or closed' });
    }
    await db.setSetting('site_status', status);
    res.json({ success: true, status, message: `Site status set to ${status}` });
});

// ==================== FULL ACTIVATION TOGGLE ====================
router.get('/full-activation', adminAuth, async (req, res) => {
    const s = await db.getSetting('full_activation_enabled');
    res.json({ success: true, enabled: s ? s.value === 'true' : false });
});
router.put('/full-activation', adminAuth, async (req, res) => {
    const { enabled } = req.body;
    await db.setSetting('full_activation_enabled', enabled ? 'true' : 'false');
    res.json({ success: true, enabled, message: `Full activation ${enabled ? 'enabled' : 'disabled'}` });
});

// ==================== OUT OF STOCK ====================
router.get('/out-of-stock', adminAuth, async (req, res) => {
    const s = await db.getSetting('out_of_stock');
    res.json({ success: true, out_of_stock: s ? s.value === 'true' : false });
});
router.put('/out-of-stock', adminAuth, async (req, res) => {
    const { out_of_stock } = req.body;
    await db.setSetting('out_of_stock', out_of_stock ? 'true' : 'false');
    res.json({ success: true, out_of_stock, message: `Out of stock ${out_of_stock ? 'enabled' : 'disabled'}` });
});


// ==================== DEPOSITS ====================

router.get('/deposits', adminAuth, async (req, res) => {
    const deposits = await db.getAllDeposits();
    const totalDeposits = await db.getTotalDeposits();
    res.json({ success: true, deposits, total_usdt: totalDeposits.total });
});

router.post('/deposits/:id/approve', adminAuth, async (req, res) => {
    const deposit = await db.getDepositById(req.params.id);
    if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
    if (deposit.status === 'paid') return res.json({ success: true, message: 'Already approved' });
    await db.updateDepositStatus('paid', deposit.id);
    await db.addPointsToCDK(deposit.points_credited, deposit.points_credited, deposit.cdk_id);
    await db.insertLog(deposit.cdk_id, null, 'deposit_approved',
        `Admin approved deposit $${parseFloat(deposit.amount_usdt).toFixed(2)} USDT → ${deposit.points_credited} points`);
    res.json({ success: true, message: 'Deposit approved and points credited' });
});

router.post('/deposits/:id/reject', adminAuth, async (req, res) => {
    const deposit = await db.getDepositById(req.params.id);
    if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
    await db.updateDepositStatus('rejected', deposit.id);
    await db.insertLog(deposit.cdk_id, null, 'deposit_rejected', `Admin rejected deposit #${deposit.id}`);
    res.json({ success: true, message: 'Deposit rejected' });
});

router.delete('/deposits/:id', adminAuth, async (req, res) => {
    const deposit = await db.getDepositById(req.params.id);
    if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
    await db.deleteDeposit(deposit.id);
    res.json({ success: true, message: 'Deposit deleted permanently' });
});

// ==================== ACTIVITY LOG ====================

router.get('/activity', adminAuth, async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await db.getRecentLogs(limit);
    res.json({ success: true, logs });
});

router.delete('/activity', adminAuth, async (req, res) => {
    await db.clearAllLogs();
    res.json({ success: true, message: 'All activity logs cleared' });
});

router.delete('/activity/:id', adminAuth, async (req, res) => {
    await db.deleteLog(req.params.id);
    res.json({ success: true, message: 'Log entry deleted' });
});

// ==================== BRANDING ====================

router.get('/branding', adminAuth, async (req, res) => {
    try {
        const keys = ['brand_name', 'brand_subtitle', 'hero_title', 'hero_subtitle', 'hero_description', 'logo_url'];
        const result = {};
        for (const key of keys) {
            const setting = await db.getSetting(key);
            result[key] = setting ? setting.value : '';
        }
        res.json({ success: true, branding: result });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/branding', adminAuth, async (req, res) => {
    try {
        const allowed = ['brand_name', 'brand_subtitle', 'hero_title', 'hero_subtitle', 'hero_description', 'logo_url'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                await db.setSetting(key, req.body[key]);
            }
        }
        res.json({ success: true, message: 'Branding updated' });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
