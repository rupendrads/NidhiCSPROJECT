"""
Accounts and login (Module 1, sub-problem 1.7 / FR12).

How it works, in one paragraph:
  - Passwords are never stored. We keep a salted PBKDF2 hash made by
    werkzeug.security (ships with Flask); check_password_hash() compares.
  - A successful login returns a signed, time-limited token
    (itsdangerous.URLSafeTimedSerializer). The browser sends it back as
    `Authorization: Bearer <token>` on every request. The token is signed with
    a random secret that lives in backend/.secret_key (git-ignored, NFR5), so
    nobody can forge one and a restart does not log everyone out.
  - Tokens rather than session cookies because the page (port 8000) and the API
    (port 5000) are different origins; a header works everywhere a cookie would
    need SameSite / CORS-credential exceptions.
"""
import os
import re
import secrets
from functools import wraps

from flask import g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from config import BACKEND_DIR

SECRET_PATH = os.path.join(BACKEND_DIR, ".secret_key")
TOKEN_MAX_AGE = 7 * 24 * 3600          # a token is valid for 7 days
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
MIN_PASSWORD = 8


def _secret() -> str:
    """Read the signing secret, creating a random one on first run."""
    if os.path.exists(SECRET_PATH):
        with open(SECRET_PATH) as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(SECRET_PATH, "w") as f:
        f.write(key)
    return key


_serializer = URLSafeTimedSerializer(_secret(), salt="portfolio-login")


# ---- passwords --------------------------------------------------------------
def hash_password(password: str) -> str:
    return generate_password_hash(password)          # pbkdf2:sha256 + random salt


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


# ---- validation (mirrors the rules in the write-up, §2.4) -------------------
def validate_username(username: str) -> str | None:
    if not USERNAME_RE.match(username or ""):
        return "Username must be 3-30 characters: letters, digits or underscore."
    return None


def validate_password(password: str) -> str | None:
    if not isinstance(password, str) or len(password) < MIN_PASSWORD:
        return f"Password must be at least {MIN_PASSWORD} characters."
    return None


# ---- tokens -----------------------------------------------------------------
def issue_token(user_id: int) -> str:
    return _serializer.dumps({"uid": user_id})


def read_token(token: str) -> int | None:
    """Return the user id inside a valid token, or None if missing/forged/expired."""
    try:
        data = _serializer.loads(token, max_age=TOKEN_MAX_AGE)
        return int(data["uid"])
    except (BadSignature, SignatureExpired, KeyError, ValueError, TypeError):
        return None


def current_user_id() -> int | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return read_token(header[len("Bearer "):].strip())


def require_login(view):
    """Route decorator: reject the request with 401 unless a valid token is sent."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        uid = current_user_id()
        if uid is None:
            return jsonify({"error": "Please sign in.", "code": "unauthorized"}), 401
        g.user_id = uid
        return view(*args, **kwargs)
    return wrapper
