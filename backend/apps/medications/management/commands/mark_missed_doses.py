from django.core.management.base import BaseCommand

from apps.medications import doses, scheduling


class Command(BaseCommand):
    help = "Record 'missed' for doses that were never logged and whose grace period is over."

    def add_arguments(self, parser):
        parser.add_argument(
            "--lookback-days",
            type=int,
            default=doses.DEFAULT_LOOKBACK_DAYS,
            help="How many days back to check (default: %(default)s).",
        )

    def handle(self, *args, **options):
        count = doses.mark_missed_doses(
            scheduling.current_time(), lookback_days=options["lookback_days"]
        )
        self.stdout.write(f"Marked {count} missed doses.")
