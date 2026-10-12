#!/usr/bin/env python3
"""Find a real product photo for each Cedros SKU (vendor pages, then web search)."""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path
from urllib.parse import unquote, urljoin

ROOT = Path("/workspace")
OUT_DIR = ROOT / "public" / "catalog" / "photos"
STATE = Path("/tmp/cedros-photo-work/state.json")
PRODUCTS = Path("/tmp/cedros-photo-work/products.tsv")
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
SKIP_HOST = re.compile(
    r"(duckduckgo|google\.|facebook|instagram|pinterest|twitter|linkedin|youtube|wikipedia|reddit\.com)",
    re.I,
)
BAD_IMG = re.compile(
    r"(logo|sprite|fallback|placeholder|favicon|1x1|pixel|blank\.|spacer|icon[-_/]|avatar|catalog-fallback)",
    re.I,
)
VENDOR = {
    "Dräger": ["draeger-inc", "draeger", "drager"],
    "Philips": ["philips-healthcare", "philips"],
    "Masimo": ["masimo"],
    "3M": ["3m"],
    "Welch Allyn": ["welch-allyn", "welchallyn"],
    "ASP": ["advanced-sterilization-products", "asp"],
}

def fold(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())

def http_get(url: str, timeout: int = 16, max_bytes: int = 2_800_000) -> tuple[str, bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,es;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        final = resp.geturl()
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        data = resp.read(max_bytes + 1)
        return final, data[:max_bytes], ctype

def sniff_ext(data: bytes, ctype: str, url: str) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG"):
        return "png"
    if data.startswith(b"RIFF") and b"WEBP" in data[:16]:
        return "webp"
    if data.startswith(b"GIF8"):
        return "gif"
    if "jpeg" in ctype or "jpg" in ctype or url.lower().endswith((".jpg", ".jpeg")):
        return "jpg"
    if "png" in ctype or url.lower().endswith(".png"):
        return "png"
    if "webp" in ctype:
        return "webp"
    return None

def extract_images(html: str, base: str) -> list[str]:
    found: list[str] = []
    patterns = [
        r'property=["\']og:image(?::secure_url)?["\'][^>]*content=["\']([^"\']+)',
        r'content=["\']([^"\']+)["\'][^>]*property=["\']og:image',
        r'name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)',
        r'"image"\s*:\s*"(https?://[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"',
        r'<img[^>]+(?:data-src|src)=["\'](https?://[^"\']+\.(?:jpg|jpeg|png|webp)[^"\']*)',
    ]
    for pat in patterns:
        for match in re.findall(pat, html, flags=re.I):
            url = unescape(match).replace("&amp;", "&")
            if url.startswith("//"):
                url = "https:" + url
            elif url.startswith("/"):
                url = urljoin(base, url)
            if url.startswith("http") and not BAD_IMG.search(url) and url not in found:
                found.append(url)
        if found:
            return found[:5]
    return found

TRUSTED_HOST = re.compile(
    r"(3m\.com|solventum|draeger|philips|masimo|welchallyn|hillrom|partssource|medline|mckesson|henrychein|cardiacdirect|outfrontmedical|steeles\.com|medicalmega|bigcommerce)",
    re.I,
)

def page_matches(html: str, part: str) -> bool:
    key = fold(part)
    if len(key) < 4:
        return key in fold(html)
    return key in fold(html)

def images_from_page(url: str, part: str) -> list[str]:
    try:
        final, raw, ctype = http_get(url)
    except Exception:
        return []
    if ctype.startswith("image/"):
        return [final]
    html = raw.decode("utf-8", "replace")
    images = extract_images(html, final)
    if not images:
        return []
    if page_matches(html, part):
        return images
    if any(fold(part) in fold(img) for img in images):
        return images
    if TRUSTED_HOST.search(final) and not BAD_IMG.search(images[0]):
        return images
    return []

def vendor_urls(brand: str, part: str) -> list[str]:
    urls = []
    for slug in VENDOR.get(brand, []):
        urls.append(f"https://www.partssource.com/parts/{slug}/{urllib.parse.quote(part)}")
        compact = part.replace(" ", "")
        if compact != part:
            urls.append(f"https://www.partssource.com/parts/{slug}/{urllib.parse.quote(compact)}")
    return urls

def ddg_links(query: str, limit: int = 6) -> list[str]:
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)
    _, raw, _ = http_get(url)
    html = raw.decode("utf-8", "replace")
    links: list[str] = []
    for enc in re.findall(r"uddg=([^\"&]+)", html):
        href = unquote(enc)
        if not href.startswith("http") or SKIP_HOST.search(href) or href in links:
            continue
        links.append(href)
        if len(links) >= limit:
            break
    return links

def find_photo(brand: str, part: str, name: str) -> str | None:
    for url in vendor_urls(brand, part):
        images = images_from_page(url, part)
        if images:
            return images[0]
    brand_q = "Draeger Drager" if brand == "Dräger" else brand
    query = f'"{part}" {brand_q} { " ".join(name.split()[:5]) }'
    try:
        links = ddg_links(query)
    except Exception:
        links = []
    time.sleep(0.35)
    for link in links:
        images = images_from_page(link, part)
        if images:
            return images[0]
    return None

def download(image_url: str, dest_stem: Path) -> Path | None:
    try:
        final, data, ctype = http_get(image_url, timeout=20, max_bytes=3_000_000)
    except Exception:
        return None
    ext = sniff_ext(data, ctype, final)
    if not ext or len(data) < 3500:
        return None
    path = dest_stem.with_suffix("." + ext)
    path.write_bytes(data)
    return path

def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"ok": {}, "miss": {}, "error": {}}

def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [line for line in PRODUCTS.read_text().splitlines() if line.strip()]
    state = load_state()
    # Retry previous misses with the stricter finder.
    for item_id in list(state.get("miss", {})):
        if item_id not in state.get("ok", {}):
            state["miss"].pop(item_id, None)
    save_state(state)
    pending = []
    for line in rows:
        item_id = line.split("\t", 1)[0]
        if item_id in state["ok"]:
            continue
        if list(OUT_DIR.glob(f"{item_id}.*")):
            rel = "/" + str(next(OUT_DIR.glob(f"{item_id}.*")).relative_to(ROOT / "public"))
            state["ok"][item_id] = rel
            continue
        pending.append(line)
    print(f"pending={len(pending)} already_ok={len(state['ok'])}", flush=True)
    for index, line in enumerate(pending, start=1):
        item_id, sku, brand, part, name = line.split("\t", 4)
        try:
            url = find_photo(brand, part, name.strip())
            saved = download(url, OUT_DIR / item_id) if url else None
            if saved:
                rel = "/" + str(saved.relative_to(ROOT / "public"))
                state["ok"][item_id] = rel
                status = "ok"
                payload = rel
            else:
                state["miss"][item_id] = url or ""
                status = "miss"
                payload = url or ""
        except Exception as exc:
            state["error"][item_id] = str(exc)
            status = "error"
            payload = str(exc)
        if index % 5 == 0 or status == "ok":
            save_state(state)
            print(
                f"{index}/{len(pending)} ok={len(state['ok'])} miss={len(state['miss'])} {status} {sku} {payload[:90]}",
                flush=True,
            )
    save_state(state)
    print(f"DONE ok={len(state['ok'])} miss={len(state['miss'])} err={len(state['error'])}", flush=True)

if __name__ == "__main__":
    main()
