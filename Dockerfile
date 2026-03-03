FROM node:20-slim

WORKDIR /app

# Copy package files and install (need devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies for smaller image
RUN npm prune --omit=dev

# Railway injects PORT automatically
ENV TRANSPORT=http
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
