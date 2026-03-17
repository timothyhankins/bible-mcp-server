FROM node:20-slim

# better-sqlite3 needs python3 + build tools for native compilation
RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install (need devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Copy ingestion scripts and download data
COPY scripts/ ./scripts/
RUN mkdir -p data \
    && curl -L -o data/cross_references.txt \
       "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/extras/cross_references.txt" \
    && curl -L -o data/TBESG.txt \
       "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt" \
    && curl -L -o data/TBESH.txt \
       "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt"

# Ingest data into SQLite at build time
RUN npx tsx scripts/ingest-all.ts

# Remove raw data files (keep only the SQLite db)
RUN rm -f data/cross_references.txt data/TBESG.txt data/TBESH.txt

# Prune dev dependencies for smaller image
RUN npm prune --omit=dev

# Railway injects PORT automatically
ENV TRANSPORT=http
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
