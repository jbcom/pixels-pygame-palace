{ pkgs }: {
  deps = [
    # -------- Env / build basics --------
    pkgs.python313
    pkgs.uv
    pkgs.pkg-config
    pkgs.zlib
    pkgs.openssl
    pkgs.libffi
    pkgs.gcc
    pkgs.gnumake

    # PostgreSQL client libs/headers (psycopg)
    pkgs.postgresql_17

    # Utilities
    pkgs.git
    pkgs.git-lfs
    pkgs.wget
    pkgs.unzip
    pkgs.which

    # -------- SDL2 / sound --------
    pkgs.SDL2
    pkgs.SDL2_image
    pkgs.SDL2_mixer
    pkgs.SDL2_ttf
    pkgs.alsa-lib

    # -------- Image codecs --------
    pkgs.libjpeg
    pkgs.libpng
    pkgs.libtiff
    pkgs.libwebp
    pkgs.libimagequant
    pkgs.openjpeg

    # -------- GUI / fonts / rendering --------
    pkgs.glib
    pkgs.cairo
    pkgs.pango
    pkgs.fontconfig
    pkgs.freetype
    pkgs.gtk3
    pkgs.libxkbcommon
    pkgs.nspr
    pkgs.nss
    pkgs.dbus

    # X11 stack (for headless + virtual display)
    pkgs.xorg.libX11
    pkgs.xorg.libXext
    pkgs.xorg.libXrender
    pkgs.xorg.libXrandr
    pkgs.xorg.libXcomposite
    pkgs.xorg.libXdamage
    pkgs.xorg.libXfixes
    pkgs.xorg.xorgserver   # provides Xvfb binary

    # -------- Browser automation --------
    pkgs.chromium
    pkgs.chromedriver
    # selenium-server is not a Nix package
    # Install via npm: selenium-webdriver
    # Or Python: selenium
  ];
}