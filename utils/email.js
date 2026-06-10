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

const LOGO = 'https://portal.websitesupportcalgary.ca/logo.jpg'
const PORTAL = 'https://portal.websitesupportcalgary.ca'
const ADMIN = 'https://portal.websitesupportcalgary.ca/admin'

const emailTemplate = ({ title, greeting, body, footer_tagline, footer_sub }) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0d1b35;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0d1b35" style="background:#0d1b35;padding:30px 16px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">

  <!-- HEADER -->
  <tr><td bgcolor="#1a3a6b" style="background:#1a3a6b;padding:40px 20px 32px;text-align:center;border-radius:16px 16px 0 0">
    <img src="${LOGO}" alt="Two Trees Studio" width="90" height="90" style="border-radius:12px;display:block;margin:0 auto 18px;border:3px solid rgba(255,255,255,0.15)" />
    <div style="color:#ffffff;font-size:30px;font-weight:700;letter-spacing:-0.5px;font-family:Georgia,serif">Two Trees Studio</div>
    <div style="color:rgba(255,255,255,0.6);font-size:12px;letter-spacing:3px;margin-top:6px;text-transform:uppercase">Web Design &amp; Development</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#ffffff;padding:36px 40px">
    ${greeting ? `<p style="margin:0 0 6px;font-size:24px;font-weight:700;color:#1a202c">Hi <span style="color:#1A6BAB">${greeting},</span></p><div style="width:40px;height:3px;background:#1A6BAB;margin-bottom:20px"></div>` : ''}
    ${body}
  </td></tr>

  <!-- FOOTER TAGLINE -->
  <tr><td bgcolor="#1a3a6b" style="background:#1a3a6b;padding:24px 40px;text-align:center">
    <img src="${LOGO}" alt="" width="44" height="44" style="border-radius:50%;border:2px solid rgba(255,255,255,0.2);margin-bottom:12px;display:block;margin-left:auto;margin-right:auto" />
    <div style="color:#ffffff;font-size:16px;font-weight:700;margin-bottom:4px">${footer_tagline || "Let's build something great together."}</div>
    <div style="color:rgba(255,255,255,0.6);font-size:13px">${footer_sub || 'Thank you for being part of Two Trees Studio.'}</div>
  </td></tr>

  <!-- BOTTOM BAR -->
  <tr><td bgcolor="#0d1b35" style="background:#0d1b35;padding:16px 40px;border-radius:0 0 16px 16px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;color:rgba(255,255,255,0.5);font-size:12px">
        &#127760; Two Trees Studio &nbsp;|&nbsp; &#128205; Calgary, AB &nbsp;|&nbsp; 
        <a href="${PORTAL}" style="color:rgba(255,255,255,0.6);text-decoration:none">&#8599; Client Portal</a>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`

const credRow = (icon, label, value) => `
<tr>
  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;vertical-align:middle">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:44px;vertical-align:middle">
        <div style="width:36px;height:36px;background:#1A6BAB;border-radius:50%;text-align:center;line-height:36px;font-size:16px">${icon}</div>
      </td>
      <td style="padding-left:12px;vertical-align:middle;color:#4a5568;font-size:14px;font-weight:500;width:80px">${label}</td>
      <td style="padding-left:12px;vertical-align:middle;color:#1A6BAB;font-size:14px;font-weight:600">${value}</td>
    </tr></table>
  </td>
</tr>`

const credTable = (rows) => `
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:20px 0">
  ${rows}
</table>`

const warningBox = (text) => `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
  <tr><td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:32px;vertical-align:top;font-size:20px">&#9888;</td>
      <td style="padding-left:10px;color:#1d4ed8;font-size:13px;line-height:1.6">${text}</td>
    </tr></table>
  </td></tr>
</table>`

const actionBtn = (url, label, icon = '&#10148;') => `
<table cellpadding="0" cellspacing="0" style="margin:24px auto">
  <tr><td style="background:#1A6BAB;border-radius:10px">
    <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px">
      ${icon} &nbsp;${label}
    </a>
  </td></tr>
</table>`

const sendEmail = ({ to, subject, html, greeting, footer_tagline, footer_sub }) =>
  sendBrevoEmail({ to, subject, html: emailTemplate({ title: subject, greeting, body: html, footer_tagline, footer_sub }) })

