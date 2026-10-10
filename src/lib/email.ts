// Envío de correos electrónicos (códigos de verificación) con nodemailer.
//
// Configuración en .env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//   (ejemplo Gmail: host smtp.gmail.com, puerto 465 y una "contraseña de aplicación")
//
// Si no hay SMTP configurado y EMAIL_DEV_FALLBACK=true, las rutas pueden
// devolver el código en pantalla para poder probar el flujo sin correo real.
import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST ?? ''
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const SMTP_FROM = process.env.SMTP_FROM ?? 'Eva ♥ David <no-reply@localhost>'
const EMAIL_DEV_FALLBACK = process.env.EMAIL_DEV_FALLBACK === 'true'

export function isEmailConfigured(): boolean {
  return !!SMTP_HOST
}

export function isDevFallbackEnabled(): boolean {
  return !isEmailConfigured() && EMAIL_DEV_FALLBACK
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      connectionTimeout: 10_000,
    })
  }
  return transporter
}

function codeEmailHtml(name: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#fff7f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 4px 16px rgba(244,63,94,0.12);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#f43f5e,#ec4899);padding:28px 24px;text-align:center;">
          <span style="font-size:26px;color:#ffffff;font-weight:bold;">Eva ♥ David</span><br/>
          <span style="font-size:13px;color:#ffe4e6;">Nuestro chat privado</span>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1c1917;">Hola ${name}:</p>
          <p style="margin:0 0 18px;font-size:14px;color:#57534e;">Has pedido cambiar tu contraseña. Este es tu código de verificación:</p>
          <div style="text-align:center;margin:0 0 18px;">
            <span style="display:inline-block;background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:14px 28px;font-size:30px;letter-spacing:8px;font-weight:bold;color:#e11d48;">${code}</span>
          </div>
          <p style="margin:0 0 6px;font-size:13px;color:#57534e;">El código caduca en <b>10 minutos</b> y solo puede usarse una vez.</p>
          <p style="margin:0;font-size:13px;color:#57534e;">Si no has sido tú, ignora este mensaje y tu contraseña no cambiará.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;">Mensaje automático de nuestro chat privado.</p>
    </td></tr>
  </table>
</body>
</html>`
}

// Envía el código de verificación por correo. Devuelve true si se envió.
export async function sendVerificationCode(
  to: string,
  name: string,
  code: string,
): Promise<boolean> {
  if (!isEmailConfigured()) return false
  try {
    await getTransporter().sendMail({
      from: SMTP_FROM,
      to,
      subject: `Tu código de verificación: ${code}`,
      text: `Hola ${name}: tu código de verificación para cambiar la contraseña es ${code}. Caduca en 10 minutos. Si no has sido tú, ignora este mensaje.`,
      html: codeEmailHtml(name, code),
    })
    return true
  } catch (err) {
    console.error('[email] no se pudo enviar el correo:', err)
    return false
  }
}

// Oculta parte del correo: eva@gmail.com -> e***@gmail.com
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  return `${local.charAt(0)}${'*'.repeat(Math.max(3, local.length - 1))}${domain}`
}
