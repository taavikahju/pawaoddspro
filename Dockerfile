FROM node:18-alpine
WORKDIR /app
# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
# Copy the rest of the application
COPY . .
# Expose the port your app runs on
EXPOSE 3000
# Start the application
CMD ["npm", "start"]
