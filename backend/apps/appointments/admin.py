from django.contrib import admin

from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "type", "starts_at", "status")
    list_filter = ("type", "status")
    search_fields = ("title", "provider_name", "owner__email")
