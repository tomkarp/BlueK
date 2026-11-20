use std::{
    sync::{atomic::{AtomicBool, Ordering}, Mutex},
    time::Duration,
};
use tauri::{async_runtime::{channel, Sender}, AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

#[derive(Default)]
pub struct DesktopUpdate {
    busy: AtomicBool,
    closing: AtomicBool,
    pending: Mutex<Option<(String, Sender<bool>)>>,
}

impl DesktopUpdate {
    pub fn closing(&self) -> bool {
        self.closing.load(Ordering::SeqCst)
    }

    pub fn window_closed(&self, label: &str) {
        self.resolve_close(label, true);
    }

    fn resolve_close(&self, label: &str, closed: bool) {
        let mut pending = self.pending.lock().unwrap();
        if pending.as_ref().is_some_and(|(expected, _)| expected == label) {
            if let Some((_, sender)) = pending.take() {
                let _ = sender.try_send(closed);
            }
        }
    }

    async fn close_windows(&self, app: &AppHandle) -> Result<bool, String> {
        self.closing.store(true, Ordering::SeqCst);
        while let Some(window) = super::focused_window(app) {
            let (sender, mut reply) = channel(1);
            *self.pending.lock().unwrap() = Some((window.label().into(), sender));
            if let Err(error) = window.close() {
                if app.get_webview_window(window.label()).is_none() {
                    continue;
                }
                return Err(error.to_string());
            }
            if reply.recv().await != Some(true) {
                return Ok(false);
            }
        }
        Ok(true)
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMessages {
    title: String,
    unavailable: String,
    current: String,
    confirm: String,
    failed: String,
}

#[tauri::command]
pub fn cancel_desktop_update_close(window: WebviewWindow, state: tauri::State<'_, DesktopUpdate>) {
    state.resolve_close(window.label(), false);
}

#[tauri::command]
pub async fn check_desktop_update(window: WebviewWindow, messages: UpdateMessages) {
    let app = window.app_handle();
    let state = app.state::<DesktopUpdate>();
    if state.busy.swap(true, Ordering::SeqCst) {
        return;
    }

    let result = run_update(app, &window, &state, &messages).await;
    *state.pending.lock().unwrap() = None;

    match result {
        Ok(true) => {
            app.state::<super::ExitRequestState>().allow_app_exit.store(true, Ordering::SeqCst);
            app.request_restart();
            return;
        }
        Ok(false) => {}
        Err(error) => {
            eprintln!("BlueK desktop update: {error}");
            let _ = super::ensure_window(app);
            app.dialog().message(messages.failed).title(messages.title)
                .kind(MessageDialogKind::Error).show(|_| {});
        }
    }
    state.closing.store(false, Ordering::SeqCst);
    state.busy.store(false, Ordering::SeqCst);
}

async fn run_update(
    app: &AppHandle,
    window: &WebviewWindow,
    state: &DesktopUpdate,
    messages: &UpdateMessages,
) -> Result<bool, String> {
    if app.config().plugins.0.get("updater").is_none() {
        app.dialog().message(&messages.unavailable).title(&messages.title).parent(window).show(|_| {});
        return Ok(false);
    }

    let updater = app.updater_builder().timeout(Duration::from_secs(20))
        .build().map_err(|error| error.to_string())?;
    let Some(mut update) = updater.check().await.map_err(|error| error.to_string())? else {
        app.dialog().message(&messages.current).title(&messages.title).parent(window).show(|_| {});
        return Ok(false);
    };
    let (sender, mut answer) = channel(1);
    app.dialog().message(messages.confirm.replace("{0}", &update.version))
        .title(&messages.title).parent(window).buttons(MessageDialogButtons::OkCancel)
        .show(move |accepted| { let _ = sender.try_send(accepted); });
    if answer.recv().await != Some(true) {
        return Ok(false);
    }

    update.timeout = Some(Duration::from_secs(180));
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|error| error.to_string())?;
    if !state.close_windows(app).await? {
        return Ok(false);
    }
    // On Windows the updater launches the installer and exits the process.
    update.install(bytes).map_err(|error| error.to_string())?;
    Ok(true)
}
