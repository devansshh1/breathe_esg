from django.urls import path

from .views import (
    EmissionAuditHistoryView,
    EmissionStatusUpdateView,
    EmissionsListView,
    SAPUploadView,
    TravelUploadView,
    UtilityUploadView,
)


urlpatterns = [
    path("", EmissionsListView.as_view(), name="emissions-list"),
    path("upload/sap/", SAPUploadView.as_view(), name="sap-upload"),
    path("upload/utility/", UtilityUploadView.as_view(), name="utility-upload"),
    path("upload/travel/", TravelUploadView.as_view(), name="travel-upload"),
    path("<int:pk>/status/", EmissionStatusUpdateView.as_view(), name="emission-status-update"),
    path("<int:pk>/history/", EmissionAuditHistoryView.as_view(), name="emission-audit-history"),
]
