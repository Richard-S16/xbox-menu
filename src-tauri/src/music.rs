use crate::dashboard::{self, Language, Store, Track};
use http_range::HttpRange;
use serde::Serialize;
use std::{
    fs::{self, File},
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};
use tauri::{
    State, WebviewWindow,
    http::{Request, Response, header},
};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
pub struct TrackInfo {
    id: u32,
    name: String,
    available: bool,
}

fn describe(tracks: Vec<Track>) -> Vec<TrackInfo> {
    tracks
        .into_iter()
        .map(|track| TrackInfo {
            id: track.id,
            name: dashboard::track_name(&track.path),
            available: open_audio(&track.path).is_ok(),
        })
        .collect()
}

#[cfg(windows)]
fn local_path(path: &Path) -> bool {
    use std::path::{Component, Prefix};
    use windows_sys::Win32::Storage::FileSystem::GetDriveTypeW;

    let Some(Component::Prefix(prefix)) = path.components().next() else {
        return false;
    };
    let drive = match prefix.kind() {
        Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => drive,
        _ => return false,
    };
    let root = [u16::from(drive), b':' as u16, b'\\' as u16, 0];
    // DRIVE_REMOVABLE, DRIVE_FIXED, DRIVE_CDROM, DRIVE_RAMDISK.
    path.is_absolute() && matches!(unsafe { GetDriveTypeW(root.as_ptr()) }, 2 | 3 | 5 | 6)
}

#[cfg(not(windows))]
fn local_path(path: &Path) -> bool {
    path.is_absolute()
}

fn open_audio(path: &Path) -> io::Result<(File, &'static str, u64)> {
    let unavailable = || io::Error::from(io::ErrorKind::InvalidData);
    if !local_path(path) || fs::canonicalize(path)? != path {
        return Err(unavailable());
    }
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default();
    let mut file = File::open(path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(unavailable());
    }
    let mut magic = [0; 12];
    file.read_exact(&mut magic)?;
    let mime = if extension.eq_ignore_ascii_case("wav")
        && matches!(&magic[..4], b"RIFF" | b"RF64")
        && &magic[8..] == b"WAVE"
    {
        "audio/wav"
    } else if extension.eq_ignore_ascii_case("mp3")
        && (&magic[..3] == b"ID3" || (magic[0] == 0xff && magic[1] & 0xe0 == 0xe0))
    {
        "audio/mpeg"
    } else {
        return Err(unavailable());
    };
    Ok((file, mime, metadata.len()))
}

#[tauri::command]
pub async fn list_tracks(store: State<'_, Store>) -> Result<Vec<TrackInfo>, &'static str> {
    Ok(describe(
        store.read().map_err(dashboard::storage_error)?.tracks,
    ))
}

#[tauri::command]
pub async fn pick_tracks(
    window: WebviewWindow,
    store: State<'_, Store>,
    replace: Option<u32>,
    language: Language,
) -> Result<Option<Vec<TrackInfo>>, &'static str> {
    if let Some(id) = replace {
        store.find_track(id).map_err(|_| "unavailable")?;
    }
    let dialog = window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title(match (replace, language) {
            (Some(_), Language::PtBr) => "Localizar arquivo",
            (Some(_), Language::En) => "Locate File",
            (None, Language::PtBr) => "Adicionar faixas",
            (None, Language::En) => "Add Tracks",
        })
        .add_filter(
            match language {
                Language::PtBr => "Arquivos de áudio",
                Language::En => "Audio files",
            },
            &["mp3", "wav"],
        );
    let picked = if replace.is_some() {
        dialog.blocking_pick_file().map(|path| vec![path])
    } else {
        dialog.blocking_pick_files()
    };
    if let Err(error) = window.set_focus() {
        eprintln!("Could not restore dashboard focus after audio picker: {error}");
    }
    let Some(picked) = picked else {
        return Ok(None);
    };
    let paths = picked
        .into_iter()
        .map(|file| {
            let path = file.into_path().map_err(|_| "unavailable")?;
            if !local_path(&path) {
                return Err("unavailable");
            }
            let path = fs::canonicalize(path).map_err(|_| "unavailable")?;
            open_audio(&path).map_err(|_| "unavailable")?;
            Ok(path)
        })
        .collect::<Result<Vec<PathBuf>, &'static str>>()?;

    let data = store
        .update(|data| {
            for path in paths {
                if let Some(id) = replace {
                    data.replace_track(id, path)?;
                } else {
                    data.add_track(path)?;
                }
            }
            Ok(())
        })
        .map_err(|error| match error.kind() {
            io::ErrorKind::AlreadyExists => "duplicate",
            _ => dashboard::storage_error(error),
        })?;
    Ok(Some(describe(data.tracks)))
}

