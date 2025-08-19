#!/bin/bash

# Create config directory if it doesn't exist
mkdir -p /usr/src/app/config

# Check if config.json exists, if not copy from config.example.json
if [ ! -f "/usr/src/app/config/config.json" ]; then
    echo "No config.json found. Copying from config.example.json..."
    cp /usr/src/app/config.example.json /usr/src/app/config/config.json
    echo "Config file created at config/config.json. Please edit it and restart the container."
fi

# Start the application
exec "$@"