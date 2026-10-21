import smtplib

host = "smtp.gmail.com"
port = 587
user = "thoorigai.infotech.ai@gmail.com"
password = "ngujlvljdlsvcmkc"

print(f"Connecting to {host}:{port}...")
try:
    server = smtplib.SMTP(host, port, timeout=10)
    server.starttls()
    server.login(user, password)
    print("SMTP LOGIN SUCCESSFUL! Credentials and Gmail connectivity are 100% verified.")
    server.quit()
except Exception as e:
    print("SMTP ERROR:", e)

