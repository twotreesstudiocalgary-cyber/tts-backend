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
