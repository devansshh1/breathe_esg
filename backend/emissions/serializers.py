from rest_framework import serializers

from .models import AuditLog, NormalizedEmissionsData

class AuditLogSerializer(serializers.ModelSerializer):
    changed_by_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "emission_record",
            "old_status",
            "new_status",
            "changed_by",
            "changed_by_display",
            "changed_at",
        ]
        read_only_fields = fields

    def get_changed_by_display(self, obj):
        if not obj.changed_by:
            return None
        return obj.changed_by.get_username()


class NormalizedEmissionsDataSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    reviewed_by_display = serializers.SerializerMethodField()

    class Meta:
        model = NormalizedEmissionsData
        fields = [
            "id",
            "tenant",
            "tenant_name",
            "scope_category",
            "activity_type",
            "activity_start_date",
            "activity_end_date",
            "raw_quantity",
            "raw_unit",
            "normalized_quantity",
            "normalized_unit",
            "source_system",
            "raw_record_id",
            "status",
            "reviewed_by",
            "reviewed_by_display",
            "reviewed_at",
            "system_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_reviewed_by_display(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_username()


class EmissionStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=NormalizedEmissionsData.Status.choices)
