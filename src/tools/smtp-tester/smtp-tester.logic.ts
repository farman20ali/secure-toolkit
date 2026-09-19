export interface SmtpPreset {
  id: string
  name: string
  host: string
  port: number
  security: 'starttls' | 'tls' | 'none'
  authType: 'app_password' | 'password' | 'oauth2'
  note: string
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: 'google',
    name: 'Google Gmail SMTP',
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls',
    authType: 'app_password',
    note: 'Requires 2-Step Verification enabled and a 16-character Google App Password.',
  },
  {
    id: 'google-ssl',
    name: 'Google Gmail (Direct SSL/TLS)',
    host: 'smtp.gmail.com',
    port: 465,
    security: 'tls',
    authType: 'app_password',
    note: 'Direct SSL socket connection using Google App Password.',
  },
  {
    id: 'office365',
    name: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    security: 'starttls',
    authType: 'password',
    note: 'Requires SMTP AUTH enabled in Microsoft 365 Admin Center.',
  },
  {
    id: 'mailgun',
    name: 'Mailgun SMTP',
    host: 'smtp.mailgun.org',
    port: 587,
    security: 'starttls',
    authType: 'password',
    note: 'Use your Mailgun SMTP credentials (postmaster@yourdomain.com).',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid SMTP',
    host: 'smtp.sendgrid.net',
    port: 587,
    security: 'starttls',
    authType: 'password',
    note: 'Username must be exact string "apikey" and password is your SendGrid API key.',
  },
  {
    id: 'postmark',
    name: 'Postmark SMTP',
    host: 'smtp.postmarkapp.com',
    port: 2525,
    security: 'starttls',
    authType: 'password',
    note: 'Username and Password are both set to your Server API Token.',
  },
  {
    id: 'custom',
    name: 'Custom SMTP Server',
    host: '',
    port: 587,
    security: 'starttls',
    authType: 'password',
    note: 'Enter your custom server parameters.',
  },
]

export interface SmtpAttachment {
  filename: string
  content: string   // base64-encoded file content
  contentType: string
  size: number      // bytes, for display only
}

export interface SmtpConfig {
  host: string
  port: number
  security: 'starttls' | 'tls' | 'none'
  authType: 'app_password' | 'password' | 'oauth2'
  username: string
  password: string
  fromEmail: string
  toEmail: string
  ccEmail?: string   // comma-separated CC addresses
  bccEmail?: string  // comma-separated BCC addresses
  subject?: string
  body?: string
  isHtml?: boolean
  attachments?: SmtpAttachment[]
}

export interface SecurityCheckResult {
  severity: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
}

export function cleanGoogleAppPassword(password: string): string {
  // Google App Passwords are 16 alphanumeric characters, often displayed as 4 groups of 4: "abcd efgh ijkl mnop"
  return password.replace(/\s+/g, '')
}

export function parseRecipientList(toEmailStr: string): string[] {
  if (!toEmailStr) return ['recipient@example.com']
  const split = toEmailStr
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)
  return split.length > 0 ? split : ['recipient@example.com']
}

export function validateSmtpConfig(config: SmtpConfig): SecurityCheckResult[] {
  const results: SecurityCheckResult[] = []

  if (!config.host.trim()) {
    results.push({
      severity: 'error',
      title: 'Missing Host',
      message: 'SMTP host server address is required.',
    })
  }

  if (!config.username.trim()) {
    results.push({
      severity: 'warning',
      title: 'Missing Username',
      message: 'Most SMTP servers require authentication username/email.',
    })
  }

  // Google specific validation
  if (config.host.toLowerCase().includes('gmail') || config.host.toLowerCase().includes('google')) {
    const cleanedPass = cleanGoogleAppPassword(config.password)
    if (config.password.length > 0 && cleanedPass.length !== 16) {
      results.push({
        severity: 'warning',
        title: 'Non-Standard Google Password',
        message:
          'Google requires a 16-character App Password when 2FA is active. Regular Google account passwords will be rejected by smtp.gmail.com with error 535 5.7.8.',
      })
    } else if (cleanedPass.length === 16) {
      results.push({
        severity: 'success',
        title: 'Valid App Password Format',
        message: 'Google 16-character App Password format detected.',
      })
    }
  }

  // Bulk recipients check
  const recipients = parseRecipientList(config.toEmail)
  if (recipients.length > 1) {
    results.push({
      severity: 'info',
      title: 'Bulk Dispatch Mode',
      message: `Sending email to ${recipients.length} recipients (${recipients.join(', ')}). Multiple RCPT TO commands will be executed.`,
    })
  }

  // Port & Security alignment checks
  if (config.port === 465 && config.security !== 'tls') {
    results.push({
      severity: 'warning',
      title: 'Port Security Mismatch',
      message: 'Port 465 is traditionally used for Direct Implicit SSL/TLS. Consider switching Security mode to Direct SSL/TLS.',
    })
  }

  if (config.port === 587 && config.security === 'none') {
    results.push({
      severity: 'warning',
      title: 'Unencrypted Submission',
      message: 'Port 587 usually expects explicit STARTTLS encryption.',
    })
  }

  if (config.port === 25) {
    results.push({
      severity: 'info',
      title: 'Port 25 Notice',
      message: 'Port 25 is often blocked by ISPs and cloud providers (AWS, GCP, Azure). Use port 587 or 465 if connections time out.',
    })
  }

  if (config.security === 'none') {
    results.push({
      severity: 'error',
      title: 'Insecure Connection',
      message: 'Unencrypted SMTP sends credentials and email content over plain text across the network.',
    })
  }

  return results
}

