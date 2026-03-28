#!/bin/bash

set -e

MODE=""
DOMAIN=""
EMAIL=""
VERBOSE=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$SCRIPT_DIR/certs"

usage() {
    echo "Usage: $0 -c <domain> [-e <email>] | -r [-v]"
    echo ""
    echo "  -c <domain>   Request a new Let's Encrypt certificate for <domain>"
    echo "  -e <email>    Email for Let's Encrypt registration (enables non-interactive mode)"
    echo "  -r            Renew the existing certificate and restart FreeRTC"
    echo "  -v            Verbose output"
    exit 1
}

log() { [ "$VERBOSE" = true ] && echo "$@"; }

while getopts "c:e:rv" opt; do
    case $opt in
        c) MODE="create"; DOMAIN="$OPTARG" ;;
        e) EMAIL="$OPTARG" ;;
        r) MODE="renew" ;;
        v) VERBOSE=true ;;
        *) usage ;;
    esac
done

[ -z "$MODE" ] && usage

QUIET_FLAG=""
APT_QUIET="-qq"
[ "$VERBOSE" = true ] && QUIET_FLAG="" || QUIET_FLAG="--quiet"
[ "$VERBOSE" = true ] && APT_QUIET=""

if [ "$MODE" = "create" ]; then
    [ -z "$DOMAIN" ] && { echo "Error: -c requires a domain name"; usage; }

    log "Installing certbot..."
    sudo apt-get install -y $APT_QUIET certbot

    log "Requesting certificate for $DOMAIN..."
    if [ -n "$EMAIL" ]; then
        sudo certbot certonly --standalone --non-interactive --agree-tos \
            --email "$EMAIL" -d "$DOMAIN" $QUIET_FLAG
    else
        sudo certbot certonly --standalone -d "$DOMAIN" $QUIET_FLAG
    fi

    log "Copying certificates to $CERT_DIR..."
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem"   "$CERT_DIR/private.key"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/certificate.pem"
    sudo chown "$(whoami):$(whoami)" "$CERT_DIR/private.key" "$CERT_DIR/certificate.pem"

    echo "Done. Certificate created for $DOMAIN."

elif [ "$MODE" = "renew" ]; then
    log "Renewing certificate..."
    sudo certbot renew $QUIET_FLAG

    DOMAIN=$(openssl x509 -in "$CERT_DIR/certificate.pem" -noout -subject 2>/dev/null \
        | sed -n 's/.*CN\s*=\s*\([^,/]*\).*/\1/p')

    if [ -z "$DOMAIN" ]; then
        DOMAIN=$(sudo certbot certificates 2>/dev/null \
            | grep -m1 "Domains:" | awk '{print $2}')
    fi

    [ -z "$DOMAIN" ] && { echo "Error: could not detect domain from existing certificate."; exit 1; }

    log "Detected domain: $DOMAIN"
    log "Copying renewed certificates to $CERT_DIR..."
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem"   "$CERT_DIR/private.key"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/certificate.pem"
    sudo chown "$(whoami):$(whoami)" "$CERT_DIR/private.key" "$CERT_DIR/certificate.pem"

    log "Restarting FreeRTC..."
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" restart freertc

    echo "Done. Certificate renewed for $DOMAIN."
fi
