import { invoke } from "@tauri-apps/api/core";

async function invokeSafe(command, payload = {}) {
  try {
    return await invoke(command, payload);
  } catch {
    return null;
  }
}

export async function readStoredApiKey() {
  const value = await invokeSafe("get_api_key");
  return typeof value === "string" ? value : "";
}

export async function writeStoredApiKey(value) {
  if (!value || !value.trim()) {
    await invokeSafe("clear_api_key");
    return;
  }
  await invokeSafe("save_api_key", { value: value.trim() });
}

export async function clearStoredApiKey() {
  await invokeSafe("clear_api_key");
}
