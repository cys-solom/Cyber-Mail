const express = require('express');
const router = express.Router();
const cdkAuth = require('../middleware/cdkAuth');
const db = require('../database/db');
const AiDoneClient = require('../services/aidone');

// All routes use CDK auth
router.use(cdkAuth);

// ==================== BALANCE ====================
router.post('/balance', (req, res) => {
    res.json({ success: true, remaining_uses: req.cdk.remaining_points, remaining_points: req.cdk.remaining_points });
});

// ==================== CHECK BALANCE ====================
router.post('/check-balance', (req, res) => {
    res.json({ success: true, remaining_points: req.cdk.remaining_points, cdk_code: req.cdk.code });
});

// ==================== PRICING ====================
router.post('/pricing', async (req, res) => {
    const pricing = await db.getAllPricing();
    const mapped = {};
    pricing.forEach(p => { mapped[p.task_type] = { points: p.points_cost, label_en: p.label_en, label_ar: p.label_ar }; });
    res.json({ success: true, pricing: mapped });
});

// ==================== SUBMIT ORDER ====================
router.post('/submit', async (req, res) => {
    const { email, password, twofa, task_type } = req.body;
    const cdk = req.cdk;

    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password are required' });
    if (!task_type || !['full', 'extract'].includes(task_type)) return res.status(400).json({ success: false, error: 'task_type must be "full" or "extract"' });

    const pricing = await db.getPricingByType(task_type);
    if (!pricing) return res.status(400).json({ success: false, error: 'Invalid task type' });
    if (cdk.remaining_points < pricing.points_cost) return res.status(400).json({ success: false, error: `Insufficient balance. You have ${cdk.remaining_points} points but this task requires ${pricing.points_cost} points.`, required: pricing.points_cost, remaining: cdk.remaining_points });

    // Check site status
    const statusSetting = await db.getSetting('site_status');
    const siteStatus = statusSetting ? statusSetting.value : 'maintenance';
    if (siteStatus === 'maintenance') return res.status(503).json({ success: false, error: '🔧 Service is under maintenance. Please try again later.' });
    if (siteStatus === 'closed') return res.status(503).json({ success: false, error: '🔒 Service is currently closed. Contact admin.' });

    // Out of Stock check
    const oosSetting = await db.getSetting('out_of_stock');
    if (oosSetting && oosSetting.value === 'true') return res.status(503).json({ success: false, error: '📦 Out of stock — no activations available right now. Please check back later.' });

    // Full activation check (task_type='full' requires it to be enabled)
    if (task_type === 'full') {
        const fullEnabled = await db.getSetting('full_activation_enabled');
        if (!fullEnabled || fullEnabled.value !== 'true') return res.status(400).json({ success: false, error: '⛔ Full activation is currently disabled. Only Extract is available.' });
    }

    // ── Smart source rotation with live balance checks ──
    // Get ALL active source keys, ordered by ID
    const allSources = await db.getAllActiveSourceCDKeys();
    if (!allSources || allSources.length === 0) {
        return res.status(500).json({ success: false, error: 'No active source available. Contact admin.' });
    }

    // Sort so the assigned source comes first, then the rest by ID
    const sortedSources = [];
    if (cdk.source_cdkey_id) {
        const assigned = allSources.find(s => s.id === cdk.source_cdkey_id);
        if (assigned) sortedSources.push(assigned);
    }
    for (const s of allSources) {
        if (!sortedSources.find(x => x.id === s.id)) sortedSources.push(s);
    }

    let sourceKey = null;
    let result = null;

    for (const candidate of sortedSources) {
        // Live balance check — silently skip sources with 0 balance
        try {
            const balanceCheck = await AiDoneClient.getBalance(candidate.cdkey);
            if (balanceCheck.success) {
                const bal = (balanceCheck.remaining_uses !== undefined && balanceCheck.remaining_uses !== null)
                    ? balanceCheck.remaining_uses : 0;
                await db.updateSourceCDKeyBalance(bal, candidate.id);
                if (bal <= 0) {
                    console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) has 0 balance (${bal}), skipping...`);
                    continue;
                }
            } else {
                // Balance check returned success:false — check if it's an insufficient balance error
                const errMsg = (balanceCheck.error || balanceCheck.message || '').toLowerCase();
                if (errMsg.includes('余额') || errMsg.includes('insufficient') || errMsg.includes('balance')) {
                    await db.updateSourceCDKeyBalance(0, candidate.id);
                    console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) reported insufficient balance, skipping...`);
                } else {
                    console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) balance check failed: ${errMsg}, skipping...`);
                }
                continue;
            }
        } catch (err) {
            console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) balance check error: ${err.message}, skipping...`);
            continue;
        }

        // Source has balance — try submitting
        try {
            result = await AiDoneClient.submitTask(candidate.cdkey, email, password, twofa || '', task_type);
            if (result.success) {
                sourceKey = candidate;
                break;
            }
            // Check if submit failed due to insufficient balance on the source
            const submitErr = (result.error || result.message || '').toLowerCase();
            if (submitErr.includes('余额') || submitErr.includes('insufficient') || submitErr.includes('balance') || submitErr.includes('额度')) {
                await db.updateSourceCDKeyBalance(0, candidate.id);
                console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) has insufficient credits, auto-skipping to next...`);
                continue;
            }
            // Other submission error — log and try next
            console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) submit failed: ${result.error || result.message}, trying next...`);
        } catch (submitErr) {
            console.log(`[Submit] Source "${candidate.name}" (${candidate.id}) submit error: ${submitErr.message}, trying next...`);
        }
    }

    if (!sourceKey || !result || !result.success) {
        return res.status(500).json({ success: false, error: 'Service temporarily unavailable. Please try again later.' });
    }

    const newBalance = cdk.remaining_points - pricing.points_cost;
    await db.updatePlatformCDKPoints(newBalance, cdk.id);
    if (result.remaining_uses !== undefined) await db.updateSourceCDKeyBalance(result.remaining_uses, sourceKey.id);

    // Update CDK's linked source to the one actually used
    if (sourceKey.id !== cdk.source_cdkey_id) {
        await db.updatePlatformCDK(cdk.label || '', sourceKey.id, cdk.id);
    }

    const order = await db.insertOrder(cdk.id, email, password, twofa || '', task_type, result.task_id, 'pending', pricing.points_cost, sourceKey.id);
    await db.insertLog(cdk.id, order.id, 'submit', `Submitted ${task_type} task for ${email} — charged ${pricing.points_cost} points (source: ${sourceKey.name})`);

    res.json({ success: true, message: 'Order submitted successfully', order_id: order.id, remaining_uses: newBalance });
});

