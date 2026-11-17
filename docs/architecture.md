health-tracker/
├── README.md                      # V1-8: how to run, test, reset
├── TASK.md                        # roadmap
├── docker-compose.yml             # V1-0: db (Postgres); V1-7: add redis
├── .env.example                   # V1-0: variable names only, no secrets
├── .gitignore                     # V1-0
├── .github/workflows/ci.yml       # optional: run ruff, mypy, pytest on push
│
├── docs/
│   ├── PRD.md  SRS.md  API.md  architecture.md
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt           # V1-0 (add requirements-dev.txt for pytest, ruff, mypy)
│   ├── pyproject.toml             # V1-0: ruff, mypy, pytest settings
│   ├── conftest.py                # shared test fixtures (users, clients)
│   ├── .env                       # real local values, never committed
│   │
│   ├── config/
│   │   ├── settings.py            # reads environment variables
│   │   ├── urls.py                # includes each app's urls under /api/
│   │   ├── asgi.py  wsgi.py
│   │   └── celery.py              # V1-7
│   │
│   └── apps/
│       ├── core/                  # V1-1: shared helpers, no models
│       │   ├── exceptions.py      #   the one error format from API.md
│       │   ├── pagination.py
│       │   ├── timeutils.py       #   UTC and timezone conversion helpers
│       │   └── management/commands/seed_demo.py   # V1-8: FAKE demo data
│       │
│       ├── accounts/              # V1-0 model, V1-1 API
│       ├── care/                  # V1-2: CareLink, invites
│       │   └── permissions.py     #   can_access_profile(): the one authorization gate
│       ├── medications/           # V1-3 to V1-5
│       │   ├── models.py          #   Medication, Schedule, DoseLog
│       │   └── services.py        #   due-dose calculation, log_dose, refill math
│       ├── appointments/          # V1-6
│       ├── reminders/             # V1-7
│       │   ├── models.py          #   NotificationSettings, PushSubscription
│       │   ├── tasks.py           #   Celery jobs: due doses, appointments, missed doses
│       │   └── senders/           #   email.py, push.py
│       └── assistant/             # V2
│           ├── models.py          #   Conversation, Message
│           ├── llm.py             #   the only file that talks to a model
│           ├── tools.py           #   the four read-only tools
│           ├── agent.py           #   tool-calling loop
│           ├── prompts.py         #   system prompt
│           └── evals/             #   question set + runner
│
└── frontend/                      # React + Vite + TypeScript + Tailwind PWA
    ├── package.json  vite.config.ts  tsconfig.json  index.html
    ├── public/                    # manifest.webmanifest, icons, sw.js (service worker)
    └── src/
        ├── main.tsx  App.tsx      # routes
        ├── api/                   # client.ts (CSRF, errors) + one file per resource
        ├── context/               # AuthContext, ProfileContext (profile switcher)
        ├── pages/                 # Login, Register, Today, Medications, MedicationDetail,
        │                          # History, Appointments, CareCircle, Settings,
        │                          # Assistant (V2)
        ├── components/            # shared UI pieces
        ├── lib/                   # date and time formatting, helpers
        └── tests/