use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::Manager;

#[cfg(not(target_os = "android"))]
use keyring::Entry;

#[derive(Serialize)]
struct Document { id: i64, name: String }
#[derive(Serialize)]
struct Word { id: i64, source: String, translation: String }

fn db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db = Connection::open(dir.join("traductor.sqlite3")).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY, name TEXT NOT NULL, data BLOB NOT NULL); CREATE TABLE IF NOT EXISTS vocabulary(id INTEGER PRIMARY KEY, source TEXT NOT NULL, translation TEXT NOT NULL); CREATE TABLE IF NOT EXISTS translations(source TEXT PRIMARY KEY, translation TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);").map_err(|e| e.to_string())?;
    Ok(db)
}

#[tauri::command]
fn save_api_key(app: tauri::AppHandle, value: String) -> Result<(), String> {
    let key = value.trim();
    if key.is_empty() { return clear_api_key(app); }
    #[cfg(target_os = "android")]
    {
        db(&app)?.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('api_key', ?1)", params![key]).map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let entry = Entry::new("traductor-pdf", "api_key").map_err(|e| e.to_string())?;
        entry.set_password(key).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn get_api_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        db(&app)?.query_row("SELECT value FROM settings WHERE key='api_key'", [], |r| r.get(0)).optional().map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let entry = Entry::new("traductor-pdf", "api_key").map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(err.to_string()),
        }
    }
}

#[tauri::command]
fn clear_api_key(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        db(&app)?.execute("DELETE FROM settings WHERE key='api_key'", []).map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let entry = Entry::new("traductor-pdf", "api_key").map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(_) => { entry.delete_password().map_err(|e| e.to_string())?; Ok(()) }
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(err.to_string()),
        }
    }
}

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
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() { tauri::Builder::default().invoke_handler(tauri::generate_handler![list_documents,save_document,get_document,delete_document,add_word,list_words,cache_get,cache_put,save_api_key,get_api_key,clear_api_key]).run(tauri::generate_context!()).expect("error while running tauri application"); }
