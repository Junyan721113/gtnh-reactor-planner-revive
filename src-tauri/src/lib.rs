use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Serialize, Deserialize)]
struct FileWriteResult {
    path: String,
    bytes: usize,
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(PathBuf::from(path)).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<FileWriteResult, String> {
    let path_buf = PathBuf::from(&path);
    if let Some(parent) = path_buf.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&path_buf, contents.as_bytes()).map_err(|error| error.to_string())?;
    Ok(FileWriteResult {
        path,
        bytes: contents.len(),
    })
}

#[tauri::command]
fn pick_save_path(
    title: String,
    default_filename: String,
    filter_name: String,
    file_extension: String,
) -> Option<String> {
    rfd::FileDialog::new()
        .set_title(&title)
        .set_file_name(&default_filename)
        .add_filter(&filter_name, &[file_extension.as_str()])
        .save_file()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_user_settings(path: String) -> Result<String, String> {
    match fs::read_to_string(PathBuf::from(path)) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok("{}".to_string()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_user_settings(path: String, contents: String) -> Result<FileWriteResult, String> {
    write_text_file(path, contents)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            pick_save_path,
            load_user_settings,
            save_user_settings
        ])
        .run(tauri::generate_context!())
        .expect("failed to run GTNH Reactor Planner");
}
