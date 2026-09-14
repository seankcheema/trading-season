# Jenkins with Node.js Setup

This directory contains the Docker setup for running Jenkins with Node.js support.

## Files

- **Dockerfile.jenkins** — Jenkins image based on `jenkins/jenkins:lts-jdk21` with Node.js 20.x installed
- **../docker-compose/docker-compose.jenkins.yml** — Docker Compose configuration for running Jenkins with backend and database
- **setup-jenkins.sh** — Quick-start bash script to build and run Jenkins

## Quick Start

### Option 1: Using the Setup Script (Recommended)

```bash
cd infrastructure/docker
chmod +x setup-jenkins.sh
./setup-jenkins.sh
```

This will:
1. Build the custom Jenkins image with Node.js
2. Start Jenkins and all supporting services
3. Display access credentials and verification commands

### Option 2: Manual Docker Compose

```bash
cd infrastructure/docker-compose
docker-compose -f docker-compose.jenkins.yml build --no-cache
docker-compose -f docker-compose.jenkins.yml up -d
```

### Option 3: Manual Docker Build & Run

```bash
cd infrastructure/docker
docker build -f Dockerfile.jenkins -t jenkins-with-nodejs .
docker run -d \
  --name jenkins-with-nodejs \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins-with-nodejs
```

## Verify Installation

Once Jenkins is running, verify Node.js is installed:

```bash
# Check Node.js version
docker exec jenkins-with-nodejs node --version

# Check npm version
docker exec jenkins-with-nodejs npm --version

# Check Java version
docker exec jenkins-with-nodejs java -version
```

## Access Jenkins

- **URL**: http://localhost:8080
- **Username**: admin
- **Password**: admin

## Configure Jenkins for Pipeline Execution

1. Go to **Manage Jenkins** → **Configure System**
2. Scroll to **Pipeline** section
3. Verify Node.js is available by running a test pipeline with:
   ```groovy
   sh 'node --version && npm --version'
   ```

## Testing the Jenkinsfile

The Jenkinsfile at `infrastructure/jenkins/Jenkinsfile` now has conditional logic to:
1. Always run backend tests (Maven/JUnit 5)
2. Run frontend tests (Vitest) **only if npm is available**

With this Jenkins image, both backend and frontend tests will execute successfully.

## Cleanup

To stop Jenkins and remove containers:

```bash
docker-compose -f infrastructure/docker-compose/docker-compose.jenkins.yml down
```

To also remove the volume (⚠️ this deletes Jenkins data):

```bash
docker-compose -f infrastructure/docker-compose/docker-compose.jenkins.yml down -v
```

## Troubleshooting

### Jenkins won't start
```bash
docker logs jenkins-with-nodejs
```

### Permission denied on docker.sock
Ensure the Jenkins container has access to the Docker socket:
```bash
docker exec jenkins-with-nodejs id  # Should show jenkins user
```

### Node.js not found in Jenkinsfile
Verify installation:
```bash
docker exec jenkins-with-nodejs bash -c 'command -v node && command -v npm'
```

## What's Installed

- **Base**: Jenkins LTS with JDK 21
- **Node.js**: v20.x from NodeSource repository
- **npm**: Latest stable version
- **Maven**: Already configured in Jenkins
- **Docker access**: For container-based builds (DooD)

## Environment Variables

The docker-compose file sets:
- `JAVA_OPTS: "-Xmx2g -Xms512m"` — Jenkins JVM heap size
- `JENKINS_OPTS` — Initial admin user configuration
- `DB_PASSWORD` — Customizable (default: "changeme")

## Security Notes

⚠️ **Default credentials are for development only.**

For production:
1. Change the admin password immediately
2. Configure authentication (LDAP, GitHub, etc.)
3. Use secrets management for DB passwords
4. Don't expose Jenkins to the internet without HTTPS/VPN
5. Regularly update Jenkins and plugins
