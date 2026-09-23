FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

# The server only uses Node built-ins, so the runtime image needs no npm packages.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=build /app/dist ./dist
COPY server/app.ts server/index.ts server/leaderboard.ts ./server/
RUN mkdir -p server/data && chown -R node:node server/data
USER node
EXPOSE 3001
CMD ["node", "server/index.ts", "--static"]
