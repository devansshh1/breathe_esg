from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


class Tenant(models.Model):
    """
    Minimal tenant model so the ForeignKey is immediately usable.
    Replace or move this if your project already has an organization model.
    """

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class NormalizedEmissionsData(models.Model):
    class ScopeCategory(models.TextChoices):
        SCOPE_1 = "SCOPE_1", "Scope 1"
        SCOPE_2 = "SCOPE_2", "Scope 2"
        SCOPE_3 = "SCOPE_3", "Scope 3"

    class Status(models.TextChoices):
        PENDING_REVIEW = "PENDING_REVIEW", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        FLAGGED = "FLAGGED", "Flagged"
        LOCKED = "LOCKED", "Locked"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="normalized_emissions_records",
    )
    scope_category = models.CharField(max_length=20, choices=ScopeCategory.choices)
    activity_type = models.CharField(max_length=255)

    activity_start_date = models.DateField()
    activity_end_date = models.DateField()

    raw_quantity = models.DecimalField(max_digits=20, decimal_places=6)
    raw_unit = models.CharField(max_length=50)
    normalized_quantity = models.DecimalField(max_digits=20, decimal_places=6)
    normalized_unit = models.CharField(max_length=50)

    source_system = models.CharField(max_length=100)
    raw_record_id = models.CharField(max_length=255)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_emissions_records",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    system_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "scope_category"]),
            models.Index(fields=["source_system", "raw_record_id"]),
            models.Index(fields=["activity_start_date", "activity_end_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "source_system", "raw_record_id"],
                name="unique_source_record_per_tenant",
            )
        ]

    def clean(self):
        if self.activity_end_date < self.activity_start_date:
            raise ValidationError("activity_end_date cannot be earlier than activity_start_date.")

    def __str__(self):
        return f"{self.tenant} | {self.activity_type} | {self.status}"


class AuditLog(models.Model):
    emission_record = models.ForeignKey(
        NormalizedEmissionsData,
        on_delete=models.PROTECT,
        related_name="audit_logs",
    )
    old_status = models.CharField(
        max_length=20,
        choices=NormalizedEmissionsData.Status.choices,
    )
    new_status = models.CharField(
        max_length=20,
        choices=NormalizedEmissionsData.Status.choices,
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="emissions_status_changes",
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]
        indexes = [
            models.Index(fields=["emission_record", "changed_at"]),
        ]

    def __str__(self):
        return f"{self.emission_record_id}: {self.old_status} -> {self.new_status}"


@receiver(pre_save, sender=NormalizedEmissionsData)
def cache_previous_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return

    instance._previous_status = (
        sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    )


@receiver(post_save, sender=NormalizedEmissionsData)
def create_status_audit_log(sender, instance, created, **kwargs):
    if created:
        return

    previous_status = getattr(instance, "_previous_status", None)
    if previous_status and previous_status != instance.status:
        AuditLog.objects.create(
            emission_record=instance,
            old_status=previous_status,
            new_status=instance.status,
            changed_by=instance.reviewed_by,
        )
