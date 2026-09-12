FROM node:22-bookworm AS node

FROM eclipse-temurin:21-jdk-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=5173 \
    GRADLE_USER_HOME=/var/cache/bluek/gradle

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

# Reuse the official multi-architecture Node.js image while keeping Java 21
# as the base runtime for the Kotlin/JS compiler.
COPY --from=node /usr/local/ /usr/local/

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && mkdir -p /var/cache/bluek/gradle \
    && ./jvm/gradlew --version \
    && useradd --system --uid 10001 --create-home --home-dir /home/bluek bluek \
    && chown -R bluek:bluek /var/cache/bluek /home/bluek

USER bluek

EXPOSE 5173

CMD ["node", "server/dist/server/src/index.js"]
