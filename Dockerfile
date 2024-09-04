FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# COPY .env .env
# # Install debugging tools
# RUN apk add --no-cache netcat-openbsd iputils bind-tools

# COPY wait-for-it.sh /wait-for-it.sh
# RUN chmod +x /wait-for-it.sh

EXPOSE 5000

CMD ["node", "server.js"]