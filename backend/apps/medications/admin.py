from django.contrib import admin

from .models import Medication


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "pills_remaining", "refill_threshold", "active")
    list_filter = ("active",)
    search_fields = ("name", "owner__email")