#[tauri::command]
pub fn remove_track(store: State<'_, Store>, id: u32) -> Result<Vec<TrackInfo>, &'static str> {
    let data = store
        .update(|data| {
            data.tracks.retain(|track| track.id != id);
            Ok(())
        })
        .map_err(dashboard::storage_error)?;
    Ok(describe(data.tracks))
}

#[tauri::command]
pub async fn resolve_track(store: State<'_, Store>, id: u32) -> Result<String, &'static str> {
    let path = store.find_track(id).map_err(|_| "unavailable")?;
    open_audio(&path).map_err(|_| "unavailable")?;
    let origin = if cfg!(windows) {
        "http://soundtrack.localhost"
    } else {
        "soundtrack://localhost"
    };
    Ok(format!("{origin}/{id}"))
}

pub fn serve(store: &Store, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let empty = |status| Response::builder().status(status).body(Vec::new()).unwrap();
    if request.method() != "GET" && request.method() != "HEAD" {
        return empty(405);
    }
    let Ok(id) = request.uri().path().trim_start_matches('/').parse::<u32>() else {
        return empty(404);
    };
    let Ok((mut file, mime, length)) = store.find_track(id).and_then(|path| open_audio(&path))
    else {
        return empty(404);
    };
    let mut response = Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::ACCEPT_RANGES, "bytes");
    let (start, count) = match request.headers().get(header::RANGE) {
        Some(value) => {
            let ranges = value
                .to_str()
                .ok()
                .and_then(|value| HttpRange::parse(value, length).ok());
            let Some([range]) = ranges
                .as_deref()
                .filter(|ranges| ranges.first().is_some_and(|range| range.length > 0))
            else {
                return response
                    .status(416)
                    .header(header::CONTENT_RANGE, format!("bytes */{length}"))
                    .body(Vec::new())
                    .unwrap();
            };
            let count = range.length.min(2 * 1024 * 1024);
            response = response.status(206).header(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{length}", range.start, range.start + count - 1),
            );
            (range.start, count)
        }
        None => (0, length),
    };
    let mut bytes = Vec::new();
    if request.method() == "GET" {
        // shortcut: large files need byte ranges in the WebView, add streaming if another client needs whole-file GETs.
        if count > 128 * 1024 * 1024 {
            return empty(413);
        }
        if file.seek(SeekFrom::Start(start)).is_err()
            || file.take(count).read_to_end(&mut bytes).is_err()
            || bytes.len() as u64 != count
        {
            return empty(404);
        }
    }
    response
        .header(header::CONTENT_LENGTH, count)
        .body(bytes)
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_selected_tracks_are_served_and_removal_preserves_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("selected.wav");
        let data = b"RIFF\x04\x00\x00\x00WAVE";
        fs::write(&path, data).unwrap();
        let store = Store::new(directory.path().into());
        let request = |path: &str| {
            Request::builder()
                .uri(path)
                .header("Range", "bytes=0-3")
                .body(Vec::new())
                .unwrap()
        };

        assert_eq!(serve(&store, request("/0")).status(), 404);
        store
            .update(|data| data.add_track(fs::canonicalize(&path)?))
            .unwrap();
        let reopened = Store::new(directory.path().into());
        let response = serve(&reopened, request("/0"));
        assert_eq!(response.status(), 206);
        assert_eq!(response.headers()[header::CONTENT_RANGE], "bytes 0-3/12");
        assert_eq!(response.body(), b"RIFF");
        assert_eq!(serve(&reopened, request("/1")).status(), 404);
        assert_eq!(serve(&reopened, request("/selected.wav")).status(), 404);

        let moved = directory.path().join("renamed.wav");
        fs::rename(&path, &moved).unwrap();
        assert!(!describe(reopened.read().unwrap().tracks)[0].available);
        assert_eq!(serve(&reopened, request("/0")).status(), 404);
        reopened
            .update(|data| data.replace_track(0, fs::canonicalize(&moved)?))
            .unwrap();
        assert_eq!(serve(&reopened, request("/0")).status(), 206);
        reopened
            .update(|data| {
                data.tracks.retain(|track| track.id != 0);
                Ok(())
            })
            .unwrap();
        assert_eq!(serve(&reopened, request("/0")).status(), 404);
        assert_eq!(fs::read(moved).unwrap(), data);
    }
}
