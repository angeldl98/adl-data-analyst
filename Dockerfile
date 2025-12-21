FROM node:20-slim

WORKDIR /app

# Runtime-only image: assumes dist already built.
COPY dist ./dist
COPY package*.json ./

CMD ["node", "dist/main.js"]


