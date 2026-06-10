const jwt = require('jsonwebtoken')
const { pool } = require('../db')

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' })
    }
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

const requireAdmin = (req, res, next) => {
  if (!['staff', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Staff access required' })
  }
  next()
}

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required' })
  }
  next()
}

const requireClient = (req, res, next) => {
  if (req.user?.role !== 'client') {
    return res.status(403).json({ message: 'Client access required' })
  }
  next()
}

module.exports = { authenticate, requireAdmin, requireSuperAdmin, requireClient }
