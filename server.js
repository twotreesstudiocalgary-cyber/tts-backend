require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { initDB } = require('./db')

const app = express()

// Middleware
app.use(helmet())
app.use(morgan('dev'))
app.use(cors({
  origin: function(origin, callback) {
    callback(null, true)
  },
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/client/auth', require('./routes/clientAuth'))
app.use('/api/admin/auth', require('./routes/adminAuth'))
app.use('/api/tickets', require('./routes/tickets'))
app.use('/api', require('./routes/misc'))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
})

const PORT = process.env.PORT || 4000

const start = async () => {
  try {
    await initDB()
    app.listen(PORT, () => {
      console.log(`✅ WSC Backend running on port ${PORT}`)
      console.log(`   Health: http://localhost:${PORT}/health`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

// ─── Recurring Tickets Cron ───────────────────────────────────────────────────
const checkRecurringTickets = async () => {
  const now = new Date()
  if (now.getDate() !== 1) return // Only run on 1st of month
  console.log('🔄 Running recurring tickets job...')
  try {
    const { pool, execute } = require('./db')
    const { v4: uuidv4 } = require('uuid')
    const [templates] = await execute('SELECT * FROM recurring_tickets WHERE active = 1')
    for (const tmpl of templates) {
      // Get eligible clients based on scope
      const [clients] = await execute(
        "SELECT id, name, email FROM clients WHERE status = 'active' AND customer_type = 'support_plan'"
      )
      for (const client of clients) {
        // Check if ticket already created this month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const [existing] = await execute(
          "SELECT id FROM tickets WHERE client_id = ? AND title = ? AND created_at >= ?",
          [client.id, tmpl.title, startOfMonth]
        )
        if (existing.length > 0) continue // Already created
        const id = uuidv4()
        await execute(
          'INSERT INTO tickets (id, title, type, priority, description, client_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, tmpl.title, tmpl.type, tmpl.priority, tmpl.description || '', client.id, tmpl.assignee_id || null]
        )
        console.log(`✅ Recurring ticket created for ${client.name}: ${tmpl.title}`)
      }
    }
  } catch (err) { console.error('Recurring ticket error:', err) }
}

// Check every hour
setInterval(checkRecurringTickets, 60 * 60 * 1000)
// Also check on startup
setTimeout(checkRecurringTickets, 5000)
