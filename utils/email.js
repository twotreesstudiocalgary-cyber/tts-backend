const https = require('https')

const sendBrevoEmail = async ({ to, subject, html }) => {
  return new Promise((resolve) => {
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
          console.log(`✅ Email sent to ${to}: ${subject}`)
        } else {
          console.error('Brevo error:', body)
        }
        resolve()
      })
    })
    req.on('error', err => { console.error('Email error:', err.message); resolve() })
    req.write(data)
    req.end()
  })
}

const emailTemplate = (content) => `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)}
.header{background:linear-gradient(135deg,#0F2340,#1A6BAB);padding:28px 32px;text-align:center}
.header img{width:60px;height:60px;border-radius:10px;object-fit:cover;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto}
.header h1{color:white;margin:0;font-size:20px;font-weight:700}
.header p{color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px}
.body{padding:28px 32px;color:#1A202C;font-size:14px;line-height:1.7}
.btn{display:inline-block;background:#1A6BAB;color:white !important;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px}
.btn:hover{background:#145A91}
.footer{padding:16px 32px;background:#f7f9fc;font-size:12px;color:#718096;border-top:1px solid #E2E8F0;text-align:center}
.footer a{color:#1A6BAB;text-decoration:none}
table{width:100%;border-collapse:collapse;margin:16px 0}
table td{padding:9px 12px;font-size:13px;border-bottom:1px solid #E2E8F0}
table tr:last-child td{border-bottom:none}
table tr:nth-child(even) td{background:#f7f9fc}
</style></head><body>
<div class="wrap">
  <div class="header">
    <img src="https://portal.websitesupportcalgary.ca/logo.jpg" alt="Two Trees Studio" />
    <h1>Two Trees Studio</h1>
    <p>Web Design &amp; Development</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    Two Trees Studio &mdash; Calgary, AB &mdash; 
    <a href="https://portal.websitesupportcalgary.ca">Client Portal</a>
  </div>
</div>
</body></html>`

const sendEmail = ({ to, subject, html }) => sendBrevoEmail({ to, subject, html: emailTemplate(html) })

const emails = {
  verifyEmail: (client, token) => sendEmail({
    to: client.email,
    subject: 'Verify your email — Two Trees Studio',
    html: `<p>Hi ${client.name},</p><p>Thanks for registering with Two Trees Studio! Please verify your email address to activate your account.</p><center><a href="https://portal.websitesupportcalgary.ca/#/verify-email?token=${token}" class="btn">Verify My Email</a></center><p style="color:#718096;font-size:13px;margin-top:16px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
  }),

  resetPassword: (email, token, isClient = true) => sendEmail({
    to: email,
    subject: 'Reset your password — Two Trees Studio',
    html: `<p>You requested a password reset for your Two Trees Studio account.</p><center><a href="https://portal.websitesupportcalgary.ca/#/reset-password?token=${token}" class="btn">Reset Password</a></center><p style="color:#718096;font-size:13px;margin-top:16px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`
  }),

  ticketCreated: (ticket, client) => sendEmail({
    to: client.email,
    subject: `We received your request: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>We've received your service request and our team will review it shortly.</p><table><tr><td style="color:#4A5568;width:100px">Request</td><td><strong>${ticket.title}</strong></td></tr><tr><td style="color:#4A5568">Type</td><td>${ticket.type}</td></tr><tr><td style="color:#4A5568">Priority</td><td>${ticket.priority}</td></tr></table><center><a href="https://portal.websitesupportcalgary.ca/#/tickets/${ticket.id}" class="btn">View Ticket</a></center>`
  }),

  ticketStatusUpdate: (ticket, client, status) => sendEmail({
    to: client.email,
    subject: `Update on your request: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>Your ticket status has been updated to <strong>${status === 'inprogress' ? 'In Progress' : status === 'complete' ? 'Complete ✅' : status}</strong>.</p>${status === 'complete' ? '<p>Your request has been completed! If you have any issues, you can reopen the ticket from your portal.</p>' : ''}<center><a href="https://portal.websitesupportcalgary.ca/#/tickets/${ticket.id}" class="btn">View Ticket</a></center>`
  }),

  newComment: (ticket, client, commentText) => sendEmail({
    to: client.email,
    subject: `New message on: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>Our team has sent you a message on your ticket.</p><blockquote style="border-left:4px solid #1A6BAB;padding:12px 16px;background:#f0f7ff;margin:16px 0;border-radius:0 8px 8px 0;font-size:14px">${commentText}</blockquote><center><a href="https://portal.websitesupportcalgary.ca/#/tickets/${ticket.id}" class="btn">Reply</a></center>`
  }),

  newTicketAdmin: (ticket, adminEmail) => sendEmail({
    to: adminEmail,
    subject: `🎫 New ticket: ${ticket.title}`,
    html: `<p>A new service ticket has been submitted.</p><table><tr><td style="color:#4A5568;width:100px">Client</td><td><strong>${ticket.client_name}</strong></td></tr><tr><td style="color:#4A5568">Title</td><td>${ticket.title}</td></tr><tr><td style="color:#4A5568">Type</td><td>${ticket.type}</td></tr><tr><td style="color:#4A5568">Priority</td><td>${ticket.priority}</td></tr></table><center><a href="https://portal.websitesupportcalgary.ca/admin/#/tickets/${ticket.id}" class="btn">View in Dashboard</a></center>`
  }),

  staffInvite: (member, tempPassword) => sendEmail({
    to: member.email,
    subject: 'You have been invited to Two Trees Studio Dashboard',
    html: `<p>Hi ${member.name},</p><p>You have been added as a team member on the Two Trees Studio admin dashboard.</p><table><tr><td style="color:#4A5568;width:100px">Email</td><td>${member.email}</td></tr><tr><td style="color:#4A5568">Password</td><td><strong style="font-size:16px">${tempPassword}</strong></td></tr></table><p style="color:#E53E3E;font-size:13px">⚠️ Please change your password after first login.</p><center><a href="https://portal.websitesupportcalgary.ca/admin/#/login" class="btn">Go to Dashboard</a></center>`
  })
}

module.exports = { sendEmail, emails }
