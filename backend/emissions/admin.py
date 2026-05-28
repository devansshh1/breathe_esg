from django.contrib import admin

from .models import AuditLog, NormalizedEmissionsData, Tenant


class AuditLogInline(admin.TabularInline):
    model = AuditLog
    extra = 0
    can_delete = False
    fields = ("old_status", "new_status", "changed_by", "changed_at")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    readonly_fields = ("created_at",)


@admin.register(NormalizedEmissionsData)
class NormalizedEmissionsDataAdmin(admin.ModelAdmin):
    list_display = (
        "source_system",
        "raw_record_id",
        "tenant",
        "scope_category",
        "activity_type",
        "raw_quantity",
        "raw_unit",
        "normalized_quantity",
        "normalized_unit",
        "status",
        "reviewed_by",
        "reviewed_at",
        "created_at",
    )
    list_filter = ("status", "scope_category", "source_system", "tenant", "created_at")
    search_fields = ("source_system", "raw_record_id", "activity_type", "system_notes")
    readonly_fields = ("created_at", "updated_at")
    inlines = (AuditLogInline,)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("emission_record", "old_status", "new_status", "changed_by", "changed_at")
    list_filter = ("old_status", "new_status", "changed_at")
    search_fields = (
        "emission_record__raw_record_id",
        "emission_record__source_system",
        "changed_by__username",
    )
    readonly_fields = ("emission_record", "old_status", "new_status", "changed_by", "changed_at")

    def has_add_permission(self, request):
        return False