const emails = {
  verifyEmail: (client, token) => sendEmail({
    to: client.email,
    subject: 'Verify your email — Two Trees Studio',
    greeting: client.name.split(' ')[0],
    footer_tagline: "Welcome to Two Trees Studio!",
    footer_sub: "We're excited to have you on board.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">Thanks for registering with <strong>Two Trees Studio</strong>! Please verify your email address to activate your account and get started.</p>
      ${actionBtn(`${PORTAL}/#/verify-email?token=${token}`, 'Verify My Email', '&#10003;')}
      <p style="color:#718096;font-size:12px;text-align:center;margin-top:8px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>`
  }),

  resetPassword: (email, token, isClient = true) => sendEmail({
    to: email,
    subject: 'Reset your password — Two Trees Studio',
    greeting: null,
    footer_tagline: "Account Security",
    footer_sub: "Keep your account safe.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">We received a request to reset your <strong>Two Trees Studio</strong> account password. Click the button below to set a new password.</p>
      ${actionBtn(`${PORTAL}/#/reset-password?token=${token}`, 'Reset Password', '&#128274;')}
      ${warningBox('This link expires in 1 hour. If you did not request a password reset, please ignore this email — your account is safe.')}` 
  }),

  ticketCreated: (ticket, client) => sendEmail({
    to: client.email,
    subject: `Ticket received: ${ticket.title}`,
    greeting: client.name.split(' ')[0],
    footer_tagline: "We're on it!",
    footer_sub: "Our team will review your request shortly.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">We've received your service request and our team will review it shortly. You'll be notified of any updates.</p>
      ${credTable(
        credRow('&#127903;', 'Request', `<span style="color:#1a202c">${ticket.title}</span>`) +
        credRow('&#127991;', 'Type', `<span style="color:#1a202c">${ticket.type}</span>`) +
        credRow('&#9650;', 'Priority', `<span style="color:${ticket.priority === 'urgent' ? '#e53e3e' : ticket.priority === 'normal' ? '#1A6BAB' : '#38a169'}">${ticket.priority}</span>`)
      )}
      ${actionBtn(`${PORTAL}/#/tickets/${ticket.id}`, 'View Ticket', '&#128065;')}`
  }),

  ticketStatusUpdate: (ticket, client, status) => sendEmail({
    to: client.email,
    subject: `Update on: ${ticket.title}`,
    greeting: client.name.split(' ')[0],
    footer_tagline: status === 'complete' ? "All done!" : "We're working on it!",
    footer_sub: status === 'complete' ? "Thank you for choosing Two Trees Studio." : "Your request is being handled with care.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">Your ticket status has been updated to <strong style="color:#1A6BAB">${status === 'inprogress' ? 'In Progress' : status === 'complete' ? 'Complete' : status}</strong>.</p>
      ${status === 'complete' ? `<div style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:10px;padding:16px;margin:16px 0;color:#276749;font-size:14px">&#10003; &nbsp;Your request has been completed! If you need any changes, you can reopen the ticket from your portal.</div>` : ''}
      ${actionBtn(`${PORTAL}/#/tickets/${ticket.id}`, 'View Ticket', '&#128065;')}`
  }),

  newComment: (ticket, client, commentText) => sendEmail({
    to: client.email,
    subject: `New message: ${ticket.title}`,
    greeting: client.name.split(' ')[0],
    footer_tagline: "We're here to help.",
    footer_sub: "Reply anytime through your client portal.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">Our team has sent you a message on your ticket <strong>${ticket.title}</strong>:</p>
      <div style="background:#f0f7ff;border-left:4px solid #1A6BAB;border-radius:0 10px 10px 0;padding:16px 20px;margin:16px 0;font-size:14px;color:#1a202c;line-height:1.7">${commentText}</div>
      ${actionBtn(`${PORTAL}/#/tickets/${ticket.id}`, 'Reply', '&#128172;')}`
  }),

  newTicketAdmin: (ticket, adminEmail) => sendEmail({
    to: adminEmail,
    subject: `New ticket: ${ticket.title}`,
    greeting: null,
    footer_tagline: "New service request received.",
    footer_sub: "Assign and respond promptly.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">A new service ticket has been submitted and is waiting for assignment.</p>
      ${credTable(
        credRow('&#128100;', 'Client', `<span style="color:#1a202c;font-weight:700">${ticket.client_name}</span>`) +
        credRow('&#127903;', 'Title', `<span style="color:#1a202c">${ticket.title}</span>`) +
        credRow('&#127991;', 'Type', `<span style="color:#1a202c">${ticket.type}</span>`) +
        credRow('&#9650;', 'Priority', `<span style="color:${ticket.priority === 'urgent' ? '#e53e3e' : ticket.priority === 'normal' ? '#1A6BAB' : '#38a169'};font-weight:700;text-transform:uppercase">${ticket.priority}</span>`)
      )}
      ${actionBtn(`${ADMIN}/#/tickets/${ticket.id}`, 'View in Dashboard', '&#9881;')}`
  }),

  staffInvite: (member, tempPassword) => sendEmail({
    to: member.email,
    subject: 'You have been invited to Two Trees Studio Dashboard',
    greeting: member.name.split(' ')[0],
    footer_tagline: "Let's build something great together.",
    footer_sub: "Thank you for being part of Two Trees Studio.",
    html: `
      <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7">You have been added as a team member on the <strong>Two Trees Studio</strong> admin dashboard. Use the credentials below to sign in and get started.</p>
      ${credTable(
        credRow('&#9993;', 'Email', member.email) +
        credRow('&#128274;', 'Password', `<strong style="font-size:16px;letter-spacing:1px;color:#1a202c">${tempPassword}</strong>`)
      )}
      ${warningBox('Please change your password immediately after your first login.')}
      ${actionBtn(`${ADMIN}/#/login`, 'Go to Dashboard', '&#127807;')}`
  })
}

module.exports = { sendEmail, emails }
