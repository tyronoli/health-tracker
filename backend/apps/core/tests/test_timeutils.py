from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest
from rest_framework.exceptions import ValidationError

from apps.core.timeutils import local_midnight, owner_zone, parse_date_param


def test_owner_zone_uses_the_users_timezone(make_user):
    user = make_user("tz@example.com", timezone="Asia/Manila")
    assert owner_zone(user) == ZoneInfo("Asia/Manila")


def test_owner_zone_falls_back_to_utc_for_a_broken_value(make_user):
    user = make_user("broken@example.com")
    user.timezone = "Nowhere/Land"
    assert owner_zone(user) == ZoneInfo("UTC")


def test_local_midnight_is_returned_as_a_utc_instant():
    midnight = local_midnight(date(2026, 11, 18), ZoneInfo("Asia/Manila"))
    assert midnight == datetime(2026, 11, 17, 16, 0, tzinfo=UTC)


def test_parse_date_param():
    assert parse_date_param(None, "from") is None
    assert parse_date_param("2026-11-18", "from") == date(2026, 11, 18)


@pytest.mark.parametrize("bad", ["garbage", "2026-13-45", ""])
def test_parse_date_param_rejects_bad_dates(bad):
    with pytest.raises(ValidationError) as caught:
        parse_date_param(bad, "from")
    assert "from" in caught.value.detail
