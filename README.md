# DevBoard

A full-stack project management app built with a Spring Boot microservices backend and a React + TypeScript frontend, backed by MongoDB, with a full DevSecOps pipeline deploying to AWS EKS via Helm.

---

## Architecture

```
Browser
  └── Frontend (React + Vite)    :5173
        └── API Gateway           :8080   ← single public entry point
              ├── auth-service     :8081   ← users, JWTs, API keys
              ├── project-service  :8082   ← projects & collaborators
              └── task-service     :8083   ← tasks, status, priority
                        │
                   MongoDB :27017  +  Redis :6379
```

| Service | Port | Responsibility |
|---|---:|---|
| frontend | 5173 | React SPA served via Nginx |
| api-gateway | 8080 | Spring Cloud Gateway — routing + CORS |
| auth-service | 8081 | Register, login, JWT, API keys |
| project-service | 8082 | Project CRUD + collaborators |
| task-service | 8083 | Tasks with status, priority, pagination |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Nginx |
| Backend | Java 21, Spring Boot 3.5.3, Spring Cloud Gateway |
| Database | MongoDB 7 |
| Cache / Rate-limit | Redis 7 |
| Containerisation | Docker, Docker Compose |
| Orchestration | AWS EKS (Kubernetes) |
| Package manager | Helm 3 |
| CI/CD + Security | GitHub Actions, SonarQube, Snyk, Trivy |

---

## Prerequisites

**Docker setup**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose v2)

