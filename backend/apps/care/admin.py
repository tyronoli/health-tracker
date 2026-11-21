from django.contrib import admin

from .models import CareLink


@admin.register(CareLink)
class CareLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "caregiver", "recipient", "permission", "status", "created_at")
    list_filter = ("status", "permission")
