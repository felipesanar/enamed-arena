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

WORKDIR /app

# Vendored fonts (no network font resolution at runtime — Tectonic/fontconfig
# have no system fontconfig database configured, so every font used in the
# LaTeX templates must be referenced via an explicit fontspec Path= pointing
# here). Plus Jakarta Sans is the primary UI font family; Noto Sans is a
# mandatory fallback for glyphs Plus Jakarta Sans lacks (Greek block: alpha,
# beta, etc. — common in medical content like "alfa-fetoproteína"). Without
# it, missing glyphs render as a wrong/confusing .notdef box instead of a
# clear placeholder, which is worse than the "?" fallback in the current
# pdf-lib renderer it replaces.
COPY assets/fonts/ /opt/fonts/

# Defense in depth: refresh fontconfig cache even though every font reference
# uses an explicit Path=, in case any dependency ever falls back to fontconfig
# discovery.
RUN fc-cache -f

# Minimal fixture used to both prime and smoke-test the Tectonic package
# cache in this same image build (see below).
COPY test/fixtures/minimal.tex test/fixtures/minimal.tex

# Prime the Tectonic package cache at build time: this is the only network
# access needed to resolve LaTeX packages (fontspec, polyglossia,
# ucharclasses, microtype, graphicx, geometry, fancyhdr, xcolor, enumitem,
# needspace, tcolorbox, tikz, and transitive deps). Compiling once here
# downloads and caches everything into $TECTONIC_CACHE_DIR so no further
# network access is required at runtime.
RUN mkdir -p /tmp/prime && \
    tectonic test/fixtures/minimal.tex --outdir=/tmp/prime && \
    test -s /tmp/prime/minimal.pdf && \
    test -n "$(ls -A "$TECTONIC_CACHE_DIR")"

# Smoke stage: recompile the same fixture. If this fails, the build fails —
# this is the final gate confirming Tectonic + vendored fonts + cached
# packages actually produce a non-empty PDF from this image.
# Limitation: this RUN step is not isolated from network access (Docker has
# no per-RUN --network=none knob within a single Dockerfile stage). In
# practice it should need zero network access because the priming step above
# already populated $TECTONIC_CACHE_DIR with everything minimal.tex requires;
# if this step were to silently reach the network on a cache miss, it would
# not be caught here. Documented as an accepted limitation for Task 2 scope.
RUN mkdir -p /tmp/smoke && \
    tectonic test/fixtures/minimal.tex --outdir=/tmp/smoke && \
    test -s /tmp/smoke/minimal.pdf
