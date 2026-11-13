const { readFileSync } = require("node:fs");
const { version } = require("../package.json");
const config = require("../src-tauri/tauri.conf.json");
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8").match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (`v${version}` !== process.env.GITHUB_REF_NAME || version !== config.version || version !== cargo) {
  throw new Error("Versiones o etiqueta no coinciden");
}
