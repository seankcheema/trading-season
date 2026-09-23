# Jenkins disk-space troubleshooting

Use this runbook when a Jenkins build fails because its agent or Docker host is out of disk space. A typical failure occurs while the synthetic market-data image installs Python packages:

```text
ERROR: Could not install packages due to an OSError: [Errno 28] No space left on device
```

This failure happens before the market-data test fixture is generated. Reducing the test date range does not address an image-build failure. The pipeline requires at least 7 GiB free before its explicit depth-1 checkout.

## Identify the active Jenkins home

Do not assume that a directory named `jenkins_home` is active. The pipeline normally runs on a native agent whose home is `/var/lib/jenkins`. The optional Compose environment stores Jenkins data at `/var/jenkins_home` inside its container and mounts that path from a named Docker volume.

For a native service, inspect its process and configured home:

```sh
ps -ef | grep '[j]enkins'
sudo systemctl show jenkins --property=Environment
sudo systemctl status jenkins
```

For containerized Jenkins, identify the running container and its mounts:

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect jenkins-with-nodejs --format '{{range .Mounts}}{{println .Destination "->" .Source}}{{end}}'
```

The repository's Compose example mounts the `docker-compose_jenkins_home` volume at `/var/jenkins_home`. Use the actual container and mount names reported by Docker rather than assuming the example names apply to another installation.

## Measure usage before removing anything

Check filesystem capacity and inode usage:

```sh
df -h /
df -i /
```

For native Jenkins, inspect its total usage and largest workspaces:

```sh
sudo du -sh /var/lib/jenkins
sudo du -xhd1 /var/lib/jenkins/workspace | sort -h
```

For containerized Jenkins, inspect the same paths inside the running container:

```sh
docker exec jenkins-with-nodejs du -sh /var/jenkins_home
docker exec jenkins-with-nodejs sh -c 'du -xhd1 /var/jenkins_home/workspace | sort -h'
```

Inspect Docker storage before choosing what to remove:

```sh
docker system df -v
docker ps -a
docker image ls
docker volume ls
docker volume ls -qf dangling=true
```

If `/var` remains unexpectedly large, narrow the search without crossing into other filesystems:

```sh
sudo du -xhd1 /var | sort -h
sudo du -xhd1 /var/lib | sort -h
```

## Clean up safely

Use the following order and recheck `df -h /` after each step. Confirm that no Jenkins build is running before changing a workspace.

### 1. Remove obsolete branch workspaces

For multibranch jobs, use the branch job's **Workspace > Wipe Out Current Workspace** action in Jenkins. Confirm that the branch job is inactive and no build is using the directory. This is safer than deleting files on the agent directly.

Deleting a workspace does not delete its Git branch, Jenkins job, build history, or archived artifacts. A later build checks out the branch again and recreates `node_modules`, Maven `target` directories, coverage output, and other generated dependencies.

If the Jenkins UI is unavailable, first resolve and inspect one exact inactive workspace. The example name below is deliberately not a real branch:

```sh
sudo realpath /var/lib/jenkins/workspace/example-confirmed-inactive-branch
sudo du -sh /var/lib/jenkins/workspace/example-confirmed-inactive-branch
```

Only after verifying that exact path and confirming no build is active, remove that one workspace and its matching temporary directory:

```sh
sudo rm -rf -- /var/lib/jenkins/workspace/example-confirmed-inactive-branch
sudo rm -rf -- /var/lib/jenkins/workspace/example-confirmed-inactive-branch@tmp
```

Do not remove the workspace of the branch being tested. For containerized Jenkins, use the Jenkins UI rather than deleting files directly from Docker's volume-storage directory.

### 2. Remove unused Docker images

List active containers first. The following command removes images that no container currently uses; later builds may need to download them again:

```sh
docker ps -a
docker image prune -af
```

Do not remove the image of a running Jenkins, SonarQube, registry, or database container.

### 3. Remove unused Docker build cache

Check the cache size in `docker system df -v`. If it is material and no build is running, remove unused cache entries:

```sh
docker builder prune -af
```

This may make the next image build slower. It will not help materially when the cache is only a few megabytes.

### 4. Remove reproducible build output

Prefer removing an entire obsolete workspace. If an active branch must be retained, its generated `node_modules`, Maven `target`, and coverage directories can be recreated by the pipeline. Remove them only while that workspace is idle and only after confirming their exact paths and ownership.

Do not change ownership of the whole Jenkins home to make a manual build work. Run the job through Jenkins or run diagnostic commands as the configured agent user so new output retains the expected ownership.

## Protect persistent data

Do not run these broad commands as routine cleanup:

```text
docker volume prune
docker system prune --volumes
```

An unattached volume can still contain data that must be retained. In particular, preserve active or unverified volumes containing:

- Jenkins home and job configuration
- PostgreSQL databases
- SonarQube data, extensions, and logs
- private registry storage
- generated market-data archives that are intended to persist

Before deleting any volume, inspect its mount point and usage, identify the owning service, confirm that it is obsolete, and back up data that cannot be recreated:

```sh
docker volume inspect VOLUME_NAME
docker system df -v
```

## Verify and rerun

After cleanup, verify both host and Docker usage:

```sh
df -h /
docker system df
```

Do not rerun the Docker integration stage with only hundreds of megabytes free. Keep at least 7 GiB available before starting it; the pipeline enforces that threshold. More headroom is appropriate when Jenkins, Docker, SonarQube, and databases share a small root filesystem.

Rerun the branch job through Jenkins so files are created with the configured agent identity. A manual Maven test verifies only one Java suite and does not exercise the Python image build or the two-day PostgreSQL integration stage.

## Automatic pipeline cleanup

The pipeline is intentionally configured as a cold build for the shared 30 GB agent. It disables the implicit full-history checkout, checks out the current branch at depth 1, and archives test reports before cleanup. Its final cleanup then removes the exact Playwright image used by the build, all unused Docker builder cache, Maven and npm caches, and the complete workspace. Named Docker volumes are not removed.

The next build therefore downloads its checkout, dependencies, and browser image again. This costs build time and network bandwidth but prevents Git history, dependency trees, Docker layers, and generated output from accumulating between runs. If final cleanup is interrupted, use the manual inspection and cleanup sequence above before retrying.

## Prevent recurrence

- Configure multibranch jobs to discard orphaned branch jobs and their workspaces after an agreed retention period.
- Keep build history retention enabled; the pipeline currently retains ten builds, but workspace retention is separate.
- Review `df -h /`, Jenkins workspace usage, and `docker system df` regularly on small agents.
- The pipeline deletes its workspace after report publication; use archived artifacts and build logs for debugging.
- Expand the agent's storage when ordinary Jenkins, Docker, and service data cannot maintain at least 7 GiB of free working space. Cleanup is not a substitute for adequate CI capacity.
- Revisit the cold-build policy if the agent is expanded and build speed becomes more important than minimum retained storage.
