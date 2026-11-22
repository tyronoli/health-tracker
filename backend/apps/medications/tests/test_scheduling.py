from datetime import UTC, date, datetime, time

import pytest

from apps.accounts.models import User
from apps.medications import scheduling

pytestmark = pytest.mark.django_db


def utc(*args):
    return datetime(*args, tzinfo=UTC)


def instants(owner, day):
    return [d.scheduled_for for d in scheduling.due_doses_for_date(owner, day)]


@pytest.fixture
def manila(make_user):
    return make_user("manila@example.com", timezone="Asia/Manila")  # UTC+8, no DST


@pytest.fixture
def new_york(make_user):
    return make_user("ny@example.com", timezone="America/New_York")


# ---------- timezone conversion ----------


def test_time_is_interpreted_in_the_owners_timezone(
    manila, make_user, make_medication, make_schedule
):
    make_schedule(make_medication(manila), time_of_day=time(8, 0))
    assert instants(manila, date(2026, 11, 17)) == [utc(2026, 11, 17, 0, 0)]

    london = make_user("london@example.com", timezone="Europe/London")  # UTC+0 in November
    make_schedule(make_medication(london), time_of_day=time(8, 0))
    assert instants(london, date(2026, 11, 17)) == [utc(2026, 11, 17, 8, 0)]


def test_early_morning_in_manila_is_the_previous_utc_day(manila, make_medication, make_schedule):
    make_schedule(make_medication(manila), time_of_day=time(6, 0))
    assert instants(manila, date(2026, 11, 17)) == [utc(2026, 11, 16, 22, 0)]


# ---------- which days ----------


def test_weekday_filter_uses_monday_as_zero(manila, make_medication, make_schedule):
    make_schedule(make_medication(manila), days_of_week=[0, 2])  # Monday, Wednesday
    assert len(instants(manila, date(2026, 11, 16))) == 1  # Mon
    assert instants(manila, date(2026, 11, 17)) == []  # Tue
    assert len(instants(manila, date(2026, 11, 18))) == 1  # Wed


def test_start_and_end_dates_are_inclusive(manila, make_medication, make_schedule):
    make_schedule(
        make_medication(manila), start_date=date(2026, 11, 17), end_date=date(2026, 11, 19)
    )
    assert instants(manila, date(2026, 11, 16)) == []
    assert len(instants(manila, date(2026, 11, 17))) == 1
    assert len(instants(manila, date(2026, 11, 19))) == 1
    assert instants(manila, date(2026, 11, 20)) == []


def test_open_ended_schedule_has_no_last_day(manila, make_medication, make_schedule):
    make_schedule(make_medication(manila), end_date=None)
    assert len(instants(manila, date(2030, 1, 1))) == 1


# ---------- what is excluded ----------


def test_inactive_schedules_and_medications_are_excluded(manila, make_medication, make_schedule):
    make_schedule(make_medication(manila, name="Off schedule"), active=False)
    make_schedule(make_medication(manila, name="Off medication", active=False))
    assert instants(manila, date(2026, 11, 17)) == []


def test_other_peoples_schedules_are_excluded(manila, stranger, make_medication, make_schedule):
    make_schedule(make_medication(stranger))
    assert instants(manila, date(2026, 11, 17)) == []


def test_doses_are_sorted_by_time_then_name(manila, make_medication, make_schedule):
    zinc = make_medication(manila, name="Zinc")
    aspirin = make_medication(manila, name="Aspirin")
    make_schedule(zinc, time_of_day=time(8, 0))
    make_schedule(aspirin, time_of_day=time(8, 0))
    make_schedule(zinc, time_of_day=time(7, 0))
    names = [
        d.schedule.medication.name
        for d in scheduling.due_doses_for_date(manila, date(2026, 11, 17))
    ]
    assert names == ["Zinc", "Aspirin", "Zinc"]


# ---------- daylight saving (America/New_York, 2026) ----------


def test_utc_offset_shifts_with_daylight_saving(new_york, make_medication, make_schedule):
    make_schedule(make_medication(new_york), time_of_day=time(8, 0))
    assert instants(new_york, date(2026, 3, 7)) == [utc(2026, 3, 7, 13, 0)]  # EST, UTC-5
    assert instants(new_york, date(2026, 3, 9)) == [utc(2026, 3, 9, 12, 0)]  # EDT, UTC-4


def test_time_skipped_by_spring_forward_happens_once(new_york, make_medication, make_schedule):
    make_schedule(make_medication(new_york), time_of_day=time(2, 30))  # 2:30 doesn't exist on Mar 8
    assert instants(new_york, date(2026, 3, 8)) == [utc(2026, 3, 8, 7, 30)]  # = 3:30 EDT


def test_time_repeated_by_fall_back_happens_once(new_york, make_medication, make_schedule):
    make_schedule(make_medication(new_york), time_of_day=time(1, 30))  # 1:30 happens twice on Nov 1
    assert instants(new_york, date(2026, 11, 1)) == [utc(2026, 11, 1, 5, 30)]  # first one, EDT


# ---------- local date ----------


def test_local_today_follows_the_owners_timezone(manila, new_york, make_user):
    honolulu = make_user("hnl@example.com", timezone="Pacific/Honolulu")
    now = utc(2026, 11, 17, 20, 0)
    assert scheduling.local_today(manila, now) == date(2026, 11, 18)  # UTC+8
    assert scheduling.local_today(new_york, now) == date(2026, 11, 17)  # UTC-5
    assert scheduling.local_today(honolulu, now) == date(2026, 11, 17)  # UTC-10


def test_a_broken_stored_timezone_falls_back_to_utc(manila, make_medication, make_schedule):
    make_schedule(make_medication(manila), time_of_day=time(8, 0))
    User.objects.filter(pk=manila.pk).update(timezone="Nowhere/Land")
    manila.refresh_from_db()
    assert instants(manila, date(2026, 11, 17)) == [utc(2026, 11, 17, 8, 0)]
