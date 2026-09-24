#!/usr/bin/env python3
"""CAS login for https://qyrz.xjvut.edu.cn/cas/login

Flow (mirrors the page's JS, cf. zhihu.com/p/338158060):
  1. GET  /cas/login            -> execution token, cookies (SESSION/route)
  2. POST /cas/v1/getPubKey     -> {modulus, exponent}; sets _pv0CAS cookie
  3. password = RSA-no-padding( reversed(plaintext) ); chunks of 126 bytes,
     each block packed little-endian 16-bit words == big-endian of original
     plaintext; ciphertext hex = digitToHex(4 nibbles/digit), blocks space-joined
  4. POST /cas/login            -> username, password=<enc>, code=, authcode=<kaptcha>,
     execution, _eventId=submit, type=zhmm (+ rememberMe)
  5. Failure re-renders login page with error text; success 302s to service/TGT.
"""
import argparse, json, re, sys
from pathlib import Path
from urllib.parse import urljoin
import urllib.request, urllib.error, http.cookiejar

BASE = "https://qyrz.xjvut.edu.cn/cas/"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def encrypt_password(pwd: str, modulus_hex: str, exponent_hex: str) -> str:
    """Exact port of RSAUtils.encryptedString(key, pwd) from /cas/js/security.js.

    Caller must pass the REVERSED password (page JS: reversedPwd = pwd[::-1]).
    a[] = charCodes of pwd, zero-padded to chunkSize = 2*biHighIndex(modulus)
    (62 for the 512-bit key); per block, 16-bit little-endian digit packing ==
    big-endian int of the reversed block bytes; ciphertext hex emits 4 hex
    chars per 16-bit digit; blocks joined with single space.
    """
    n, e = int(modulus_hex, 16), int(exponent_hex, 16)
    chunk = 2 * (n.bit_length() // 16 - 1)          # chunkSize = 2 * biHighIndex(modulus)
    a = [ord(c) for c in pwd]                        # encryptedString input as-is
    while len(a) % chunk:
        a.append(0)
    out = []
    for i in range(0, len(a), chunk):
        blk = bytes(a[i:i + chunk][::-1])            # big-endian int == LE16-digit packing
        c = pow(int.from_bytes(blk, "big"), e, n)
        h = format(c, "x")
        out.append("0" * ((-len(h)) % 4) + h)        # digitToHex: 4 hex chars per 16-bit digit
    return " ".join(out)


def make_opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def fetch(opener, url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", UA)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        resp = opener.open(req, timeout=30)
        return resp.geturl(), resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as ex:
        return ex.geturl(), ex.code, dict(ex.headers), ex.read()


def extract_execution(html: str):
    m = re.search(r'name="execution"\s+value="([^"]+)"', html)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-u", "--username", required=True)
    ap.add_argument("-p", "--password", required=True)
    ap.add_argument("-c", "--authcode", help="kaptcha answer; omit to save captcha image and exit")
    ap.add_argument("--cookies", default="cas_cookies.json")
    ap.add_argument("--save-captcha", default="cas_kaptcha.png")
    args = ap.parse_args()

    opener, jar = make_opener()
    state = Path(args.cookies)
    if args.authcode and state.exists():
        # reuse session from the captcha-fetch run
        data = json.loads(state.read_text())
        jar = http.cookiejar.CookieJar()
        for c in data:
            jar.set_cookie(http.cookiejar.Cookie(0, c["name"], c["value"], None, False,
                           c["domain"], True, True, c["path"], True, False, None, False,
                           None, None, {}))
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    else:
        # step 1: login page -> execution
        _, _, _, html = fetch(opener, urljoin(BASE, "login"),
                              headers={"Accept": "text/html,application/xhtml+xml"})
        text = html.decode("utf-8", "replace")
        execution = extract_execution(text)
        if not execution:
            sys.exit("ERROR: execution token not found")
        # step 2: public key (sets _pv0CAS)
        _, _, _, body = fetch(opener, urljoin(BASE, "v1/getPubKey"),
                              data=b"{}", method="POST",
                              headers={"Content-Type": "application/json",
                                       "X-Requested-With": "XMLHttpRequest",
                                       "Referer": urljoin(BASE, "login")})
        key = json.loads(body.decode())
        print(f"[*] execution: {execution[:48]}... ({len(execution)} chars)")
        print(f"[*] modulus={key['modulus'][:32]}... exponent={key['exponent']}")
        enc = encrypt_password(args.password[::-1], key["modulus"], key["exponent"])
        print(f"[*] encrypted password: {enc}")

        if not args.authcode:
            # save captcha + session for manual reading
            url, _, headers, img = fetch(
                opener, urljoin(BASE, f"kaptcha?time={__import__('time').time()*1000:.0f}"))
            Path(args.save_captcha).write_bytes(img)
            state.write_text(json.dumps(
                [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path}
                 for c in jar]))
            print(f"[!] kaptcha required -> captcha saved to {args.save_captcha} "
                  f"({len(img)} bytes); rerun with -c <code>")
            return

        # step 3: login POST
        form = {"username": args.username, "password": enc, "code": "",
                "authcode": args.authcode, "execution": execution,
                "_eventId": "submit", "type": "zhmm"}
        body = "&".join(f"{k}={urllib.parse.quote(v, safe='')}" for k, v in form.items())
        final_url, status, headers, html2 = fetch(
            opener, urljoin(BASE, "login"), data=body.encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded",
                     "Referer": urljoin(BASE, "login"),
                     "Origin": "https://qyrz.xjvut.edu.cn"})
        text2 = html2.decode("utf-8", "replace")
        print(f"[*] POST /cas/login -> HTTP {status} {final_url}")
        err = re.search(r'class="[^"]*error[^"]*"[^>]*>\s*([^<]+)', text2)
        if err or "execution" in text2:
            print(f"[-] login failed: {err.group(1).strip() if err else '(login page re-rendered)'}")
        else:
            print(f"[+] possibly logged in; page title: "
                  f"{re.search(r'<title>(.*?)</title>', text2, re.S).group(1) if '<title>' in text2 else '?'}")
        print("[*] cookies:", ", ".join(sorted(c.name for c in jar)))
        return

    # --authcode path: reuse session, do the login POST
    _, _, _, html = fetch(opener, urljoin(BASE, "login"))
    text = html.decode("utf-8", "replace")
    execution = extract_execution(text)
    if not execution:
        sys.exit("ERROR: execution token not found on reused session")
    _, _, _, body = fetch(opener, urljoin(BASE, "v1/getPubKey"), data=b"{}", method="POST",
                          headers={"Content-Type": "application/json",
                                   "X-Requested-With": "XMLHttpRequest"})
    key = json.loads(body.decode())
    enc = encrypt_password(args.password[::-1], key["modulus"], key["exponent"])
    form = {"username": args.username, "password": enc, "code": "",
            "authcode": args.authcode, "execution": execution,
            "_eventId": "submit", "type": "zhmm"}
    body = "&".join(f"{k}={urllib.parse.quote(v, safe='')}" for k, v in form.items())
    final_url, status, _, html2 = fetch(opener, urljoin(BASE, "login"), data=body.encode(),
                                        headers={"Content-Type": "application/x-www-form-urlencoded",
                                                 "Referer": urljoin(BASE, "login"),
                                                 "Origin": "https://qyrz.xjvut.edu.cn"})
    text2 = html2.decode("utf-8", "replace")
    print(f"[*] POST /cas/login -> HTTP {status} {final_url}")
    err = re.search(r'class="[^"]*error[^"]*"[^>]*>\s*([^<]+)', text2)
    print(f"[-] failed: {err.group(1).strip()}" if err else
          f"[+] response len={len(text2)}; check cookies/redirect for success")


if __name__ == "__main__":
    import urllib.parse
    main()
