# Infrastructure

| Resource | Purpose |
| --- | --- |
| [Local Compose](docker-compose/docker-compose.local.yml) | Business and auth databases, auth container, outdated Java service configuration |
| [Jenkins Compose](docker-compose/docker-compose.jenkins.yml) | Optional local Jenkins environment |
| [Jenkinsfile](jenkins/Jenkinsfile) | Java, auth, and frontend test pipeline |
| [Jenkins image](docker/Dockerfile.jenkins) | Optional container image; current Node 20 setup needs updating for Angular |

Use [operations](../docs/guides/operations.md) for configuration ownership, limitations, CI outputs, and troubleshooting. Use [development](../docs/guides/development.md) for local startup. These examples do not constitute a production deployment.
