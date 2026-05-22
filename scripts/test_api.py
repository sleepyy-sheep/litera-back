#!/usr/bin/env python3
"""Quick API smoke test."""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://localhost:8000"


def req(method, path, data=None, token=None, form=False):
    url = BASE + path
    headers = {"Accept": "application/json"}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            detail = json.loads(raw)
        except Exception:
            detail = raw.decode()
        return e.code, detail


def main():
    email = "smoke_test@gmail.com"
    user = "smoke_test"
    password = "password123"

    code, _ = req("POST", "/auth/register", {"username": user, "email": email, "password": password})
    print(f"register: {code}")

    code, tokens = req(
        "POST",
        "/auth/login",
        {"username": email, "password": password},
        form=True,
    )
    print(f"login: {code}")
    if code != 200:
        print(tokens)
        sys.exit(1)
    token = tokens["access_token"]

    for path in ["/books/my", "/books/my/", "/goals", "/goals/"]:
        code, data = req("GET", path, token=token)
        print(f"GET {path}: {code}", end="")
        if code == 200:
            if "items" in (data or {}):
                print(f" items={data['total']}")
            elif isinstance(data, list):
                print(f" list len={len(data)}")
            else:
                print()
        else:
            print(data)

    code, goal = req(
        "POST",
        "/goals/",
        {"goal_type": "pages_per_day", "target_value": 25},
        token=token,
    )
    print(f"POST /goals/: {code}", goal if code != 200 else "ok")

    code, goal2 = req(
        "POST",
        "/goals",
        {"goal_type": "minutes_per_day", "target_value": 40},
        token=token,
    )
    print(f"POST /goals: {code}", goal2 if code != 200 else "ok")

    # multipart upload minimal fake pdf
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    pdf_content = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    parts = []
    for name, val in [
        ("title", "Test Book"),
        ("format", "pdf"),
    ]:
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n")
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.pdf\"\r\n"
        f"Content-Type: application/pdf\r\n\r\n"
    )
    body = "".join(parts).encode() + pdf_content + f"\r\n--{boundary}--\r\n".encode()

    for path in ["/books/", "/books"]:
        url = BASE + path
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        }
        r = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                print(f"POST {path}: {resp.status}")
        except urllib.error.HTTPError as e:
            print(f"POST {path}: {e.code}", e.read().decode()[:200])

    print("done")


if __name__ == "__main__":
    main()
