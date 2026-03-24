#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required but was not found in PATH."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is required but was not found in PATH."
    exit 1
fi

echo "Installing project dependencies..."
npm install

if [ ! -f "private.key" ] || [ ! -f "certificate.pem" ]; then
    echo
    echo "Warning: HTTPS certificate files are missing."
    echo "Generate HTTPS certificates with:"
    echo "openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate.pem"
fi

echo
echo "Install complete."
echo "Start the app with: npm start"
