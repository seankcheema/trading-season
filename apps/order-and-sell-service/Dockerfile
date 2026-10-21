# ── Stage 1: Build ─────────────────────────────────────────────────────────────
# Use the official Maven + JDK image so we have everything needed to compile.
# Naming this stage "build" lets the runtime stage reference it with COPY --from=build.
FROM maven:3.9-eclipse-temurin-21 AS build

# The build context is the repository root, because the service compiles the
# classes in packages/trading-java-common with its own. The directory layout is
# kept so the pom's ../../packages path resolves the same as it does locally.
WORKDIR /app/apps/order-and-sell-service

# The BuildKit cache mount keeps the Maven repository between builds without
# storing it in an image layer, so a pom.xml change downloads only the new
# artifacts. Both Java services share the mount; `locked` stops their parallel
# Compose builds from writing to it at the same time. Resolving through
# `package` alone skips the site and report plugins that go-offline fetched.
COPY apps/order-and-sell-service/pom.xml ./
COPY apps/order-and-sell-service/src/ src/
COPY packages/trading-java-common/ /app/packages/trading-java-common/
RUN --mount=type=cache,target=/root/.m2,sharing=locked     mvn -B package -DskipTests

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
# Fresh base image: JRE-only Alpine variant. The JDK, Maven, source code,
# and build cache from Stage 1 are NOT copied here — they never exist in the
# final image. That's why the multi-stage image is significantly smaller.
# A glibc-based runtime, not Alpine: the market replay reads the parquet tick archive
# through DuckDB's JDBC driver, whose native library needs glibc and libstdc++. On
# musl it fails to load and every snapshot answers "no replay prices available".
FROM eclipse-temurin:21-jre
LABEL maintainer="DuaLEAPa Team"

WORKDIR /app

# Create a non-root group and user, then switch to it.
# Running as root inside a container is unnecessary and increases blast radius
# if the container is compromised.
RUN groupadd --system appgroup && useradd --system --gid appgroup --shell /usr/sbin/nologin appuser
USER appuser

# Copy only the compiled jar from the build stage. Nothing else.
COPY --from=build /app/apps/order-and-sell-service/target/order-and-sell-service.jar app.jar

EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
