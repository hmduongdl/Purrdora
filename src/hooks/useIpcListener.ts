import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSystemStore } from "../store/useSystemStore";
import type { SystemTelemetry, AudioState, MediaInfo } from "../types/schema";

export function useIpcListener() {
  const setTelemetry = useSystemStore((s) => s.setTelemetry);
  const setAudio = useSystemStore((s) => s.setAudio);
  const setMedia = useSystemStore((s) => s.setMedia);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      const u1 = await listen<SystemTelemetry>("system-tick", (event) => {
        setTelemetry(event.payload);
      });
      unlisteners.push(u1);

      const u2 = await listen<MediaInfo>("media-update", (event) => {
        setMedia(event.payload);
      });
      unlisteners.push(u2);

      // Future audio event from PipeWire listener
      try {
        const u3 = await listen<AudioState>("audio-update", (event) => {
          setAudio(event.payload);
        });
        unlisteners.push(u3);
      } catch {
        // audio-update event not yet implemented in backend
      }
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [setTelemetry, setAudio, setMedia]);
}
