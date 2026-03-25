#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

MAC=0
for arg in "$@"; do
    case "$arg" in
        -mac) MAC=1 ;;
    esac
done

if [ "$MAC" = "1" ]; then
    echo "Running macOS setup..."

    if ! command -v brew >/dev/null 2>&1; then
        echo "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    else
        echo "Homebrew already installed."
    fi

    if ! command -v node >/dev/null 2>&1; then
        echo "Installing Node.js via Homebrew..."
        brew install node
    else
        echo "Node.js already installed: $(node --version)"
    fi

    if ! command -v openssl >/dev/null 2>&1; then
        echo "Installing openssl via Homebrew..."
        brew install openssl
    else
        echo "openssl already installed."
    fi
else
    if ! command -v node >/dev/null 2>&1; then
        echo "Error: Node.js is required but was not found in PATH."
        exit 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        echo "Error: npm is required but was not found in PATH."
        exit 1
    fi
fi

if [ -d "node_modules" ]; then
    echo "Fixing node_modules ownership..."
    sudo chown -R "$(id -u):$(id -g)" node_modules
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
