use serde::Serialize;
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    thread,
    time::Duration,
};
use tauri::{Manager, State, WebviewWindow, ipc::Channel};

#[derive(Default)]
pub struct WatchGeneration(Arc<AtomicUsize>);

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PadState {
    port: u32,
    dpad: [bool; 4],
    x: i16,
    y: i16,
    confirm: bool,
    back: bool,
}

#[tauri::command]
pub fn watch_controller(
    window: WebviewWindow,
    watcher: State<'_, WatchGeneration>,
    on_state: Channel<Option<PadState>>,
) {
    let app = window.app_handle().clone();
    let label = window.label().to_owned();
    let generation = Arc::clone(&watcher.0);
    let subscription = generation.fetch_add(1, Ordering::Relaxed) + 1;
    thread::spawn(move || {
        let mut previous = None;
        while generation.load(Ordering::Relaxed) == subscription {
            let Some(window) = app.get_webview_window(&label) else {
                break;
            };
            let state = if window.is_focused().unwrap_or(false) {
                read_controller(previous.map(|state: PadState| state.port))
            } else {
                None
            };
            if state != previous {
                if on_state.send(state).is_err() {
                    break;
                }
                previous = state;
            }
            thread::sleep(Duration::from_millis(8));
        }
    });
}

#[cfg(windows)]
fn read_controller(active_port: Option<u32>) -> Option<PadState> {
    use windows_sys::Win32::UI::Input::XboxController::*;
    let read = |port| {
        let mut state = XINPUT_STATE::default();
        // XInput writes one XINPUT_STATE to the supplied valid, exclusive pointer.
        if unsafe { XInputGetState(port, &mut state) } != 0 {
            return None;
        }
        let pad = state.Gamepad;
        let pressed = |mask| pad.wButtons & mask != 0;
        Some(PadState {
            port,
            dpad: [
                pressed(XINPUT_GAMEPAD_DPAD_UP),
                pressed(XINPUT_GAMEPAD_DPAD_DOWN),
                pressed(XINPUT_GAMEPAD_DPAD_LEFT),
                pressed(XINPUT_GAMEPAD_DPAD_RIGHT),
            ],
            x: pad.sThumbLX,
            y: pad.sThumbLY,
            confirm: pressed(XINPUT_GAMEPAD_A),
            back: pressed(XINPUT_GAMEPAD_B),
        })
    };
    active_port.and_then(read).or_else(|| {
        (0..4)
            .filter(|port| Some(*port) != active_port)
            .find_map(read)
    })
}

#[cfg(not(windows))]
fn read_controller(_: Option<u32>) -> Option<PadState> {
    None
}
