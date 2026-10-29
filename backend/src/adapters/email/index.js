import { env } from '../../config/env.js'

/** Email adapter. "console" logs the message (dev); "resend" uses the Resend HTTP API; "none" drops with a warning. */
export function createEmailAdapter(log) {
  return {
    name: env.EMAIL_PROVIDER,
    configured: env.EMAIL_PROVIDER === 'console' || (env.EMAIL_PROVIDER === 'resend' && !!env.EMAIL_API_KEY),
    async send({ to, subject, text }) {
      if (env.EMAIL_PROVIDER === 'console') { log.info({ to, subject, text }, 'email (console provider — not delivered)'); return { delivered: false, provider: 'console' } }
      if (env.EMAIL_PROVIDER === 'resend' && env.EMAIL_API_KEY) {
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }) })
        if (!r.ok) throw new Error(`Email provider responded ${r.status}`)
        return { delivered: true, provider: 'resend' }
      }
      log.warn({ to, subject }, 'email provider not configured; message dropped')
      return { delivered: false, provider: 'none' }
    },
  }
}
