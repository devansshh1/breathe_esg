import csv
import io
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import uuid4

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, NormalizedEmissionsData, Tenant
from .serializers import (
    AuditLogSerializer,
    EmissionStatusUpdateSerializer,
    NormalizedEmissionsDataSerializer,
)


DECIMAL_PRECISION = Decimal("0.000001")
ZERO_QUANTITY = Decimal("0.000000")
BLANK_MARKERS = {"", "null", "none", "nan", "n/a", "na", "-"}

UNIT_NORMALIZATION_MAP = {
    "g": (Decimal("0.001"), "kg"),
    "gram": (Decimal("0.001"), "kg"),
    "grams": (Decimal("0.001"), "kg"),
    "kg": (Decimal("1"), "kg"),
    "kilogram": (Decimal("1"), "kg"),
    "kilograms": (Decimal("1"), "kg"),
    "lb": (Decimal("0.453592"), "kg"),
    "lbs": (Decimal("0.453592"), "kg"),
    "pound": (Decimal("0.453592"), "kg"),
    "pounds": (Decimal("0.453592"), "kg"),
    "t": (Decimal("1000"), "kg"),
    "mt": (Decimal("1000"), "kg"),
    "ton": (Decimal("1000"), "kg"),
    "tons": (Decimal("1000"), "kg"),
    "tonne": (Decimal("1000"), "kg"),
    "tonnes": (Decimal("1000"), "kg"),
    "metric ton": (Decimal("1000"), "kg"),
    "metric tons": (Decimal("1000"), "kg"),
    "wh": (Decimal("0.001"), "kWh"),
    "kwh": (Decimal("1"), "kWh"),
    "mwh": (Decimal("1000"), "kWh"),
    "l": (Decimal("1"), "L"),
    "liter": (Decimal("1"), "L"),
    "liters": (Decimal("1"), "L"),
    "litre": (Decimal("1"), "L"),
    "litres": (Decimal("1"), "L"),
    "gal": (Decimal("3.785410"), "L"),
    "gallon": (Decimal("3.785410"), "L"),
    "gallons": (Decimal("3.785410"), "L"),
    "km": (Decimal("1"), "km"),
    "kilometer": (Decimal("1"), "km"),
    "kilometers": (Decimal("1"), "km"),
    "kilometre": (Decimal("1"), "km"),
    "kilometres": (Decimal("1"), "km"),
    "mi": (Decimal("1.609340"), "km"),
    "mile": (Decimal("1.609340"), "km"),
    "miles": (Decimal("1.609340"), "km"),
    "kgco2e": (Decimal("1"), "kg CO2e"),
    "kg co2e": (Decimal("1"), "kg CO2e"),
    "tco2e": (Decimal("1000"), "kg CO2e"),
    "t co2e": (Decimal("1000"), "kg CO2e"),
}

SCOPE_NORMALIZATION_MAP = {
    "scope_1": NormalizedEmissionsData.ScopeCategory.SCOPE_1,
    "scope 1": NormalizedEmissionsData.ScopeCategory.SCOPE_1,
    "scope1": NormalizedEmissionsData.ScopeCategory.SCOPE_1,
    "1": NormalizedEmissionsData.ScopeCategory.SCOPE_1,
    "scope_2": NormalizedEmissionsData.ScopeCategory.SCOPE_2,
    "scope 2": NormalizedEmissionsData.ScopeCategory.SCOPE_2,
    "scope2": NormalizedEmissionsData.ScopeCategory.SCOPE_2,
    "2": NormalizedEmissionsData.ScopeCategory.SCOPE_2,
    "scope_3": NormalizedEmissionsData.ScopeCategory.SCOPE_3,
    "scope 3": NormalizedEmissionsData.ScopeCategory.SCOPE_3,
    "scope3": NormalizedEmissionsData.ScopeCategory.SCOPE_3,
    "3": NormalizedEmissionsData.ScopeCategory.SCOPE_3,
}


def normalize_key(value):
    return str(value or "").strip().lower()


def is_blank_value(value):
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in BLANK_MARKERS
    return False


def row_value(row, *aliases, default=None):
    lowered_row = {normalize_key(key): value for key, value in row.items()}
    for alias in aliases:
        value = lowered_row.get(normalize_key(alias))
        if not is_blank_value(value):
            return value
    return default


def has_any_alias(row, aliases):
    lowered_keys = {normalize_key(key) for key in row.keys()}
    return any(normalize_key(alias) in lowered_keys for alias in aliases)


