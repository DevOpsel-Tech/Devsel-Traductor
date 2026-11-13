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
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.value === "string") return value.value;
  return "";
}

export async function writeStoredApiKey(value) {
  const next = typeof value === "string" ? value.trim() : "";
  if (!next) {
    await invokeSafe("clear_api_key");
    return;
  }
  await invokeSafe("save_api_key", { value: next });
}

export async function clearStoredApiKey() {
  await invokeSafe("clear_api_key");
}
