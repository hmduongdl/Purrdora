#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HELPER_SRC="$ROOT/src-tauri"
HELPER_BIN="purrdora-helper"
TARGET="/usr/libexec/$HELPER_BIN"
POLICY_SRC="$ROOT/packaging/com.purrdora.pkexec.policy"
POLICY_DST="/usr/share/polkit-1/actions/com.purrdora.pkexec.policy"
RULES_SRC="$ROOT/packaging/99-purrdora.rules"
RULES_DST="/etc/polkit-1/rules.d/99-purrdora.rules"
UDEV_SRC="$ROOT/resources/99-purrdora.rules"
UDEV_DST="/etc/udev/rules.d/99-purrdora.rules"

echo "==> Building helper binary..."
cargo build --manifest-path "$HELPER_SRC/Cargo.toml" --bin "$HELPER_BIN"

echo "==> Installing helper binary to $TARGET..."
sudo cp -f "$HELPER_SRC/target/debug/$HELPER_BIN" "$TARGET"
sudo chown root:root "$TARGET"
sudo chmod 755 "$TARGET"

echo "==> Installing polkit policy..."
sudo cp -f "$POLICY_SRC" "$POLICY_DST"
sudo chown root:root "$POLICY_DST"
sudo chmod 644 "$POLICY_DST"

echo "==> Installing polkit rules..."
sudo cp -f "$RULES_SRC" "$RULES_DST"
sudo chown root:root "$RULES_DST"
sudo chmod 644 "$RULES_DST"

echo "==> Installing udev rules..."
sudo cp -f "$UDEV_SRC" "$UDEV_DST"
sudo chown root:root "$UDEV_DST"
sudo chmod 644 "$UDEV_DST"
sudo udevadm control --reload 2>/dev/null || true
sudo udevadm trigger 2>/dev/null || true

echo "==> Done! Helper & polkit policies installed for passwordless privileged actions."
