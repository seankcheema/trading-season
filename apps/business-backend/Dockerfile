# ── Stage 1: Build ─────────────────────────────────────────────────────────────
# Use the official Maven + JDK image so we have everything needed to compile.
# Naming this stage "build" lets the runtime stage reference it with COPY --from=build.
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# Copy pom.xml first, before source. Docker caches each layer separately, so
# as long as pom.xml hasn't changed, the next RUN (dependency download) is
# served from cache even if source files changed. This avoids re-downloading
# Maven dependencies on every code change — the main layer-caching win.
COPY pom.xml .
RUN mvn -B dependency:go-offline

# Now copy source and compile. This layer is re-run only when src/ changes.
COPY src/ src/
RUN mvn -B clean package -DskipTests

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
# Fresh base image: JRE-only Alpine variant. The JDK, Maven, source code,
# and build cache from Stage 1 are NOT copied here — they never exist in the
# final image. That's why the multi-stage image is significantly smaller.
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a non-root group and user, then switch to it.
# Running as root inside a container is unnecessary and increases blast radius
# if the container is compromised.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy only the compiled jar from the build stage. Nothing else.
COPY --from=build /app/target/sprint1-greeter-app.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
