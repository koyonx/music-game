FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ \
  && ln -sf python3 /usr/bin/python
EXPOSE 8787
CMD ["sh", "-c", "npm install && npm run db:push && npm run dev"]
