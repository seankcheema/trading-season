# Infrastructure

| Resource | Purpose |
| --- | --- |
| [Local Compose](docker-compose/docker-compose.local.yml) | Business and auth databases, auth container, outdated Java service configuration |
| [Jenkins Compose](docker-compose/docker-compose.jenkins.yml) | Optional local Jenkins environment |
| [Jenkins pipeline](jenkins/Jenkinsfile) | Java, auth, frontend, and synthetic market-data test pipeline |
| [Jenkins troubleshooting](jenkins/README.md) | Disk-space diagnosis, safe cleanup, and prevention |
| [Jenkins image](docker/Dockerfile.jenkins) | Container image with Node 24.8.0 and JDK21 for Angular 22.2.x |

For Linux VM development, `scripts/setup-local.sh` at the repository root can reuse verified local PostgreSQL or start only the two databases from Local Compose. It checks storage before changing it and does not require Docker Desktop.

Use [operations](../docs/guides/operations.md) for configuration ownership, limitations, CI outputs, and troubleshooting. Use [development](../docs/guides/development.md) for local startup. These examples do not constitute a production deployment.
