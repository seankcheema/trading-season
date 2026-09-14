# Jenkins image

[Dockerfile.jenkins](Dockerfile.jenkins) and [setup-jenkins.sh](setup-jenkins.sh) support the optional [Jenkins Compose environment](../docker-compose/docker-compose.jenkins.yml).

The image currently installs Node 20, which is below this repository's Angular requirement. The active pipeline expects a configured native Jenkins agent; building this image does not change that agent's toolchain. Review [operations](../../docs/guides/operations.md#ci-and-artifacts) before using the example.
