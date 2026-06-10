const nodemailer = require('nodemailer')
const https = require('https')

const sendBrevoEmail = async ({ to, subject, html }) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      sender: { email: 'info@twotreesstudio.ca', name: 'Two Trees Studio' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data)
      }
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`Email sent to ${to}: ${subject}`)
          resolve()
        } else {
          console.error('Brevo error:', body)
          resolve()
        }
      })
    })
    req.on('error', err => { console.error('Email error:', err.message); resolve() })
    req.write(data)
    req.end()
  })
}

const emailTemplate = (content) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f7f9fc;margin:0;padding:0}.wrap{max-width:560px;margin:30px auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}.header{background:linear-gradient(135deg,#0F2340,#1A6BAB);padding:22px 28px}.header h1{color:white;margin:0;font-size:17px}.body{padding:26px 28px;color:#1A202C;font-size:14px;line-height:1.7}.btn{display:inline-block;background:#1A6BAB;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:500;margin:14px 0}.footer{padding:14px 28px;background:#f7f9fc;font-size:12px;color:#718096;border-top:1px solid #E2E8F0}</style></head><body><div class="wrap"><div class="header"><h1>Two Trees Studio</h1><div style="color:rgba(255,255,255,0.6);font-size:12px">Web Design & Development</div></div><div class="body">${content}</div><div class="footer">Two Trees Studio &mdash; <a href="https://portal.websitesupportcalgary.ca" style="color:#1A6BAB">Client Portal</a></div></div></body></html>`

const sendEmail = ({ to, subject, html }) => sendBrevoEmail({ to, subject, html: emailTemplate(html) })

const emails = {
  verifyEmail: (client, token) => sendEmail({
    to: client.email,
    subject: 'Verify your email — Two Trees Studio',
    html: `<p>Hi ${client.name},</p><p>Thanks for registering! Please verify your email to activate your account.</p><a href="https://portal.websitesupportcalgary.ca/verify-email?token=${token}" class="btn">Verify My Email</a><p style="color:#718096;font-size:13px;margin-top:16px">This link expires in 24 hours.</p>`
  }),
  resetPassword: (email, token, isClient = true) => sendEmail({
    to: email,
    subject: 'Reset your password — Two Trees Studio',
    html: `<p>You requested a password reset.</p><a href="https://portal.websitesupportcalgary.ca/reset-password?token=${token}" class="btn">Reset Password</a><p style="color:#718096;font-size:13px;margin-top:16px">This link expires in 1 hour.</p>`
  }),
  ticketCreated: (ticket, client) => sendEmail({
    to: client.email,
    subject: `We received your request: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>We received your service request and will review it shortly.</p><p><strong>${ticket.title}</strong> &mdash; ${ticket.type}</p><a href="https://portal.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">View Ticket</a>`
  }),
  ticketStatusUpdate: (ticket, client, status) => sendEmail({
    to: client.email,
    subject: `Update on your request: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>Your ticket status updated to <strong>${status === 'inprogress' ? 'In Progress' : status === 'complete' ? 'Complete' : status}</strong>.</p>${status === 'complete' ? '<p>Your request is complete! You can reopen it from your portal if needed.</p>' : ''}<a href="https://portal.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">View Ticket</a>`
  }),
  newComment: (ticket, client, commentText) => sendEmail({
    to: client.email,
    subject: `New message on: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>Our team sent you a message.</p><blockquote style="border-left:3px solid #1A6BAB;padding:10px 16px;background:#f7f9fc;margin:16px 0;border-radius:0 6px 6px 0">${commentText}</blockquote><a href="https://portal.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">Reply</a>`
  }),
  newTicketAdmin: (ticket, adminEmail) => sendEmail({
    to: adminEmail,
    subject: `New ticket: ${ticket.title}`,
    html: `<p>New ticket from <strong>${ticket.client_name}</strong>.</p><p><strong>${ticket.title}</strong> &mdash; ${ticket.type} &mdash; ${ticket.priority} priority</p><a href="https://portal.websitesupportcalgary.ca/admin/tickets/${ticket.id}" class="btn">View in Dashboard</a>`
  }),
  staffInvite: (member, tempPassword) => sendEmail({
    to: member.email,
    subject: 'You have been added to Two Trees Studio Dashboard',
    html: `<p>Hi ${member.name},</p><p>You have been added as a team member.</p><p>Email: <strong>${member.email}</strong><br>Temp password: <strong>${tempPassword}</strong></p><p style="color:#E53E3E;font-size:13px">Please change your password after first login.</p><a href="https://portal.websitesupportcalgary.ca/admin/login" class="btn">Go to Dashboard</a>`
  })
}

module.exports = { sendEmail, emails }
