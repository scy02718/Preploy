# apps/api — FastAPI conventions

This file scopes Claude's instructions to the Python service. The root
`CLAUDE.md` covers monorepo-wide rules.

## Stack

- FastAPI + Uvicorn (Python 3.12)
- SQLAlchemy 2 + psycopg2
- Pydantic v2 + pydantic-settings
- OpenAI SDK (`openai>=1.70`)
- Sentry SDK
- pytest + pytest-asyncio + httpx for tests
- ruff for lint (`E`, `F`, `I` rule sets)

## Logging

Use `logging.getLogger(__name__)` — JSON output is configured globally in
production. **Never** use `print()` in service code.

```python
import logging
log = logging.getLogger(__name__)
log.info("processing request", extra={"user_id": user_id})
log.exception("openai call failed")
```

## Tests

- Place `test_*.py` in `apps/api/tests/`.
- Mock external API calls (OpenAI) with `unittest.mock.patch`.
- Test everything else for real — no DB mocking, no HTTP server mocking.
- Async tests: pytest-asyncio is in `auto` mode, just write `async def test_...`.
- Use `httpx.AsyncClient` against the FastAPI app for endpoint tests.

### Run tests

```bash
cd apps/api
.venv/bin/pytest                # Run all tests
.venv/bin/pytest --cov          # With coverage
```

### Coverage targets

- Pure logic (services, prompt builders, parsers): 80%+ line coverage.
- Endpoints: at least one test per route covering the happy path + one error case.

## Lint and typecheck

```bash
.venv/bin/ruff check .          # Lint
.venv/bin/ruff format .         # Format
```

The root `npx turbo lint` runs ruff via the `lint` script in `package.json`.

## Environment

- Python venv lives at `apps/api/.venv` — bootstrap with:
  ```bash
  python -m venv .venv
  .venv/bin/pip install -e ".[dev]"
  ```
- Settings load from `.env` via `pydantic-settings`. Never hardcode secrets.

## Skills available

- **`claude-api`** — reference for Anthropic SDK usage *if* a story explicitly
  asks to add Claude alongside or instead of OpenAI. Do not silently swap
  providers.
