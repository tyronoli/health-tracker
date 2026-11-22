import io
from datetime import UTC, date, datetime, time

import pytest
from django.core.management import call_command

from apps.medications import doses
from apps.medications.models import DoseLog

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 17, 12, 0, tzinfo=UTC)


def utc(*args):
    return datetime(*args, tzinfo=UTC)


@pytest.fixture
def daily_8am(alex, make_medication, make_schedule):
    return make_schedule(
        make_medication(alex), time_of_day=time(8, 0), start_date=date(2026, 11, 1)
    )


def test_marks_unlogged_doses_past_the_grace_period(daily_8am):
    assert doses.mark_missed_doses(NOW) == 4  # Nov 14, 15, 16 and 17 at 08:00 (3 days back)
    assert DoseLog.objects.count() == 4
    assert set(DoseLog.objects.values_list("status", flat=True)) == {"missed"}


def test_waits_for_the_grace_period(alex, make_medication, make_schedule):
    make_schedule(make_medication(alex), time_of_day=time(11, 30), start_date=date(2026, 11, 17))
    assert doses.mark_missed_doses(NOW) == 0  # 11:30 + 60 minutes is after 12:00
    assert doses.mark_missed_doses(utc(2026, 11, 17, 12, 30)) == 1  # exactly at the end counts


def test_running_twice_creates_nothing_new(daily_8am):
    doses.mark_missed_doses(NOW)
    assert doses.mark_missed_doses(NOW) == 0
    assert DoseLog.objects.count() == 4


def test_existing_logs_are_never_overwritten(daily_8am, make_dose_log):
    make_dose_log(daily_8am, utc(2026, 11, 17, 8, 0), "taken")
    assert doses.mark_missed_doses(NOW) == 3
    assert DoseLog.objects.get(scheduled_for=utc(2026, 11, 17, 8, 0)).status == "taken"


def test_doses_before_tracking_started_are_ignored(daily_8am):
    daily_8am.tracking_started_at = utc(2026, 11, 16, 0, 0)
    daily_8am.save()
    assert doses.mark_missed_doses(NOW) == 2  # only Nov 16 and 17


def test_inactive_schedules_and_medications_are_ignored(
    alex, daily_8am, make_medication, make_schedule
):
    daily_8am.active = False
    daily_8am.save()
    make_schedule(make_medication(alex, name="Stopped", active=False))
    assert doses.mark_missed_doses(NOW) == 0


def test_lookback_window(daily_8am):
    assert doses.mark_missed_doses(NOW, lookback_days=0) == 1  # today only
    assert doses.mark_missed_doses(NOW, lookback_days=10) == 10  # Nov 7..16; today's already exists


def test_works_in_the_owners_timezone(make_user, make_medication, make_schedule):
    manila = make_user("manila@example.com", timezone="Asia/Manila")
    make_schedule(make_medication(manila), time_of_day=time(8, 0), start_date=date(2026, 11, 1))
    assert doses.mark_missed_doses(NOW) == 4
    assert DoseLog.objects.filter(scheduled_for=utc(2026, 11, 17, 0, 0)).exists()  # 08:00 Manila


def test_command_reports_how_many_it_marked(daily_8am, freeze_now):
    freeze_now(NOW)
    out = io.StringIO()
    call_command("mark_missed_doses", stdout=out)
    assert "4" in out.getvalue()
    out = io.StringIO()
    call_command("mark_missed_doses", "--lookback-days", "0", stdout=out)
    assert "0" in out.getvalue()  # nothing new left to mark


# ---------- history is frozen before a schedule changes ----------


def test_editing_a_schedule_first_records_what_was_missed(
    client_for, alex, make_medication, make_schedule, freeze_now
):
    freeze_now(NOW)
    schedule = make_schedule(
        make_medication(alex), time_of_day=time(8, 0), start_date=date(2026, 11, 17)
    )
    resp = client_for(alex).patch(
        f"/api/schedules/{schedule.id}/", {"time_of_day": "13:00"}, format="json"
    )
    assert resp.status_code == 200
    log = DoseLog.objects.get()
    assert (log.status, log.scheduled_for) == ("missed", utc(2026, 11, 17, 8, 0))


def test_deleting_a_schedule_keeps_what_was_missed(
    client_for, alex, make_medication, make_schedule, freeze_now
):
    freeze_now(NOW)
    schedule = make_schedule(
        make_medication(alex), time_of_day=time(8, 0), start_date=date(2026, 11, 17)
    )
    assert client_for(alex).delete(f"/api/schedules/{schedule.id}/").status_code == 204
    log = DoseLog.objects.get()
    assert (log.status, log.schedule) == ("missed", None)
