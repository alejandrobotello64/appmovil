#!/usr/bin/env python3
"""Find a real product photo for each Cedros SKU (vendor pages, then image search)."""

from __future__ import annotations

import hashlib
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
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
SKIP_HOST = re.compile(
    r"(duckduckgo|google\.|gstatic|facebook|instagram|pinterest|twitter|linkedin|youtube|wikipedia|reddit\.com|yastatic|bing\.com|yahoo\.com)",
    re.I,
)
BAD_IMG = re.compile(
    r"(logo|sprite|fallback|placeholder|favicon|1x1|pixel|blank\.|spacer|icon[-_/]|avatar|catalog-fallback|facebook_sharing)",
    re.I,
)
BAD_TITLE = re.compile(
    r"(epox|epoxy|resin|h[aä]rter|spray glue|knife|knives|navaja|srm\b|plumbing|stroy-mart|valve manifold)",
    re.I,
)
VENDOR = {
    "Dräger": ["draeger-inc", "draeger", "drager"],
    "Philips": ["philips-healthcare", "philips"],
    "Masimo": ["masimo"],
    "3M": ["3m"],
    "Welch Allyn": ["welch-allyn", "welchallyn", "hill-rom"],
    "ASP": ["advanced-sterilization-products", "asp"],
}
TRUSTED_HOST = re.compile(
    r"(3m\.com|solventum|draeger|philips|masimo|welchallyn|hillrom|partssource|medline|mckesson|henryschein|cardiacdirect|outfrontmedical|steeles\.com|medicalmega|bigcommerce|scene7|multimedia\.3m|vizyon|onestopmedical|ciamedical|4mdmedical|boundtree|medisave|wms\.co)",
    re.I,
)
FAMILY = re.compile(
    r"\b(TEGADERM|ATTEST|COBAN|DURAPORE|TRANSPORE|LOBAN|BAIR|COMPLY|LNCS|NELLCOR|MICROSTREAM|SIDESTREAM|FAST\s?CUFF|FLEXIPORT|PANOPTIC|MACROVIEW)\b",
    re.I,
)


