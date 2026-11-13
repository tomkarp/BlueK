use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WebviewWindow};

const MAX_PROJECT_BYTES: u64 = 64 * 1024 * 1024;

fn trace_desktop(message: &str) {
    if std::env::var("BLUEK_DESKTOP_TRACE").as_deref() == Ok("1") {
        eprintln!("BlueK desktop: {message}");
    }
}

#[derive(Default)]
struct PendingProject(Mutex<HashMap<String, String>>);

#[derive(Default)]
struct DesktopReady(AtomicBool);

#[derive(Default)]
struct ExitRequestState {
    allow_window_close: AtomicBool,
    allow_app_exit: AtomicBool,
}

fn project_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !matches!(extension.to_ascii_lowercase().as_str(), "bluek" | "json") {
        return Err("Choose a .bluek project file.".into());
    }
    Ok(path)
}

#[tauri::command]
fn read_project(path: String) -> Result<String, String> {
    let path = project_path(&path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_PROJECT_BYTES {
        return Err("The project file is larger than 64 MB.".into());
    }
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    trace_desktop("project file read successfully");
    Ok(contents)
}

#[tauri::command]
fn write_project(path: String, contents: String) -> Result<(), String> {
    let path = project_path(&path)?;
    if path.extension().and_then(|value| value.to_str()) != Some("bluek") {
        return Err("BlueK desktop projects must use the .bluek extension.".into());
    }
    if contents.len() as u64 > MAX_PROJECT_BYTES {
        return Err("The project file is larger than 64 MB.".into());
    }
    let parent = path.parent().ok_or("The project path has no parent folder.")?;
    path.file_name().ok_or("The project path has no file name.")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    temporary.write_all(contents.as_bytes()).map_err(|error| error.to_string())?;
    temporary.as_file().sync_all().map_err(|error| error.to_string())?;
    temporary.persist(&path).map(|_| ()).map_err(|error| error.error.to_string())
}

#[tauri::command]
fn take_startup_project(
    window: WebviewWindow,
    state: tauri::State<'_, PendingProject>,
) -> Option<String> {
    let path = state.0.lock().ok()?.remove(window.label());
    if path.is_some() { trace_desktop("startup project consumed"); }
    path
}

#[tauri::command]
fn authorize_window_close_exit(state: tauri::State<'_, ExitRequestState>) {
    #[cfg(not(target_os = "macos"))]
    state.allow_window_close.store(true, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    let _ = state;
}

#[tauri::command]
fn exit_application(
    app: tauri::AppHandle,
    state: tauri::State<'_, ExitRequestState>,
) {
    state.allow_app_exit.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn incoming_project(args: &[String]) -> Option<String> {
    args.iter().skip(1).find_map(|argument| {
        let path = Path::new(argument);
        (path.extension().and_then(|value| value.to_str())
            .is_some_and(|extension| matches!(extension.to_ascii_lowercase().as_str(), "bluek" | "json"))
            && path.is_file())
        .then(|| path.to_string_lossy().into_owned())
    })
}

fn focused_window(app: &tauri::AppHandle) -> Option<WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"))
        .or_else(|| app.webview_windows().into_values().next())
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenProjectEvent {
    path: String,
    window_label: String,
}

// Window lifetime and application lifetime are separate on macOS. Reopening
// the app or a document after the last window closed creates a normal window.
fn ensure_window(app: &tauri::AppHandle) -> tauri::Result<WebviewWindow> {
    if let Some(window) = focused_window(app) {
        return Ok(window);
    }
    tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?.build()
}

fn dispatch_project(app: &tauri::AppHandle, path: String) {
    // macOS delivers Opened/Reopen before Tauri creates configured windows.
    // Never create one from those callbacks until setup has finished.
    if !app.state::<DesktopReady>().0.load(Ordering::SeqCst) {
        trace_desktop("file queued before app ready");
        if let Ok(mut pending) = app.state::<PendingProject>().0.lock() {
            pending.insert("main".to_string(), path);
        }
        return;
    }
    let existing = focused_window(app);
    let label = existing.as_ref().map(|window| window.label()).unwrap_or("main");
    if let Ok(mut pending) = app.state::<PendingProject>().0.lock() {
        pending.insert(label.to_string(), path.clone());
    }
    if let Some(window) = existing {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit_to(
            tauri::EventTarget::window(window.label()),
            "bluek://open-project",
            OpenProjectEvent { path, window_label: window.label().to_string() },
        );
    } else {
        // Queue before creating the webview; startup consumes the path even
        // when no frontend event listener exists yet.
        let _ = ensure_window(app);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .menu(|app| {
            #[cfg(target_os = "macos")]
            {
                Menu::with_items(
                    app,
                    &[
                        &Submenu::with_items(
                            app,
                            "BlueK",
                            true,
                            &[
                                &PredefinedMenuItem::about(app, None, None)?,
                                &PredefinedMenuItem::separator(app)?,
                                &PredefinedMenuItem::services(app, None)?,
                                &PredefinedMenuItem::separator(app)?,
                                &PredefinedMenuItem::hide(app, None)?,
                                &PredefinedMenuItem::hide_others(app, None)?,
                                &PredefinedMenuItem::separator(app)?,
                                &MenuItem::with_id(
                                    app,
                                    "bluek-quit",
                                    "Quit BlueK",
                                    true,
                                    Some("Cmd+Q"),
                                )?,
                            ],
                        )?,
                        &Submenu::with_items(
                            app,
                            "File",
                            true,
                            &[&MenuItem::with_id(
                                app,
                                "bluek-close-window",
                                "Close Window",
                                true,
                                Some("Cmd+W"),
                            )?],
                        )?,
                        &Submenu::with_items(
                            app,
                            "Edit",
                            true,
                            &[
                                &PredefinedMenuItem::undo(app, None)?,
                                &PredefinedMenuItem::redo(app, None)?,
                                &PredefinedMenuItem::separator(app)?,
                                &PredefinedMenuItem::cut(app, None)?,
                                &PredefinedMenuItem::copy(app, None)?,
                                &PredefinedMenuItem::paste(app, None)?,
                                &PredefinedMenuItem::select_all(app, None)?,
                            ],
                        )?,
                        &Submenu::with_items(
                            app,
                            "View",
                            true,
                            &[&PredefinedMenuItem::fullscreen(app, None)?],
                        )?,
                        &Submenu::with_items(
                            app,
                            "Window",
                            true,
                            &[
                                &PredefinedMenuItem::minimize(app, None)?,
                                &PredefinedMenuItem::maximize(app, None)?,
                                &PredefinedMenuItem::separator(app)?,
                            ],
                        )?,
                    ],
                )
            }
            #[cfg(not(target_os = "macos"))]
            {
                Menu::default(app)
            }
        })
        .on_menu_event(|app, event| {
            if event.id() == "bluek-close-window" {
                if let Some(window) = focused_window(app) {
                    let _ = window.close();
                }
            } else if event.id() == "bluek-quit" {
                if let Some(window) = focused_window(app) {
                    let _ = app.emit_to(
                        tauri::EventTarget::window(window.label()),
                        "bluek://exit-requested",
                        window.label(),
                    );
                } else {
                    app.exit(0);
                }
            }
        })
        .manage(PendingProject(Mutex::new(
            incoming_project(&std::env::args().collect::<Vec<_>>())
                .map(|path| HashMap::from([("main".to_string(), path)]))
                .unwrap_or_default(),
        )))
        .manage(ExitRequestState::default())
        .manage(DesktopReady::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = incoming_project(&args) {
                dispatch_project(app, path);
            } else if app.state::<DesktopReady>().0.load(Ordering::SeqCst) {
                if let Ok(window) = ensure_window(app) {
                let _ = window.show();
                let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_project,
            write_project,
            take_startup_project,
            authorize_window_close_exit,
            exit_application
        ])
        .build(tauri::generate_context!())
        .expect("error while building BlueK");
    app.run(|handle, event| match event {
        tauri::RunEvent::Ready => {
            trace_desktop("app ready");
            handle.state::<DesktopReady>().0.store(true, Ordering::SeqCst);
            // Keep the entries until the frontend consumes them. This event
            // also covers a webview whose listener started before Ready.
            let pending = handle.state::<PendingProject>().0.lock()
                .map(|entries| entries.clone()).unwrap_or_default();
            for (label, path) in pending {
                let _ = handle.emit_to(
                    tauri::EventTarget::window(&label),
                    "bluek://open-project",
                    OpenProjectEvent { path, window_label: label },
                );
            }
        }
        tauri::RunEvent::ExitRequested { api, .. } => {
            let state = handle.state::<ExitRequestState>();
            if state.allow_app_exit.swap(false, Ordering::SeqCst)
                || state.allow_window_close.swap(false, Ordering::SeqCst)
            {
                return;
            }
            if let Some(window) = focused_window(handle) {
                api.prevent_exit();
                let _ = handle.emit_to(
                    tauri::EventTarget::window(window.label()),
                    "bluek://exit-requested",
                    window.label(),
                );
            }
        }
        event => {
            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::Opened { urls } => {
                    for url in urls {
                        if let Ok(path) = url.to_file_path() {
                            dispatch_project(handle, path.to_string_lossy().into_owned());
                        }
                    }
                }
                tauri::RunEvent::Reopen { .. } if handle.state::<DesktopReady>().0.load(Ordering::SeqCst) => {
                    if let Ok(window) = ensure_window(handle) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (handle, event);
        }
    });
}
