#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
LINUX_UNPACKED="$DIST_DIR/linux-unpacked"

if [[ ! -d "$LINUX_UNPACKED" ]]; then
  echo "linux-unpacked not found. Run: npm run build:linux" >&2
  exit 1
fi

VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
APP_NAME="botassist-whatsapp"
PRODUCT_DIR="BotAssist-WhatsApp"
SUMMARY="BotAssist - Assistente WhatsApp IA com Interface Gráfica"
APP_ASAR="$LINUX_UNPACKED/resources/app.asar"

if ! node -e "require.resolve('@electron/asar')" >/dev/null 2>&1; then
  echo "Missing '@electron/asar' dependency. Run: npm ci" >&2
  exit 1
fi

if [[ ! -f "$APP_ASAR" ]]; then
  echo "app.asar not found. Run: npm run build:linux" >&2
  exit 1
fi

APP_VERSION="$(node -e "const asar=require('@electron/asar'); const buf=asar.extractFile(process.argv[1],'package.json'); const pkg=JSON.parse(buf.toString('utf8')); process.stdout.write(pkg.version||'');" "$APP_ASAR")"
if [[ -z "$APP_VERSION" ]]; then
  echo "Unable to read version from app.asar. Rebuild with: npm run build:linux" >&2
  exit 1
fi
if [[ "$APP_VERSION" != "$VERSION" ]]; then
  echo "Version mismatch: package.json=$VERSION, app.asar=$APP_VERSION. Rebuild with: npm run build:linux" >&2
  exit 1
fi

TOPDIR="$(mktemp -d -t botassist-rpm-XXXXXXXX)"
BUILDROOT="$TOPDIR/BUILDROOT"
STAGE_DIR="$TOPDIR/BUILD/stage"
SOURCES="$TOPDIR/SOURCES"
SPECS="$TOPDIR/SPECS"
RPMS="$TOPDIR/RPMS"

mkdir -p "$STAGE_DIR/opt/$PRODUCT_DIR" "$STAGE_DIR/usr/share/applications" "$SOURCES" "$SPECS" "$RPMS"

cp -a "$LINUX_UNPACKED/." "$STAGE_DIR/opt/$PRODUCT_DIR/"

# Ensure package-type indicates rpm for auto-update detection.
if [[ -d "$STAGE_DIR/opt/$PRODUCT_DIR/resources" ]]; then
  echo "rpm" > "$STAGE_DIR/opt/$PRODUCT_DIR/resources/package-type"
fi

cat > "$STAGE_DIR/usr/share/applications/$APP_NAME.desktop" <<EOF
[Desktop Entry]
Name=BotAssist WhatsApp
Exec=/opt/$PRODUCT_DIR/$APP_NAME %U
Terminal=false
Type=Application
Icon=$APP_NAME
StartupWMClass=BotAssist WhatsApp
Categories=Utility;
EOF

ICON_SRC="$ROOT_DIR/node_modules/app-builder-lib/templates/icons/electron-linux"
for size in 16 32 48 64 128 256; do
  install -Dm644 "$ICON_SRC/${size}x${size}.png" "$STAGE_DIR/usr/share/icons/hicolor/${size}x${size}/apps/$APP_NAME.png"
done

find "$STAGE_DIR" \( -type f -o -type l \) | sed "s|^$STAGE_DIR||" | sort > "$SOURCES/filelist"

cat > "$SPECS/$APP_NAME.spec" <<EOF
Name: $APP_NAME
Version: $VERSION
Release: 1
Summary: $SUMMARY
License: MIT
URL: https://github.com/N1ghthill/botassist-whatsapp
Requires: gtk3, libnotify, nss, libXScrnSaver, libXtst, xdg-utils, at-spi2-core, libuuid
BuildRoot: %{buildroot}

%description
$SUMMARY

%prep
%build
%install
rm -rf "%{buildroot}"
mkdir -p "%{buildroot}"
cp -a "$STAGE_DIR/." "%{buildroot}/"
%clean

%files -f %{_sourcedir}/filelist
%defattr(-,root,root,-)

%changelog
EOF

RPMDB="$TOPDIR/RPMDB"
mkdir -p "$RPMDB"
rpm --initdb --dbpath "$RPMDB" >/dev/null 2>&1 || true

rpmbuild -bb \
  --buildroot "$BUILDROOT" \
  --define "_topdir $TOPDIR" \
  --define "_dbpath $RPMDB" \
  --define "_dbpath_rebuild $RPMDB" \
  --define "_tmppath /tmp" \
  "$SPECS/$APP_NAME.spec"

RPM_OUT="$(find "$RPMS" -type f -name "*.rpm" -printf '%T@ %p\n' | sort -nr | head -n 1 | awk '{print $2}')"
if [[ -z "$RPM_OUT" ]]; then
  echo "RPM build output not found." >&2
  exit 1
fi
ARCH="$(rpm --dbpath "$RPMDB" --queryformat '%{ARCH}' -qp "$RPM_OUT")"
TARGET="$DIST_DIR/${APP_NAME}-${VERSION}.${ARCH}.rpm"
cp -f "$RPM_OUT" "$TARGET"
echo "Wrote $TARGET"
