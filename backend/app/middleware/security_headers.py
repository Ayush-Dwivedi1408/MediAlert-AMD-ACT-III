from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# The interactive API docs (Swagger UI / ReDoc) load their own scripts and
# styles from a CDN and would break under a strict Content-Security-Policy —
# every other route gets the full policy.
DOCS_PATHS = {"/docs", "/redoc", "/openapi.json"}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Point 14 — Security Features: defense-in-depth response headers on
    every response.

    This doesn't replace the actual fixes living elsewhere in the app —
    ORM-parameterized queries prevent SQL injection, React's default {}
    escaping prevents XSS in rendered output, Pydantic schemas validate
    input. What these headers add is protection against browser-level
    attack classes that don't depend on any single bug in application code:
    clickjacking (X-Frame-Options), MIME-type confusion attacks
    (X-Content-Type-Options), and — as a backstop even if something
    unexpected ever did get injected into a response — a restrictive
    Content-Security-Policy that stops it from executing.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        if request.url.path not in DOCS_PATHS:
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

        return response
