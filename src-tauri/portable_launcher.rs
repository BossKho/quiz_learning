#![windows_subsystem = "windows"]

use std::env;
use std::fs;
use std::process::Command;

fn main() {
    let app_bytes = include_bytes!(r"D:\ECC\quiz_platform\src-tauri\target\release\app.exe");
    let dll_bytes = include_bytes!(r"D:\ECC\quiz_platform\src-tauri\target\release\WebView2Loader.dll");

    let local_app_data = env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| env::temp_dir().to_string_lossy().to_string());
    let bin_dir = std::path::PathBuf::from(local_app_data)
        .join("QuizLearningPro")
        .join("bin");

    if fs::create_dir_all(&bin_dir).is_err() {
        return;
    }

    let exe_path = bin_dir.join("QuizLearningCore.exe");
    let dll_path = bin_dir.join("WebView2Loader.dll");

    let need_write_exe = match fs::metadata(&exe_path) {
        Ok(meta) => meta.len() != app_bytes.len() as u64,
        Err(_) => true,
    };
    if need_write_exe {
        let _ = fs::write(&exe_path, app_bytes);
    }

    let need_write_dll = match fs::metadata(&dll_path) {
        Ok(meta) => meta.len() != dll_bytes.len() as u64,
        Err(_) => true,
    };
    if need_write_dll {
        let _ = fs::write(&dll_path, dll_bytes);
    }

    let args: Vec<String> = env::args().skip(1).collect();
    let _ = Command::new(&exe_path)
        .args(&args)
        .current_dir(&bin_dir)
        .spawn();
}
