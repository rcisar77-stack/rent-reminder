FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install build dependencies for better-sqlite3
RUN apk add --no-allowed-untrusted --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Create volume directory for SQLite database persistence
RUN mkdir -p /usr/src/app/data

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV DB_PATH=/usr/src/app/data/rent_reminder.db

CMD ["npm", "start"]