def fold(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def part_in(text: str, part: str) -> bool:
    raw = (part or "").strip()
    if len(fold(raw)) < 4:
        return False
    variants = {raw, raw.replace(" ", ""), raw.replace("-", ""), raw.replace(".", "")}
    for variant in variants:
        if len(variant) < 4:
            continue
        if re.search(r"(?<![A-Za-z0-9])" + re.escape(variant) + r"(?![A-Za-z0-9])", text, re.I):
            return True
    key = fold(raw)
    folded = fold(text)
    idx = 0
    while True:
        i = folded.find(key, idx)
        if i < 0:
            return False
        before = folded[i - 1] if i else ""
        after = folded[i + len(key)] if i + len(key) < len(folded) else ""
        if (not before.isalnum()) and (not after.isalnum()):
            return True
        idx = i + 1


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


def image_size(data: bytes, ext: str) -> tuple[int, int] | None:
    try:
        if ext == "png" and len(data) >= 24:
            return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
        if ext == "jpg":
            i = 2
            while i + 9 < len(data):
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2):
                    h = int.from_bytes(data[i + 5 : i + 7], "big")
                    w = int.from_bytes(data[i + 7 : i + 9], "big")
                    return w, h
                if marker in (0xD8, 0xD9) or (0xD0 <= marker <= 0xD7):
                    i += 2
                    continue
                length = int.from_bytes(data[i + 2 : i + 4], "big")
                i += 2 + length
        if ext == "webp" and data[0:4] == b"RIFF":
            if data[12:16] == b"VP8 " and len(data) >= 30:
                w = int.from_bytes(data[26:28], "little") & 0x3FFF
                h = int.from_bytes(data[28:30], "little") & 0x3FFF
                return w, h
            if data[12:16] == b"VP8L" and len(data) >= 25:
                bits = int.from_bytes(data[21:25], "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            if data[12:16] == b"VP8X" and len(data) >= 30:
                w = 1 + int.from_bytes(data[24:27], "little")
                h = 1 + int.from_bytes(data[27:30], "little")
                return w, h
    except Exception:
        return None
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
            return found[:6]
    return found


def page_matches(html: str, part: str) -> bool:
    return part_in(html, part)


def images_from_page(url: str, part: str) -> list[str]:
    try:
        final, raw, ctype = http_get(url)
    except Exception:
        return []
    if ctype.startswith("image/"):
        return [final]
    html = raw.decode("utf-8", "replace")
    images = extract_images(html, final)
    images = [img for img in images if not BAD_IMG.search(img)]
    if not images:
        return []
    if page_matches(html, part):
        return images
    if any(part_in(img, part) for img in images):
        return images
    if TRUSTED_HOST.search(final) and not BAD_IMG.search(images[0]):
        return images
    return []


def vendor_urls(brand: str, part: str) -> list[str]:
    urls = []
    compact = part.replace(" ", "")
    for slug in VENDOR.get(brand, []):
        urls.append(f"https://www.partssource.com/parts/{slug}/{urllib.parse.quote(part)}")
        if compact != part:
            urls.append(f"https://www.partssource.com/parts/{slug}/{urllib.parse.quote(compact)}")
    if brand == "3M":
        urls.append(f"https://www.henryschein.com/us-en/Search.aspx?searchkeyWord={urllib.parse.quote(part)}")
    return urls


def yandex_candidates(query: str, part: str, brand: str, name: str) -> list[str]:
    url = "https://yandex.com/images/search?text=" + urllib.parse.quote(query)
    try:
        _, raw, _ = http_get(url, timeout=22, max_bytes=2_200_000)
    except Exception:
        return []
    html = raw.decode("utf-8", "replace")
    scored: list[tuple[int, str]] = []
    seen: set[str] = set()
    short = len(fold(part)) < 6
    for match in re.finditer(
        r"origUrl&quot;:&quot;(https?:[^&]+?)&quot;.{0,400}?title&quot;:&quot;([^&]{0,220})",
        html,
    ):
        img = unescape(match.group(1)).replace("\\/", "/")
        title = unescape(match.group(2))
        if img in seen or SKIP_HOST.search(img) or BAD_IMG.search(img) or BAD_TITLE.search(f"{img} {title}"):
            continue
        seen.add(img)
        blob = f"{img} {title}"
        if not part_in(blob, part):
            continue
        brand_hit = bool(fold(brand) and fold(brand) in fold(f"{title} {img}"))
        family_hit = bool(FAMILY.search(name) and FAMILY.search(title) and FAMILY.search(title).group(1).upper() in name.upper())
        if short and not brand_hit and not family_hit:
            continue
        score = 10
        if brand_hit:
            score += 3
        if family_hit:
            score += 4
        tokens = [t for t in re.split(r"\W+", name.upper()) if len(t) >= 5][:4]
        score += sum(1 for t in tokens if t in title.upper())
        if TRUSTED_HOST.search(img):
            score += 3
        scored.append((score, img))
    scored.sort(key=lambda item: -item[0])
    return [img for _, img in scored[:8]]


def find_photos(brand: str, part: str, name: str) -> list[str]:
    found: list[str] = []
    for url in vendor_urls(brand, part):
        for img in images_from_page(url, part):
            if img not in found:
                found.append(img)
        if found:
            return found[:5]
    brand_q = "Draeger Drager" if brand == "Dräger" else brand
    fam = FAMILY.search(name).group(0) if FAMILY.search(name) else ""
    queries = [
        f'"{part}" {brand_q} medical',
        f'"{part}" {brand_q} {fam}'.strip(),
        f"{part} {brand_q} {fam or ' '.join(name.split()[:3])}",
    ]
    seen_q: set[str] = set()
    for query in queries:
        query = " ".join(query.split())
        if query in seen_q:
            continue
        seen_q.add(query)
        for img in yandex_candidates(query, part, brand, name):
            if img not in found:
                found.append(img)
        time.sleep(0.4)
        if len(found) >= 4:
            break
    return found[:8]


def download(image_url: str, dest_stem: Path, known_hashes: dict[str, int]) -> Path | None:
    try:
        final, data, ctype = http_get(image_url, timeout=20, max_bytes=3_000_000)
    except Exception:
        return None
    ext = sniff_ext(data, ctype, final)
    if not ext or len(data) < 4000:
        return None
    if BAD_IMG.search(final):
        return None
    size = image_size(data, ext)
    if size:
        w, h = size
        if w < 140 or h < 140 or w * h < 28000:
            return None
        if (w, h) == (267, 179):
            return None
    digest = hashlib.sha256(data).hexdigest()
    if known_hashes.get(digest, 0) >= 3:
        return None
    path = dest_stem.with_suffix("." + ext)
    path.write_bytes(data)
    known_hashes[digest] = known_hashes.get(digest, 0) + 1
    return path


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"ok": {}, "miss": {}, "error": {}}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def existing_file(item_id: str) -> Path | None:
    matches = list(OUT_DIR.glob(f"{item_id}.*"))
    return matches[0] if matches else None


