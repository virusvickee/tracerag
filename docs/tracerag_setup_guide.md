# Monorepo Setup & Docker Compose Scaffold Guide

## Quickstart
```bash
cp .env.example .env
docker-compose up --build
```
The backend automatically initializes `pgvector` tables and seeds the pre-built Demo Workspace on startup.
