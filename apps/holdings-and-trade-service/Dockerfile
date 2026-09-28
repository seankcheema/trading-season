# ── Stage 1: Build ─────────────────────────────────────────────────────────────
# Use the official Maven + JDK image so we have everything needed to compile.
# Naming this stage "build" lets the runtime stage reference it with COPY --from=build.
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# The BuildKit cache mount keeps the Maven repository between builds without
# storing it in an image layer, so a pom.xml change downloads only the new
# artifacts. Both Java services share the mount; `locked` stops their parallel
# Compose builds from writing to it at the same time. Resolving through
# `package` alone skips the site and report plugins that go-offline fetched.
COPY pom.xml .
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2,sharing=locked     mvn -B package -DskipTests

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
COPY --from=build /app/target/holdings-and-trade-service.jar app.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