def load_rows() -> list[tuple[str, str, str, str, str]]:
    rows = []
    for line in PRODUCTS.read_text().splitlines():
        if not line.strip():
            continue
        item_id, sku, brand, part, name = line.split("\t", 4)
        rows.append((item_id, sku, brand, part, name.strip()))
    return rows


def family_key(brand: str, part: str, name: str) -> str | None:
    match = FAMILY.search(name)
    if match:
        return f"{brand}|{match.group(1).upper()}"
    return None


def copy_family(rows: list[tuple[str, str, str, str, str]], state: dict) -> int:
    by_family: dict[str, list[tuple[str, str]]] = {}
    for item_id, sku, brand, part, name in rows:
        key = family_key(brand, part, name)
        if not key:
            continue
        by_family.setdefault(key, []).append((item_id, sku))
    copied = 0
    for key, members in by_family.items():
        source = None
        for item_id, _sku in members:
            src = existing_file(item_id)
            if src:
                source = src
                break
        if not source:
            continue
        data = source.read_bytes()
        for item_id, sku in members:
            if existing_file(item_id):
                continue
            dest = OUT_DIR / f"{item_id}{source.suffix}"
            dest.write_bytes(data)
            rel = "/" + str(dest.relative_to(ROOT / "public"))
            state["ok"][item_id] = rel
            state.get("miss", {}).pop(item_id, None)
            copied += 1
            print(f"family {sku} <- {source.name} ({key})", flush=True)
    return copied


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = load_rows()
    state = load_state()
    state["ok"] = {k: v for k, v in state.get("ok", {}).items() if existing_file(k)}
    for item_id, _sku, _brand, _part, _name in rows:
        found = existing_file(item_id)
        if found:
            rel = "/" + str(found.relative_to(ROOT / "public"))
            state["ok"][item_id] = rel
            state.get("miss", {}).pop(item_id, None)
    for item_id in list(state.get("miss", {})):
        if item_id in state["ok"]:
            state["miss"].pop(item_id, None)
    save_state(state)

    known_hashes: dict[str, int] = {}
    for path in OUT_DIR.glob("*"):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        known_hashes[digest] = known_hashes.get(digest, 0) + 1

    pending = [row for row in rows if row[0] not in state["ok"]]
    print(f"pending={len(pending)} already_ok={len(state['ok'])}", flush=True)
    for index, (item_id, sku, brand, part, name) in enumerate(pending, start=1):
        try:
            urls = find_photos(brand, part, name)
            saved = None
            used = ""
            for url in urls:
                saved = download(url, OUT_DIR / item_id, known_hashes)
                if saved:
                    used = url
                    break
            if saved:
                rel = "/" + str(saved.relative_to(ROOT / "public"))
                state["ok"][item_id] = rel
                state.get("miss", {}).pop(item_id, None)
                status = "ok"
                payload = rel
            else:
                state.setdefault("miss", {})[item_id] = urls[0] if urls else ""
                status = "miss"
                payload = urls[0] if urls else ""
        except Exception as exc:
            state.setdefault("error", {})[item_id] = str(exc)
            status = "error"
            payload = str(exc)
        if index % 5 == 0 or status == "ok":
            save_state(state)
            print(
                f"{index}/{len(pending)} ok={len(state['ok'])} miss={len(state.get('miss', {}))} {status} {sku} {payload[:90]}",
                flush=True,
            )
    copied = copy_family(rows, state)
    save_state(state)
    print(
        f"DONE ok={len(state['ok'])} miss={len(state.get('miss', {}))} err={len(state.get('error', {}))} family={copied}",
        flush=True,
    )


if __name__ == "__main__":
    main()
