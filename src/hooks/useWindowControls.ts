import { invoke } from "@tauri-apps/api/core";

export function closeWindow() {
  invoke("close_window").catch(console.error);
}

export function minimizeWindow() {
  invoke("minimize_window").catch(console.error);
}

export function toggleMaximize() {
  invoke("toggle_maximize").catch(console.error);
}
