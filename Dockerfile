FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/app/data
COPY --from=build /app/.output ./.output
RUN mkdir -p /app/data && chown node /app/data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
