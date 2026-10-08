use std::io::{Read, Write};
use tauri::{Emitter, Manager};

#[tauri::command]
fn show_busy_popup(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(w) = app.get_webview_window("busy_popup") {
    let monitor = w.current_monitor().ok().flatten().or_else(|| w.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
      let pos = m.position();
      let size = m.size();
      let scale = m.scale_factor();
      // Popup width 460, height 560
      let popup_w = (460.0 * scale) as i32;
      let popup_h = (560.0 * scale) as i32;
      let margin_x = (20.0 * scale) as i32;
      let margin_bottom = (55.0 * scale) as i32; // stay above taskbar

      let x = pos.x + (size.width as i32) - popup_w - margin_x;
      let y = pos.y + (size.height as i32) - popup_h - margin_bottom;

      let _ = w.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: popup_w as u32, height: popup_h as u32 }));
      let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }
    let _ = w.set_always_on_top(true);
    let _ = w.show();
    let _ = w.set_focus();
  }
  Ok(())
}

#[tauri::command]
fn hide_busy_popup(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(w) = app.get_webview_window("busy_popup") {
    let _ = w.hide();
  }
  Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    std::process::Command::new("cmd")
      .args(["/c", "start", "", &url])
      .creation_flags(CREATE_NO_WINDOW)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(not(target_os = "windows"))]
  {
    std::process::Command::new("open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[derive(Clone, serde::Serialize)]
struct DownloadProgressPayload {
  downloaded: u64,
  total: u64,
  percent: f64,
}

#[derive(serde::Serialize)]
struct DownloadResult {
  installer_path: String,
  sha256: String,
  total_bytes: u64,
}

#[tauri::command]
async fn download_update_with_progress(
  app: tauri::AppHandle,
  url: String,
  expected_sha256: Option<String>,
) -> Result<DownloadResult, String> {
  let app_handle = app.clone();

  // Run downloading and checksumming on a dedicated worker thread
  tauri::async_runtime::spawn_blocking(move || {
    let temp_dir = std::env::temp_dir();
    let dest_path = temp_dir.join("QuizLearningPro_Update.exe");

    // Clean up previous stale download if exists
    if dest_path.exists() {
      let _ = std::fs::remove_file(&dest_path);
    }

    let response = ureq::get(&url)
      .timeout(std::time::Duration::from_secs(300))
      .call()
      .map_err(|e| format!("Lỗi kết nối tải bản cập nhật: {}", e))?;

    let total_bytes: u64 = response
      .header("content-length")
      .and_then(|s| s.parse::<u64>().ok())
      .unwrap_or(0);

    let mut reader = response.into_reader();
    let mut file = std::fs::File::create(&dest_path)
      .map_err(|e| format!("Không thể tạo tệp lưu tạm: {}", e))?;

    let mut hasher = sha2::Sha256::default();
    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 64 * 1024]; // 64KB buffer
    let mut last_emit_time = std::time::Instant::now();

    loop {
      let bytes_read = reader
        .read(&mut buffer)
        .map_err(|e| format!("Lỗi trong quá trình nhận luồng dữ liệu: {}", e))?;

      if bytes_read == 0 {
        break;
      }

      file
        .write_all(&buffer[..bytes_read])
        .map_err(|e| format!("Lỗi ghi dữ liệu xuống đĩa: {}", e))?;

      use sha2::Digest;
      hasher.update(&buffer[..bytes_read]);

      downloaded += bytes_read as u64;

      // Throttle UI progress events to at most once per 60ms to keep UI silky smooth
      let now = std::time::Instant::now();
      if now.duration_since(last_emit_time).as_millis() >= 60 || (total_bytes > 0 && downloaded >= total_bytes) {
        last_emit_time = now;
        let percent = if total_bytes > 0 {
          ((downloaded as f64 / total_bytes as f64) * 100.0).min(100.0)
        } else {
          0.0
        };

        let _ = app_handle.emit(
          "update-download-progress",
          DownloadProgressPayload {
            downloaded,
            total: total_bytes,
            percent,
          },
        );
      }
    }

    file.flush().map_err(|e| format!("Lỗi hoàn tất tệp: {}", e))?;
    drop(file);

    // Verify minimum file size (Setup exe must be at least 1MB)
    if downloaded < 1_000_000 {
      let _ = std::fs::remove_file(&dest_path);
      return Err(format!(
        "Dữ liệu tải về không đầy đủ (chỉ nhận được {} bytes). Đã hủy để bảo vệ an toàn.",
        downloaded
      ));
    }

    use sha2::Digest;
    let calculated_sha256 = hex::encode(hasher.finalize()).to_uppercase();

    // Verify SHA-256 Checksum if provided
    if let Some(ref expected) = expected_sha256 {
      let clean_expected = expected.trim().to_uppercase();
      if !clean_expected.is_empty() && clean_expected != calculated_sha256 {
        let _ = std::fs::remove_file(&dest_path);
        return Err(format!(
          "Lỗi bảo mật tính toàn vẹn: Mã SHA-256 không khớp!\nTính toán: {}\nKỳ vọng: {}\nTệp đã bị xóa để bảo vệ an toàn.",
          calculated_sha256, clean_expected
        ));
      }
    }

    Ok(DownloadResult {
      installer_path: dest_path.to_string_lossy().to_string(),
      sha256: calculated_sha256,
      total_bytes: downloaded,
    })
  })
  .await
  .map_err(|e| format!("Lỗi tác vụ nền: {}", e))?
}

#[tauri::command]
fn launch_updater_and_exit(
  app: tauri::AppHandle,
  installer_path: String,
) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

    let target_pid = std::process::id();
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let app_path_str = current_exe.to_string_lossy().to_string();

    let temp_dir = std::env::temp_dir();
    let helper_script_path = temp_dir.join("quiz_updater_helper.ps1");

    // Construct resilient helper script
    let script_content = r#"param(
  [int]$TargetPid,
  [string]$InstallerPath,
  [string]$AppPath
)

