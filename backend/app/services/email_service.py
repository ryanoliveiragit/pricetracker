"""
Email service — sends transactional emails via Resend API.

Required env var:
  RESEND_API_KEY   your Resend API key (re_xxxx...)
  RESEND_FROM      sender address, e.g. "PriceTracker <onboarding@resend.dev>"
  APP_BASE_URL     frontend base URL, e.g. https://seuapp.onrender.com
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

_RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
_RESEND_FROM = os.getenv("RESEND_FROM", "PriceTracker <onboarding@resend.dev>")
_RESEND_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> bool:
    if not _RESEND_API_KEY:
        logger.warning("RESEND_API_KEY não configurado — e-mail não enviado para %s", to)
        return False

    payload = {"from": _RESEND_FROM, "to": [to], "subject": subject, "html": html}
    logger.info("Resend → enviando | to=%s | from=%s | subject=%s", to, _RESEND_FROM, subject)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {_RESEND_API_KEY}"},
            )
        logger.info("Resend ← status=%s | body=%s", resp.status_code, resp.text)
        resp.raise_for_status()
        return True
    except httpx.HTTPStatusError as exc:
        logger.error("Resend erro HTTP %s | body=%s", exc.response.status_code, exc.response.text)
        return False
    except Exception as exc:
        logger.error("Resend falha inesperada para %s: %s", to, exc)
        return False


async def send_credentials_email(
    to_email: str,
    nome: str,
    password: str,
    login_url: str,
    app_name: str = "PriceTracker",
) -> bool:
    subject = f"Suas credenciais de acesso — {app_name}"
    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <tr>
          <td style="background:#2563eb;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">{app_name}</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">
              Olá, <strong>{nome}</strong>!
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Sua conta foi criada com sucesso. Use as credenciais abaixo para acessar o sistema:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">E-mail</p>
                  <p style="margin:0 0 20px;font-size:16px;color:#111827;font-weight:600;">{to_email}</p>
                  <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Senha</p>
                  <p style="margin:0;font-size:20px;color:#2563eb;font-weight:700;letter-spacing:.08em;">{password}</p>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#2563eb;border-radius:6px;">
                  <a href="{login_url}"
                     style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Acessar agora →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
              Por segurança, recomendamos alterar sua senha no primeiro acesso.<br>
              Se você não esperava este e-mail, ignore-o.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">{app_name} · Enviado automaticamente, não responda.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return await send_email(to_email, subject, html)
