use serde::Serialize;
use std::{
    fs::{self, File},
    io::{self, Write},
    path::Path,
};

pub fn lock(directory: &Path, name: &str) -> io::Result<File> {
    fs::create_dir_all(directory)?;
    let file = File::options()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join(name))?;
    file.lock()?;
    Ok(file)
}

pub fn write(path: &Path, data: &(impl Serialize + ?Sized)) -> io::Result<()> {
    let mut file = tempfile::NamedTempFile::new_in(path.parent().unwrap())?;
    serde_json::to_writer(&mut file, data).map_err(io::Error::other)?;
    file.flush()?;
    file.as_file().sync_all()?;
    file.persist(path)?;
    Ok(())
}
