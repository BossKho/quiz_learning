use tauri::Manager;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let res = tauri::Builder::default()
    .runtime(tauri_runtime_wry::Wry::default())
    .invoke_handler(tauri::generate_handler![show_busy_popup, hide_busy_popup])
    .setup(|_app| {
      Ok(())
    })
    .run(tauri::generate_context!());

  if let Err(e) = res {
    eprintln!("Run error: {:?}", e);
  }
}
