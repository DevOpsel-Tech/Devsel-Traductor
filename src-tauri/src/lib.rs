use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::Manager;

fn db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db = Connection::open(dir.join("traductor.sqlite3")).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY, name TEXT NOT NULL, data BLOB NOT NULL); CREATE TABLE IF NOT EXISTS vocabulary(id INTEGER PRIMARY KEY, source TEXT NOT NULL, translation TEXT NOT NULL); CREATE TABLE IF NOT EXISTS translations(source TEXT PRIMARY KEY, translation TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);").map_err(|e| e.to_string())?;
    Ok(db)
}
#[derive(Serialize)]
struct Document { id: i64, name: String }
#[derive(Serialize)]
struct Word { id: i64, source: String, translation: String }
#[derive(Serialize, Deserialize)]
struct Settings { online: bool, api_key: String }

#[tauri::command]
fn list_documents(app: tauri::AppHandle) -> Result<Vec<Document>, String> {
    let conn = db(&app)?;
    let mut stmt = conn.prepare("SELECT id,name FROM documents ORDER BY id DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(Document { id: r.get(0)?, name: r.get(1)? })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_document(app: tauri::AppHandle, name: String, data: Vec<u8>) -> Result<(), String> {
    if data.len() > 50 * 1024 * 1024 || !data.starts_with(b"%PDF-") { return Err("PDF no válido o mayor de 50 MiB".into()); }
    db(&app)?.execute("INSERT INTO documents(name,data) VALUES(?1,?2)", params![name, data]).map_err(|e| e.to_string())?; Ok(())
}
#[tauri::command]
fn get_document(app: tauri::AppHandle, id: i64) -> Result<Vec<u8>, String> {
    db(&app)?.query_row("SELECT data FROM documents WHERE id=?1", [id], |r| r.get(0)).map_err(|e| e.to_string())
}
#[tauri::command]
fn delete_document(app: tauri::AppHandle, id: i64) -> Result<(), String> { db(&app)?.execute("DELETE FROM documents WHERE id=?1", [id]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn add_word(app: tauri::AppHandle, source: String, translation: String) -> Result<(), String> { db(&app)?.execute("INSERT INTO vocabulary(source,translation) VALUES(?1,?2)", params![source,translation]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn list_words(app: tauri::AppHandle) -> Result<Vec<Word>, String> {
    let conn = db(&app)?; let mut stmt = conn.prepare("SELECT id,source,translation FROM vocabulary ORDER BY id DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(Word { id:r.get(0)?,source:r.get(1)?,translation:r.get(2)? })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>,_>>().map_err(|e| e.to_string())
}
#[tauri::command]
fn cache_get(app: tauri::AppHandle, source: String) -> Result<Option<String>, String> { db(&app)?.query_row("SELECT translation FROM translations WHERE source=?1", [source], |r| r.get(0)).optional().map_err(|e| e.to_string()) }
#[tauri::command]
fn cache_put(app: tauri::AppHandle, source: String, translation: String) -> Result<(), String> { db(&app)?.execute("INSERT OR REPLACE INTO translations VALUES(?1,?2)", params![source,translation]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let conn = db(&app)?;
    let read = |key: &str| -> Result<String,String> { Ok(conn.query_row("SELECT value FROM settings WHERE key=?1", [key], |r| r.get(0)).optional().map_err(|e| e.to_string())?.unwrap_or_default()) };
    Ok(Settings { online: read("online")? == "true", api_key: read("api_key")? })
}
#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let conn = db(&app)?;
    for (key,value) in [("online",settings.online.to_string()),("api_key",settings.api_key)] { conn.execute("INSERT OR REPLACE INTO settings VALUES(?1,?2)", params![key,value]).map_err(|e| e.to_string())?; } Ok(())
}
#[tauri::command]
async fn translate_online(app: tauri::AppHandle, text: String) -> Result<String,String> {
    if text.trim().is_empty() || text.len() > 10000 { return Err("Texto inválido".into()); }
    let settings = get_settings(app)?;
    if !settings.online || settings.api_key.is_empty() { return Err("La traducción online está desactivada o falta la clave".into()); }
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let response = client.post("https://openrouter.ai/api/v1/chat/completions").bearer_auth(settings.api_key).json(&serde_json::json!({"model":"openrouter/free","messages":[{"role":"system","content":"Translate the user's English text into Spanish. Return only the translation."},{"role":"user","content":text}]})).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() { return Err(format!("OpenRouter: HTTP {}",response.status())); }
    let value: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    value["choices"][0]["message"]["content"].as_str().filter(|s| !s.trim().is_empty()).map(str::to_owned).ok_or_else(|| "Respuesta de OpenRouter sin traducción".into())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() { tauri::Builder::default().invoke_handler(tauri::generate_handler![list_documents,save_document,get_document,delete_document,add_word,list_words,cache_get,cache_put,get_settings,save_settings,translate_online]).run(tauri::generate_context!()).expect("error while running tauri application"); }