**Local development setup**
- Java 21+ — [Eclipse Temurin](https://adoptium.net/) recommended
- Maven 3.9+
- Node.js 22+
- Docker Desktop (for MongoDB + Redis only)

---

## Option 1 — Run with Docker (recommended)

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd Project

cp .env.example .env
```

Open `.env` and set your values:

```dotenv
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
MONGO_ROOT_PASSWORD=devboard-root
REDIS_PASSWORD=
```

### 2. Build backend JARs

```bash
cd backend
mvn clean package -DskipTests
cd ..
```

### 3. Start the full stack

```bash
docker compose up --build
```

### 4. Open the app

| URL | What |
|---|---|
| http://localhost:5173 | Web UI |
| http://localhost:8080 | API Gateway |
| http://localhost:27017 | MongoDB |

### Useful Docker commands

```bash
docker compose up --build -d
docker compose logs -f auth-service
docker compose down
docker compose down -v
```

---

## Option 2 — Local development

### 1. Start infrastructure only

```bash
docker compose -f docker-compose.infra.yml up -d
```

Starts MongoDB on `localhost:27017` and Redis on `localhost:6379` with no authentication required.

### 2. Build and run backend services

```bash
cd backend
mvn clean package -DskipTests
```

```bash
java -jar auth-service/target/auth-service-1.0.0.jar
java -jar project-service/target/project-service-1.0.0.jar
java -jar task-service/target/task-service-1.0.0.jar
java -jar api-gateway/target/api-gateway-1.0.0.jar
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Vite dev server starts on `http://localhost:5173` and proxies all API calls to the gateway at `http://localhost:8080`.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | `development-secret-must-be-at-least-32-characters-long` | JWT signing key |
| `MONGO_ROOT_PASSWORD` | Docker | `devboard-root` | MongoDB root password |
| `MONGO_URI` | Docker | `mongodb://localhost:27017/devboard` | Full MongoDB connection URI |
| `REDIS_PASSWORD` | No | _(empty)_ | Redis auth password |
| `AUTH_URL` | No | `http://localhost:8081` | Auth service base URL |
| `PROJECT_URL` | No | `http://localhost:8082` | Project service base URL |
| `TASK_URL` | No | `http://localhost:8083` | Task service base URL |

---

## API overview

All requests go through the gateway at `http://localhost:8080`. Auth endpoints use `Authorization: Bearer <JWT>`. All project and task endpoints use `X-API-Key` header.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | Bearer JWT | Current user info |
| POST | `/auth/api-key` | Bearer JWT | Generate API key |
| GET | `/auth/api-keys` | Bearer JWT | List API keys |
| DELETE | `/auth/api-keys/{id}` | Bearer JWT | Revoke API key |

### Projects

| Method | Path | Description |
|---|---|---|
| POST | `/projects` | Create project |
| GET | `/projects` | List your projects |
| GET | `/projects/{id}` | Get project |
| PUT | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Soft-delete project |
| GET | `/projects/{id}/export` | Export project + tasks as JSON |
| POST | `/projects/{id}/collaborators` | Add collaborator by userId |
| GET | `/projects/{id}/collaborators` | List collaborators |
| DELETE | `/projects/{id}/collaborators/{uid}` | Remove collaborator |

### Tasks

| Method | Path | Description |
|---|---|---|
| POST | `/projects/{id}/tasks` | Create task |
| GET | `/projects/{id}/tasks` | List tasks (`?page=&size=`) |
| PUT | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Soft-delete task |

**Status values:** `TODO` · `IN_PROGRESS` · `DONE`
**Priority values:** `LOW` · `MEDIUM` · `HIGH`

### Quick example

```bash
# Register
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"password123"}'

# Generate API key (use JWT from login)
curl -X POST http://localhost:8080/auth/api-key \
  -H "Authorization: Bearer <JWT>"

# Create project (use API key)
curl -X POST http://localhost:8080/projects \
  -H "X-API-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Project","description":"Getting started"}'

# Add a task (use MongoDB ObjectId from project response)
curl -X POST http://localhost:8080/projects/<PROJECT_ID>/tasks \
  -H "X-API-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Design the UI","priority":"HIGH"}'
```

A [Postman collection](./backend/postman/DevBoard.postman_collection.json) is included — import it and set `baseUrl`, `jwt`, and `apiKey` variables.

---

## DevSecOps Pipeline

The pipeline runs on **manual trigger** (`workflow_dispatch`) from the GitHub Actions tab. It runs security scans first — nothing is deployed unless all scans pass.

### Pipeline stages

```
Manual trigger (choose: staging / production)
         │
    Build JARs
         │
    ┌────┼────┐
 SonarQube  Snyk  Trivy
 (SAST)    (SCA) (images)
    └────┼────┘
    all pass?
         │
    Push images → Amazon ECR
         │
    Deploy → AWS EKS via Helm
         │
    Verify rollout
```

| Stage | Tool | What it checks |
|---|---|---|
| SAST | SonarQube | Java + TypeScript source code |
| Dependency scan | Snyk | `pom.xml` + `package.json` CVEs |
| Container scan | Trivy | All 5 Docker images (CRITICAL + HIGH) |
| Registry | Amazon ECR | Images tagged with git SHA + `latest` |
| Deploy | Helm + EKS | `helm upgrade --install --atomic` |

### GitHub Secrets required

| Secret | Description |
|---|---|
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID |
| `AWS_ROLE_ARN` | IAM role ARN for GitHub OIDC |
| `EKS_CLUSTER_NAME` | EKS cluster name |
| `SONAR_TOKEN` | SonarQube / SonarCloud token |
| `SONAR_HOST_URL` | SonarQube host URL |
| `SNYK_TOKEN` | Snyk API token |
| `MONGO_URI` | MongoDB Atlas or DocumentDB URI |
| `JWT_SECRET` | JWT signing secret (32+ chars) |
| `STAGING_HOST` | Ingress hostname for staging |
| `PROD_HOST` | Ingress hostname for production |

### Create ECR repositories (one-time setup)

```bash
for svc in auth-service project-service task-service api-gateway frontend; do
  aws ecr create-repository --repository-name devboard-${svc} --region us-east-1
done
```

---

## Helm chart

Located at `helm/devboard/`. Deploys all 5 services + Nginx Ingress to Kubernetes.

```
helm/devboard/
  Chart.yaml
  values.yaml
  templates/
    secrets.yaml          ← K8s Secret (MongoDB URI, JWT)
    auth-service.yaml     ← Deployment + Service
    project-service.yaml  ← Deployment + Service
    task-service.yaml     ← Deployment + Service
    api-gateway.yaml      ← Deployment + Service
    frontend.yaml         ← Deployment + Service
    ingress.yaml          ← Nginx Ingress (routes by path)
```

Manual deploy:

```bash
helm upgrade --install devboard ./helm/devboard \
  --namespace devboard-staging \
  --create-namespace \
  --set global.imageRegistry=<ECR_REGISTRY> \
  --set global.imageTag=<GIT_SHA> \
  --set mongodb.uri=<MONGO_URI> \
  --set auth.jwtSecret=<JWT_SECRET> \
  --set ingress.host=staging.devboard.example.com \
  --wait --atomic
```

---

## Project structure

```
Project/
├── .env                            ← local secrets (git-ignored)
├── .env.example                    ← template
├── .trivyignore                    ← Trivy CVE suppressions
├── docker-compose.yml              ← full stack
├── docker-compose.infra.yml        ← MongoDB + Redis only
├── .github/
│   └── workflows/
│       └── devsecops.yml           ← full DevSecOps pipeline
├── helm/
│   └── devboard/                   ← Helm chart for EKS
├── backend/
│   ├── pom.xml                     ← Maven reactor (parent POM)
│   ├── api-gateway/                ← Spring Cloud Gateway  :8080
│   ├── auth-service/               ← Auth + JWT + API keys :8081
│   ├── project-service/            ← Projects + collabs    :8082
│   ├── task-service/               ← Tasks                 :8083
│   └── postman/
│       └── DevBoard.postman_collection.json
└── frontend/
    ├── src/
    │   ├── main.tsx                ← full React app
    │   └── styles.css
    ├── sonar-project.properties    ← SonarQube frontend config
    ├── nginx.conf
    ├── vite.config.ts
    └── package.json
```

---

## Troubleshooting

**Sidebar shows empty project names**
Old MongoDB data may have been created before the `@JsonProperty("id")` fix. Run `docker compose down -v` to wipe data, then `docker compose up` and re-register.

**`/projects/undefined/tasks` in network tab**
Same cause as above — stale data with mismatched IDs. Wipe volumes and start fresh.

**Services can't reach each other inside Docker**
All services communicate over the default Docker Compose bridge network using service names (`http://auth-service:8081`). These names only resolve inside Docker — not from your host.

**Port conflicts**
MongoDB is mapped to `27017`. If that's in use locally, change the host port in `docker-compose.infra.yml` and update `MONGO_URI` accordingly.

**Frontend blank page / Nginx 500**
Run `npm run build` inside `frontend/` locally to see TypeScript errors before building the Docker image.

**Pipeline fails at Trivy**
Check `.trivyignore` to suppress known false positives. Only `CRITICAL` and `HIGH` unfixed CVEs fail the build.
