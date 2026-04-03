FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared/package.json packages/shared/

RUN npm install --workspace=apps/dashboard --workspace=packages/shared

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/dashboard/ apps/dashboard/

WORKDIR /app/apps/dashboard

# Build Next.js
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
