#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod controller;
mod saves;

use tauri::{Manager, State};

#[tauri::command]
fn list_saves(store: State<'_, saves::Store>) -> Result<Vec<saves::Save>, String> {
    store.list().map_err(report_storage_failure)
}

#[tauri::command]
fn remove_save(store: State<'_, saves::Store>, id: String) -> Result<Vec<saves::Save>, String> {
    store.remove(&id).map_err(report_storage_failure)
}

fn report_storage_failure(error: std::io::Error) -> String {
    eprintln!("Memory store: {error}");
    "The hard disk could not be updated. Your saves have not changed.".into()
}

fn main() {
    tauri::Builder::default()
        .manage(controller::WatchGeneration::default())
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            app.manage(saves::Store::new(directory));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_saves,
            remove_save,
            controller::watch_controller
        ])
        .run(tauri::generate_context!())
        .expect("could not start Xbox Dashboard");
}
