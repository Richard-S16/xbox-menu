use crate::storage;
use serde::{Deserialize, Serialize};
use std::{fs, io, path::PathBuf};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Save {
    id: String,
    title: String,
    name: String,
    blocks: u32,
}

pub struct Store {
    directory: PathBuf,
}

impl Store {
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    pub fn list(&self) -> io::Result<Vec<Save>> {
        let _guard = storage::lock(&self.directory, "memory.lock")?;
        self.load()
    }

    pub fn remove(&self, id: &str) -> io::Result<Vec<Save>> {
        let _guard = storage::lock(&self.directory, "memory.lock")?;
        let mut saves = self.load()?;
        // A retry after a successful removal returns the current list.
        if let Some(index) = saves.iter().position(|save| save.id == id) {
            saves.remove(index);
            self.write(&saves)?;
        }
        Ok(saves)
    }

    fn load(&self) -> io::Result<Vec<Save>> {
        match fs::read(self.directory.join("memory.json")) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(io::Error::other),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                let saves = [
                    ("rally", "Rally Championship", "Championship progress", 27),
                    ("orbit", "Orbital Strike", "Mission checkpoint", 16),
                    ("street", "Street Circuit", "Time trial records", 9),
                ]
                .map(|(id, title, name, blocks)| Save {
                    id: id.into(),
                    title: title.into(),
                    name: name.into(),
                    blocks,
                });
                self.write(&saves)?;
                Ok(saves.into())
            }
            Err(error) => Err(error),
        }
    }

    fn write(&self, saves: &[Save]) -> io::Result<()> {
        storage::write(&self.directory.join("memory.json"), saves)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn samples_seed_once_and_removal_survives_restart() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::new(directory.path().into());
        let initial = store.list().unwrap();
        assert_eq!(initial.len(), 3);
        assert_eq!(store.remove("not-an-id").unwrap(), initial);
        for save in initial {
            store.remove(&save.id).unwrap();
        }
        let reopened = Store::new(directory.path().into());
        assert!(reopened.list().unwrap().is_empty());
    }

    #[test]
    fn unreadable_store_is_not_replaced_with_samples() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("memory.json");
        fs::write(&path, b"invalid").unwrap();
        let store = Store::new(directory.path().into());
        assert!(store.remove("rally").is_err());
        assert_eq!(fs::read(path).unwrap(), b"invalid");
    }

    #[test]
    fn simultaneous_removals_do_not_restore_either_save() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::new(directory.path().into());
        std::thread::scope(|threads| {
            threads.spawn(|| Store::new(directory.path().into()).remove("rally").unwrap());
            threads.spawn(|| Store::new(directory.path().into()).remove("orbit").unwrap());
        });
        assert_eq!(store.list().unwrap()[0].id, "street");
        assert_eq!(store.list().unwrap().len(), 1);
    }
}
