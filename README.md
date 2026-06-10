# WSC Backend API

Node.js + Express backend for the Website Support Calgary ticket system.

## Tech Stack
- Node.js + Express
- MySQL (IONOS)
- JWT Authentication
- Nodemailer (email)
- Stripe (payments)

## Local Development

```bash
npm install
# Edit .env with your credentials
npm run dev
# Runs on http://localhost:4000
```

## Deploy to Railway (Free Hosting)

1. Go to https://railway.app and sign up (free)
2. Click **New Project → Deploy from GitHub repo**
3. Push this backend folder to a GitHub repo first, then connect it
4. In Railway project settings → **Variables**, add all values from your `.env` file:
   - `DB_HOST` = db5020666136.hosting-data.io
   - `DB_NAME` = dbs15775653
   - `DB_USER` = dbu2232817
   - `DB_PASSWORD` = your_password
   - `JWT_SECRET` = any long random string
   - `SMTP_HOST` = smtp.ionos.ca
   - `SMTP_PORT` = 587
   - `SMTP_USER` = info@twotreesstudio.ca
   - `SMTP_PASS` = your email password
   - `EMAIL_FROM` = info@twotreesstudio.ca
   - `EMAIL_FROM_NAME` = Website Support Calgary
   - `STRIPE_SECRET_KEY` = from stripe.com dashboard
   - `CLIENT_URL` = https://portal.websitesupportcalgary.ca
   - `ADMIN_URL` = https://tickets.websitesupportcalgary.ca
5. Railway auto-deploys and gives you a URL like `https://wsc-backend.up.railway.app`
6. Copy that URL and update both portals:
   - In client portal `.env`: `VITE_API_URL=https://wsc-backend.up.railway.app/api`
   - In admin dashboard `.env`: `VITE_API_URL=https://wsc-backend.up.railway.app/api`
   - Rebuild both portals (`npm run build`) and re-upload `dist/` to IONOS

## API Endpoints

### Client Auth
- `POST /api/client/auth/register`
- `POST /api/client/auth/login`
- `POST /api/client/auth/forgot-password`
- `POST /api/client/auth/reset-password`
- `GET  /api/client/auth/me`
- `PUT  /api/client/auth/profile`
- `PUT  /api/client/auth/change-password`

### Admin Auth
- `POST /api/admin/auth/login`
- `GET  /api/admin/auth/me`
- `GET  /api/admin/team`
- `POST /api/admin/team/invite`
- `PUT  /api/admin/team/:id/toggle-status`

### Tickets
- `GET  /api/tickets`
- `POST /api/tickets`
- `GET  /api/tickets/:id`
- `PUT  /api/tickets/:id/status`
- `PUT  /api/tickets/:id/assign`
- `PUT  /api/tickets/:id/note`
- `POST /api/tickets/:id/reopen`
- `POST /api/tickets/:id/comments`
- `POST /api/tickets/:id/invoice`

### Other
- `GET  /api/ticket-types`
- `POST /api/ticket-types`
- `DELETE /api/ticket-types/:id`
- `GET  /api/clients`
- `PUT  /api/clients/:id/toggle-status`
- `GET  /api/reports/summary`
- `POST /api/invoices/:id/pay`

## Default Admin Login (first run)
- Email: admin@websitesupportcalgary.ca
- Password: Admin@WSC2026!
- **Change this immediately after first login**
