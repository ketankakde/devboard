# Backend microservices

This Maven reactor contains four independently deployable Spring Boot applications.

| Service | Port | Responsibility |
|---|---:|---|
| api-gateway | 8080 | Single public routing entry point |
| auth-service | 8081 | Users, JWTs, and hashed API keys |
| project-service | 8082 | Project ownership and CRUD |
| task-service | 8083 | Tasks, priority, due dates, and pagination |

Build all services with `mvn package -DskipTests` from this directory. The root `docker-compose.yml` provides MongoDB and runs each service with environment-specific Spring configuration.

## Database

All three domain services use **MongoDB 7** (no shared schema — MongoDB is schemaless).
Collections created automatically on first write:

| Collection | Service | Notes |
|---|---|---|
| `users` | auth-service | Unique index on `email` |
| `api_keys` | auth-service | Unique index on `keyHash` |
| `projects` | project-service | Soft-deleted via `deletedAt` |
| `collaborators` | project-service | Soft-revoked via `revokedAt` |
| `tasks` | task-service | Soft-deleted via `deletedAt` |

## Running locally

```bash
# Start MongoDB + Redis only
docker compose -f docker-compose.infra.yml up -d

# Run any service (example)
cd auth-service
mvn spring-boot:run
```

Default local connection: `mongodb://localhost:27017/devboard` (no auth required with infra compose).
