use crate::storage;
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, State};

pub struct Store(PathBuf);

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    En,
    #[serde(rename = "pt-BR", alias = "es")]
    PtBr,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    language: Language,
    hour24: bool,
    volume: u8,
    muted: bool,
    fullscreen: bool,
    reduced_motion: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            language: Language::En,
            hour24: false,
            volume: 100,
            muted: false,
            fullscreen: false,
            reduced_motion: false,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreferencePatch {
    language: Option<Language>,
    hour24: Option<bool>,
    volume: Option<u8>,
    muted: Option<bool>,
    fullscreen: Option<bool>,
    reduced_motion: Option<bool>,
}

#[derive(Deserialize, Serialize)]
pub struct Track {
    pub id: u32,
    pub path: PathBuf,
}

#[derive(Default, Deserialize, Serialize)]
pub struct Data {
    preferences: Preferences,
    pub tracks: Vec<Track>,
    pub next_id: u32,
}

impl Store {
    pub fn new(directory: PathBuf) -> Self {
        Self(directory)
    }

    pub fn read(&self) -> io::Result<Data> {
        match fs::read(self.0.join("dashboard.json")) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(io::Error::other),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Data::default()),
            Err(error) => Err(error),
        }
    }

    pub fn update(&self, change: impl FnOnce(&mut Data) -> io::Result<()>) -> io::Result<Data> {
        let _guard = storage::lock(&self.0, "dashboard.lock")?;
        let mut data = self.read()?;
        change(&mut data)?;
        storage::write(&self.0.join("dashboard.json"), &data)?;
        Ok(data)
    }

    pub fn find_track(&self, id: u32) -> io::Result<PathBuf> {
        self.read()?
            .tracks
            .into_iter()
            .find(|track| track.id == id)
            .map(|track| track.path)
            .ok_or_else(|| io::Error::from(io::ErrorKind::NotFound))
    }
}

pub fn storage_error(error: io::Error) -> &'static str {
    eprintln!("Dashboard store: {error}");
    "storage"
}

#[derive(Serialize)]
pub struct Bootstrap {
    preferences: Option<Preferences>,
    version: String,
    saves: Option<Vec<crate::saves::Save>>,
}

#[tauri::command]
pub fn bootstrap(
    app: AppHandle,
    store: State<'_, Store>,
    saves: State<'_, crate::saves::Store>,
) -> Bootstrap {
    Bootstrap {
        preferences: store
            .read()
            .map(|data| data.preferences)
            .map_err(storage_error)
            .ok(),
        version: app.package_info().version.to_string(),
        saves: saves.list().map_err(crate::report_storage_failure).ok(),
    }
}

#[tauri::command]
pub fn patch_preferences(
    store: State<'_, Store>,
    patch: PreferencePatch,
) -> Result<Preferences, &'static str> {
    if patch.volume.is_some_and(|volume| volume > 100) {
        return Err("volume");
    }
    store
        .update(|data| {
            let prefs = &mut data.preferences;
            prefs.language = patch.language.unwrap_or(prefs.language);
            prefs.hour24 = patch.hour24.unwrap_or(prefs.hour24);
            prefs.volume = patch.volume.unwrap_or(prefs.volume);
            prefs.muted = patch.muted.unwrap_or(prefs.muted);
            prefs.fullscreen = patch.fullscreen.unwrap_or(prefs.fullscreen);
            prefs.reduced_motion = patch.reduced_motion.unwrap_or(prefs.reduced_motion);
            Ok(())
        })
        .map(|data| data.preferences)
        .map_err(storage_error)
}

impl Data {
    pub fn add_track(&mut self, path: PathBuf) -> io::Result<()> {
        if !self.tracks.iter().any(|track| track.path == path) {
            let id = self.next_id;
            self.next_id = id
                .checked_add(1)
                .ok_or_else(|| io::Error::other("Track IDs exhausted"))?;
            self.tracks.push(Track { id, path });
        }
        Ok(())
    }

    pub fn replace_track(&mut self, id: u32, path: PathBuf) -> io::Result<()> {
        if self
            .tracks
            .iter()
            .any(|track| track.id != id && track.path == path)
        {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "Track is already in the soundtrack",
            ));
        }
        let track = self
            .tracks
            .iter_mut()
            .find(|track| track.id == id)
            .ok_or_else(|| io::Error::from(io::ErrorKind::NotFound))?;
        track.path = path;
        Ok(())
    }
}

pub fn track_name(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_spanish_preference_reopens_as_portuguese() {
        let mut saved = serde_json::to_value(Preferences::default()).unwrap();
        saved["language"] = "es".into();
        saved["volume"] = 50.into();

        let prefs: Preferences = serde_json::from_value(saved.clone()).unwrap();
        saved["language"] = "pt-BR".into();
        assert_eq!(serde_json::to_value(prefs).unwrap(), saved);
    }
}
