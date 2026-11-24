# Health Tracker

A web app (installable as a PWA) for tracking medications, doses, refills and appointments. A caregiver can have their own login and, with the family member's consent, view that person's profile.

> **Tracker only. This app does not give medical advice.**
> It is a practice project: use **fake data only**, never real medical information.

Progress and the build plan live in [`TASK.md`](TASK.md). Requirements and design are in [`docs/`](docs/) (`PRD.md`, `SRS.md`, `API.md`, `architecture.md`).

## Tech stack

| Part | Tools |
|---|---|
| Backend | Python 3.11+ (3.12 recommended), Django 5.2, Django REST Framework, session auth + CSRF |
| Database | PostgreSQL 16, run in Docker |
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router |
| Tests and checks | pytest, ruff, mypy (backend); Vitest, Testing Library, ESLint, `tsc` (frontend) |

## Project layout

```
health-tracker/
├── .env                  # your local settings (NOT in git; create it from .env.example)
├── .env.example          # the variable names, safe to commit
├── docker-compose.yml    # PostgreSQL
├── TASK.md               # roadmap and progress
├── docs/                 # PRD, SRS, API, architecture
├── backend/              # Django project
│   ├── config/           #   settings, urls
│   ├── apps/             #   accounts, care, medications, core
│   └── manage.py
└── frontend/             # React app (src/, index.html, vite.config.ts)
```

## Setup on Ubuntu (first time on a machine)

These steps are for Ubuntu running directly on the computer. No WSL is needed.

### 1. Install the tools

**System packages:**

```bash
sudo apt update
sudo apt install -y git curl python3 python3-venv python3-pip build-essential libpq-dev
python3 --version      # must be 3.11 or newer. Ubuntu 24.04 ships 3.12
```

Ubuntu 22.04 ships Python 3.10, which is too old for this project. Install a newer Python (for example from the deadsnakes PPA) and use it to create the virtual environment in step 4.

**Docker Engine and the Compose plugin.** Follow the official guide for Ubuntu: <https://docs.docker.com/engine/install/ubuntu/>. Then let your user run Docker without `sudo`, and log out and back in:

```bash
sudo usermod -aG docker $USER
# log out and back in, then check:
docker run --rm hello-world
docker compose version
```

**Node.js** (through nvm, not `apt`, because the apt version is too old). Copy the current install command from <https://github.com/nvm-sh/nvm>, then:

```bash
nvm install --lts
node -v        # Vite needs 20.19+ or 22.12+; the current LTS is fine
```

**Do not install PostgreSQL with apt.** The database runs in Docker. A second Postgres on port 5432 will answer instead of the container and cause confusing password errors. If one is already installed, turn it off: `sudo systemctl disable --now postgresql`.

### 2. Get the code

```bash
git clone https://github.com/tyronoli/health-tracker.git
cd health-tracker
```

### 3. Create your `.env`

One `.env` file in the **repository root** is used by both Docker and Django.

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # copy the output
```

Edit `.env` so it looks like this (use your own values for the key and password):

```
DJANGO_SECRET_KEY=paste-the-generated-key-here
DJANGO_DEBUG=true
DB_NAME=health_tracker
DB_USER=health
DB_PASSWORD=choose-a-password-with-letters-and-digits-only
DB_HOST=localhost
DB_PORT=5432
```

Rules: no spaces around `=`, no quotes, and a simple password (characters like `$`, `#` or spaces are read differently by Docker and Django). `.env` is ignored by git, so it must be created again on every machine.

### 4. Start the database and set up the backend

```bash
docker compose up -d db
docker compose ps                       # the db service should be "running"

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements-dev.txt

python manage.py migrate
python manage.py createsuperuser        # a fake email and a throwaway password
```

The database starts empty on a new machine. Data does not travel with the code.

### 5. Set up the frontend

```bash
cd ../frontend
npm install
```

## Run the app (every day)

Use three terminals:

```bash
# 1. Database (from the repo root). It keeps running in the background.
docker compose up -d db

# 2. Backend (from backend/)
source .venv/bin/activate
python manage.py runserver              # http://127.0.0.1:8000

# 3. Frontend (from frontend/)
npm run dev                             # http://localhost:5173
```

Open **<http://localhost:5173>**. The Vite server forwards `/api` requests to Django, so cookies and CSRF work as they will in production. Other addresses:

- Django admin: <http://localhost:8000/admin/> (log in with the superuser)
- Stop everything: Ctrl+C in the two server terminals, then `docker compose down` (this keeps your data).

## Checks and tests

Run these before every commit. All of them should pass.

```bash
# Backend (from backend/, venv active, database running)
pytest
ruff format .
ruff check .
mypy .

# Frontend (from frontend/)
npm test
npm run lint
npm run typecheck
npm run build
```

## Useful commands

```bash
# Mark unlogged doses as missed after the grace period (safe to run repeatedly)
python manage.py mark_missed_doses

# Wipe the database and start clean (DELETES ALL LOCAL DATA)
docker compose down -v
docker compose up -d db
python manage.py migrate

# See what is listening on the database port
ss -ltnp | grep 5432
```

Until the care circle screen exists, link two users in the admin: **Care links > Add**, with the caregiver, the recipient, status `active` and permission `view` or `edit`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Browser shows errors and the Vite log says `ECONNREFUSED 127.0.0.1:8000` | The backend isn't running. Start `python manage.py runserver` |
| Django: `Connection refused` on port 5432 | The database isn't running. `docker compose up -d db`, then `docker compose ps` |
| Django: `password authentication failed for user "health"` | Either the database volume was created with a different password (fix: `docker compose down -v`, then `up -d db`, which deletes local data), or another Postgres owns port 5432 (`ss -ltnp \| grep 5432`, then disable it) |
| `docker compose` prints `The "DB_USER" variable is not set` | `.env` is missing, or you aren't in the repo root |
| `permission denied while trying to connect to the Docker daemon socket` | Your user isn't in the `docker` group. Run `sudo usermod -aG docker $USER` and log out and in |
| `403 CSRF check failed` in the browser | Open the app at <http://localhost:5173> (not port 8000) and make sure `DJANGO_DEBUG=true` in `.env` |
| Vite or npm complain about the Node version | `nvm install --lts` and open a new terminal |
| Vitest: `No test suite found in file …` | That test file is empty or truncated. Restore it from git: `git checkout -- <file>` |
| `Address already in use` (port 8000 or 5173) | An old server is still running. Find it with `ss -ltnp \| grep <port>` and stop it |
| `pip install` fails building `psycopg` | Install the build tools: `sudo apt install build-essential libpq-dev` |

## Working conventions

- One task at a time from [`TASK.md`](TASK.md): write the tests first, make them pass, commit, then tick the box.
- One branch per task (for example `v1-f2-today`), merged through a pull request.
- Never commit `.env`, `.venv`, `node_modules` or real personal data.
- Every endpoint that returns user data goes through the permission helper in `backend/apps/care/permissions.py`, and has a test proving another user is denied.