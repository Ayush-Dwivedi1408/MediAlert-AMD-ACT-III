
import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("AMD_API_KEY")
base_url = os.getenv("AMD_BASE_URL")
model = os.getenv("AMD_MODEL")

if not all([api_key, base_url, model]):
    raise SystemExit(
        "Missing AMD_API_KEY, AMD_BASE_URL, or AMD_MODEL in .env"
    )

try:
    response = requests.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": "Reply with: MediAlert AMD connection successful."
                }
            ],
            "max_tokens": 60,
            "stream": False,
        },
        timeout=45,
    )

    if not response.ok:
        print("HTTP error:", response.status_code)
        print(response.text[:1000])
    else:
        data = response.json()
        print(data["choices"][0]["message"]["content"])

except requests.RequestException as exc:
    print("Request failed:", exc)
