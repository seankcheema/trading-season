# Jenkins image

[Dockerfile.jenkins](Dockerfile.jenkins) and [setup-jenkins.sh](setup-jenkins.sh) support the optional [Jenkins Compose environment](../docker-compose/docker-compose.jenkins.yml).

The image installs Node 24.x, which is compatible with this repository's Angular 21.2.x requirement. The active pipeline expects a configured native Jenkins agent with a Node 24.x toolchain at 24.8.0 or later; building this image does not change that agent's tools. Review [operations](../../docs/guides/operations.md#ci-and-artifacts) before using the example.
