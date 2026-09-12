FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=5173 \
    GRADLE_USER_HOME=/var/cache/bluek/gradle

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jdk-headless ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

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
