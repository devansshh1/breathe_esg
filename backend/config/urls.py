from django.contrib import admin
from django.urls import include, path

from common.views import (
    CSRFCookieView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CurrentUserView,
    LogoutView,
)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/csrf/", CSRFCookieView.as_view(), name="csrf-cookie"),
    path("api/auth/login/", CookieTokenObtainPairView.as_view(), name="token-login"),
    path("api/auth/me/", CurrentUserView.as_view(), name="current-user"),
    path("api/auth/refresh/", CookieTokenRefreshView.as_view(), name="token-refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="token-logout"),
    path("api/emissions/", include("emissions.urls")),
]
