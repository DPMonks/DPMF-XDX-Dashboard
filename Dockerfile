# force rebuild v2
# Use Node 18
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy everything else (including src/)
COPY . .

# Expose the port your server uses
EXPOSE 8080

# Start the app
CMD ["npm", "start"]