def append_missing_note(row, notes, field_name, aliases):
    if not has_any_alias(row, aliases):
        notes.append(f"{field_name} column/key missing during ingestion.")
        return

    raw_value = row_value(row, *aliases)
    if is_blank_value(raw_value):
        notes.append(f"{field_name} is blank or null during ingestion.")


def append_blank_source_notes(row, notes):
    for key, value in row.items():
        if is_blank_value(value):
            notes.append(f"{key or 'Unnamed field'} is blank or null in the source row.")


def parse_decimal_for_ingestion(value, field_name, notes):
    if is_blank_value(value):
        notes.append(f"{field_name} is blank or null; defaulted to 0 for audit review.")
        return ZERO_QUANTITY, False

    try:
        cleaned_value = str(value).replace(",", "").strip()
        return Decimal(cleaned_value).quantize(DECIMAL_PRECISION, rounding=ROUND_HALF_UP), True
    except (InvalidOperation, TypeError):
        notes.append(f"{field_name} '{value}' is not numeric; defaulted to 0 for audit review.")
        return ZERO_QUANTITY, False


def parse_activity_dates(row, start_aliases, end_aliases):
    today = timezone.localdate()
    notes = []

    start_present = has_any_alias(row, start_aliases)
    end_present = has_any_alias(row, end_aliases)
    start_raw = row_value(row, *start_aliases)
    end_raw = row_value(row, *end_aliases)

    start_date = parse_date(str(start_raw)) if start_raw else None
    end_date = parse_date(str(end_raw)) if end_raw else None

    if start_present and is_blank_value(start_raw):
        notes.append("Activity start date is blank or missing; defaulted to today.")
    elif start_raw and not start_date:
        notes.append(f"Invalid start date '{start_raw}' defaulted to today.")

    if end_present and is_blank_value(end_raw):
        notes.append("Activity end date is blank or missing; defaulted to activity start date.")
    elif end_raw and not end_date:
        notes.append(f"Invalid end date '{end_raw}' defaulted to start date.")

    start_date = start_date or today
    end_date = end_date or start_date

    return start_date, end_date, notes


def normalize_quantity(raw_quantity, raw_unit):
    if not raw_unit or not str(raw_unit).strip():
        return raw_quantity, "UNRESOLVED", False, "Unit missing during ingestion."

    normalized_unit_key = normalize_key(raw_unit)
    mapping = UNIT_NORMALIZATION_MAP.get(normalized_unit_key)
    if not mapping:
        return (
            raw_quantity,
            "UNRESOLVED",
            False,
            f"Unknown unit '{raw_unit}' encountered during ingestion.",
        )

    factor, normalized_unit = mapping
    normalized_quantity = (raw_quantity * factor).quantize(
        DECIMAL_PRECISION,
        rounding=ROUND_HALF_UP,
    )
    return normalized_quantity, normalized_unit, True, ""


def normalize_scope_category(raw_scope, default_scope):
    if is_blank_value(raw_scope):
        return default_scope

    if raw_scope in NormalizedEmissionsData.ScopeCategory.values:
        return raw_scope

    normalized_scope = SCOPE_NORMALIZATION_MAP.get(normalize_key(raw_scope))
    return normalized_scope or default_scope


def normalized_status(unit_known, notes):
    if unit_known and not notes:
        return NormalizedEmissionsData.Status.PENDING_REVIEW
    return NormalizedEmissionsData.Status.FLAGGED


def source_value_or_placeholder(row, notes, field_name, aliases, placeholder, required=False):
    if required:
        append_missing_note(row, notes, field_name, aliases)
    elif has_any_alias(row, aliases) and is_blank_value(row_value(row, *aliases)):
        notes.append(f"{field_name} is blank or null during ingestion.")

    value = row_value(row, *aliases)
    if is_blank_value(value):
        return placeholder
    return str(value).strip()


def unique_raw_record_id(tenant, source_system, raw_record_id, notes):
    base_id = str(raw_record_id or f"{source_system.lower()}-{uuid4().hex}").strip()
    candidate = base_id

    if NormalizedEmissionsData.objects.filter(
        tenant=tenant,
        source_system=source_system,
        raw_record_id=candidate,
    ).exists():
        candidate = f"{base_id}-{uuid4().hex[:8]}"
        notes.append(f"Duplicate raw_record_id '{base_id}' detected; stored as '{candidate}'.")

    return candidate


