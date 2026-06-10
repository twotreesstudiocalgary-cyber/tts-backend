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

// GET /api/ticket-types/:id/options
router.get('/ticket-types/:id/options', async (req, res) => {
  try {
    const [options] = await execute('SELECT * FROM ticket_type_options WHERE ticket_type_id = ? ORDER BY sort_order ASC, created_at ASC', [req.params.id])
    res.json({ options })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

// POST /api/ticket-types/:id/options
router.post('/ticket-types/:id/options', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { label } = req.body
    if (!label?.trim()) return res.status(400).json({ message: 'Label is required' })
    const id = uuidv4()
    await execute('INSERT INTO ticket_type_options (id, ticket_type_id, label) VALUES (?, ?, ?)', [id, req.params.id, label.trim()])
    res.status(201).json({ option: { id, ticket_type_id: req.params.id, label: label.trim() } })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

// DELETE /api/ticket-types/options/:optionId
router.delete('/ticket-types/options/:optionId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM ticket_type_options WHERE id = ?', [req.params.optionId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
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

// POST /api/clients/create (admin creates client manually)
router.post('/clients/create', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, company, customer_type } = req.body
    if (!name) return res.status(400).json({ message: 'Name is required' })

    // Only check email uniqueness if email provided
    if (email) {
      const [existing] = await execute('SELECT id FROM clients WHERE email = ?', [email])
      if (existing.length > 0) return res.status(409).json({ message: 'A client with this email already exists' })
    }

    const bcrypt = require('bcryptjs')
    const { v4: uuidv4 } = require('uuid')
    const tempPassword = 'TTS@' + Math.random().toString(36).slice(2, 8).toUpperCase()
    const hashed = await bcrypt.hash(tempPassword, 12)
    const id = uuidv4()
    const validType = ['new_customer','support_plan','existing_customer'].includes(customer_type) ? customer_type : 'new_customer'

    await execute(
      'INSERT INTO clients (id, name, email, password, company, customer_type, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email || null, hashed, company || null, validType, 1]
    )

    // Only send email if email provided
    if (email) {
      const { emails } = require('../utils/email')
      await emails.staffInvite({ name, email }, tempPassword).catch(() => {})
    }

    res.status(201).json({ client: { id, name, email: email || null, company: company || null, customer_type: validType, status: 'active', tickets: 0, created_at: new Date() } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/clients/:id
router.get('/clients/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await execute(`SELECT c.*, COUNT(t.id) as tickets FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.id = ? GROUP BY c.id`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Client not found' })
    res.json({ client: rows[0] })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

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

// PUT /api/clients/:id
router.put('/clients/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, customer_type } = req.body
    await execute('UPDATE clients SET name = ?, email = ?, customer_type = ? WHERE id = ?', [name, email || null, customer_type, req.params.id])
    res.json({ client: { id: req.params.id, name, email, customer_type } })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

// DELETE /api/clients/:id
router.delete('/clients/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM tickets WHERE client_id = ?', [req.params.id])
    await execute('DELETE FROM clients WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
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

// ─── Recurring Tickets ────────────────────────────────────────────────────────

// GET /api/recurring-tickets
router.get('/recurring-tickets', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [tickets] = await execute(`
      SELECT r.*, u.name as assignee_name 
      FROM recurring_tickets r
      LEFT JOIN users u ON r.assignee_id = u.id
      ORDER BY r.created_at DESC
    `)
    res.json({ tickets })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

// POST /api/recurring-tickets
router.post('/recurring-tickets', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { title, type, priority, description, assignee_id, scope } = req.body
    if (!title || !type) return res.status(400).json({ message: 'Title and type are required' })
    const { v4: uuidv4 } = require('uuid')
    const id = uuidv4()
    await execute(
      'INSERT INTO recurring_tickets (id, title, type, priority, description, assignee_id, scope, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, type, priority || 'normal', description || '', assignee_id || null, scope || 'support_plan', req.user.id]
    )
    res.status(201).json({ ticket: { id, title, type, priority: priority || 'normal', description, assignee_id, scope: scope || 'support_plan', active: 1 } })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

// PUT /api/recurring-tickets/:id/toggle
router.put('/recurring-tickets/:id/toggle', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await execute('SELECT active FROM recurring_tickets WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ message: 'Not found' })
    const newActive = rows[0].active ? 0 : 1
    await execute('UPDATE recurring_tickets SET active = ? WHERE id = ?', [newActive, req.params.id])
    res.json({ active: newActive })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})

// DELETE /api/recurring-tickets/:id
router.delete('/recurring-tickets/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM recurring_tickets WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: 'Server error' }) }
})