# 1. Cho tien trinh ung dung cu tat han & giai phong file locks
if ($TargetPid -gt 0) {
  Wait-Process -Id $TargetPid -Timeout 20 -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 1200

# 2. Xac dinh duong dan App chinh thuc tu Registry (neu da cai dat)
$launchTarget = $AppPath
try {
  $reg = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Quiz Learning Pro" -ErrorAction SilentlyContinue
  if ($reg -and $reg.InstallLocation) {
    $installedExe = Join-Path $reg.InstallLocation "app.exe"
    if (Test-Path $installedExe) {
      $launchTarget = $installedExe
    }
  }
} catch {}

# 3. Kich hoat NSIS Silent Installer
$proc = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait -PassThru -ErrorAction SilentlyContinue

# 4. Khoi chay lai ung dung moi (hoac phuc hoi neu co loi)
Start-Sleep -Milliseconds 1000
Start-Process -FilePath $launchTarget -ErrorAction SilentlyContinue

# 5. Don dep file installer tam thoi
Start-Sleep -Seconds 3
Remove-Item -Path $InstallerPath -Force -ErrorAction SilentlyContinue
"#;

    std::fs::write(&helper_script_path, script_content)
      .map_err(|e| format!("Không thể tạo script điều phối: {}", e))?;

    let helper_path_str = helper_script_path.to_string_lossy().to_string();

    // Spawn completely detached helper process
    std::process::Command::new("powershell")
      .args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        &helper_path_str,
        "-TargetPid",
        &target_pid.to_string(),
        "-InstallerPath",
        &installer_path,
        "-AppPath",
        &app_path_str,
      ])
      .creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP)
      .spawn()
      .map_err(|e| format!("Không thể kích hoạt tiến trình cập nhật: {}", e))?;

    // Exit old main app immediately to free all file locks
    let _ = app.exit(0);
    std::process::exit(0);
  }

  #[cfg(not(target_os = "windows"))]
  {
    Err("Tính năng tự động cập nhật hiện hỗ trợ môi trường Windows.".to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Prevent third-party overlay DLL injection crashes (MSI Afterburner/RTSS RTSSHooks64.dll, NVIDIA NvMemMapStoragex.dll)
  #[cfg(target_os = "windows")]
  {
    // Block legacy third-party extension hook DLLs from injecting into our process
    unsafe extern "system" {
      fn SetProcessMitigationPolicy(
        policy: i32,
        lp_buffer: *const std::ffi::c_void,
        dw_length: usize,
      ) -> i32;
    }
    unsafe {
      let policy: u32 = 1; // ProcessExtensionPointDisablePolicy: DisableExtensionPoints = 1
      SetProcessMitigationPolicy(2, &policy as *const u32 as *const std::ffi::c_void, 4);
    }

    if std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_err() {
      unsafe {
        std::env::set_var(
          "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
          "--disable-gpu --disable-features=RendererCodeIntegrity --disable-gpu-watchdog",
        );
      }
    }
  }

  let app = tauri::Builder::default()
    .runtime(tauri_runtime_wry::Wry::default())
    .invoke_handler(tauri::generate_handler![
      show_busy_popup,
      hide_busy_popup,
      open_url,
      download_update_with_progress,
      launch_updater_and_exit
    ])
    .on_window_event(|window, event| {
      match event {
        tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
          if window.label() == "main" {
            let handle = window.app_handle();
            let _ = handle.exit(0);
            #[cfg(target_os = "windows")]
            {
              std::process::exit(0);
            }
          }
        }
        _ => {}
      }
    })
    .setup(|_app| {
      Ok(())
    })
    .build(tauri::generate_context!());

  match app {
    Ok(app) => {
      app.run(|_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
          std::process::exit(0);
        }
      });
    }
    Err(e) => {
      eprintln!("Run error: {:?}", e);
    }
  }
}
