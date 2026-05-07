FROM node:20-alpine

WORKDIR /app

# sharp prebuilt binaries for linuxmusl come via npm install. Build deps only
# needed if prebuilt is unavailable for current arch.
RUN apk add --no-cache vips-dev || true

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
