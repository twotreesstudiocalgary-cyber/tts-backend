const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
})

const initDB = async () => {
  const conn = await pool.getConnection()
  try {
    // Users table (staff + superadmin)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('superadmin','staff') DEFAULT 'staff',
        status ENUM('active','inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // Clients table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        company VARCHAR(150),
        status ENUM('active','inactive') DEFAULT 'active',
        customer_type ENUM('new_customer','support_plan','existing_customer') DEFAULT 'new_customer',
        email_verified TINYINT(1) DEFAULT 0,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expires DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // Ticket types table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ticket_types (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Tickets table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        status ENUM('new','inprogress','review','complete','reopened') DEFAULT 'new',
        priority ENUM('low','normal','urgent') DEFAULT 'normal',
        description TEXT,
        internal_note TEXT,
        client_id VARCHAR(36) NOT NULL,
        assignee_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    // Ticket attachments
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id VARCHAR(36) PRIMARY KEY,
        ticket_id VARCHAR(36) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        mimetype VARCHAR(100),
        size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `)

    // Comments table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR(36) PRIMARY KEY,
        ticket_id VARCHAR(36) NOT NULL,
        author_id VARCHAR(36) NOT NULL,
        author_type ENUM('client','staff') NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `)

    // Invoices table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(36) PRIMARY KEY,
        ticket_id VARCHAR(36) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('unpaid','paid') DEFAULT 'unpaid',
        stripe_payment_intent VARCHAR(255),
        paid_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `)

    // Notifications log
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        user_type ENUM('client','staff') NOT NULL,
        ticket_id VARCHAR(36),
        type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        read_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Password reset tokens for staff
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(150) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('✅ Database tables initialized')

    // Seed default ticket types if empty
    const [types] = await conn.execute('SELECT COUNT(*) as count FROM ticket_types')
    if (types[0].count === 0) {
      const defaultTypes = ['New Page', 'Website Update', 'Bug Fix', 'SEO', 'Logo / Design', 'Hosting Support', 'Other']
      for (const name of defaultTypes) {
        const { v4: uuidv4 } = require('uuid')
        await conn.execute('INSERT INTO ticket_types (id, name) VALUES (?, ?)', [uuidv4(), name])
      }
      console.log('✅ Default ticket types seeded')
    }

    // Seed superadmin if no users exist
    const [users] = await conn.execute('SELECT COUNT(*) as count FROM users')
    if (users[0].count === 0) {
      const bcrypt = require('bcryptjs')
      const { v4: uuidv4 } = require('uuid')
      const hashedPassword = await bcrypt.hash('Admin@WSC2026!', 12)
      await conn.execute(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), 'Admin', 'admin@websitesupportcalgary.ca', hashedPassword, 'superadmin']
      )
      console.log('✅ Default superadmin created: admin@websitesupportcalgary.ca / Admin@WSC2026!')
    }

  } finally {
    conn.release()
  }
}

module.exports = { pool, initDB }
