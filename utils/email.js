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
        if (res.statusCode >= 200 && res.statusCode < 300) console.log(`✅ Email sent to ${to}: ${subject}`)
        else console.error('Brevo error:', body)
        resolve()
      })
    })
    req.on('error', err => { console.error('Email error:', err.message); resolve() })
    req.write(data)
    req.end()
  })
}

const emailTemplate = (content) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Two Trees Studio</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:30px 10px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0F2340 0%,#1A6BAB 100%);padding:32px 36px;text-align:center">
          <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:28px;line-height:56px">🌳</div>
          <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Two Trees Studio</div>
          <div style="color:rgba(255,255,255,0.65);font-size:13px;margin-top:4px">Web Design &amp; Development · Calgary, AB</div>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:32px 36px;color:#1A202C;font-size:15px;line-height:1.7">
          ${content}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f7f9fc;padding:16px 36px;border-top:1px solid #E2E8F0;text-align:center">
          <p style="margin:0;font-size:12px;color:#718096">
            Two Trees Studio · Calgary, AB · 
            <a href="https://portal.websitesupportcalgary.ca" style="color:#1A6BAB;text-decoration:none">Client Portal</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`

const btn = (url, label) => `<table cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#1A6BAB;border-radius:8px;padding:0"><a href="${url}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">${label}</a></td></tr></table>`

const infoTable = (rows) => `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">
${rows.map(([label, value], i) => `<tr style="background:${i % 2 === 0 ? '#f7f9fc' : '#ffffff'}"><td style="padding:10px 14px;font-size:13px;color:#4A5568;width:110px;font-weight:500">${label}</td><td style="padding:10px 14px;font-size:13px;color:#1A202C">${value}</td></tr>`).join('')}
</table>`

const sendEmail = ({ to, subject, html }) => sendBrevoEmail({ to, subject, html: emailTemplate(html) })

const emails = {
  verifyEmail: (client, token) => sendEmail({
    to: client.email,
    subject: '✉️ Verify your email — Two Trees Studio',
    html: `<p style="margin:0 0 16px">Hi <strong>${client.name}</strong>,</p>
<p style="margin:0 0 16px">Thanks for registering with Two Trees Studio! Please verify your email address to activate your account.</p>
${btn(`https://portal.websitesupportcalgary.ca/#/verify-email?token=${token}`, 'Verify My Email')}
<p style="margin:16px 0 0;font-size:13px;color:#718096">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>`
  }),

  resetPassword: (email, token, isClient = true) => sendEmail({
    to: email,
    subject: '🔐 Reset your password — Two Trees Studio',
    html: `<p style="margin:0 0 16px">You requested a password reset for your Two Trees Studio account.</p>
${btn(`https://portal.websitesupportcalgary.ca/#/reset-password?token=${token}`, 'Reset Password')}
<p style="margin:16px 0 0;font-size:13px;color:#718096">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`
  }),

  ticketCreated: (ticket, client) => sendEmail({
    to: client.email,
    subject: `🎫 We received your request: ${ticket.title}`,
    html: `<p style="margin:0 0 16px">Hi <strong>${client.name}</strong>,</p>
<p style="margin:0 0 16px">We've received your service request and our team will review it shortly.</p>
${infoTable([['Request', `<strong>${ticket.title}</strong>`], ['Type', ticket.type], ['Priority', ticket.priority]])}
${btn(`https://portal.websitesupportcalgary.ca/#/tickets/${ticket.id}`, 'View Ticket')}`
  }),

  ticketStatusUpdate: (ticket, client, status) => sendEmail({
    to: client.email,
    subject: `📋 Update on your request: ${ticket.title}`,
    html: `<p style="margin:0 0 16px">Hi <strong>${client.name}</strong>,</p>
<p style="margin:0 0 16px">Your ticket status has been updated to <strong style="color:#1A6BAB">${status === 'inprogress' ? 'In Progress' : status === 'complete' ? 'Complete ✅' : status}</strong>.</p>
${status === 'complete' ? '<p style="margin:0 0 16px;padding:12px 16px;background:#f0fff4;border-left:4px solid #38A169;border-radius:0 8px 8px 0;color:#276749">Your request has been completed! If you have any questions, you can reopen the ticket from your portal.</p>' : ''}
${btn(`https://portal.websitesupportcalgary.ca/#/tickets/${ticket.id}`, 'View Ticket')}`
  }),

  newComment: (ticket, client, commentText) => sendEmail({
    to: client.email,
    subject: `💬 New message on: ${ticket.title}`,
    html: `<p style="margin:0 0 16px">Hi <strong>${client.name}</strong>,</p>
<p style="margin:0 0 16px">Our team has sent you a message on your ticket:</p>
<blockquote style="margin:16px 0;padding:14px 18px;background:#f0f7ff;border-left:4px solid #1A6BAB;border-radius:0 8px 8px 0;font-size:14px;color:#1A202C">${commentText}</blockquote>
${btn(`https://portal.websitesupportcalgary.ca/#/tickets/${ticket.id}`, 'Reply')}`
  }),

  newTicketAdmin: (ticket, adminEmail) => sendEmail({
    to: adminEmail,
    subject: `🎫 New ticket: ${ticket.title}`,
    html: `<p style="margin:0 0 16px">A new service ticket has been submitted.</p>
${infoTable([['Client', `<strong>${ticket.client_name}</strong>`], ['Title', ticket.title], ['Type', ticket.type], ['Priority', `<strong style="color:${ticket.priority === 'urgent' ? '#E53E3E' : ticket.priority === 'normal' ? '#3182CE' : '#38A169'}">${ticket.priority}</strong>`]])}
${btn(`https://portal.websitesupportcalgary.ca/admin/#/tickets/${ticket.id}`, 'View in Dashboard')}`
  }),

  staffInvite: (member, tempPassword) => sendEmail({
    to: member.email,
    subject: '👋 You have been invited to Two Trees Studio Dashboard',
    html: `<p style="margin:0 0 16px">Hi <strong>${member.name}</strong>,</p>
<p style="margin:0 0 16px">You have been added as a team member on the Two Trees Studio admin dashboard. Use the credentials below to sign in.</p>
${infoTable([['Email', member.email], ['Password', `<strong style="font-size:16px;letter-spacing:1px">${tempPassword}</strong>`]])}
<p style="margin:16px 0;padding:12px 16px;background:#fff5f5;border-left:4px solid #E53E3E;border-radius:0 8px 8px 0;color:#C53030;font-size:13px">⚠️ Please change your password immediately after your first login.</p>
${btn('https://portal.websitesupportcalgary.ca/admin/#/login', 'Go to Dashboard')}`
  })
}

module.exports = { sendEmail, emails }
