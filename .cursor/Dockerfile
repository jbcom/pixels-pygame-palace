FROM astral/uv:python3.13-bookworm-slim

ENV SDL_VIDEODRIVER=x11
ENV SDL_AUDIODRIVER=dummy
ENV DISPLAY=:99
ENV PYGLET_HEADLESS=True
ENV PYTHONUNBUFFERED=1

# Install system dependencies for arcade, SDL, testing, and development
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials
    git \
    curl \
    build-essential \
    pkg-config \
    # SDL2 and graphics libraries for arcade
    libsdl2-dev \
    libsdl2-image-dev \
    libsdl2-mixer-dev \
    libsdl2-ttf-dev \
    libfreetype6-dev \
    libjpeg-dev \
    libpng-dev \
    libportmidi-dev \
    # OpenGL libraries (software rendering)
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    mesa-utils \
    # X11 libraries for GUI testing
    xvfb \
    x11-utils \
    libx11-dev \
    libxext-dev \
    libxrender-dev \
    libxinerama-dev \
    && rm -rf /var/lib/apt/lists/*

# Install just command runner
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin