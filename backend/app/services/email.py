import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

class EmailService:
    def send_email(self, to_email: str, subject: str, body: str):
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print("Warning: SMTP credentials not set. Email skipped.")
            return

        try:
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject

            msg.attach(MIMEText(body, 'plain'))

            if settings.SMTP_PORT == 465:
                # SSL connection
                with smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            else:
                # TLS connection
                with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            
            print(f"Email sent to {to_email}: {subject}")
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False
