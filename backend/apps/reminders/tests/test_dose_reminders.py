from datetime import UTC, date, datetime, time

import pytest
from django.conf import settings

from apps.accounts.models import NotificationSettings
from apps.reminders import services, tasks
from apps.reminders.models import DoseReminder

pytestmark = pytest.mark.django_db


def utc(*args):
    return datetime(*args, tzinfo=UTC)


@pytest.fixture
def daily_8am(alex, make_medication, make_schedule):
    med = make_medication(alex, name="Metformin", dosage="500 mg")
    return make_schedule(med, time_of_day=time(8, 0), start_date=date(2026, 11, 1))


# ---------- the basics ----------


def test_sends_one_email_at_the_scheduled_time(daily_8am, mailoutbox):
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 1
    assert len(mailoutbox) == 1
    email = mailoutbox[0]
    assert email.to == ["alex@example.com"]
    assert email.subject == "Time to take Metformin"
    assert "Metformin 500 mg" in email.body
    assert "08:00" in email.body
    assert settings.SITE_URL in email.body
    assert "not medical advice" in email.body


def test_waits_for_the_scheduled_time(daily_8am, mailoutbox):
    assert services.send_dose_reminders(utc(2026, 11, 17, 7, 59)) == 0
    assert mailoutbox == []


def test_never_sends_the_same_reminder_twice(daily_8am, mailoutbox):
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 1
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 1, 30)) == 0
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 5)) == 0
    assert len(mailoutbox) == 1
    assert DoseReminder.objects.get().email_sent_at is not None


def test_catches_up_for_a_while_then_gives_up(daily_8am, mailoutbox):
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 29)) == 1  # within 30 minutes
    DoseReminder.objects.all().delete()
    mailoutbox.clear()
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 31)) == 0  # too late to be useful


def test_a_dose_just_after_midnight_still_counts_as_yesterdays(
    alex, make_medication, make_schedule, mailoutbox
):
    make_schedule(make_medication(alex), time_of_day=time(23, 50), start_date=date(2026, 11, 1))
    assert services.send_dose_reminders(utc(2026, 11, 18, 0, 5)) == 1


# ---------- who and what is skipped ----------


def test_skips_doses_that_are_already_logged(daily_8am, make_dose_log, mailoutbox):
    make_dose_log(daily_8am, utc(2026, 11, 17, 8, 0), "taken")
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 0


def test_respects_the_email_switch(daily_8am, alex, mailoutbox):
    NotificationSettings.objects.create(user=alex, email_enabled=False)
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 0
    assert mailoutbox == []
    assert DoseReminder.objects.count() == 0  # nothing was claimed


def test_ignores_stopped_medications_and_paused_schedules(
    alex, make_medication, make_schedule, mailoutbox
):
    make_schedule(make_medication(alex, name="Stopped", active=False))
    make_schedule(make_medication(alex, name="Paused"), active=False)
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 0


def test_ignores_doses_from_before_tracking_started(
    alex, make_medication, make_schedule, mailoutbox
):
    make_schedule(
        make_medication(alex),
        time_of_day=time(8, 0),
        tracking_started_at=utc(2026, 11, 17, 8, 0, 10),
    )
    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 0


def test_everyone_gets_only_their_own_reminders(
    alex, mum, make_medication, make_schedule, mailoutbox
):
    make_schedule(make_medication(alex, name="Alexs pills"), time_of_day=time(8, 0))
    make_schedule(make_medication(mum, name="Mums pills"), time_of_day=time(8, 0))

    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 2

    by_recipient = {m.to[0]: m for m in mailoutbox}
    assert "Alexs pills" in by_recipient["alex@example.com"].body
    assert "Mums pills" not in by_recipient["alex@example.com"].body
    assert "Mums pills" in by_recipient["mum@example.com"].body


def test_doses_due_together_share_one_email(alex, make_medication, make_schedule, mailoutbox):
    make_schedule(make_medication(alex, name="Metformin"), time_of_day=time(8, 0))
    make_schedule(make_medication(alex, name="Vitamin D"), time_of_day=time(8, 0))

    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 1

    assert len(mailoutbox) == 1
    assert mailoutbox[0].subject == "Time to take 2 medications"
    assert "Metformin" in mailoutbox[0].body and "Vitamin D" in mailoutbox[0].body


# ---------- timezones ----------


def test_uses_the_owners_timezone(make_user, make_medication, make_schedule, mailoutbox):
    manila = make_user("manila@example.com", timezone="Asia/Manila")
    make_schedule(make_medication(manila), time_of_day=time(8, 0), start_date=date(2026, 11, 1))

    assert services.send_dose_reminders(utc(2026, 11, 17, 0, 0, 30)) == 1  # 08:00 in Manila
    assert "08:00" in mailoutbox[0].body
    assert (
        services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 0
    )  # 16:00 in Manila: nothing due


def test_fires_once_each_day_across_a_daylight_saving_change(
    make_user, make_medication, make_schedule, mailoutbox
):
    ny = make_user("ny@example.com", timezone="America/New_York")
    make_schedule(make_medication(ny), time_of_day=time(8, 0), start_date=date(2026, 3, 1))

    # 7 March is winter time (08:00 = 13:00 UTC); clocks jump on 8 March (08:00 = 12:00 UTC).
    moments = [
        utc(2026, 3, 7, 13, 0, 30),
        utc(2026, 3, 7, 14, 0),
        utc(2026, 3, 8, 12, 0, 30),
        utc(2026, 3, 8, 13, 0),  # the old winter-time hour: must NOT fire again
        utc(2026, 3, 9, 12, 0, 30),
    ]
    assert sum(services.send_dose_reminders(moment) for moment in moments) == 3


# ---------- failure and retry ----------


def test_a_failed_send_is_retried_on_the_next_run(daily_8am, mailoutbox, monkeypatch):
    real_send = services.send_mail
    calls = {"count": 0}

    def flaky(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise OSError("mail server is down")
        return real_send(*args, **kwargs)

    monkeypatch.setattr(services, "send_mail", flaky)

    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 0, 30)) == 0
    assert DoseReminder.objects.get().email_sent_at is None  # the claim was released

    assert services.send_dose_reminders(utc(2026, 11, 17, 8, 1, 30)) == 1
    assert len(mailoutbox) == 1


# ---------- the Celery tasks ----------


def test_the_reminder_task_uses_the_current_time(daily_8am, freeze_now, mailoutbox):
    freeze_now(utc(2026, 11, 17, 8, 0, 30))
    assert tasks.send_dose_reminders() == 1


def test_the_missed_dose_task_records_missed_doses(daily_8am, freeze_now):
    freeze_now(utc(2026, 11, 17, 12, 0))
    assert tasks.mark_missed_doses() == 4  # the 14th to the 17th


def test_every_scheduled_task_really_exists():
    import apps.reminders.tasks  # noqa: F401  (registers the tasks)
    from config.celery import app

    for entry in settings.CELERY_BEAT_SCHEDULE.values():
        assert entry["task"] in app.tasks
