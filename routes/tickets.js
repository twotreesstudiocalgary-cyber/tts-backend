const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const { pool, execute } = require('../db')
const { authenticate, requireAdmin } = require('../middleware/auth')
const { emails } = require('../utils/email')

const getTicketWithDetails = async (id) => {
  const [tickets] = await execute(`
    SELECT t.*, 
      c.name as client_name, c.email as client_email, c.company as client_company,
      u.name as assignee_name
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `, [id])

  if (tickets.length === 0) return null

  const ticket = tickets[0]
  const [comments] = await execute(`
    SELECT id, author_id, author_type, text, created_at FROM comments WHERE ticket_id = ? ORDER BY created_at ASC
  `, [id])

  const [invoices] = await execute('SELECT * FROM invoices WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1', [id])
  const [selectedOptions] = await execute('SELECT * FROM ticket_selected_options WHERE ticket_id = ?', [id]).catch(() => [[], []])
  const [internalNotes] = await execute('SELECT * FROM internal_notes WHERE ticket_id = ? ORDER BY created_at ASC', [id]).catch(() => [[], []])

  // Enrich comments with author names
  for (const comment of comments) {
    if (comment.author_type === 'client') {
      const [rows] = await execute('SELECT name FROM clients WHERE id = ?', [comment.author_id])
      comment.author = rows[0]?.name || 'Client'
    } else {
      const [rows] = await execute('SELECT name FROM users WHERE id = ?', [comment.author_id])
      comment.author = rows[0]?.name || 'Team'
    }
    comment.role = comment.author_type
  }

  return {
    ...ticket,
    client: { id: ticket.client_id, name: ticket.client_name, email: ticket.client_email, company: ticket.client_company },
    assignee: ticket.assignee_name,
    comments,
    invoice: invoices[0] || null,
    attachments: [],
    selected_options: selectedOptions || [],
    internal_notes: internalNotes || []
  }
}

