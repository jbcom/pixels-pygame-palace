FROM astral/uv:python3.13-bookworm-slim

# Environment variables from .replit
ENV FLASK_ENV=development
ENV FLASK_SECRET_KEY=dev-secret-change-me
ENV NODE_ENV=development
ENV PIP_USER=0

# Headless environment for testing
ENV SDL_VIDEODRIVER=x11
ENV SDL_AUDIODRIVER=dummy
ENV DISPLAY=:99
ENV PYTHONUNBUFFERED=1

# Install Node.js 24 (matching replit config)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install system dependencies matching replit.nix
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials
    git \
    git-lfs \
    wget \
    unzip \
    which \
    build-essential \
    pkg-config \
    gcc \
    make \
    # Core libraries
    zlib1g-dev \
    libssl-dev \
    libffi-dev \
    # PostgreSQL 17 client
    postgresql-client \
    libpq-dev \
    # SDL2 and sound libraries
    libsdl2-dev \
    libsdl2-image-dev \
    libsdl2-mixer-dev \
    libsdl2-ttf-dev \
    libasound2-dev \
    # Image codecs
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libwebp-dev \
    libopenjp2-7-dev \
    # GUI / fonts / rendering
    libglib2.0-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libfontconfig1-dev \
    libfreetype6-dev \
    libgtk-3-dev \
    libxkbcommon-dev \
    libnspr4-dev \
    libnss3-dev \
    libdbus-1-dev \
    # X11 stack for headless display
    libx11-dev \
    libxext-dev \
    libxrender-dev \
    libxrandr-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libxfixes-dev \
    xvfb \
    # Browser automation
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /workspace

# Copy package files first for better caching
COPY package*.json ./
COPY pyproject.toml ./
COPY uv.lock ./
COPY apps/frontend/package*.json apps/frontend/
COPY apps/server/package*.json apps/server/
COPY packages/assets/package*.json packages/assets/
COPY packages/shared/package*.json packages/shared/

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Run bootstrap script
RUN bash -lc "./scripts/bootstrap_env.sh"

# Expose ports from .replit config
EXPOSE 5173 5000 5001

# Default command matches .replit run command
CMD ["bash", "-lc", "source .venv/bin/activate && npm run dev"]