const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const { pool, execute } = require('../db')
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth')

// ─── Ticket Types ────────────────────────────────────────────────────────────

// GET /api/ticket-types
router.get('/ticket-types', async (req, res) => {
  try {
    const [types] = await execute(`
      SELECT tt.*, COUNT(t.id) as count 
      FROM ticket_types tt
      LEFT JOIN tickets t ON t.type = tt.name
      WHERE tt.active = 1
      GROUP BY tt.id ORDER BY tt.name ASC
    `)
    res.json({ types })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/ticket-types
router.post('/ticket-types', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' })
    const [existing] = await execute('SELECT id FROM ticket_types WHERE name = ?', [name.trim()])
    if (existing.length > 0) return res.status(409).json({ message: 'This type already exists' })
    const id = uuidv4()
    await execute('INSERT INTO ticket_types (id, name) VALUES (?, ?)', [id, name.trim()])
    res.status(201).json({ type: { id, name: name.trim(), count: 0 } })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// DELETE /api/ticket-types/:id
router.delete('/ticket-types/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await execute('UPDATE ticket_types SET active = 0 WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── Clients ─────────────────────────────────────────────────────────────────

// GET /api/clients
router.get('/clients', authenticate, requireAdmin, async (req, res) => {
  try {
    const [clients] = await execute(`
      SELECT c.id, c.name, c.email, c.company, c.status, c.created_at,
        COUNT(t.id) as tickets
      FROM clients c
      LEFT JOIN tickets t ON t.client_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC
    `)
    res.json({ clients })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/clients/:id/toggle-status
router.put('/clients/:id/toggle-status', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await execute('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Client not found' })
    const newStatus = rows[0].status === 'active' ? 'inactive' : 'active'
    await execute('UPDATE clients SET status = ? WHERE id = ?', [newStatus, req.params.id])
    res.json({ client: { ...rows[0], status: newStatus } })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── Reports ──────────────────────────────────────────────────────────────────

// GET /api/reports/summary
router.get('/reports/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[{ total }]] = await execute('SELECT COUNT(*) as total FROM tickets')
    const [[{ open }]] = await execute("SELECT COUNT(*) as open FROM tickets WHERE status = 'new'")
    const [[{ inprogress }]] = await execute("SELECT COUNT(*) as inprogress FROM tickets WHERE status = 'inprogress'")
    const [[{ complete }]] = await execute("SELECT COUNT(*) as complete FROM tickets WHERE status = 'complete'")
    const [[{ overdue }]] = await execute("SELECT COUNT(*) as overdue FROM tickets WHERE status IN ('new','inprogress') AND updated_at < NOW() - INTERVAL '3 days'")
    const [[{ unpaidInvoices }]] = await execute("SELECT COUNT(*) as unpaidInvoices FROM invoices WHERE status = 'unpaid'")
    const [[{ unpaidAmount }]] = await execute("SELECT COALESCE(SUM(amount),0) as unpaidAmount FROM invoices WHERE status = 'unpaid'")

    const [byType] = await execute(`
      SELECT tt.name, COUNT(t.id) as count 
      FROM ticket_types tt LEFT JOIN tickets t ON t.type = tt.name 
      WHERE tt.active = 1 GROUP BY tt.id ORDER BY count DESC
    `)

    res.json({ total, open, inprogress, complete, overdue, unpaidInvoices, unpaidAmount, byType })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── Stripe Payment ───────────────────────────────────────────────────────────

// POST /api/invoices/:id/pay
router.post('/invoices/:id/pay', authenticate, async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    const [rows] = await execute('SELECT * FROM invoices WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Invoice not found' })
    if (rows[0].status === 'paid') return res.status(400).json({ message: 'Invoice already paid' })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(rows[0].amount * 100),
      currency: 'cad',
      metadata: { invoice_id: req.params.id, ticket_id: rows[0].ticket_id }
    })

    res.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Payment error' })
  }
})

// POST /api/invoices/:id/confirm-payment
router.post('/invoices/:id/confirm-payment', authenticate, async (req, res) => {
  try {
    await execute("UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?", [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