export interface HandshakeStep {
  step: number
  direction: 'client' | 'server' | 'info'
  code?: number
  text: string
  explanation: string
}

export function generateHandshakeSimulation(config: SmtpConfig): HandshakeStep[] {
  const steps: HandshakeStep[] = []
  const host = config.host || 'smtp.example.com'
  const port = config.port || 587
  const cleanedPass = cleanGoogleAppPassword(config.password) || 'your_app_password'
  const user = config.username || 'user@example.com'
  const from = config.fromEmail || user
  const recipients = parseRecipientList(config.toEmail)
  const subject = config.subject || 'Secure Toolkit SMTP Test Mail'
  const body = config.body || 'Hello, this is a test email sent to verify SMTP authentication.'

  let stepNum = 1

  steps.push({
    step: stepNum++,
    direction: 'info',
    text: `Initiating TCP connection to ${host}:${port} (${config.security.toUpperCase()})...`,
    explanation: 'Client initiates a TCP socket connection to the mail server.',
  })

  if (config.security === 'tls') {
    steps.push({
      step: stepNum++,
      direction: 'info',
      text: 'Negotiating Direct SSL/TLS wrapper on connection establishing...',
      explanation: 'TLS handshake completes before any SMTP banner command is issued.',
    })
  }

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 220,
    text: `220 ${host} ESMTP Service Ready`,
    explanation: 'Server sends initial greeting banner indicating readiness.',
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: `EHLO [127.0.0.1]`,
    explanation: 'Client introduces itself to the server using Extended HELO.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 250,
    text: `250-${host} greets 127.0.0.1\n250-SIZE 35651584\n250-8BITMIME\n250-AUTH LOGIN PLAIN\n250 STARTTLS`,
    explanation: 'Server lists supported capabilities, available authentication mechanisms, and encryption support.',
  })

  if (config.security === 'starttls') {
    steps.push({
      step: stepNum++,
      direction: 'client',
      text: 'STARTTLS',
      explanation: 'Client requests upgrading the plain connection to TLS encryption.',
    })

    steps.push({
      step: stepNum++,
      direction: 'server',
      code: 220,
      text: '220 2.0.0 Ready to start TLS',
      explanation: 'Server accepts request. Subsequent network traffic is encrypted.',
    })

    steps.push({
      step: stepNum++,
      direction: 'client',
      text: 'EHLO [127.0.0.1]',
      explanation: 'Client re-sends EHLO over the newly encrypted TLS tunnel to discover authenticated capabilities.',
    })

    steps.push({
      step: stepNum++,
      direction: 'server',
      code: 250,
      text: `250-${host}\n250-AUTH LOGIN PLAIN OAUTHBEARER`,
      explanation: 'Server confirms supported auth mechanisms over TLS.',
    })
  }

  // Auth step
  steps.push({
    step: stepNum++,
    direction: 'client',
    text: 'AUTH LOGIN',
    explanation: 'Client initiates LOGIN authentication flow.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 334,
    text: '334 VXNlcm5hbWU6', // Base64 for "Username:"
    explanation: 'Server asks for Base64 encoded username (334 VXNlcm5hbWU6 = "Username:").',
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: btoa(user),
    explanation: `Client sends Base64-encoded username ("${user}").`,
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 334,
    text: '334 UGFzc3dvcmQ6', // Base64 for "Password:"
    explanation: 'Server asks for Base64 encoded password (334 UGFzc3dvcmQ6 = "Password:").',
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: btoa(cleanedPass),
    explanation: 'Client sends Base64-encoded password or App Password.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 235,
    text: '235 2.7.0 Authentication successful',
    explanation: 'Server validates credentials and authorizes sender.',
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: `MAIL FROM:<${from}>`,
    explanation: 'Client specifies envelope sender address.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 250,
    text: '250 2.1.0 Sender OK',
    explanation: 'Server approves sender address.',
  })

  // Bulk recipients loop
  recipients.forEach((rcpt) => {
    steps.push({
      step: stepNum++,
      direction: 'client',
      text: `RCPT TO:<${rcpt}>`,
      explanation: `Client specifies recipient address (${rcpt}).`,
    })

    steps.push({
      step: stepNum++,
      direction: 'server',
      code: 250,
      text: `250 2.1.5 Recipient ${rcpt} OK`,
      explanation: 'Server approves recipient address.',
    })
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: 'DATA',
    explanation: 'Client begins mail body transmission.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 354,
    text: '354 Start mail input; end with <CR><LF>.<CR><LF>',
    explanation: 'Server acknowledges data mode.',
  })

  const contentType = config.isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8'
  steps.push({
    step: stepNum++,
    direction: 'info',
    text: `Content-Type: ${contentType}\nSubject: ${subject}\nFrom: ${from}\nTo: ${recipients.join(', ')}\n\n${body}`,
    explanation: 'Sending MIME headers and email payload content.',
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: '.',
    explanation: 'Client sends single period line indicating end of data payload.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 250,
    text: '250 2.0.0 OK 1726750000 s1234567890pqr.12 - gsmtp',
    explanation: 'Server confirms mail queued successfully for delivery.',
  })

  steps.push({
    step: stepNum++,
    direction: 'client',
    text: 'QUIT',
    explanation: 'Client terminates SMTP session.',
  })

  steps.push({
    step: stepNum++,
    direction: 'server',
    code: 221,
    text: '221 2.0.0 Service closing transmission channel',
    explanation: 'Server closes TCP connection.',
  })

  return steps
}

