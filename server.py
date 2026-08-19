"""DataNova — тайлан, өгөгдөл борлуулах энгийн сервер.

  python server.py
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
WEB = (ROOT / "web").resolve()
DATA = (ROOT / "data").resolve()
ORDERS = (ROOT / "orders").resolve()
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8787"))

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+\-\s()]{6,20}$")
ADMIN_TOKENS: set[str] = set()
CATEGORY_LABELS = {
    "briefing": "Тойм",
    "report": "Тайлан",
    "dataset": "Өгөгдөл",
    "guide": "Заавар",
}
ORDER_STATUSES = {"awaiting_payment", "paid", "sent", "cancelled"}


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalog() -> dict:
    return read_json(DATA / "products.json")


def load_products() -> dict:
    return {item["id"]: item for item in load_catalog().get("products", [])}


def load_admin() -> dict:
    env_pw = normalize_password(os.environ.get("ADMIN_PASSWORD", ""))
    if env_pw:
        return {"password": env_pw}
    path = DATA / "admin.json"
    if path.exists():
        return {"password": normalize_password(str(read_json(path).get("password") or ""))}
    return {"password": "DataNova1"}


def normalize_password(raw: str) -> str:
    value = str(raw or "").strip().strip('"').strip("'")
    if value.startswith("ADMIN_PASSWORD") and "=" in value:
        value = value.split("=", 1)[1].strip().strip('"').strip("'")
    return value


def passwords_match(given: str, expected: str) -> bool:
    left = normalize_password(given).encode("utf-8")
    right = normalize_password(expected).encode("utf-8")
    if not right or len(left) != len(right):
        return False
    return secrets.compare_digest(left, right)


def safe_file(root: Path, rel: str) -> Path | None:
    if not rel or rel.endswith("/"):
        return None
    target = (root / rel).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        return None
    return target if target.is_file() else None


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys_stdout = __import__("sys").stderr
        sys_stdout.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path or "/"
        if path == "/api/health":
            self._json(200, {"ok": True})
            return
        if path == "/api/admin/orders":
            if not self._admin_ok():
                return
            self._json(200, {"orders": list_orders()})
            return
        if path == "/api/admin/store":
            if not self._admin_ok():
                return
            self._json(200, {"store": read_json(DATA / "store.json")})
            return
        if path == "/api/admin/products":
            if not self._admin_ok():
                return
            self._json(200, load_catalog())
            return
        self._serve_public(path)

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path or "/"
        if path == "/api/health":
            self._json(200, {"ok": True})
            return
        self._serve_public(path, body=False)

    def _serve_public(self, path: str, body: bool = True) -> None:
        if path in ("/", "/index.html"):
            self._send_file(WEB / "index.html", body=body)
            return
        if path in ("/admin", "/admin/"):
            self._send_file(WEB / "admin.html", body=body)
            return
        if path.startswith("/data/"):
            if path.rstrip("/").endswith("admin.json") or path.rstrip("/").endswith("/admin"):
                self._not_found()
                return
            target = safe_file(DATA, path[len("/data/") :])
            if not target:
                self._not_found()
                return
            self._send_file(target, body=body)
            return
        target = safe_file(WEB, path.lstrip("/"))
        if target:
            self._send_file(target, body=body)
            return
        self._send_file(WEB / "index.html", body=body)

    def _send_file(self, path: Path, body: bool = True) -> None:
        if not path.is_file():
            self._not_found()
            return
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if path.suffix in {".html", ".js", ".css", ".json", ".svg", ".txt"}:
            ctype = {
                ".html": "text/html; charset=utf-8",
                ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".svg": "image/svg+xml",
                ".txt": "text/plain; charset=utf-8",
            }[path.suffix]
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if body:
            self.wfile.write(data)

    def _not_found(self) -> None:
        body = (
            "<!doctype html><meta charset=utf-8><title>Олдсонгүй</title>"
            "<p>Хуудас олдсонгүй. <a href='/'>Нүүр</a></p>"
        ).encode("utf-8")
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/orders":
            payload, err = self._read_json(80_000)
            if err:
                self._json(400, {"error": err})
                return
            order, order_err = build_order(payload)
            if order_err:
                self._json(400, {"error": order_err})
                return
            ORDERS.mkdir(exist_ok=True)
            write_json(ORDERS / f"{order['id']}.json", order)
            self._json(201, {"order": public_order(order)})
            return
        if path == "/api/admin/login":
            payload, err = self._read_json(4_000)
            if err:
                self._json(400, {"error": err})
                return
            password = str(payload.get("password") or "")
            expected = str(load_admin().get("password") or "")
            if not passwords_match(password, expected):
                self._json(401, {"error": "password"})
                return
            token = secrets.token_hex(24)
            ADMIN_TOKENS.add(token)
            self._json(200, {"token": token})
            return
        self._json(404, {"error": "not_found"})

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if not self._admin_ok():
            return
        payload, err = self._read_json(200_000)
        if err:
            self._json(400, {"error": err})
            return
        if path == "/api/admin/store":
            saved, save_err = save_store(payload)
            if save_err:
                self._json(400, {"error": save_err})
                return
            self._json(200, {"store": saved})
            return
        if path == "/api/admin/products":
            saved, save_err = save_product(payload)
            if save_err:
                self._json(400, {"error": save_err})
                return
            self._json(200, {"product": saved})
            return
        if path == "/api/admin/password":
            new_password = str(payload.get("password") or "").strip()
            if len(new_password) < 6:
                self._json(400, {"error": "password"})
                return
            write_json(DATA / "admin.json", {"password": new_password})
            ADMIN_TOKENS.clear()
            self._json(200, {"ok": True})
            return
        if path.startswith("/api/admin/orders/"):
            order_id = path.rsplit("/", 1)[-1]
            saved, save_err = update_order_status(order_id, payload)
            if save_err:
                self._json(400 if save_err != "not_found" else 404, {"error": save_err})
                return
            self._json(200, {"order": saved})
            return
        self._json(404, {"error": "not_found"})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if not self._admin_ok():
            return
        if parsed.path.startswith("/api/admin/products/"):
            pid = unquote(parsed.path.rsplit("/", 1)[-1])
            ok, err = delete_product(pid)
            if err:
                self._json(404 if err == "not_found" else 400, {"error": err})
                return
            self._json(200, {"ok": ok})
            return
        self._json(404, {"error": "not_found"})

    def _admin_ok(self) -> bool:
        token = self.headers.get("X-Admin-Token", "")
        if token and token in ADMIN_TOKENS:
            return True
        self._json(401, {"error": "auth"})
        return False

    def _read_json(self, max_len: int) -> tuple[dict, str | None]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0 or length > max_len:
            return {}, "bad_body"
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}, "invalid_json"
        if not isinstance(payload, dict):
            return {}, "invalid_payload"
        return payload, None

    def _json(self, status: int, body: dict) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def list_orders() -> list[dict]:
    ORDERS.mkdir(exist_ok=True)
    items = []
    for path in ORDERS.glob("*.json"):
        try:
            items.append(read_json(path))
        except (json.JSONDecodeError, OSError):
            continue
    items.sort(key=lambda o: str(o.get("createdAt") or ""), reverse=True)
    return items


def update_order_status(order_id: str, payload: dict) -> tuple[dict | None, str | None]:
    if not re.fullmatch(r"[A-Z]{3}-[0-9A-Z-]+", order_id):
        return None, "not_found"
    status = str(payload.get("status") or "")
    if status not in ORDER_STATUSES:
        return None, "status"
    path = ORDERS / f"{order_id}.json"
    if not path.exists():
        return None, "not_found"
    order = read_json(path)
    order["status"] = status
    write_json(path, order)
    return order, None


def save_store(payload: dict) -> tuple[dict | None, str | None]:
    current = read_json(DATA / "store.json")
    name = str(payload.get("name") or current.get("name") or "").strip()
    email = str(payload.get("email") or "").strip()
    if len(name) < 2:
        return None, "name"
    if email and not EMAIL_RE.match(email):
        return None, "email"
    bank_in = payload.get("bank") if isinstance(payload.get("bank"), dict) else {}
    current.update(
        {
            "name": name[:80],
            "nameEn": str(payload.get("nameEn") or name)[:80],
            "mark": str(payload.get("mark") or name[:1] or "D")[:2],
            "tagline": str(payload.get("tagline") or current.get("tagline") or "")[:160],
            "taglineEn": pick_text(payload, current, "taglineEn", 160),
            "kicker": pick_text(payload, current, "kicker", 80),
            "kickerEn": pick_text(payload, current, "kickerEn", 80),
            "headline": pick_text(payload, current, "headline", 120),
            "headlineEn": pick_text(payload, current, "headlineEn", 120),
            "description": str(payload.get("description") or current.get("description") or "")[:500],
            "descriptionEn": pick_text(payload, current, "descriptionEn", 500),
            "heroAside": pick_text(payload, current, "heroAside", 300),
            "heroAsideEn": pick_text(payload, current, "heroAsideEn", 300),
            "featuredHint": pick_text(payload, current, "featuredHint", 200),
            "featuredHintEn": pick_text(payload, current, "featuredHintEn", 200),
            "notice": pick_text(payload, current, "notice", 300),
            "noticeEn": pick_text(payload, current, "noticeEn", 300),
            "audienceTitle": pick_text(payload, current, "audienceTitle", 80),
            "audienceTitleEn": pick_text(payload, current, "audienceTitleEn", 80),
            "cityEn": pick_text(payload, current, "cityEn", 80),
            "fulfillmentHoursEn": pick_text(payload, current, "fulfillmentHoursEn", 80),
            "email": email[:120],
            "phone": str(payload.get("phone") or "")[:30],
            "city": str(payload.get("city") or current.get("city") or "")[:80],
            "fulfillmentHours": str(
                payload.get("fulfillmentHours") or current.get("fulfillmentHours") or ""
            )[:80],
        }
    )
    if "audience" in payload:
        current["audience"] = parse_audience(payload.get("audience"))
    current["bank"] = {
        "bankName": str(bank_in.get("bankName") or current.get("bank", {}).get("bankName") or "")[:80],
        "account": str(bank_in.get("account") or current.get("bank", {}).get("account") or "")[:40],
        "accountName": str(bank_in.get("accountName") or current.get("bank", {}).get("accountName") or "")[:80],
        "note": str(bank_in.get("note") or current.get("bank", {}).get("note") or "")[:300],
        "bankNameEn": str(bank_in.get("bankNameEn") or current.get("bank", {}).get("bankNameEn") or "")[:80],
        "noteEn": str(bank_in.get("noteEn") or current.get("bank", {}).get("noteEn") or "")[:300],
    }
    write_json(DATA / "store.json", current)
    return current, None


def pick_text(payload: dict, current: dict, key: str, limit: int) -> str:
    if payload.get(key) is not None:
        return str(payload.get(key) or "")[:limit]
    return str(current.get(key) or "")[:limit]


def parse_audience(raw) -> list[dict]:
    items = []
    if not isinstance(raw, list):
        return items
    for row in raw[:12]:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()[:80]
        text = str(row.get("text") or "").strip()[:240]
        title_en = str(row.get("titleEn") or "").strip()[:80]
        text_en = str(row.get("textEn") or "").strip()[:240]
        if title or text or title_en or text_en:
            items.append({"title": title, "text": text, "titleEn": title_en, "textEn": text_en})
    return items


def save_product(payload: dict) -> tuple[dict | None, str | None]:
    title = str(payload.get("title") or "").strip()
    if len(title) < 2:
        return None, "title"
    try:
        price = int(payload.get("price"))
    except (TypeError, ValueError):
        return None, "price"
    if price < 0 or price > 50_000_000:
        return None, "price"

    catalog = load_catalog()
    products = catalog.get("products", [])
    pid = str(payload.get("id") or "").strip()
    existing = next((p for p in products if p.get("id") == pid), None) if pid else None

    category = str(payload.get("category") or (existing or {}).get("category") or "report")
    if category not in CATEGORY_LABELS:
        category = "report"

    formats = payload.get("formats")
    if isinstance(formats, str):
        formats = [part.strip() for part in formats.split(",") if part.strip()]
    if not isinstance(formats, list) or not formats:
        formats = (existing or {}).get("formats") or ["PDF"]
    formats = [str(x)[:40] for x in formats[:8]]

    def lines(value, fallback):
        if isinstance(value, list):
            return [str(x).strip()[:200] for x in value if str(x).strip()][:12]
        if isinstance(value, str):
            return [part.strip()[:200] for part in value.splitlines() if part.strip()][:12]
        return fallback

    if not existing:
        pid = slugify(title)
        if any(p.get("id") == pid for p in products):
            pid = f"{pid}-{uuid.uuid4().hex[:4]}"
        existing = {
            "id": pid,
            "sku": next_sku(products),
            "accent": "#1e3a5f",
            "sample": False,
            "toc": [],
            "preview": [],
            "audience": [],
        }
        products.append(existing)

    existing.update(
        {
            "title": title[:140],
            "subtitle": str(payload.get("subtitle") or "")[:160],
            "category": category,
            "categoryLabel": CATEGORY_LABELS[category],
            "price": price,
            "pages": int(payload.get("pages") or existing.get("pages") or 0),
            "formats": formats,
            "updated": datetime.now().strftime("%Y-%m"),
            "featured": bool(payload.get("featured")),
            "published": payload.get("published", existing.get("published", True)) is not False,
            "excerpt": str(payload.get("excerpt") or "")[:400],
            "description": str(payload.get("description") or "")[:2000],
            "includes": lines(payload.get("includes"), existing.get("includes") or []),
            "notIncludes": lines(payload.get("notIncludes"), existing.get("notIncludes") or []),
            "audience": lines(payload.get("audience"), existing.get("audience") or []),
            "titleEn": str(payload.get("titleEn") or existing.get("titleEn") or "")[:140],
            "subtitleEn": str(payload.get("subtitleEn") or existing.get("subtitleEn") or "")[:160],
            "excerptEn": str(payload.get("excerptEn") or existing.get("excerptEn") or "")[:400],
            "descriptionEn": str(payload.get("descriptionEn") or existing.get("descriptionEn") or "")[:2000],
            "includesEn": lines(payload.get("includesEn"), existing.get("includesEn") or []),
            "notIncludesEn": lines(payload.get("notIncludesEn"), existing.get("notIncludesEn") or []),
            "audienceEn": lines(payload.get("audienceEn"), existing.get("audienceEn") or []),
        }
    )
    if payload.get("toc") is not None:
        existing["toc"] = lines(payload.get("toc"), existing.get("toc") or [])
    if payload.get("preview") is not None:
        existing["preview"] = lines(payload.get("preview"), existing.get("preview") or [])
    if payload.get("tocEn") is not None:
        existing["tocEn"] = lines(payload.get("tocEn"), existing.get("tocEn") or [])
    if payload.get("previewEn") is not None:
        existing["previewEn"] = lines(payload.get("previewEn"), existing.get("previewEn") or [])

    catalog["products"] = products
    write_json(DATA / "products.json", catalog)
    return existing, None


def delete_product(pid: str) -> tuple[bool, str | None]:
    catalog = load_catalog()
    products = catalog.get("products", [])
    kept = [p for p in products if p.get("id") != pid]
    if len(kept) == len(products):
        return False, "not_found"
    catalog["products"] = kept
    write_json(DATA / "products.json", catalog)
    return True, None


def next_sku(products: list[dict]) -> str:
    highest = 0
    for item in products:
        sku = str(item.get("sku") or "")
        if sku.startswith("DNV-"):
            tail = sku.split("-")[-1]
            if tail.isdigit():
                highest = max(highest, int(tail))
    return f"DNV-{highest + 1:03d}"


def slugify(title: str) -> str:
    return f"item-{uuid.uuid4().hex[:8]}"


def build_order(payload: dict) -> tuple[dict | None, str | None]:
    if not isinstance(payload, dict):
        return None, "invalid_payload"

    name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip()
    phone = str(payload.get("phone") or "").strip()
    org = str(payload.get("org") or "").strip()
    note = str(payload.get("note") or "").strip()
    agree = bool(payload.get("agree"))
    items_in = payload.get("items")

    if len(name) < 2 or len(name) > 80:
        return None, "name"
    if not EMAIL_RE.match(email):
        return None, "email"
    if not PHONE_RE.match(phone):
        return None, "phone"
    if not agree:
        return None, "agree"
    if not isinstance(items_in, list) or not items_in:
        return None, "items"
    if len(note) > 500 or len(org) > 120:
        return None, "too_long"

    catalog = load_products()
    lines = []
    total = 0
    seen = set()

    for raw in items_in[:20]:
        if not isinstance(raw, dict):
            continue
        pid = str(raw.get("id") or "")
        product = catalog.get(pid)
        if pid in seen or not product or product.get("published") is False:
            continue
        seen.add(pid)
        price = int(product["price"])
        lines.append(
            {
                "id": product["id"],
                "sku": product["sku"],
                "title": product["title"],
                "price": price,
                "formats": product.get("formats", []),
            }
        )
        total += price

    if not lines:
        return None, "items"

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%y%m%d")
    suffix = uuid.uuid4().hex[:4].upper()
    order_id = f"DNV-{stamp}-{suffix}"

    order = {
        "id": order_id,
        "createdAt": now.isoformat(),
        "status": "awaiting_payment",
        "buyer": {
            "name": name,
            "email": email,
            "phone": phone,
            "org": org,
        },
        "note": note,
        "items": lines,
        "total": total,
        "currency": "MNT",
    }
    return order, None


def public_order(order: dict) -> dict:
    return {
        "id": order["id"],
        "createdAt": order["createdAt"],
        "status": order["status"],
        "buyer": order["buyer"],
        "items": order["items"],
        "total": order["total"],
        "currency": order["currency"],
    }


def main() -> None:
    ORDERS.mkdir(exist_ok=True)
    DATA.mkdir(exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"DataNova нээлттэй: http://{HOST}:{PORT}", flush=True)
    print(f"Удирдлага: http://{HOST}:{PORT}/admin", flush=True)
    if os.environ.get("RENDER"):
        print("Render дээр ажиллаж байна.", flush=True)
    print("Зогсоох: Ctrl+C", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nХаалаа.")
        httpd.server_close()


if __name__ == "__main__":
    main()