def get_or_create_tenant(request):
    request_data = request.data if hasattr(request.data, "get") else {}

    tenant_id = request_data.get("tenant_id") or request.query_params.get("tenant_id")
    if tenant_id:
        return get_object_or_404(Tenant, pk=tenant_id)

    tenant_name = request_data.get("tenant_name") or request.query_params.get("tenant_name")
    if tenant_name:
        tenant_slug = normalize_key(tenant_name).replace(" ", "-")
        tenant, _ = Tenant.objects.get_or_create(
            slug=tenant_slug,
            defaults={"name": tenant_name.strip()},
        )
        return tenant

    tenant, _ = Tenant.objects.get_or_create(
        slug="demo-tenant",
        defaults={"name": "Demo Tenant"},
    )
    return tenant


def build_system_note(notes):
    cleaned_notes = [note.strip() for note in notes if note and str(note).strip()]
    return " ".join(cleaned_notes)


def create_emissions_record(
    *,
    tenant,
    source_system,
    raw_record_id,
    scope_category,
    activity_type,
    activity_start_date,
    activity_end_date,
    raw_quantity,
    raw_unit,
    normalized_quantity,
    normalized_unit,
    status_value,
    system_notes,
):
    with transaction.atomic():
        record = NormalizedEmissionsData(
            tenant=tenant,
            scope_category=scope_category,
            activity_type=activity_type,
            activity_start_date=activity_start_date,
            activity_end_date=activity_end_date,
            raw_quantity=raw_quantity,
            raw_unit=raw_unit,
            normalized_quantity=normalized_quantity,
            normalized_unit=normalized_unit,
            source_system=source_system,
            raw_record_id=raw_record_id,
            status=status_value,
            system_notes=system_notes,
        )
        record.full_clean()
        record.save()
        return record


class BaseIngestionAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def ingestion_response(self, created_records, errors):
        serializer = NormalizedEmissionsDataSerializer(created_records, many=True)
        flagged_count = sum(
            1 for record in created_records if record.status == NormalizedEmissionsData.Status.FLAGGED
        )
        response_status = (
            status.HTTP_201_CREATED
            if created_records and not errors
            else status.HTTP_200_OK
            if created_records
            else status.HTTP_400_BAD_REQUEST
        )
        return Response(
            {
                "detail": (
                    "Pipeline accepted the payload."
                    if created_records
                    else "No records were ingested. Check the uploaded payload structure."
                ),
                "created_count": len(created_records),
                "flagged_count": flagged_count,
                "error_count": len(errors),
                "records": serializer.data,
                "errors": errors,
            },
            status=response_status,
        )


class SAPUploadView(BaseIngestionAPIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "A CSV file must be provided in the 'file' field."}, status=400)

        tenant = get_or_create_tenant(request)
        created_records = []
        errors = []

        try:
            decoded_file = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response({"detail": "CSV file must be UTF-8 encoded."}, status=400)

        reader = csv.DictReader(io.StringIO(decoded_file))
        for row_number, row in enumerate(reader, start=2):
            try:
                notes = []
                append_blank_source_notes(row, notes)

                raw_quantity, _quantity_known = parse_decimal_for_ingestion(
                    row_value(row, "Quantity", "Qty"),
                    "Quantity",
                    notes,
                )
                raw_unit = source_value_or_placeholder(
                    row,
                    notes,
                    "Unit",
                    ("Unit", "UoM", "UOM"),
                    "UNKNOWN",
                    required=True,
                )
                activity_start_date, activity_end_date, date_notes = parse_activity_dates(
                    row,
                    ("Activity Start Date", "Posting Date", "Document Date", "Date"),
                    ("Activity End Date", "Posting Date", "Document Date", "Date"),
                )
                notes.extend(date_notes)
                normalized_quantity, normalized_unit, unit_known, unit_note = normalize_quantity(
                    raw_quantity,
                    raw_unit,
                )

                if unit_note:
                    notes.append(unit_note)

                raw_record_id = source_value_or_placeholder(
                    row,
                    notes,
                    "Raw record ID",
                    ("Record ID", "Document Number", "Line Item", "ID"),
                    f"sap-{uuid4().hex}",
                )
                raw_record_id = unique_raw_record_id(tenant, "SAP_ERP", raw_record_id, notes)
                scope_category = normalize_scope_category(
                    source_value_or_placeholder(
                        row,
                        notes,
                        "Scope",
                        ("Scope", "Scope Category"),
                        NormalizedEmissionsData.ScopeCategory.SCOPE_1,
                    ),
                    NormalizedEmissionsData.ScopeCategory.SCOPE_1,
                )
                activity_type = source_value_or_placeholder(
                    row,
                    notes,
                    "Activity type",
                    ("Activity Type", "Description", "Material"),
                    "SAP Activity",
                )

                created_records.append(
                    create_emissions_record(
                        tenant=tenant,
                        source_system="SAP_ERP",
                        raw_record_id=raw_record_id,
                        scope_category=scope_category,
                        activity_type=activity_type,
                        activity_start_date=activity_start_date,
                        activity_end_date=activity_end_date,
                        raw_quantity=raw_quantity,
                        raw_unit=raw_unit,
                        normalized_quantity=normalized_quantity,
                        normalized_unit=normalized_unit,
                        status_value=normalized_status(unit_known, notes),
                        system_notes=build_system_note(notes),
                    )
                )
            except (DjangoValidationError, IntegrityError, ValueError) as exc:
                errors.append({"row": row_number, "error": str(exc)})

        return self.ingestion_response(created_records, errors)


