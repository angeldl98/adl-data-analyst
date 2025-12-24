FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

ENV ANALYST_INTERVAL_SECONDS=900

ENTRYPOINT ["sh", "-c", "while true; do node dist/src/index.js --plugin=boe || true; sleep ${ANALYST_INTERVAL_SECONDS:-900}; done"]
