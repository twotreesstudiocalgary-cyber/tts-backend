const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { pool } = require('../db')
const { emails } = require('../utils/email')
const { authenticate, requireSuperAdmin } = require('../middleware/auth')

const signToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN }
)

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' })

    const user = rows[0]
    if (user.status === 'inactive') return res.status(403).json({ message: 'Account is deactivated' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' })

    const token = signToken(user)
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/admin/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (rows.length > 0) {
      const token = uuidv4()
      const expires = new Date(Date.now() + 60 * 60 * 1000)
      await pool.execute('INSERT INTO password_resets (id, email, token, expires_at) VALUES (?, ?, ?, ?)', [uuidv4(), email, token, expires])
      await emails.resetPassword(email, token, false).catch(() => {})
    }
    res.json({ message: 'If an account exists, a reset email has been sent.' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/admin/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [req.user.id])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/admin/team
router.get('/team', authenticate, async (req, res) => {
  try {
    const [team] = await pool.execute(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
        COUNT(t.id) as tickets_assigned
      FROM users u
      LEFT JOIN tickets t ON t.assignee_id = u.id AND t.status != 'complete'
      GROUP BY u.id ORDER BY u.created_at ASC
    `)
    res.json({ team })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/admin/team/invite
router.post('/team/invite', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email } = req.body
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) return res.status(409).json({ message: 'A user with this email already exists' })

    const tempPassword = 'WSC@' + Math.random().toString(36).slice(2, 8).toUpperCase()
    const hashed = await bcrypt.hash(tempPassword, 12)
    const id = uuidv4()

    await pool.execute('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)', [id, name, email, hashed, 'staff'])
    const member = { id, name, email, role: 'staff', status: 'active', created_at: new Date(), tickets_assigned: 0 }

    await emails.staffInvite(member, tempPassword).catch(() => {})
    res.status(201).json({ member })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/admin/team/:id/toggle-status
router.put('/team/:id/toggle-status', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (rows[0].role === 'superadmin') return res.status(403).json({ message: 'Cannot deactivate super admin' })

    const newStatus = rows[0].status === 'active' ? 'inactive' : 'active'
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, req.params.id])
    res.json({ member: { ...rows[0], status: newStatus } })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/admin/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current, newPass } = req.body
    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id])
    const valid = await bcrypt.compare(current, rows[0].password)
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' })
    const hashed = await bcrypt.hash(newPass, 12)
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id])
    res.json({ message: 'Password updated' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
