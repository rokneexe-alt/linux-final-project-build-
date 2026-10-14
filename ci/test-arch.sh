#!/bin/bash
# يثبّت حزمة pacman داخل Arch Linux نظيف ويشغّلها 20 ثانية (شاشة افتراضية) للتأكد أنها لا تنهار.
set -e
pacman -Syu --noconfirm
pacman -S --noconfirm xorg-server-xvfb
PKG=$(find /pkg -name "*.pkg.tar.zst" | head -1)
echo "== installing: $PKG"
pacman -U --noconfirm "$PKG"
echo "== package files =="
pacman -Ql word-challenge | head -15
BIN=$(command -v word-challenge || echo "/opt/Word Challenge/word-challenge")
echo "== binary: $BIN"
useradd -m tester
set +e
su tester -c "cd ~ && timeout 20 xvfb-run -a \"$BIN\" --no-sandbox --disable-gpu"
code=$?
set -e
if [ $code -eq 124 ]; then echo "PASS: app launched and stayed running for 20s"; else echo "FAIL: exit code $code"; exit 1; fi