// ==================== ORDER STATUS ====================
router.post('/status', async (req, res) => {
    const { order_id } = req.body;
    const cdk = req.cdk;
    let order;
    if (order_id) order = await db.getOrderForCDK(order_id, cdk.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: {
        order_id: order.id, email: order.email, status: order.status, message: order.result_message,
        offer_url: order.offer_url, has_offer_url: !!order.has_offer_url, task_type: order.task_type,
        created_at: order.created_at, updated_at: order.updated_at
    }});
});

// ==================== CANCEL ORDER ====================
router.post('/cancel', async (req, res) => {
    const { order_id } = req.body;
    const cdk = req.cdk;
    if (!order_id) return res.status(400).json({ success: false, error: 'order_id is required' });
    const order = await db.getOrderForCDK(order_id, cdk.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, error: 'Only pending orders can be cancelled' });

    if (order.remote_task_id) {
        const sourceKey = await db.getSourceCDKey(order.source_cdkey_id);
        if (sourceKey) await AiDoneClient.cancelTask(sourceKey.cdkey, order.remote_task_id);
    }

    const newBalance = cdk.remaining_points + order.charged_points;
    await db.updatePlatformCDKPoints(newBalance, cdk.id);
    await db.cancelOrder(order.id);
    await db.insertLog(cdk.id, order.id, 'cancel', `Cancelled order #${order.id} — refunded ${order.charged_points} points`);
    res.json({ success: true, message: 'Order cancelled and points refunded', remaining_uses: newBalance });
});

