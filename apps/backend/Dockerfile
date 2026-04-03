FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/

RUN npm install --workspace=apps/backend --workspace=packages/shared

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/backend/ apps/backend/

# Set working directory to backend
WORKDIR /app/apps/backend

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