export function generateOpenSslCommand(config: SmtpConfig): string {
  const host = config.host || 'smtp.gmail.com'
  const port = config.port || 587
  if (config.security === 'starttls') {
    return `openssl s_client -connect ${host}:${port} -starttls smtp -crlf`
  }
  if (config.security === 'tls') {
    return `openssl s_client -connect ${host}:${port} -crlf`
  }
  return `nc -c ${host} ${port}`
}

export function generateNodeJsScript(config: SmtpConfig): string {
  const host = config.host || 'smtp.gmail.com'
  const port = config.port || 587
  const pass = cleanGoogleAppPassword(config.password) || 'YOUR_APP_PASSWORD'
  const user = config.username || 'YOUR_EMAIL@gmail.com'
  const from = config.fromEmail || user
  const recipients = parseRecipientList(config.toEmail)
  const toStr = recipients.length > 1 ? JSON.stringify(recipients) : `'${recipients[0]}'`
  const subject = (config.subject || 'SMTP Connection Verification Test').replace(/'/g, "\\'")
  const body = config.body || 'This email confirms that your SMTP credentials and connection are working properly.'
  const secure = config.security === 'tls'
  const bodyProp = config.isHtml ? `html: ${JSON.stringify(body)}` : `text: ${JSON.stringify(body)}`

  return `// Save as test-smtp.js and run: node test-smtp.js
// Prerequisite: npm install nodemailer

import nodemailer from 'nodemailer';

async function testSmtp() {
  console.log('🔄 Connecting to ${host}:${port}...');
  
  const transporter = nodemailer.createTransport({
    host: '${host}',
    port: ${port},
    secure: ${secure}, // true for port 465, false for 587/25
    auth: {
      user: '${user}',
      pass: '${pass}',
    },
    tls: {
      rejectUnauthorized: true,
    }
  });

  try {
    // 1. Verify connection and credentials
    await transporter.verify();
    console.log('✅ SMTP Connection & Authentication Successful!');

    // 2. Send test email (Bulk support: ${recipients.length} recipient(s))
    const info = await transporter.sendMail({
      from: '"Secure Toolkit Test" <${from}>',
      to: ${toStr},
      subject: '${subject}',
      ${bodyProp},
    });

    console.log('✉️ Test email dispatched successfully! Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ SMTP Connection Error:', error);
  }
}

testSmtp();
`
}

export function generatePythonScript(config: SmtpConfig): string {
  const host = config.host || 'smtp.gmail.com'
  const port = config.port || 587
  const pass = cleanGoogleAppPassword(config.password) || 'YOUR_APP_PASSWORD'
  const user = config.username || 'YOUR_EMAIL@gmail.com'
  const from = config.fromEmail || user
  const recipients = parseRecipientList(config.toEmail)
  const toStr = recipients.join(', ')
  const subject = (config.subject || 'SMTP Credentials Test').replace(/"/g, '\\"')
  const body = config.body || 'This is a test email sent to verify SMTP credentials.'
  const isHtml = config.isHtml

  if (config.security === 'tls') {
    return `# Save as test_smtp.py and run: python test_smtp.py
import smtplib
import ssl
from email.message import EmailMessage

smtp_server = "${host}"
port = ${port}
sender_email = "${user}"
password = "${pass}"
receiver_email = "${toStr}"

msg = EmailMessage()
msg["Subject"] = "${subject}"
msg["From"] = "${from}"
msg["To"] = receiver_email
${isHtml ? `msg.add_alternative("""${body}""", subtype="html")` : `msg.set_content("""${body}""")`}

context = ssl.create_default_context()

try:
    print(f"🔄 Connecting to {smtp_server}:{port} via SSL/TLS...")
    with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
        server.login(sender_email, password)
        print("✅ Authentication Successful!")
        server.send_message(msg)
        print("✉️ Test email sent successfully to ${recipients.length} recipient(s)!")
except Exception as e:
    print(f"❌ Error: {e}")
`
  }

  return `# Save as test_smtp.py and run: python test_smtp.py
import smtplib
import ssl
from email.message import EmailMessage

smtp_server = "${host}"
port = ${port}
sender_email = "${user}"
password = "${pass}"
receiver_email = "${toStr}"

msg = EmailMessage()
msg["Subject"] = "${subject}"
msg["From"] = "${from}"
msg["To"] = receiver_email
${isHtml ? `msg.add_alternative("""${body}""", subtype="html")` : `msg.set_content("""${body}""")`}

context = ssl.create_default_context()

try:
    print(f"🔄 Connecting to {smtp_server}:{port}...")
    with smtplib.SMTP(smtp_server, port) as server:
        server.ehlo()
        print("🔄 Initiating STARTTLS...")
        server.starttls(context=context)
        server.ehlo()
        server.login(sender_email, password)
        print("✅ Authentication Successful!")
        server.send_message(msg)
        print("✉️ Test email sent successfully to ${recipients.length} recipient(s)!")
except Exception as e:
    print(f"❌ Error: {e}")
`
}

export function generatePowerShellScript(config: SmtpConfig): string {
  const host = config.host || 'smtp.gmail.com'
  const port = config.port || 587
  const pass = cleanGoogleAppPassword(config.password) || 'YOUR_APP_PASSWORD'
  const user = config.username || 'YOUR_EMAIL@gmail.com'
  const from = config.fromEmail || user
  const recipients = parseRecipientList(config.toEmail)
  const toStr = recipients.map((r) => `'${r}'`).join(', ')
  const subject = (config.subject || 'SMTP Test Email').replace(/'/g, "''")
  const body = (config.body || 'Test Email Body').replace(/'/g, "''")
  const useSsl = config.security !== 'none' ? '-UseSsl' : ''
  const isHtml = config.isHtml ? '-BodyAsHtml' : ''

  return `# Run directly in Windows PowerShell:
$secpasswd = ConvertTo-SecureString '${pass}' -AsPlainText -Force
$mycreds = New-Object System.Management.Automation.PSCredential ('${user}', $secpasswd)
Send-MailMessage -SmtpServer '${host}' -Port ${port} ${useSsl} -Credential $mycreds -From '${from}' -To ${toStr} -Subject '${subject}' -Body '${body}' ${isHtml}
Write-Host "✅ Email dispatched successfully via PowerShell!" -ForegroundColor Green
`
}

export function generatePhpScript(config: SmtpConfig): string {
  const host = config.host || 'smtp.gmail.com'
  const port = config.port || 587
  const pass = cleanGoogleAppPassword(config.password) || 'YOUR_APP_PASSWORD'
  const user = config.username || 'YOUR_EMAIL@gmail.com'
  const from = config.fromEmail || user
  const recipients = parseRecipientList(config.toEmail)
  const subject = (config.subject || 'SMTP Verification Test').replace(/'/g, "\\'")
  const body = config.body || 'SMTP Verification Test Mail'
  const secure = config.security === 'tls' ? 'PHPMailer::ENCRYPTION_SMTPS' : 'PHPMailer::ENCRYPTION_STARTTLS'
  const addRecipientsPhp = recipients.map((r) => `$mail->addAddress('${r}');`).join('\n    ')

  return `<?php
// Require PHPMailer via composer: composer require phpmailer/phpmailer
use PHPMailer\\PHPMailer\\PHPMailer;
use PHPMailer\\PHPMailer\\Exception;

require 'vendor/autoload.php';

$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->SMTPDebug = 2; // Output debug log
    $mail->isSMTP();
    $mail->Host       = '${host}';
    $mail->SMTPAuth   = true;
    $mail->Username   = '${user}';
    $mail->Password   = '${pass}';
    $mail->SMTPSecure = ${secure};
    $mail->Port       = ${port};

    // Recipients (${recipients.length} total)
    $mail->setFrom('${from}', 'Secure Toolkit');
    ${addRecipientsPhp}

    // Content
    $mail->isHTML(${config.isHtml ? 'true' : 'false'});
    $mail->Subject = '${subject}';
    $mail->Body    = ${JSON.stringify(body)};

    $mail->send();
    echo 'Message has been sent successfully to ${recipients.length} recipient(s)';
} catch (Exception $e) {
    echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
}
`
}

// ── CSV Mail Merge ─────────────────────────────────────────────────────────────

export interface CsvParseResult {
  headers: string[]
  rows: Record<string, string>[]
  raw: string[][]
}

/**
 * Minimal RFC-4180 CSV parser.
 * Handles quoted fields, embedded commas, escaped quotes (""), CRLF, and BOM.
 */
export function parseCSV(text: string): CsvParseResult {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter((l) => l.trim() !== '')

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') inQuote = false
        else cur += ch
      } else {
        if (ch === '"') inQuote = true
        else if (ch === ',') { cells.push(cur); cur = '' }
        else cur += ch
      }
    }
    cells.push(cur)
    return cells.map((c) => c.trim())
  }

  const raw = lines.map(parseRow)
  if (raw.length === 0) return { headers: [], rows: [], raw: [] }

  const headers = raw[0].map((h) => h.toLowerCase().trim())
  const rows = raw.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  })

  return { headers, rows, raw }
}

