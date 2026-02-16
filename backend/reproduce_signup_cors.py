import httpx
import sys

def check_signup_cors():
    url = "http://localhost:8000/api/auth/signup"
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    
    print(f"Testing OPTIONS request to {url}")
    try:
        with httpx.Client() as client:
            response = client.options(url, headers=headers)
            
        print(f"Status: {response.status_code}")
        print("Headers:")
        for k, v in response.headers.items():
            print(f"  {k}: {v}")
            
        allow_origin = response.headers.get("access-control-allow-origin")
        
        if allow_origin == "http://localhost:5173":
            print("SUCCESS: OPTIONS request returned correct origin.")
        else:
            print("FAILURE: OPTIONS request missing or incorrect allow-origin.")

    except Exception as e:
        print(f"ERROR calling OPTIONS: {e}")

if __name__ == "__main__":
    check_signup_cors()
