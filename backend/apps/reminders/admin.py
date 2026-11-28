from django.contrib import admin

from .models import DoseReminder


@admin.register(DoseReminder)
class DoseReminderAdmin(admin.ModelAdmin):
    list_display = ("schedule", "scheduled_for", "email_sent_at")
