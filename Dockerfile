# force rebuild v3
# Use official Node 22 image
FROM node:22

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy everything else (including src/)
COPY . .

# Expose the port your server uses (if you run a health server)
EXPOSE 8080

# Start the indexer
CMD ["node", "src/indexer.js"]
