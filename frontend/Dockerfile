FROM node:22-alpine

# Alpineでタイムゾーンを有効にするために tzdata をインストール
RUN apk add --no-cache tzdata

WORKDIR /app

COPY package.json yarn.lock* ./

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000

# Next.js needs -H 0.0.0.0 to be accessible from outside the container
CMD ["yarn", "dev", "-H", "0.0.0.0"]
