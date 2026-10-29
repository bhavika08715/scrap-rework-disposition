# Scrap vs Rework Disposition System

Defective parts are logged by inspectors; the system decides **SCRAP** or **REWORK** from cost rules.
High-value scrap needs manager approval.

## Run
    docker compose up -d --build
    ./demo.sh                 # full end-to-end walkthrough
    npm install && npm test   # 14 unit/API tests

## Architecture (CO1)
Client -> **gateway :8080** -> (discovers via **registry :8761**) -> **inspection :8081** / **disposition :8082** -> Postgres (one DB per service).
disposition calls inspection service-to-service via the registry.

## Course outcome map
| CO | Where to show it |
|----|------------------|
| CO1 Architecture & services | 4 services, DB-per-service, `services/disposition/rules.js` (decision engine) |
| CO2 Security & observability | JWT login + RBAC + rate limit in gateway; manager-only approval enforced at gateway AND service; `/metrics` (Prometheus at :9090), `/health`, JSON logs with `x-correlation-id` traced across services |
| CO3 Discovery, routing, DB | `services/registry` (register/heartbeat/TTL/round-robin), gateway routing by service name, circuit breaker, Postgres tables |
| CO4 Testing, CI/CD, demo | `tests/`, `.github/workflows/ci.yml` (test -> build -> compose smoke test), `demo.sh` |

## Demo tips
- Users: inspector1 / engineer1 / manager1, password `pass123`.
- Show discovery: `curl localhost:8761/services`
- Show resilience: `docker compose stop inspection`, call the API -> 503, then restart it and it self-registers.
- Show tracing: `docker compose logs | grep <cid>` using the `x-correlation-id` response header.
- Show metrics: open http://localhost:9090 and query `http_request_duration_seconds_count`.
