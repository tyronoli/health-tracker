from django.contrib import admin

from .models import DoseLog, Medication, Schedule


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "pills_remaining", "refill_threshold", "active")
    list_filter = ("active",)
    search_fields = ("name", "owner__email")


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("medication", "time_of_day", "days_of_week", "start_date", "end_date", "active")
    list_filter = ("active",)


@admin.register(DoseLog)
class DoseLogAdmin(admin.ModelAdmin):
    list_display = ("medication", "scheduled_for", "status", "logged_at")
    list_filter = ("status",)
