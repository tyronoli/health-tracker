import pytest


@pytest.fixture
def freeze_now(monkeypatch):
    """Freeze 'now' for code that asks scheduling.current_time()."""

    def _freeze(value):
        monkeypatch.setattr("apps.medications.scheduling.current_time", lambda: value)

    return _freeze