/**
 * Replaces {{column}} and $column placeholders in a template string with
 * values from a CSV row. Unmatched placeholders are left as-is.
 */
export function mergeTemplate(template: string, row: Record<string, string>): string {
  // Replace {{col}} style
  let out = template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(row, key.toLowerCase()) ? row[key.toLowerCase()] : `{{${key}}}`
  )
  // Replace $col style (only whole-word tokens to avoid partial replacements)
  out = out.replace(/\$(\w+)\b/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(row, key.toLowerCase()) ? row[key.toLowerCase()] : `$${key}`
  )
  return out
}

/**
 * Given the CSV headers, return the most likely column name that holds
 * recipient email addresses (case-insensitive).
 */
export function detectEmailColumn(headers: string[]): string | null {
  const candidates = ['to', 'email', 'e-mail', 'recipient', 'address', 'mail']
  for (const c of candidates) {
    const found = headers.find((h) => h === c)
    if (found) return found
  }
  return headers[0] ?? null
}

export interface MergePreviewResult {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
}

/** Build a preview of the merged subject and body for a single row. */
export function buildMergePreview(
  row: Record<string, string>,
  emailCol: string,
  subjectTemplate: string,
  bodyTemplate: string,
  ccColOrStatic?: string,
  bccColOrStatic?: string
): MergePreviewResult {
  let cc = ''
  if (ccColOrStatic) {
    cc = row[ccColOrStatic] !== undefined ? row[ccColOrStatic] : mergeTemplate(ccColOrStatic, row)
  }
  let bcc = ''
  if (bccColOrStatic) {
    bcc = row[bccColOrStatic] !== undefined ? row[bccColOrStatic] : mergeTemplate(bccColOrStatic, row)
  }

  return {
    to:      row[emailCol] ?? '',
    cc:      cc.trim() || undefined,
    bcc:     bcc.trim() || undefined,
    subject: mergeTemplate(subjectTemplate, row),
    body:    mergeTemplate(bodyTemplate, row),
  }
}

