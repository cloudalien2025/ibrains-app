FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy full repo FIRST so postinstall scripts exist
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build Next.js
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