// GET /api/tickets - get all tickets (admin: all, client: own only)
router.get('/', authenticate, async (req, res) => {
  try {
    let query, params = []

    if (req.user.role === 'client') {
      // Check if client is on support plan
      const [clientRows] = await execute('SELECT customer_type FROM clients WHERE id = ?', [req.user.id])
      const isOnSupportPlan = clientRows[0]?.customer_type === 'support_plan'

      if (isOnSupportPlan) {
        // Show own tickets + global recurring tickets
        query = `SELECT t.*, c.name as client_name, c.company as client_company, u.name as assignee_name,
          i.amount as invoice_amount, i.status as invoice_status
          FROM tickets t
          LEFT JOIN clients c ON t.client_id = c.id
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN invoices i ON i.ticket_id = t.id
          WHERE t.client_id = ? OR t.is_global = 1 ORDER BY t.updated_at DESC`
        params = [req.user.id]
      } else {
        query = `SELECT t.*, c.name as client_name, c.company as client_company, u.name as assignee_name,
          i.amount as invoice_amount, i.status as invoice_status
          FROM tickets t
          LEFT JOIN clients c ON t.client_id = c.id
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN invoices i ON i.ticket_id = t.id
          WHERE t.client_id = ? ORDER BY t.updated_at DESC`
        params = [req.user.id]
      }
    } else {
      query = `SELECT t.*, c.name as client_name, c.email as client_email, c.company as client_company, u.name as assignee_name,
        i.amount as invoice_amount, i.status as invoice_status
        FROM tickets t
        LEFT JOIN clients c ON t.client_id = c.id
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN invoices i ON i.ticket_id = t.id
        ORDER BY t.updated_at DESC`
    }

    const [rows] = await execute(query, params)
    const tickets = rows.map(t => ({
      ...t,
      client: { id: t.client_id, name: t.client_name, email: t.client_email, company: t.client_company },
      assignee: t.assignee_name,
      invoice: t.invoice_amount ? { amount: t.invoice_amount, status: t.invoice_status } : null
    }))

    res.json({ tickets })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/tickets/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await getTicketWithDetails(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    if (req.user.role === 'client' && ticket.client_id !== req.user.id) return res.status(403).json({ message: 'Access denied' })
    res.json({ ticket })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/tickets - create ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, type, priority, description } = req.body
    if (!title || !type) return res.status(400).json({ message: 'Title and type are required' })

    let clientId = req.user.id
    let clientName = req.user.name

    // Staff can create tickets for clients
    if (req.user.role !== 'client' && req.body.client_id) {
      clientId = req.body.client_id
      const [rows] = await execute('SELECT name, email FROM clients WHERE id = ?', [clientId])
      if (rows.length === 0) return res.status(404).json({ message: 'Client not found' })
      clientName = rows[0].name
    }

    const id = uuidv4()
    await execute(
      'INSERT INTO tickets (id, title, type, priority, description, client_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, title, type, priority || 'normal', description || '', clientId, req.body.assignee_id || null]
    )

    // Save selected options
    if (req.body.selected_options && Array.isArray(req.body.selected_options)) {
      for (const opt of req.body.selected_options) {
        await execute('INSERT INTO ticket_selected_options (id, ticket_id, option_id, option_label) VALUES (?, ?, ?, ?)',
          [uuidv4(), id, opt.id, opt.label])
      }
    }

    const ticket = await getTicketWithDetails(id)

    // Notify client
    await emails.ticketCreated(ticket, ticket.client).catch(() => {})

    // Notify all admins
    const [admins] = await execute("SELECT email FROM users WHERE role = 'superadmin' AND status = 'active'")
    for (const admin of admins) {
      await emails.newTicketAdmin({ ...ticket, client_name: clientName }, admin.email).catch(() => {})
    }

    res.status(201).json({ ticket })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/tickets/:id/status
router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['new', 'inprogress', 'review', 'complete', 'reopened']
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' })

    await execute('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id])
    const ticket = await getTicketWithDetails(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

    await emails.ticketStatusUpdate(ticket, ticket.client, status).catch(() => {})

    res.json({ ticket })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/tickets/:id/assign
router.put('/:id/assign', authenticate, requireAdmin, async (req, res) => {
  try {
    const { assignee_id } = req.body
    await execute('UPDATE tickets SET assignee_id = ?, updated_at = NOW() WHERE id = ?', [assignee_id || null, req.params.id])
    const ticket = await getTicketWithDetails(req.params.id)
    res.json({ ticket })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/tickets/:id/note - add internal note to thread
router.post('/:id/note', authenticate, requireAdmin, async (req, res) => {
  try {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ message: 'Note text is required' })
    const id = uuidv4()
    const authorName = req.user.name || 'Team'
    await execute(
      'INSERT INTO internal_notes (id, ticket_id, author_id, author_name, text) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, req.user.id, authorName, text.trim()]
    )
    res.status(201).json({ note: { id, ticket_id: req.params.id, author_id: req.user.id, author_name: authorName, text: text.trim(), created_at: new Date() } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }

})

// DELETE /api/tickets/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') return res.status(403).json({ message: 'Super admin only' })
    await execute('DELETE FROM comments WHERE ticket_id = ?', [req.params.id])
    await execute('DELETE FROM invoices WHERE ticket_id = ?', [req.params.id])
    await execute('DELETE FROM tickets WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/tickets/:id/reopen
router.post('/:id/reopen', authenticate, async (req, res) => {
  try {
    await execute("UPDATE tickets SET status = 'reopened', updated_at = NOW() WHERE id = ?", [req.params.id])
    const ticket = await getTicketWithDetails(req.params.id)
    res.json({ ticket })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/tickets/:id/comments
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ message: 'Comment text is required' })

    const ticket = await getTicketWithDetails(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    if (req.user.role === 'client' && ticket.client_id !== req.user.id) return res.status(403).json({ message: 'Access denied' })

    const authorType = req.user.role === 'client' ? 'client' : 'staff'
    const id = uuidv4()
    await execute(
      'INSERT INTO comments (id, ticket_id, author_id, author_type, text) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, req.user.id, authorType, text]
    )

    await execute('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [req.params.id])

    // If staff replied, notify client. If client replied, notify assigned staff.
    if (authorType === 'staff') {
      await emails.newComment(ticket, ticket.client, text).catch(() => {})
    }

    const comment = { id, author: req.user.name, author_id: req.user.id, role: authorType, text, created_at: new Date() }
    res.status(201).json({ comment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/tickets/:id/invoice
router.post('/:id/invoice', authenticate, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body
    if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ message: 'Valid amount required' })

    const [existing] = await execute("SELECT id FROM invoices WHERE ticket_id = ? AND status = 'unpaid'", [req.params.id])
    if (existing.length > 0) return res.status(409).json({ message: 'An unpaid invoice already exists for this ticket' })

    const id = uuidv4()
    await execute('INSERT INTO invoices (id, ticket_id, amount) VALUES (?, ?, ?)', [id, req.params.id, parseFloat(amount)])

    const ticket = await getTicketWithDetails(req.params.id)
    const invoice = { id, amount: parseFloat(amount), status: 'unpaid' }

    await emails.invoiceCreated(ticket, ticket.client, invoice).catch(() => {})

    res.status(201).json({ invoice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