class UtilityUploadView(BaseIngestionAPIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "A CSV file must be provided in the 'file' field."}, status=400)

        tenant = get_or_create_tenant(request)
        created_records = []
        errors = []

        try:
            decoded_file = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response({"detail": "CSV file must be UTF-8 encoded."}, status=400)

        reader = csv.DictReader(io.StringIO(decoded_file))
        for row_number, row in enumerate(reader, start=2):
            try:
                notes = []
                append_blank_source_notes(row, notes)

                raw_quantity, _quantity_known = parse_decimal_for_ingestion(
                    row_value(row, "Usage", "Consumption", "Quantity", "kWh"),
                    "Usage",
                    notes,
                )
                unit_aliases = ("Unit", "UoM", "Usage Unit")
                raw_unit = row_value(row, *unit_aliases)
                if is_blank_value(raw_unit):
                    if has_any_alias(row, unit_aliases):
                        append_missing_note(row, notes, "Unit", unit_aliases)
                    if has_any_alias(row, ("kWh",)) and not has_any_alias(row, unit_aliases):
                        raw_unit = "kWh"
                    else:
                        raw_unit = "UNKNOWN"
                activity_start_date, activity_end_date, date_notes = parse_activity_dates(
                    row,
                    ("Service Start Date", "Start Date", "Bill Date"),
                    ("Service End Date", "End Date", "Bill Date"),
                )
                notes.extend(date_notes)
                normalized_quantity, normalized_unit, unit_known, unit_note = normalize_quantity(
                    raw_quantity,
                    raw_unit,
                )

                if unit_note:
                    notes.append(unit_note)

                raw_record_id = source_value_or_placeholder(
                    row,
                    notes,
                    "Raw record ID",
                    ("Invoice ID", "Meter Number", "Meter ID", "Account Number", "ID"),
                    f"utility-{uuid4().hex}",
                )
                raw_record_id = unique_raw_record_id(
                    tenant,
                    "UTILITY_PORTAL",
                    raw_record_id,
                    notes,
                )
                scope_category = normalize_scope_category(
                    source_value_or_placeholder(
                        row,
                        notes,
                        "Scope",
                        ("Scope", "Scope Category"),
                        NormalizedEmissionsData.ScopeCategory.SCOPE_2,
                    ),
                    NormalizedEmissionsData.ScopeCategory.SCOPE_2,
                )
                activity_type = source_value_or_placeholder(
                    row,
                    notes,
                    "Activity type",
                    ("Activity Type", "Service Type", "Commodity"),
                    "Purchased Utility",
                )

                created_records.append(
                    create_emissions_record(
                        tenant=tenant,
                        source_system="UTILITY_PORTAL",
                        raw_record_id=raw_record_id,
                        scope_category=scope_category,
                        activity_type=activity_type,
                        activity_start_date=activity_start_date,
                        activity_end_date=activity_end_date,
                        raw_quantity=raw_quantity,
                        raw_unit=raw_unit,
                        normalized_quantity=normalized_quantity,
                        normalized_unit=normalized_unit,
                        status_value=normalized_status(unit_known, notes),
                        system_notes=build_system_note(notes),
                    )
                )
            except (DjangoValidationError, IntegrityError, ValueError) as exc:
                errors.append({"row": row_number, "error": str(exc)})

        return self.ingestion_response(created_records, errors)