// ==================== PURCHASE FAILED LINK ====================
router.post('/purchase_link', async (req, res) => {
    const { order_id } = req.body;
    const cdk = req.cdk;
    if (!order_id) return res.status(400).json({ success: false, error: 'order_id is required' });
    const order = await db.getOrderForCDK(order_id, cdk.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (!order.has_offer_url) return res.status(400).json({ success: false, error: 'This order has no available link to purchase' });

    const pricing = await db.getPricingByType('purchase_link');
    if (!pricing) return res.status(500).json({ success: false, error: 'Pricing not configured' });
    if (cdk.remaining_points < pricing.points_cost) return res.status(400).json({ success: false, error: 'Insufficient balance', required: pricing.points_cost, remaining: cdk.remaining_points });

    const sourceKey = await db.getSourceCDKey(order.source_cdkey_id);
    if (!sourceKey) return res.status(500).json({ success: false, error: 'Source key not found' });

    const result = await AiDoneClient.purchaseFailedLink(sourceKey.cdkey, order.remote_task_id);
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Failed to purchase link' });

    const newBalance = cdk.remaining_points - pricing.points_cost;
    await db.updatePlatformCDKPoints(newBalance, cdk.id);
    await db.updateOrderStatus('success', 'Link purchased successfully', result.offer_url, true, order.id);
    await db.insertLog(cdk.id, order.id, 'purchase_link', `Purchased link for order #${order.id} — charged ${pricing.points_cost} points`);
    res.json({ success: true, offer_url: result.offer_url, remaining_uses: newBalance });
});

// ==================== ALL ORDERS ====================
router.post('/orders', async (req, res) => {
    const cdk = req.cdk;
    let orders = await db.getOrdersByCDK(cdk.id);
    orders = orders.map(o => ({
        id: o.id, email: o.email, password: o.password_encrypted || '', twofa: o.twofa || '',
        task_type: o.task_type, status: o.status,
        message: o.result_message, offer_url: o.offer_url, has_offer_url: !!o.has_offer_url,
        charged_points: o.charged_points, created_at: o.created_at, updated_at: o.updated_at
    }));
    res.json({ success: true, orders });
});

// ==================== RETRY ORDER ====================
router.post('/retry', async (req, res) => {
    const { order_id } = req.body;
    const cdk = req.cdk;
    if (!order_id) return res.status(400).json({ success: false, error: 'order_id is required' });
    const order = await db.getOrderForCDK(order_id, cdk.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (!['failed', 'cancelled'].includes(order.status)) return res.status(400).json({ success: false, error: 'Only failed or cancelled orders can be retried' });

    // Use the same task type from the original order
    const pricing = await db.getPricingByType(order.task_type);
    if (!pricing) return res.status(400).json({ success: false, error: 'Invalid task type' });
    if (cdk.remaining_points < pricing.points_cost) return res.status(400).json({ success: false, error: 'Insufficient balance', required: pricing.points_cost, remaining: cdk.remaining_points });

    // Mark as retrying immediately (UI feedback)
    await db.updateOrderStatus('retrying', 'Retrying...', null, false, order.id);

    // Smart source rotation (same logic as /submit)
    const allSources = await db.getAllActiveSourceCDKeys();
    if (!allSources || allSources.length === 0) {
        await db.updateOrderStatus('failed', 'No active source available', null, false, order.id);
        return res.status(500).json({ success: false, error: 'No active source available. Contact admin.' });
    }

    const sortedSources = [];
    if (cdk.source_cdkey_id) {
        const assigned = allSources.find(s => s.id === cdk.source_cdkey_id);
        if (assigned) sortedSources.push(assigned);
    }
    for (const s of allSources) {
        if (!sortedSources.find(x => x.id === s.id)) sortedSources.push(s);
    }

    let sourceKey = null;
    let result = null;

    for (const candidate of sortedSources) {
        try {
            const balanceCheck = await AiDoneClient.getBalance(candidate.cdkey);
            if (balanceCheck.success) {
                const bal = (balanceCheck.remaining_uses !== undefined && balanceCheck.remaining_uses !== null) ? balanceCheck.remaining_uses : 0;
                await db.updateSourceCDKeyBalance(bal, candidate.id);
                if (bal <= 0) continue;
            } else {
                continue;
            }
        } catch (err) { continue; }

        try {
            result = await AiDoneClient.submitTask(candidate.cdkey, order.email, order.password_encrypted, order.twofa || '', order.task_type);
            if (result.success) { sourceKey = candidate; break; }
            const submitErr = (result.error || result.message || '').toLowerCase();
            if (submitErr.includes('余额') || submitErr.includes('insufficient') || submitErr.includes('balance') || submitErr.includes('额度')) {
                await db.updateSourceCDKeyBalance(0, candidate.id);
                continue;
            }
        } catch (submitErr) { continue; }
    }

    if (!sourceKey || !result || !result.success) {
        // Revert to failed if retry didn't work
        await db.updateOrderStatus('failed', 'Retry failed — no source available', null, false, order.id);
        return res.status(500).json({ success: false, error: 'Service temporarily unavailable. Please try again later.' });
    }

    // Deduct points and update the SAME order with new task
    const newBalance = cdk.remaining_points - pricing.points_cost;
    await db.updatePlatformCDKPoints(newBalance, cdk.id);
    if (result.remaining_uses !== undefined) await db.updateSourceCDKeyBalance(result.remaining_uses, sourceKey.id);

    // Reset the same order row with new remote task
    await db.resetOrderForRetry(result.task_id, sourceKey.id, pricing.points_cost, order.id);
    await db.insertLog(cdk.id, order.id, 'retry', `Retried order #${order.id} for ${order.email} — charged ${pricing.points_cost} points`);

    res.json({ success: true, message: 'Order retried successfully', order_id: order.id, remaining_uses: newBalance });
});

// ==================== DELETE ORDERS ====================
router.post('/delete-orders', async (req, res) => {
    const { order_ids } = req.body;
    const cdk = req.cdk;
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ success: false, error: 'order_ids array is required' });
    }

    // Verify all orders belong to this CDK and are in a final state
    let deleted = 0;
    for (const orderId of order_ids) {
        const order = await db.getOrderForCDK(orderId, cdk.id);
        if (!order) continue;
        // Only allow deleting completed orders (success, failed, cancelled)
        if (!['success', 'failed', 'cancelled'].includes(order.status)) continue;
        await db.deleteOrder(orderId);
        deleted++;
    }

    res.json({ success: true, message: `Deleted ${deleted} orders`, deleted });
});
router.post('/webhook', async (req, res) => {
    const { webhook_url } = req.body;
    await db.updatePlatformCDKWebhook(webhook_url || '', req.cdk.id);
    res.json({ success: true, message: 'Webhook URL updated' });
});

