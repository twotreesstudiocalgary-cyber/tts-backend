const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { pool, execute } = require('../db')
const { emails } = require('../utils/email')
const { authenticate } = require('../middleware/auth')

const signToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: 'client', name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN }
)

// POST /api/client/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, company, customer_type } = req.body
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const [existing] = await execute('SELECT id FROM clients WHERE email = ?', [email])
    if (existing.length > 0) return res.status(409).json({ message: 'An account with this email already exists' })

    const hashedPassword = await bcrypt.hash(password, 12)
    const id = uuidv4()
    const verificationToken = uuidv4()
    const validType = ['new_customer','support_plan','existing_customer'].includes(customer_type) ? customer_type : 'new_customer'

    await execute(
      'INSERT INTO clients (id, name, email, password, company, customer_type, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, company || null, validType, verificationToken]
    )

    const user = { id, name, email, company: company || null }
    await emails.verifyEmail(user, verificationToken).catch(e => console.error('Email error:', e))

    res.status(201).json({ message: 'Account created. Please check your email to verify your account.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/client/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' })

    const [rows] = await execute('SELECT * FROM clients WHERE email = ?', [email])
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' })

    const client = rows[0]
    if (client.status === 'inactive') return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' })

    const valid = await bcrypt.compare(password, client.password)
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' })

    const token = signToken(client)
    res.json({ user: { id: client.id, name: client.name, email: client.email, company: client.company, role: 'client' }, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/client/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ message: 'Token is required' })

    const [rows] = await execute('SELECT * FROM clients WHERE verification_token = ?', [token])
    if (rows.length === 0) return res.status(400).json({ message: 'Invalid or already used verification link' })

    await execute('UPDATE clients SET email_verified = 1, verification_token = NULL WHERE id = ?', [rows[0].id])

    const client = rows[0]
    const jwtToken = signToken(client)
    res.json({ message: 'Email verified!', user: { id: client.id, name: client.name, email: client.email, company: client.company, role: 'client' }, token: jwtToken })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/client/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const [rows] = await execute('SELECT id, name FROM clients WHERE email = ?', [email])
    if (rows.length > 0) {
      const token = uuidv4()
      const expires = new Date(Date.now() + 60 * 60 * 1000)
      await execute('INSERT INTO password_resets (id, email, token, expires_at) VALUES (?, ?, ?, ?)', [uuidv4(), email, token, expires])
      await emails.resetPassword(email, token, true).catch(() => {})
    }
    res.json({ message: 'If an account exists, a reset email has been sent.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/client/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' })

    const [rows] = await execute('SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()', [token])
    if (rows.length === 0) return res.status(400).json({ message: 'Invalid or expired reset link' })

    const hashed = await bcrypt.hash(password, 12)
    await execute('UPDATE clients SET password = ? WHERE email = ?', [hashed, rows[0].email])
    await execute('UPDATE password_resets SET used = 1 WHERE token = ?', [token])

    res.json({ message: 'Password reset successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/client/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await execute('SELECT id, name, email, company, status FROM clients WHERE id = ?', [req.user.id])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    res.json({ user: { ...rows[0], role: 'client' } })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/client/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email, company } = req.body
    await execute('UPDATE clients SET name = ?, email = ?, company = ? WHERE id = ?', [name, email, company || null, req.user.id])
    res.json({ user: { id: req.user.id, name, email, company, role: 'client' } })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/client/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current, newPass } = req.body
    const [rows] = await execute('SELECT password FROM clients WHERE id = ?', [req.user.id])
    const valid = await bcrypt.compare(current, rows[0].password)
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' })
    const hashed = await bcrypt.hash(newPass, 12)
    await execute('UPDATE clients SET password = ? WHERE id = ?', [hashed, req.user.id])
    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
