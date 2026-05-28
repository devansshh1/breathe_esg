import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update the prototype auditor account from environment variables."

    def handle(self, *args, **options):
        email = os.getenv("AUDITOR_EMAIL", "").strip().lower()
        password = os.getenv("AUDITOR_PASSWORD", "")
        username = os.getenv("AUDITOR_USERNAME", email).strip() or email

        if not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping auditor seed: set AUDITOR_EMAIL and AUDITOR_PASSWORD to enable it."
                )
            )
            return

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            user = User(username=username, email=email)
            created = True
        else:
            created = False
            if user.username != username:
                user.username = username

        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} auditor account for {email}."))
