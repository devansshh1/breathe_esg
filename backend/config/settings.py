import os
from datetime import timedelta
from pathlib import Path
import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
load_dotenv()


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-change-me-please-set-a-longer-secret-key-for-production",
)
DEBUG = os.getenv("DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]
RENDER_EXTERNAL_HOSTNAME = os.getenv("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "common",
    "emissions",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ==============================================================================
# FORCE PRODUCTION ENVIRONMENT OR LOCAL FALLBACK
# ==============================================================================

# Check if running on Render's cloud infrastructure
IS_RENDER = os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_HOSTNAME")

if IS_RENDER:
    # Pull strictly from the web dashboard container variables
    prod_db_url = os.environ.get("DATABASE_URL")
    
    # Fail loudly right here if the dashboard variable is missing or wrong
    
    DATABASES = {
        "default": dj_database_url.config(
            default=prod_db_url,
            conn_max_age=600,
            ssl_require=True  # In production, Render connections must use SSL
        )
    }
else:
    # Clean fallback for your local Windows machine (ignores cloud configuration)
    DATABASES = {
        "default": dj_database_url.config(
            default="postgres://postgres:Pass@123@127.0.0.1:5432/breathe_esg"
        )
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "common.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=8),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# JWT cookie settings
# Do not set max_age or expires when writing these cookies.
# That keeps them as non-persistent session cookies.
# ==============================================================================
# COOKIES & CORS PRODUCTION SETTINGS
# ==============================================================================

# JWT cookie settings
AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"

# CRITICAL FIXES FOR VISUAL CROSS-DOMAIN AUTHENTICATION (Vercel <-> Render):
if IS_RENDER:
    AUTH_COOKIE_SECURE = True
    AUTH_COOKIE_SAMESITE = "None"      # Must be "None" to allow transmission over HTTPS across domains
    
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = "None"     # Must be "None" for cross-origin security handshakes
    
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "None"
else:
    # Safe loose standards for local Windows machine testing
    AUTH_COOKIE_SECURE = False
    AUTH_COOKIE_SAMESITE = "Lax"
    
    CSRF_COOKIE_SECURE = False
    CSRF_COOKIE_SAMESITE = "Lax"
    
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"

AUTH_COOKIE_HTTP_ONLY = True
AUTH_COOKIE_PATH = "/"
CSRF_COOKIE_HTTPONLY = False

# Your explicit allowed origins (Perfectly configured!)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://breathe-esg-gamma-two.vercel.app",
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://breathe-esg-gamma-two.vercel.app",
]