// ==================== STATS ====================
router.post('/stats', async (req, res) => {
    const stats = await db.getOrderStatsByCDK(req.cdk.id);
    res.json({ success: true, stats, remaining_uses: req.cdk.remaining_points });
});

// ==================== DEPOSITS ====================

router.post('/deposit', async (req, res) => {
    const { amount } = req.body;
    const cdk = req.cdk;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be > 0 USDT' });

    const rateSetting = await db.getSetting('deposit_rate');
    const pricePerPoint = rateSetting ? parseFloat(rateSetting.value) : 1;
    const points = Math.floor(amount / pricePerPoint);
    // Generate unique note like "CK-A7X4"
    const noteChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let noteCode = '';
    for (let i = 0; i < 4; i++) noteCode += noteChars[Math.floor(Math.random() * noteChars.length)];
    const note = `CK-${noteCode}`;
    const tradeNo = `CK-${cdk.id}-${Date.now()}`;

    await db.insertDeposit(cdk.id, tradeNo, amount, points, 'pending', '', '', note);
    await db.insertLog(cdk.id, null, 'deposit_created', `Deposit request $${amount} USDT → ${points} points [note: ${note}]`);

    res.json({
        success: true, trade_no: tradeNo, amount_usdt: amount, points_to_credit: points,
        pay_id: process.env.BINANCE_MERCHANT_UID || '', note,
        instruction: `Send $${amount} USDT via Binance Pay to ID: ${process.env.BINANCE_MERCHANT_UID} with note: ${note}`
    });
});

router.post('/deposit/history', async (req, res) => {
    const deposits = await db.getDepositsByCDK(req.cdk.id);
    const rateSetting = await db.getSetting('deposit_rate');
    const pricePerPoint = rateSetting ? parseFloat(rateSetting.value) : 1;
    res.json({ success: true, deposits, rate: pricePerPoint, pay_id: process.env.BINANCE_MERCHANT_UID || '' });
});

router.post('/deposit/check', async (req, res) => {
    const { trade_no } = req.body;
    const cdk = req.cdk;
    if (!trade_no) return res.status(400).json({ success: false, error: 'trade_no required' });
    const deposit = await db.getDepositByTradeNo(trade_no);
    if (!deposit || deposit.cdk_id !== cdk.id) return res.status(404).json({ success: false, error: 'Deposit not found' });
    if (deposit.status === 'paid') return res.json({ success: true, status: 'paid', message: 'Already confirmed' });

    try {
        const { checkPendingDeposits } = require('../services/depositChecker');
        await checkPendingDeposits();
        const updated = await db.getDepositByTradeNo(trade_no);
        res.json({ success: true, status: updated.status, message: updated.status === 'paid' ? 'Payment confirmed!' : 'Not detected yet' });
    } catch (err) {
        res.json({ success: true, status: 'pending', message: 'Check in progress' });
    }
});

router.post('/deposit/cancel', async (req, res) => {
    const { trade_no } = req.body;
    const cdk = req.cdk;
    if (!trade_no) return res.status(400).json({ success: false, error: 'trade_no required' });
    const deposit = await db.getDepositByTradeNo(trade_no);
    if (!deposit || deposit.cdk_id !== cdk.id) return res.status(404).json({ success: false, error: 'Deposit not found' });
    if (deposit.status !== 'pending') return res.json({ success: false, error: 'Only pending deposits can be cancelled' });

    await db.updateDepositStatus('cancelled', deposit.id);
    await db.insertLog(cdk.id, null, 'deposit_cancelled', `Deposit #${deposit.id} cancelled by merchant`);
    res.json({ success: true, message: 'Deposit cancelled' });
});

module.exports = router;
