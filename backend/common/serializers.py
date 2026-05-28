from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        read_only_fields = fields


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Accepts either a Django username or an email address for prototype login.
    """

    def validate(self, attrs):
        identifier = attrs.get(self.username_field)

        if identifier and "@" in str(identifier):
            username_match_exists = User.objects.filter(username__iexact=identifier).exists()

            if not username_match_exists:
                matched_user = User.objects.filter(email__iexact=identifier).order_by("-id").first()
                if matched_user:
                    attrs = attrs.copy()
                    attrs[self.username_field] = matched_user.get_username()

        return super().validate(attrs)
