// SMTP CORS Relay Server — CommonJS (works from any working directory)
// Usage:  node script/server-relay.js    OR    npm run relay
// The relay listens on port 3001 and forwards email dispatch to Nodemailer.

const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/smtp-test-relay', (_req, res) => {
  res.json({ status: 'online', message: 'SMTP CORS Relay is running!' });
});

// ── Send email ────────────────────────────────────────────────────────────────
app.post('/api/smtp-test-relay', async (req, res) => {
  const { host, port, security, user, pass, from, to, cc, bcc, subject, body, isHtml, attachments } = req.body;

  console.log(
    `\n📩 [${new Date().toLocaleTimeString()}] Relay request received`,
    `\n   Host : ${host}:${port}  (${security})`,
    `\n   From : ${from || user}`,
    `\n   To   : ${Array.isArray(to) ? to.join(', ') : to}`,
    cc  ? `\n   CC   : ${Array.isArray(cc)  ? cc.join(', ')  : cc}`  : '',
    bcc ? `\n   BCC  : ${Array.isArray(bcc) ? bcc.join(', ') : bcc}` : '',
    attachments?.length ? `\n   Attachments: ${attachments.length} file(s)` : ''
  );

  if (!host || !port || !user || !pass) {
    return res.status(400).json({ success: false, error: 'Missing required fields: host, port, user, pass' });
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: security === 'tls',        // true → port 465 SSL; false → 587 STARTTLS / 25 plain
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // allow self-signed certs in dev
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  // Build nodemailer attachment objects from base64 strings — no temp files needed
  const nmAttachments = Array.isArray(attachments)
    ? attachments.map((a) => ({
        filename:    a.filename,
        content:     a.content,
        encoding:    'base64',
        contentType: a.contentType,
      }))
    : [];

  try {
    const mailOptions = {
      from:              from || user,
      to,
      subject:           subject || 'SMTP Verification Test Email',
      [isHtml ? 'html' : 'text']: body || 'Test email dispatched by Secure-Toolkit SMTP Tester.',
      attachments:       nmAttachments,
    };
    // Only add cc/bcc if provided — nodemailer ignores undefined fields but
    // some validators complain about empty strings.
    if (cc  && (Array.isArray(cc)  ? cc.length  : cc.trim()))  mailOptions.cc  = cc;
    if (bcc && (Array.isArray(bcc) ? bcc.length : bcc.trim())) mailOptions.bcc = bcc;

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ [${new Date().toLocaleTimeString()}] Sent! Message-ID: ${info.messageId}`);
    res.json({ success: true, messageId: info.messageId, response: info.response });
  } catch (err) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] SMTP error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Bulk send emails (with connection pooling & inter-message throttle) ───────
app.post('/api/smtp-bulk-relay', async (req, res) => {
  const { host, port, security, user, pass, from, items, delayMs = 300 } = req.body;

  if (!host || !port || !user || !pass || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: host, port, user, pass, items (array of emails)',
    });
  }

  console.log(
    `\n📦 [${new Date().toLocaleTimeString()}] Bulk dispatch request received: ${items.length} email(s)`,
    `\n   Host    : ${host}:${port} (${security})`,
    `\n   From    : ${from || user}`,
    `\n   Throttle: ${delayMs}ms delay between messages`
  );

  // Connection pooling reuses SMTP sockets across bulk dispatches
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: security === 'tls',
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 15000,
  });

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const nmAttachments = Array.isArray(item.attachments)
        ? item.attachments.map((a) => ({
            filename:    a.filename,
            content:     a.content,
            encoding:    'base64',
            contentType: a.contentType,
          }))
        : [];

      const mailOptions = {
        from: from || user,
        to:   item.to,
        subject: item.subject || 'Notification',
        [item.isHtml ? 'html' : 'text']: item.body || '',
        attachments: nmAttachments,
      };

      if (item.cc  && (Array.isArray(item.cc)  ? item.cc.length  : item.cc.trim()))  mailOptions.cc  = item.cc;
      if (item.bcc && (Array.isArray(item.bcc) ? item.bcc.length : item.bcc.trim())) mailOptions.bcc = item.bcc;

      const info = await transporter.sendMail(mailOptions);
      results.push({ index: i, to: item.to, success: true, messageId: info.messageId });
      console.log(`   [${i + 1}/${items.length}] ✅ Sent to ${item.to}`);
    } catch (err) {
      results.push({ index: i, to: item.to, success: false, error: err.message });
      console.error(`   [${i + 1}/${items.length}] ❌ Failed for ${item.to}: ${err.message}`);
    }

    // Rate-limiting delay between sequential sends
    if (i < items.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  transporter.close();
  const successCount = results.filter((r) => r.success).length;
  res.json({
    success: true,
    total: items.length,
    sent: successCount,
    failed: items.length - successCount,
    results,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║  🚀 SMTP CORS Relay  →  http://127.0.0.1:${PORT}/api  ║`);
  console.log('║  POST /api/smtp-test-relay  for single emails        ║');
  console.log('║  POST /api/smtp-bulk-relay  for bulk batch emails    ║');
  console.log('║  GET  /api/smtp-test-relay  for health check         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});