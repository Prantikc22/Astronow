"""Create a scannable QR for the currently running LAN Expo Go server.

Usage: python generate-expo-qr.py exp://192.168.1.2:8081
"""

import sys
from pathlib import Path

import qrcode

if len(sys.argv) != 2 or not sys.argv[1].startswith("exp://"):
    raise SystemExit("Pass the verified Expo Go LAN URL, for example exp://192.168.1.2:8081")

url = sys.argv[1]
out = Path(__file__).resolve().parents[1] / "EXPO_GO_QR.png"
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=4)
qr.add_data(url)
qr.make(fit=True)
qr.make_image(fill_color="#171229", back_color="#FFFFFF").save(out)
print(f"{url} -> {out}")
