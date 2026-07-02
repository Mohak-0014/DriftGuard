import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def send_email(self, to_email: str, subject: str, body: str) -> bool:
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured — email skipped.")
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            if settings.SMTP_PORT == 465:
                with smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)

            logger.info("Email sent to %s: %s", to_email, subject)
            return True
        except smtplib.SMTPException as exc:
            logger.error("Failed to send email to %s: %s", to_email, exc)
            return False
