# Container image — works on Railway, Fly.io, Google Cloud Run, any VPS with Docker.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/server/data"]
CMD ["node", "server/index.js"]
