"""Helpers for permission-matrix tests: alex is the caregiver, mum the recipient."""

LINK_STATES = {
    "no_link": None,
    "pending": ("pending", "edit"),
    "declined": ("declined", "edit"),
    "revoked": ("revoked", "edit"),
    "active_view": ("active", "view"),
    "active_edit": ("active", "edit"),
}
STATE_IDS = list(LINK_STATES)


def prepare(make_link, caregiver, recipient, state):
    link = LINK_STATES[state]
    if link:
        make_link(caregiver, recipient, status=link[0], permission=link[1])


def matrix(*codes):
    """Pair the six link states with the expected status code for each."""
    return list(zip(STATE_IDS, codes, strict=True))
