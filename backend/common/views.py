from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import CurrentUserSerializer, EmailOrUsernameTokenObtainPairSerializer


def _cookie_kwargs():
    return {
        "httponly": settings.AUTH_COOKIE_HTTP_ONLY,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": settings.AUTH_COOKIE_PATH,
    }


def set_token_cookies(response, access_token, refresh_token=None):
    response.set_cookie(
        key=settings.AUTH_COOKIE_ACCESS,
        value=access_token,
        **_cookie_kwargs(),
    )

    if refresh_token is not None:
        response.set_cookie(
            key=settings.AUTH_COOKIE_REFRESH,
            value=refresh_token,
            **_cookie_kwargs(),
        )

    return response


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFCookieView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


class CookieTokenObtainPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = EmailOrUsernameTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        access_token = serializer.validated_data["access"]
        refresh_token = serializer.validated_data["refresh"]

        response = Response(
            {
                "detail": "Login successful.",
                "user": CurrentUserSerializer(serializer.user).data,
            },
            status=status.HTTP_200_OK,
        )
        return set_token_cookies(response, access_token, refresh_token)


class CookieTokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)

        response = Response(
            {"detail": "Token refreshed."},
            status=status.HTTP_200_OK,
        )
        return set_token_cookies(
            response,
            serializer.validated_data["access"],
            serializer.validated_data.get("refresh"),
        )


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.AUTH_COOKIE_ACCESS,
            path=settings.AUTH_COOKIE_PATH,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )
        response.delete_cookie(
            settings.AUTH_COOKIE_REFRESH,
            path=settings.AUTH_COOKIE_PATH,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )
        return response


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(CurrentUserSerializer(request.user).data, status=status.HTTP_200_OK)