class TravelUploadView(BaseIngestionAPIView):
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        payload = request.data
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            records = payload.get("trips") or payload.get("records") or payload.get("data") or []
        else:
            records = []

        if not isinstance(records, list) or not records:
            return Response(
                {"detail": "Provide a JSON array or an object containing 'trips', 'records', or 'data'."},
                status=400,
            )

        tenant = get_or_create_tenant(request)
        created_records = []
        errors = []

        for row_number, row in enumerate(records, start=1):
            try:
                if not isinstance(row, dict):
                    raise ValueError("Each travel record must be a JSON object.")

                notes = []
                append_blank_source_notes(row, notes)

                activity_start_date, activity_end_date, date_notes = parse_activity_dates(
                    row,
                    ("travel_date", "start_date", "departure_date"),
                    ("end_date", "return_date", "arrival_date", "travel_date"),
                )
                notes.extend(date_notes)

                emissions_quantity = row_value(row, "emissions_kgco2e", "emissions", "co2e_kg")
                if not is_blank_value(emissions_quantity):
                    raw_quantity, _quantity_known = parse_decimal_for_ingestion(
                        emissions_quantity,
                        "emissions_kgco2e",
                        notes,
                    )
                    raw_unit = "kg CO2e"
                else:
                    raw_quantity, _quantity_known = parse_decimal_for_ingestion(
                        row_value(row, "distance", "miles", "kilometers", "km"),
                        "distance",
                        notes,
                    )
                    unit_aliases = ("unit", "distance_unit")
                    raw_unit = (
                        row_value(row, *unit_aliases)
                        or ("miles" if not is_blank_value(row_value(row, "miles")) else None)
                        or ("km" if not is_blank_value(row_value(row, "kilometers", "km")) else "")
                    )

                    if is_blank_value(raw_unit):
                        append_missing_note(row, notes, "Travel unit", unit_aliases)
                        raw_unit = "UNKNOWN"
                    elif has_any_alias(row, unit_aliases) and is_blank_value(row_value(row, *unit_aliases)):
                        append_missing_note(row, notes, "Travel unit", unit_aliases)

                normalized_quantity, normalized_unit, unit_known, unit_note = normalize_quantity(
                    raw_quantity,
                    raw_unit,
                )

                if unit_note:
                    notes.append(unit_note)

                raw_record_id = source_value_or_placeholder(
                    row,
                    notes,
                    "Trip ID",
                    ("trip_id", "id", "report_entry_id", "booking_id"),
                    f"travel-{uuid4().hex}",
                )
                raw_record_id = unique_raw_record_id(tenant, "TRAVEL_API", raw_record_id, notes)
                scope_category = normalize_scope_category(
                    source_value_or_placeholder(
                        row,
                        notes,
                        "Scope",
                        ("scope", "scope_category"),
                        NormalizedEmissionsData.ScopeCategory.SCOPE_3,
                    ),
                    NormalizedEmissionsData.ScopeCategory.SCOPE_3,
                )
                activity_type = source_value_or_placeholder(
                    row,
                    notes,
                    "Travel mode",
                    ("travel_mode", "mode", "trip_type"),
                    "Business Travel",
                )

                created_records.append(
                    create_emissions_record(
                        tenant=tenant,
                        source_system="TRAVEL_API",
                        raw_record_id=raw_record_id,
                        scope_category=scope_category,
                        activity_type=activity_type,
                        activity_start_date=activity_start_date,
                        activity_end_date=activity_end_date,
                        raw_quantity=raw_quantity,
                        raw_unit=raw_unit,
                        normalized_quantity=normalized_quantity,
                        normalized_unit=normalized_unit,
                        status_value=normalized_status(unit_known, notes),
                        system_notes=build_system_note(notes),
                    )
                )
            except (DjangoValidationError, IntegrityError, ValueError) as exc:
                errors.append({"row": row_number, "error": str(exc)})

        return self.ingestion_response(created_records, errors)


class EmissionsListView(generics.ListAPIView):
    serializer_class = NormalizedEmissionsDataSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            NormalizedEmissionsData.objects.select_related("tenant", "reviewed_by")
            .all()
            .order_by("-created_at")
        )


class EmissionStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk, *args, **kwargs):
        emission_record = get_object_or_404(NormalizedEmissionsData, pk=pk)
        serializer = EmissionStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        emission_record.status = serializer.validated_data["status"]
        emission_record.reviewed_by = request.user
        emission_record.reviewed_at = timezone.now()
        emission_record.save()

        response_serializer = NormalizedEmissionsDataSerializer(emission_record)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class EmissionAuditHistoryView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        emission_record = get_object_or_404(NormalizedEmissionsData, pk=self.kwargs["pk"])
        return AuditLog.objects.filter(emission_record=emission_record).select_related("changed_by")
