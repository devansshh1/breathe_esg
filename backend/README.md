# Django Backend Bootstrap

This backend starter is set up for:

- Django + DRF + PostgreSQL
- `djangorestframework-simplejwt`
- JWTs stored in HTTP-only cookies
- Non-persistent browser sessions
- Cookie-based auth for a React/Vite frontend on `localhost:5173`
- An immutable audit trail for emission status changes

## 1. Create and activate a virtual environment

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

## 2. Install dependencies

```powershell
pip install -r requirements.txt
```

## 3. Start the Django project and app

If you are starting from an empty folder, these are the equivalent scaffold commands:

```powershell
django-admin startproject config .
python manage.py startapp emissions
python manage.py startapp common
```

## 4. Configure PostgreSQL

Set these environment variables before running the app:

```powershell
$env:DJANGO_SECRET_KEY="replace-me"
$env:DB_NAME="breathe_esg"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres"
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="5432"
```

## 5. Apply migrations

```powershell
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## 6. Why the auth setup looks different from MERN

In a typical MERN app, you might issue JWTs in an Express controller and read them in middleware.

In Django/DRF:

- `settings.py` defines DRF auth, CORS, CSRF, and JWT lifetimes.
- `common/authentication.py` is the DRF equivalent of Express auth middleware.
- `common/views.py` is where login/refresh/logout endpoints set and clear the cookies.
- Because auth cookies are automatically sent by the browser, CSRF protection matters for `POST`, `PATCH`, and `DELETE`.

## 7. Non-persistent session behavior

The access and refresh cookies are intentionally set without `max_age` or `expires`.

That means:

- the cookies are session cookies
- they disappear when the browser session ends
- nothing is stored in `localStorage`

## 8. Frontend fetch configuration

From React, always send credentials:

```ts
await fetch("http://127.0.0.1:8000/api/emissions/", {
  method: "PATCH",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": csrfToken,
  },
  body: JSON.stringify({ status: "APPROVED" }),
});
```

You can prime the CSRF cookie by calling:

```ts
await fetch("http://127.0.0.1:8000/api/auth/csrf/", {
  credentials: "include",
});
```
