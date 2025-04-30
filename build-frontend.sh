#!/bin/bash

# Navigate to client directory
cd client

# Install required packages
npm install

# Build the frontend
npm run build

# Success message
echo "Frontend built successfully."