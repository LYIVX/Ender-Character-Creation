// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use tauri::Manager;

#[tauri::command]
fn launch_path(path: String) -> Result<(), String> {
  let target = Path::new(&path);
  if !target.exists() {
    return Err("File not found.".to_string());
  }
  std::process::Command::new(target)
    .spawn()
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn main() {
  let builder = tauri::Builder::default();
  let builder = if cfg!(debug_assertions) {
    builder
  } else {
    builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
  };
  builder
    .invoke_handler(tauri::generate_handler![launch_path])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
