# Dockerfile
FROM node:18-alpine

WORKDIR /

COPY . .

RUN npm install

ENV MONGODB_URL=

CMD node index.js