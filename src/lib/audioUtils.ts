/**
 * Clean up PipeWire node.description text by stripping verbose
 * chipset/controller prefixes and Output/Input suffixes.
 * node.name is preserved as-is for tooltips.
 *
 * Examples:
 *   Alder Lake PCH-P High Definition Audio Controller HDMI / DisplayPort 2 Output
 *     → HDMI / DisplayPort 2
 *   Alder Lake PCH-P High Definition Audio Controller Speaker
 *     → Speaker
 */

const PREFIX_RE = /^[A-Z][\w\s/-]+Audio Controller\s+/;
const SUFFIX_RE = /\s+(Output|Input)$/;

export function formatAudioDeviceName(raw: string): string {
  const cleaned = raw.trim().replace(PREFIX_RE, "").replace(SUFFIX_RE, "").trim();
  return cleaned || raw;
}
