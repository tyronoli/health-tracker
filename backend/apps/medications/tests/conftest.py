import pytest


@pytest.fixture
def make_medication(db):
    def _make(owner, **overrides):
        from apps.medications.models import Medication

        data = {
            "name": "Metformin",
            "dosage": "500 mg",
            "pills_remaining": 30,
            "refill_threshold": 10,
        }
        data.update(overrides)
        return Medication.objects.create(owner=owner, **data)

    return _make
