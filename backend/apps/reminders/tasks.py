from celery import shared_task

from apps.medications import doses, scheduling

from . import services


@shared_task
def send_dose_reminders() -> int:
    return services.send_dose_reminders(scheduling.current_time())


@shared_task
def mark_missed_doses() -> int:
    return doses.mark_missed_doses(scheduling.current_time())
