const SibApiV3Sdk = require('@getbrevo/brevo')

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY)

const FROM = { email: 'info@twotreesstudio.ca', name: 'Two Trees Studio' }

const emailTemplate = (content) => `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;background:#f7f9fc;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#0F2340,#1A6BAB);padding:22px 28px;display:flex;align-items:center;gap:14px}
  .header h1{color:white;margin:0;font-size:17px}
  .body{padding:26px 28px;color:#1A202C;font-size:14px;line-height:1.7}
  .btn{display:inline-block;background:#1A6BAB;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:500;margin:14px 0}
  .footer{padding:14px 28px;background:#f7f9fc;font-size:12px;color:#718096;border-top:1px solid #E2E8F0}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div>
      <h1>Two Trees Studio</h1>
      <div style="color:rgba(255,255,255,0.6);font-size:12px">Web Design & Development</div>
    </div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Two Trees Studio &mdash; <a href="https://portal.websitesupportcalgary.ca" style="color:#1A6BAB">Client Portal</a></div>
</div>
</body></html>`

const sendEmail = async ({ to, subject, html }) => {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.sender = FROM
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = emailTemplate(html)
    await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log(`Email sent to ${to}: ${subject}`)
  } catch (err) {
    console.error('Brevo email error:', err?.response?.body || err.message)
  }
}

const emails = {
  verifyEmail: (client, token) => sendEmail({
    to: client.email,
    subject: 'Verify your email — Two Trees Studio',
    html: `<p>Hi ${client.name},</p><p>Thanks for registering! Please verify your email address to activate your account.</p><a href="https://portal.websitesupportcalgary.ca/verify-email?token=${token}" class="btn">Verify My Email</a><p style="color:#718096;font-size:13px;margin-top:16px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
  }),

  resetPassword: (email, token, isClient = true) => sendEmail({
    to: email,
    subject: 'Reset your password — Two Trees Studio',
    html: `<p>You requested a password reset for your Two Trees Studio account.</p><a href="https://${isClient ? 'portal' : 'tickets'}.websitesupportcalgary.ca/reset-password?token=${token}" class="btn">Reset Password</a><p style="color:#718096;font-size:13px;margin-top:16px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>`
  }),

  ticketCreated: (ticket, client) => sendEmail({
    to: client.email,
    subject: `We received your request: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>We've received your service request and our team will review it shortly.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568;width:100px">Request</td><td style="padding:8px;font-size:13px;font-weight:500">${ticket.title}</td></tr><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568">Type</td><td style="padding:8px;font-size:13px">${ticket.type}</td></tr><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568">Priority</td><td style="padding:8px;font-size:13px">${ticket.priority}</td></tr></table><a href="https://portal.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">View Ticket</a>`
  }),

  ticketStatusUpdate: (ticket, client, status) => sendEmail({
    to: client.email,
    subject: `Update on your request: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>Your ticket status has been updated to <strong>${status === 'inprogress' ? 'In Progress' : status === 'complete' ? 'Complete' : status}</strong>.</p>${status === 'complete' ? '<p>🎉 Your request has been completed! If you have any issues, you can reopen the ticket from your portal.</p>' : ''}<a href="https://portal.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">View Ticket</a>`
  }),

  newComment: (ticket, client, commentText) => sendEmail({
    to: client.email,
    subject: `New message on: ${ticket.title}`,
    html: `<p>Hi ${client.name},</p><p>Our team has sent you a message on your ticket.</p><blockquote style="border-left:3px solid #1A6BAB;padding:10px 16px;background:#f7f9fc;margin:16px 0;border-radius:0 6px 6px 0;font-size:13px">${commentText}</blockquote><a href="https://portal.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">Reply</a>`
  }),

  newTicketAdmin: (ticket, adminEmail) => sendEmail({
    to: adminEmail,
    subject: `New ticket: ${ticket.title}`,
    html: `<p>A new service ticket has been submitted.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568;width:100px">Client</td><td style="padding:8px;font-size:13px">${ticket.client_name}</td></tr><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568">Title</td><td style="padding:8px;font-size:13px;font-weight:500">${ticket.title}</td></tr><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568">Priority</td><td style="padding:8px;font-size:13px">${ticket.priority}</td></tr></table><a href="https://tickets.websitesupportcalgary.ca/tickets/${ticket.id}" class="btn">View in Dashboard</a>`
  }),

  staffInvite: (member, tempPassword) => sendEmail({
    to: member.email,
    subject: 'You have been added to Two Trees Studio Dashboard',
    html: `<p>Hi ${member.name},</p><p>You have been added as a team member on the Two Trees Studio admin dashboard.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568;width:100px">Email</td><td style="padding:8px;font-size:13px">${member.email}</td></tr><tr><td style="padding:8px;background:#f7f9fc;font-size:13px;color:#4A5568">Password</td><td style="padding:8px;font-size:13px;font-weight:700">${tempPassword}</td></tr></table><p style="color:#E53E3E;font-size:13px">Please change your password after first login.</p><a href="https://tickets.websitesupportcalgary.ca/login" class="btn">Go to Dashboard</a>`
  })
}

module.exports = { sendEmail, emails }
