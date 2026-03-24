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

echo "Rebuilding native modules for the current Node.js runtime..."
npm rebuild bcrypt better-sqlite3

mkdir -p certs data

if [ ! -f "certs/private.key" ] || [ ! -f "certs/certificate.pem" ]; then
    echo
    echo "Warning: HTTPS certificate files are missing."
    echo "Generate HTTPS certificates with:"
    echo "openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/private.key -out certs/certificate.pem"
fi

echo
echo "Install complete."
echo "Start the app with: npm start"
