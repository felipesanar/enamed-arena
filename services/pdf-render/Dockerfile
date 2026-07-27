# Build for linux/amd64 explicitly (e.g., docker build --platform linux/amd64 ...)
# This environment runs Apple Silicon arm64 via Colima with QEMU emulation;
# linux/amd64 builds work but are slower than native. Tectonic only provides
# x86_64-unknown-linux-gnu binaries.
# Base image: node:20-trixie-slim (Debian 13, glibc 2.41) — required for
# compatibility with Tectonic 0.17.0 binary (needs glibc >= 2.38/2.39).

FROM node:20-trixie-slim@sha256:abfbe12cc943141a0c9e8c0a57d710df1dadd95d35e8662cc02958b284d1f35b AS runtime

# System dependencies for Tectonic binary (glibc, fontconfig, harfbuzz, icu)
# Include curl to download Tectonic binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libfontconfig1 \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu76 \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Download, verify checksum, and install Tectonic 0.17.0
RUN set -e && \
    cd /tmp && \
    curl -L -o tectonic.tar.gz "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-unknown-linux-gnu.tar.gz" && \
    echo "1a715688baf591e650c8aeb160ae934e181685eecbb38b317de30b269ac5d606  /tmp/tectonic.tar.gz" | sha256sum -c - && \
    tar -xzf tectonic.tar.gz && \
    cp tectonic /usr/local/bin/tectonic && \
    chmod +x /usr/local/bin/tectonic && \
    rm -rf /tmp/tectonic.tar.gz /tmp/tectonic

# Cache directory for LaTeX packages (populated in Task 2)
ENV TECTONIC_CACHE_DIR=/opt/tectonic-cache
