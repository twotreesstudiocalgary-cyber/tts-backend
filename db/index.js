const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// Convert MySQL ? placeholders to PostgreSQL $1, $2...
const execute = async (query, params = []) => {
  let i = 0
  const pgQuery = query.replace(/\?/g, () => `$${++i}`)
  // Convert MySQL-style NOW() interval to PostgreSQL
  .replace(/DATE_SUB\(NOW\(\), INTERVAL (\d+) DAY\)/g, "NOW() - INTERVAL '$1 days'")
  .replace(/TINYINT\(1\)/g, 'SMALLINT')
  const result = await pool.query(pgQuery, params)
  return [result.rows, result.fields]
}

pool.execute = execute

const initDB = async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'staff', status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS clients (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(150) UNIQUE, password VARCHAR(255), company VARCHAR(150), customer_type VARCHAR(50) DEFAULT 'new_customer', status VARCHAR(20) DEFAULT 'active', email_verified SMALLINT DEFAULT 0, verification_token VARCHAR(255), reset_token VARCHAR(255), reset_token_expires TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    // Allow null email for existing installs
    await pool.query(`ALTER TABLE clients ALTER COLUMN email DROP NOT NULL`).catch(() => {})
    await pool.query(`ALTER TABLE clients ALTER COLUMN password DROP NOT NULL`).catch(() => {})
    await pool.query(`CREATE TABLE IF NOT EXISTS ticket_types (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL, active SMALLINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS ticket_type_options (id VARCHAR(36) PRIMARY KEY, ticket_type_id VARCHAR(36) NOT NULL, label VARCHAR(150) NOT NULL, sort_order INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS ticket_selected_options (id VARCHAR(36) PRIMARY KEY, ticket_id VARCHAR(36) NOT NULL, option_id VARCHAR(36) NOT NULL, option_label VARCHAR(150) NOT NULL)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(36) PRIMARY KEY, ticket_number SERIAL, title VARCHAR(255) NOT NULL, type VARCHAR(100) NOT NULL, status VARCHAR(20) DEFAULT 'new', priority VARCHAR(20) DEFAULT 'normal', description TEXT, internal_note TEXT, client_id VARCHAR(36) NOT NULL, assignee_id VARCHAR(36), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    // Add ticket_number column to existing installs
    await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number SERIAL`).catch(() => {})
    // Start ticket numbers at 100
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 100`).catch(() => {})
    await pool.query(`ALTER TABLE tickets ALTER COLUMN ticket_number SET DEFAULT nextval('ticket_number_seq')`).catch(() => {})
    await pool.query(`CREATE TABLE IF NOT EXISTS comments (id VARCHAR(36) PRIMARY KEY, ticket_id VARCHAR(36) NOT NULL, author_id VARCHAR(36) NOT NULL, author_type VARCHAR(20) NOT NULL, text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS invoices (id VARCHAR(36) PRIMARY KEY, ticket_id VARCHAR(36) NOT NULL, amount DECIMAL(10,2) NOT NULL, status VARCHAR(20) DEFAULT 'unpaid', paid_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS internal_notes (id VARCHAR(36) PRIMARY KEY, ticket_id VARCHAR(36) NOT NULL, author_id VARCHAR(36) NOT NULL, author_name VARCHAR(100) NOT NULL, text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (id VARCHAR(36) PRIMARY KEY, email VARCHAR(150) NOT NULL, token VARCHAR(255) NOT NULL, expires_at TIMESTAMP NOT NULL, used SMALLINT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    console.log('✅ Database tables ready')

    const { rows: types } = await pool.query('SELECT COUNT(*) as count FROM ticket_types')
    if (parseInt(types[0].count) === 0) {
      const { v4: uuidv4 } = require('uuid')
      for (const name of ['New Page','Website Update','Bug Fix','SEO','Logo / Design','Hosting Support','Other']) {
        await pool.query('INSERT INTO ticket_types (id, name) VALUES ($1, $2)', [uuidv4(), name])
      }
      console.log('✅ Ticket types seeded')
    }

    const { rows: users } = await pool.query('SELECT COUNT(*) as count FROM users')
    if (parseInt(users[0].count) === 0) {
      const bcrypt = require('bcryptjs')
      const { v4: uuidv4 } = require('uuid')
      const hash = await bcrypt.hash('Admin@TTS2026!', 12)
      await pool.query('INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)', [uuidv4(), 'Admin', 'admin@twotreesstudio.ca', hash, 'superadmin'])
      console.log('✅ Superadmin created: admin@twotreesstudio.ca / Admin@TTS2026!')
    }
  } catch (err) {
    console.error('DB init error:', err)
    throw err
  }
}

module.exports = { pool, initDB, execute }
