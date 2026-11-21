from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import MAX_PILLS, Medication


def refill(medication: Medication, pills_added: int) -> Medication:
    with transaction.atomic():
        # Lock the row so two refills at the same moment can't overwrite each other.
        locked = Medication.objects.select_for_update().get(pk=medication.pk)
        new_total = locked.pills_remaining + pills_added
        if new_total > MAX_PILLS:
            raise ValidationError({"pills_added": [f"Total pills cannot exceed {MAX_PILLS}."]})
        locked.pills_remaining = new_total
        locked.save(update_fields=["pills_remaining", "updated_at"])
    return locked
