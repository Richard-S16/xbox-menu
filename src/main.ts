import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Input, type Action, type Direction, type PadState } from "./input.ts";
import { nextFocus } from "./navigation.ts";
import { Player, type Track } from "./player.ts";
import { playIntro } from "./startup.ts";
import { text, type Language, type Text } from "./strings.ts";
import "./style.css";

type Save = { id: string; title: string; name: string; blocks: number };
type Setting = "clock" | "language" | "audio" | "video" | "system";
type Preferences = {
  language: Language; hour24: boolean; volume: number;
  muted: boolean; fullscreen: boolean; reducedMotion: boolean;
};
type Frame = { focus: string; scroll?: number } & (
  { route: "home" | "device" | "saves" | "collection" | "live" | "settings" | Setting }
  | { route: "actions" | "confirm"; save: Save }
  | { route: "player"; track?: number }
  | { route: "track-actions" | "track-confirm"; track: number }
);
type Row = {
  id: string; label: string; note?: string; run?: () => void;
  group?: "transport"; pressed?: boolean; track?: number; playing?: boolean;
  icon?: keyof typeof transportPaths;
};

const dashboard = document.querySelector<HTMLElement>("#dashboard")!;
const scene = document.querySelector<HTMLElement>("#scene")!;
const status = document.querySelector<HTMLElement>("#status")!;
const startup = document.querySelector<HTMLElement>("#startup")!;
const intro = startup.querySelector("video")!;
const skipIntro = new AbortController();
const stack: Frame[] = [{ route: "home", focus: "music" }];
const current = () => stack.at(-1)!;
const input = new Input(act);
const native = isTauri();
const desktop = native ? getCurrentWindow() : undefined;
const systemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let preferences: Preferences = {
  language: "en", hour24: false, volume: 100, muted: false, fullscreen: false, reducedMotion: false,
};
const t = (key: Text, values?: Record<string, string | number>) => text(preferences.language, key, values);
let version = "";
let saves: Save[] = [];
let tracks: Track[] = [];
let musicReadFailed = false;
const failedTracks = new Set<number>();
let controls: { row: Row; button: HTMLButtonElement }[] = [];
let selectPrompt: HTMLButtonElement;
let backPrompt: HTMLButtonElement | undefined;
let busy = false;
let transition = false;
let loadFailed = false;
let detail: HTMLElement | undefined;
let clock: HTMLElement | undefined;
let clockFormat: Intl.DateTimeFormat;
let playback: HTMLOutputElement | undefined;
let playbackProgress: HTMLProgressElement | undefined;

const player = new Player(id => invoke<string>("resolve_track", { id }), playbackChanged, updatePlayback);

const reducedMotion = () => preferences.reducedMotion || systemMotion.matches;

function applyPreferences() {
  document.documentElement.lang = preferences.language;
  dashboard.setAttribute("aria-label", t("Xbox dashboard"));
  dashboard.toggleAttribute("data-reduced-motion", reducedMotion());
  clockFormat = new Intl.DateTimeFormat(preferences.language === "en" ? "en-US" : preferences.language, {
    hour: "numeric", minute: "2-digit", hourCycle: preferences.hour24 ? "h23" : "h12",
  });
  for (const [key, sound] of Object.entries(sounds)) {
    sound.volume = cueVolumes[key as keyof typeof cueVolumes] * preferences.volume / 100;
    sound.muted = preferences.muted;
  }
  player.setVolume(preferences.volume / 100, preferences.muted);
  intro.volume = preferences.volume / 100;
  intro.muted = preferences.muted;
  if (startup.isConnected && reducedMotion()) skipIntro.abort();
}

const cueVolumes = {
  up: .47, down: .47, move: .42, select: .58, back: .50,
  remove: .50, disk: .30, in: .42, out: .38, ambient: .22,
};
const sounds = Object.fromEntries(
  Object.entries(cueVolumes).map(([key, volume]) => {
    const sound = new Audio(`./assets/${key}.wav`);
    sound.volume = volume;
    sound.preload = key === "ambient" ? "none" : "auto";
    return [key, sound];
  }),
);
sounds.ambient.loop = true;

function play(cue: keyof typeof cueVolumes) {
  const audio = sounds[cue];
  if (cue !== "ambient") audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string,
) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function art(name: string) {
  const image = element("img", `art ${name}`);
  image.src = `./assets/${name}.webp`;
  image.alt = "";
  image.draggable = false;
  return image;
}

function prompt(label: string, glyph: "A" | "B", run: () => void) {
  const button = element("button", `prompt prompt-${glyph.toLowerCase()}`);
  button.type = "button";
  button.tabIndex = -1;
  const badge = element("span", "badge", glyph);
  badge.setAttribute("aria-hidden", "true");
  button.append(badge, element("span", "prompt-label", label));
  button.addEventListener("click", run);
  return button;
}

function syncFocus(restoreScroll = false) {
  const frame = current();
  const selected = controls.find(control => control.row.id === frame.focus);
  const canFocus = !scene.inert;
  if (!selected) {
    selectPrompt.hidden = true;
    if (canFocus) backPrompt?.focus({ preventScroll: true });
    return;
  }
  if (frame.route === "player" && selected.row.track !== undefined && frame.track !== selected.row.track) {
    frame.track = selected.row.track;
    for (const row of transportRows(frame)) {
      const control = controls.find(control => control.row.id === row.id);
      if (control) {
        control.row.run = row.run;
        if (row.run) control.button.removeAttribute("aria-disabled");
        else control.button.setAttribute("aria-disabled", "true");
      }
    }
  }
  for (const { button } of controls) {
    button.tabIndex = button === selected.button ? 0 : -1;
    button.classList.toggle("focused", button === selected.button);
  }
  selectPrompt.hidden = !selected.row.run;
  selectPrompt.querySelector(".prompt-label")!.textContent = selected.row.icon ? selected.row.label : t("Select");
  if (canFocus) {
    const button = selected.button;
    const list = button.parentElement!;
    button.focus({ preventScroll: true });
    if (selected.row.group === "transport") {
      const trackList = list.previousElementSibling as HTMLElement | null;
      if (restoreScroll && trackList) trackList.scrollTop = frame.scroll ?? 0;
    } else {
      if (restoreScroll) list.scrollTop = frame.scroll ?? 0;
      if (list.scrollHeight > list.clientHeight) {
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      frame.scroll = list.scrollTop;
    }
  }
  if (detail && frame.route === "saves") {
    const save = saves.find(save => save.id === frame.focus);
    detail.replaceChildren();
    detail.hidden = !save;
    if (save) {
      detail.append(element("strong", "", saveName(save)), element("span", "", t("{count} blocks", { count: save.blocks })));
    }
  }
}

function setStatus(message: string) {
  status.textContent = message;
  status.hidden = !message;
}

function saveName(save: Save) {
  switch (save.name) {
    case "Championship progress":
    case "Mission checkpoint":
    case "Time trial records":
      return t(save.name);
    default:
      return save.name;
  }
}

function updateClock() {
  if (clock) clock.textContent = clockFormat.format();
}

function updatePlayback() {
  if (playback) playback.textContent = `${t(player.state)} · ${player.elapsed}`;
  if (playbackProgress) playbackProgress.value = player.progress;
}

function playbackChanged() {
  const unavailable = player.state === "Unavailable";
  if (unavailable && player.id !== undefined) failedTracks.add(player.id);
  if (current().route !== "player" || transition || busy) return;
  render();
  if (unavailable) setStatus(t("Could not play this track. Locate the file or remove it from the soundtrack."));
}

function meter(label: Text, value: number) {
  const bar = element("progress", "signal-meter");
  bar.max = 1;
  bar.value = value;
  bar.setAttribute("aria-label", t(label));
  return bar;
}

const categoryNames = {
  clock: "Clock", language: "Language", audio: "Audio", video: "Video", system: "System Info",
} as const;

const windowMode = () => t(preferences.fullscreen ? "Fullscreen" : "Windowed");
const languageNames: Record<Language, string> = { en: "English", "pt-BR": "Português" };

function settingsRows(route: Setting, panel: HTMLElement): Row[] {
  const onOff = (value: boolean) => t(value ? "On" : "Off");
  switch (route) {
    case "clock":
      clock = element("p", "clock-readout");
      panel.append(clock);
      updateClock();
      return [
        { id: "12h", label: t("12-hour"), pressed: !preferences.hour24,
          run: () => void changePreferences({ hour24: false }) },
        { id: "24h", label: t("24-hour"), pressed: preferences.hour24,
          run: () => void changePreferences({ hour24: true }) },
      ];
    case "language":
      return [
        { id: "en", label: languageNames.en, pressed: preferences.language === "en",
          run: () => void changePreferences({ language: "en" }) },
        { id: "pt-BR", label: languageNames["pt-BR"], pressed: preferences.language === "pt-BR",
          run: () => void changePreferences({ language: "pt-BR" }) },
      ];
    case "audio": {
      const volume = element("div", "volume-readout");
      volume.append(element("span", "", t("Volume")), element("strong", "", `${preferences.volume}%`),
        meter("Volume", preferences.volume / 100));
      panel.append(volume);
      return [
        { id: "decrease", label: t("Decrease Volume"),
          run: preferences.volume > 0 ? () => void changePreferences({ volume: Math.max(0, preferences.volume - 10) }) : undefined },
        { id: "increase", label: t("Increase Volume"),
          run: preferences.volume < 100 ? () => void changePreferences({ volume: Math.min(100, preferences.volume + 10) }) : undefined },
        { id: "mute", label: t("Mute"), note: onOff(preferences.muted), pressed: preferences.muted,
          run: () => void changePreferences({ muted: !preferences.muted }) },
      ];
    }
    case "video":
      return [
        { id: "fullscreen", label: t("Window Mode"), note: windowMode(),
          run: toggleFullscreen },
        { id: "motion", label: t("Reduced Motion"), note: onOff(preferences.reducedMotion),
          pressed: preferences.reducedMotion,
          run: () => void changePreferences({ reducedMotion: !preferences.reducedMotion }) },
      ];
    case "system": {
      const info = element("dl", "system-info");
      info.append(
        element("dt", "", t("App Version")), element("dd", "", version || "—"),
        element("dt", "", t("Retail Reference")), element("dd", "", `${t("Original Xbox dashboard")} · 5960`),
      );
      panel.append(info);
      return [];
    }
  }
}

const available = (track: Track) => track.available && !failedTracks.has(track.id);
const trackRowId = (id: number) => `track-${id}`;
const countTracks = () => t(tracks.length === 1 ? "{count} track" : "{count} tracks", { count: tracks.length });
const isModal = (route: Frame["route"]) => route === "confirm" || route === "track-confirm";

const transportPaths = {
  previous: "M3 5h2v14H3z M19 5L7 12l12 7z",
  play: "M7 4l13 8-13 8z",
  pause: "M6 5h4v14H6z M14 5h4v14h-4z",
  stop: "M5 5h14v14H5z",
  next: "M19 5h2v14h-2z M5 5l12 7-12 7z",
};

function transportIcon(icon: keyof typeof transportPaths) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const path = document.createElementNS(namespace, "path");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "transport-icon");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", transportPaths[icon]);
  svg.append(path);
  return svg;
}

function transportRows(frame: Extract<Frame, { route: "player" }>): Row[] {
  const selected = tracks.find(track => track.id === frame.track) ?? tracks[0];
  if (!selected) return [];
  const active = tracks.find(track => track.id === player.id) ?? selected;
  const loading = player.state === "Loading track…";
  const playing = player.state === "Playing";
  const index = tracks.indexOf(active);
  const previous = tracks.slice(0, index).reverse().find(available);
  const next = tracks.slice(index + 1).find(available);
  const transport = (id: string, label: Text, icon?: Row["icon"], run?: () => void): Row =>
    ({ id, label: t(label), group: "transport", icon, run });
  const jump = (track: Track) => {
    frame.track = track.id;
    void player.play(track.id);
  };
  const togglePlayback = () => {
    if (playing) player.pause();
    else if (available(active)) void player.play(active.id);
    else openTrack(active.id);
  };
  return [
    transport("previous", "Previous", "previous", previous && (() => jump(previous))),
    transport("play", playing ? "Pause" : "Play", playing ? "pause" : "play", loading ? undefined : togglePlayback),
    transport("stop", "Stop", "stop", player.id !== undefined ? () => player.stop() : undefined),
    transport("next", "Next", "next", next && (() => jump(next))),
    transport("options", "Track Options", undefined, () => openTrack(selected.id)),
  ];
}

function playerRows(frame: Extract<Frame, { route: "player" }>): Row[] {
  if (!tracks.length) return [{ id: "empty", label: t("Back"), run: back }];
  return [
    ...tracks.map((track): Row => ({
      id: trackRowId(track.id),
      track: track.id,
      label: track.name,
      note: available(track) ? undefined : t("Unavailable"),
      playing: track.id === player.id && player.state !== "Unavailable",
      run: () => available(track) ? void player.play(track.id) : openTrack(track.id),
    })),
    ...transportRows(frame),
  ];
}

function render() {
  const frame = current();
  const view = element("section", `view view-${frame.route}`);
  const panel = element("div", "controls");
  const list = element("div", "rows");
  const transport = element("div", "transport");
  transport.setAttribute("role", "group");
  transport.setAttribute("aria-label", t("Playback Controls"));
  let rows: Row[];
  detail = undefined;
  clock = undefined;
  playback = undefined;
  playbackProgress = undefined;
  setStatus("");

  switch (frame.route) {
    case "home":
      view.setAttribute("aria-label", t("Home"));
      view.append(art("home-orb"));
      rows = [
        { id: "memory", label: t("Memory"), run: () => enter({ route: "device", focus: "disk" }) },
        { id: "music", label: t("Music"), run: () => void openCollection() },
        { id: "live", label: "Xbox Live", run: () => enter({ route: "live", focus: "" }) },
        { id: "settings", label: t("Settings"), run: () => enter({ route: "settings", focus: "clock" }) },
      ];
      break;
    case "device":
      view.setAttribute("aria-label", t("Memory device selector"));
      view.append(art("disk-orb"));
      rows = [{
        id: "disk", label: t("Xbox Hard Disk"),
        note: t("Sample saves"), run: () => void openDisk(),
      }];
      break;
    case "saves":
      view.append(art("disk-orb"));
      panel.append(element("h1", "plate-heading", t("Saved Games")));
      detail = element("div", "save-detail");
      view.append(detail);
      rows = saves.map(save => ({
        id: save.id, label: save.title, note: t("{count} blocks", { count: save.blocks }),
        run: () => enter({ route: "actions", focus: "remove", save }),
      }));
      if (loadFailed) {
        rows = [{ id: "retry", label: t("Try again"), run: () => void openDisk(true) }];
        panel.append(element("p", "panel-copy", t("The hard disk could not be read.")));
      } else if (!rows.length) {
        panel.append(element("p", "panel-copy", t("There are no saved games on this hard disk.")));
        rows = [{ id: "empty", label: t("Back"), run: back }];
      }
      break;
    case "actions": {
      const { save } = frame;
      view.append(art("disk-orb"));
      panel.append(element("h1", "plate-heading", save.title),
        element("p", "panel-copy", saveName(save)));
      rows = [
        { id: "remove", label: t("Remove save"), run: () => enter({ route: "confirm", focus: "cancel", save }) },
        { id: "cancel", label: t("Cancel"), run: back },
      ];
      break;
    }
    case "confirm": {
      const { save } = frame;
      view.append(art("disk-orb"));
      confirmation(view, panel, t("Remove saved game?"), t("“{name}” will be permanently removed.", { name: saveName(save) }));
      rows = [
        { id: "cancel", label: t("Cancel"), run: back },
        { id: "confirm", label: t("Remove"), run: () => void remove(save.id) },
      ];
      break;
    }
    case "collection":
      view.append(art("music-orb"));
      panel.append(element("h1", "plate-heading", t("Music Collection")));
      if (musicReadFailed) {
        panel.append(element("p", "panel-copy", t("Could not read the soundtrack.")));
        rows = [{ id: "retry", label: t("Try again"), run: () => void openCollection(true) }];
      } else {
        rows = [{ id: "add", label: t("Add Tracks"), run: () => void pickTracks() }];
        if (tracks.length) {
          rows.unshift({
            id: "soundtrack", label: t("Soundtrack"), note: countTracks(),
            run: () => void openPlayer(),
          });
        } else {
          panel.append(element("p", "panel-copy", t("No tracks yet. Add MP3 or WAV files to start your soundtrack.")));
        }
      }
      break;
    case "player": {
      view.append(art("music-orb"));
      const header = element("header", "player-heading");
      header.append(element("h1", "plate-heading", t("Soundtrack")), element("p", "track-count", countTracks()));
      panel.append(header);
      const readout = element("div", "playback-readout");
      playback = element("output", "");
      playback.setAttribute("aria-live", "off");
      playbackProgress = meter("Playback progress", 0);
      readout.append(playback, playbackProgress);
      view.append(readout);
      updatePlayback();
      rows = playerRows(frame);
      break;
    }
    case "track-actions": {
      const track = tracks.find(track => track.id === frame.track)!;
      view.append(art("music-orb"));
      panel.append(element("h1", "plate-heading", t("Track Options")), trackName(track));
      rows = [
        { id: "remove", label: t("Remove Track"),
          run: () => enter({ route: "track-confirm", focus: "cancel", track: track.id }) },
        { id: "cancel", label: t("Cancel"), run: back },
      ];
      if (!available(track)) {
        panel.append(element("p", "track-count", t("Unavailable")));
        rows.unshift({ id: "locate", label: t("Locate File"), run: () => void pickTracks(track.id) });
      }
      break;
    }
    case "track-confirm": {
      const track = tracks.find(track => track.id === frame.track)!;
      view.append(art("music-orb"));
      const name = trackName(track);
      name.id = "remove-track-name";
      confirmation(view, panel, t("Remove track?"), t("The original file will stay on your PC."), name);
      view.setAttribute("aria-describedby", "remove-track-name remove-copy");
      rows = [
        { id: "cancel", label: t("Cancel"), run: back },
        { id: "confirm", label: t("Remove"), run: () => void removeTrack(track.id) },
      ];
      break;
    }
    case "live": {
      const heading = element("h1", "live-heading", "Xbox Live");
      heading.append(art("live-mark"));
      panel.append(heading, element("h2", "plate-heading", t("Offline")),
        element("p", "panel-copy", t("This dashboard does not connect to Xbox Live.")));
      rows = [];
      break;
    }
    case "settings": {
      view.append(art("clock-orb"));
      panel.append(element("h1", "plate-heading", t("Settings")));
      const notes: Partial<Record<Setting, string>> = {
        language: languageNames[preferences.language],
        audio: preferences.muted ? t("Muted") : `${preferences.volume}%`,
        video: windowMode(),
      };
      rows = (Object.keys(categoryNames) as Setting[]).map(route => ({
        id: route, label: t(categoryNames[route]), note: notes[route],
        run: () => enter({ route, focus: route === "clock" ? (preferences.hour24 ? "24h" : "12h")
          : route === "language" ? preferences.language : "" }),
      }));
      clock = element("p", "clock-readout settings-clock");
      view.append(clock);
      updateClock();
      break;
    }
    case "clock":
    case "language":
    case "audio":
    case "video":
    case "system":
      view.append(art("clock-orb"));
      panel.append(element("h1", "plate-heading", t(categoryNames[frame.route])));
      rows = settingsRows(frame.route, panel);
      break;
  }

  if (rows.length && !rows.some(row => row.id === frame.focus)) frame.focus = rows[0].id;
  controls = rows.map(row => {
    const button = element("button", "blade");
    button.type = "button";
    if (!row.run) button.setAttribute("aria-disabled", "true");
    if (frame.route === "home") button.append(art("pod"));
    if (row.icon) {
      button.setAttribute("aria-label", row.label);
      button.title = row.label;
      button.append(transportIcon(row.icon));
    } else {
      const label = element("span", row.track === undefined ? "blade-label" : "blade-label track-title", row.label);
      if (frame.route === "home" && (preferences.language === "en" || row.id === "live")) label.dataset.glyph = row.id;
      if (row.track !== undefined) label.title = row.label;
      button.append(label);
    }
    if (row.note) button.append(element("span", "blade-note", row.note));
    if (row.pressed !== undefined) button.setAttribute("aria-pressed", String(row.pressed));
    if (row.playing) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => {
      if (busy || transition) return;
      frame.focus = row.id;
      syncFocus();
      act("confirm");
    });
    button.addEventListener("focus", () => {
      if (frame === current() && frame.focus !== row.id && !busy && !transition) {
        frame.focus = row.id;
        syncFocus();
      }
    });
    return { row, button };
  });
  for (const { row, button } of controls) (row.group === "transport" ? transport : list).append(button);
  if (list.childElementCount) panel.append(list);
  if (transport.childElementCount) panel.append(transport);
  view.append(panel);
  const prompts = element("div", "prompts");
  backPrompt = frame.route === "home" ? undefined : prompt(t("Back"), "B", () => act("back"));
  if (backPrompt) {
    if (!rows.length) backPrompt.tabIndex = 0;
    prompts.append(backPrompt);
  }
  selectPrompt = prompt(t("Select"), "A", () => act("confirm"));
  prompts.append(selectPrompt);
  view.append(prompts);
  (isModal(frame.route) ? panel : view).append(status);
  scene.replaceChildren(view);
  syncFocus(true);
}

function trackName(track: Track) {
  const name = element("p", "panel-copy track-title", track.name);
  name.title = track.name;
  return name;
}

function confirmation(view: HTMLElement, panel: HTMLElement, title: string, message: string, name?: HTMLElement) {
  view.classList.add("view-confirm");
  view.setAttribute("role", "alertdialog");
  view.setAttribute("aria-modal", "true");
  view.setAttribute("aria-labelledby", "remove-heading");
  view.setAttribute("aria-describedby", "remove-copy");
  const heading = element("h1", "plate-heading", title);
  heading.id = "remove-heading";
  const copy = element("p", "panel-copy", message);
  copy.id = "remove-copy";
  panel.append(heading);
  if (name) panel.append(name);
  panel.append(copy);
}

async function animateChange(change: () => void, returning = false, modal = false) {
  transition = true;
  scene.inert = true;
  input.block();
  const reduced = reducedMotion();
  const depth = !reduced && !modal;
  try {
    await scene.animate([
      { transform: "scale(1)", opacity: 1 },
      { transform: `scale(${depth ? (returning ? .65 : 1.55) : 1})`, opacity: 0 },
    ], { duration: reduced ? 60 : modal ? 85 : 250, easing: "cubic-bezier(.32,.72,0,1)" }).finished.catch(() => {});
    change();
    render();
    await scene.animate([
      { transform: `scale(${depth ? (returning ? 1.34 : .76) : 1})`, opacity: 0 },
      { transform: "scale(1)", opacity: 1 },
    ], { duration: reduced ? 70 : modal ? 125 : 400, easing: "cubic-bezier(.18,.72,.26,1)" }).finished.catch(() => {});
  } finally {
    transition = false;
    scene.inert = false;
    input.block();
    syncFocus(true);
  }
}

function enter(frame: Frame) {
  play("in");
  void animateChange(() => stack.push(frame), false, isModal(frame.route));
}

function back() {
  if (stack.length < 2) return;
  const route = current().route;
  play("out");
  void animateChange(() => stack.pop(), true, isModal(route));
  if (route === "player") player.stop();
}

async function openDisk(retry = false) {
  busy = true;
  setStatus(t("Reading the hard disk…"));
  try {
    saves = await invoke<Save[]>("list_saves");
    loadFailed = false;
  } catch {
    saves = [];
    loadFailed = true;
  } finally {
    busy = false;
  }
  if (retry) {
    render();
  } else {
    play("disk");
    enter({ route: "saves", focus: saves[0]?.id ?? "empty" });
  }
}

async function remove(id: string) {
  busy = true;
  setStatus(t("Removing the saved game…"));
  const index = saves.findIndex(save => save.id === id);
  try {
    saves = await invoke<Save[]>("remove_save", { id });
    play("remove");
    const list = stack[stack.length - 3];
    list.focus = saves[index]?.id ?? saves[index - 1]?.id ?? "empty";
    setStatus("");
    void animateChange(() => stack.splice(-2, 2), true);
  } catch {
    setStatus(t("Could not remove the save. Your saves have not changed."));
  } finally {
    busy = false;
  }
}

async function openCollection(retry = false) {
  busy = true;
  setStatus(t("Reading the soundtrack…"));
  try {
    tracks = native ? await invoke<Track[]>("list_tracks") : [];
    musicReadFailed = false;
  } catch {
    musicReadFailed = true;
  } finally {
    busy = false;
  }
  if (retry) render();
  else enter({ route: "collection", focus: tracks.length ? "soundtrack" : "add" });
}

async function openPlayer() {
  busy = true;
  try {
    tracks = await invoke<Track[]>("list_tracks");
    if (!tracks.length) {
      render();
      return;
    }
    enter({ route: "player", focus: trackRowId(tracks[0].id), track: tracks[0].id });
  } catch {
    setStatus(t("Could not read the soundtrack."));
  } finally {
    busy = false;
  }
}

async function refreshTrackAvailability() {
  busy = true;
  try {
    const currentTracks = await invoke<Track[]>("list_tracks");
    const active = currentTracks.find(track => track.id === player.id);
    if (player.id !== undefined && (!active || !available(active))) player.stop();
    tracks = currentTracks;
    render();
  } catch {
    setStatus(t("Could not read the soundtrack."));
  } finally {
    busy = false;
  }
}

async function pickTracks(replace?: number) {
  busy = true;
  input.block();
  try {
    const picked = await invoke<Track[] | null>("pick_tracks", {
      replace: replace ?? null, language: preferences.language,
    });
    if (!picked) return;
    const firstTracks = !tracks.length && picked.length > 0;
    tracks = picked;
    if (replace !== undefined) {
      failedTracks.delete(replace);
      if (player.id === replace) player.stop();
      back();
    } else {
      if (firstTracks) current().focus = "soundtrack";
      render();
    }
  } catch (error) {
    const message = error === "unavailable" ? "Choose a readable MP3 or WAV file on a local drive."
      : error === "duplicate" ? "That file is already in the soundtrack."
      : "Could not update the soundtrack. Try again.";
    setStatus(t(message));
  } finally {
    busy = false;
    input.block();
    if (!transition) syncFocus(true);
  }
}

function openTrack(id: number) {
  const track = tracks.find(track => track.id === id)!;
  enter({ route: "track-actions", track: id, focus: available(track) ? "remove" : "locate" });
}

async function removeTrack(id: number) {
  busy = true;
  const index = tracks.findIndex(track => track.id === id);
  try {
    tracks = await invoke<Track[]>("remove_track", { id });
    failedTracks.delete(id);
    if (player.id === id) player.stop();
    const frame = stack.at(-3)!;
    if (frame.route === "player") {
      frame.track = (tracks[index] ?? tracks[index - 1])?.id;
      frame.focus = frame.track === undefined ? "empty" : trackRowId(frame.track);
    }
    void animateChange(() => stack.splice(-2, 2), true, true);
  } catch {
    setStatus(t("Could not update the soundtrack. Try again."));
  } finally {
    busy = false;
  }
}

async function changePreferences(patch: Partial<Preferences>) {
  if (busy || transition) return;
  busy = true;
  let switched = false;
  try {
    if (patch.fullscreen !== undefined && desktop) {
      await desktop.setFullscreen(patch.fullscreen);
      switched = true;
    }
    preferences = native ? await invoke<Preferences>("patch_preferences", { patch }) : { ...preferences, ...patch };
    applyPreferences();
    render();
  } catch {
    if (switched) {
      await desktop?.setFullscreen(preferences.fullscreen).catch(() => {});
    }
    setStatus(t(patch.fullscreen !== undefined && !switched
      ? "Could not change the window mode." : "Could not save this setting. Try again."));
  } finally {
    busy = false;
  }
}

function toggleFullscreen() {
  void changePreferences({ fullscreen: !preferences.fullscreen });
}

function move(direction: Direction) {
  const frame = current();
  const rows = controls.map(({ row }) => row);
  const layout = frame.route === "player" ? "player" : isModal(frame.route) ? "confirmation" : "list";
  const track = frame.route === "player" && frame.track !== undefined ? trackRowId(frame.track) : undefined;
  const next = nextFocus(rows, frame.focus, direction, layout, track);
  if (!next) return;
  play(frame.route === "home" ? direction === "up" ? "up" : "down" : "move");
  frame.focus = next;
  syncFocus();
}

function act(action: Action) {
  if (!document.hasFocus()) return;
  if (startup.isConnected) {
    if (action === "confirm" || action === "back") skipIntro.abort();
    return;
  }
  if (transition || busy) return;
  if (sounds.ambient.paused) play("ambient");
  if (action === "confirm") {
    const row = controls.find(({ row }) => row.id === current().focus)?.row;
    if (row?.run) {
      play("select");
      row.run();
    } else if (!controls.length && backPrompt) {
      act("back");
    }
  } else if (action === "back") {
    if (stack.length > 1) {
      play("back");
      back();
    }
  } else {
    move(action);
  }
}

window.addEventListener("keydown", event => {
  if (event.code === "F11" && !event.altKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    if (!event.repeat && native && !startup.isConnected) toggleFullscreen();
    return;
  }
  if (event.code === "Tab" && isModal(current().route)) {
    event.preventDefault();
    if (!busy && !transition) move(current().focus === "cancel" ? "right" : "left");
    return;
  }
  if (!event.altKey && !event.metaKey && !event.ctrlKey &&
      input.keyboard(event.code, true, event.repeat)) {
    event.preventDefault();
    if (!event.repeat) input.tick(performance.now());
  }
});
window.addEventListener("keyup", event => {
  if (input.keyboard(event.code, false)) {
    event.preventDefault();
    input.tick(performance.now());
  }
});
window.addEventListener("blur", () => {
  input.blur();
  sounds.ambient.pause();
});
window.addEventListener("focus", () => {
  if (startup.isConnected) return;
  if (!transition) syncFocus(true);
  if (native && sounds.ambient.paused) play("ambient");
  if (native && !transition && !busy && current().route === "player") void refreshTrackAvailability();
});
document.addEventListener("mousedown", event => {
  // Keep middle-click from starting browser autoscroll in a dashboard list.
  if (event.button === 1) event.preventDefault();
});
document.addEventListener("pointerdown", () => {
  if (!startup.isConnected && sounds.ambient.paused) play("ambient");
}, { passive: true });

systemMotion.addEventListener("change", applyPreferences);
window.setInterval(updateClock, 1000);
let visibilityCheck = 0;
async function syncVisibility() {
  const check = ++visibilityCheck;
  const minimized = await desktop?.isMinimized().catch(() => false);
  if (check === visibilityCheck) {
    dashboard.toggleAttribute("data-hidden", document.hidden || Boolean(minimized));
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) dashboard.setAttribute("data-hidden", "");
  void syncVisibility();
});
if (desktop) {
  void Promise.all([
    desktop.onResized(syncVisibility),
    desktop.onFocusChanged(syncVisibility),
  ]).catch(error => console.error("Could not watch window visibility.", error));
}
void syncVisibility();

if (native) {
  const controller = new Channel<PadState | null>();
  controller.onmessage = pad => {
    if (document.hasFocus()) {
      input.controller(pad);
      input.tick(performance.now());
    } else {
      input.controller(null);
    }
  };
  void invoke("watch_controller", { onState: controller }).catch(error => {
    console.error("Controller input could not be initialized.", error);
  });
}
void startDashboard();

async function restoreDashboard() {
  if (!desktop) return "";
  try {
    const initial = await invoke<{ preferences: Preferences | null; version: string; saves: Save[] | null }>("bootstrap");
    version = initial.version;
    saves = initial.saves ?? [];
    if (!initial.preferences) return t("Could not read dashboard settings.");
    preferences = initial.preferences;
  } catch {
    return t("Could not read dashboard settings.");
  }
  if (preferences.fullscreen) {
    try {
      await desktop.setFullscreen(true);
    } catch {
      preferences.fullscreen = false;
      return t("Could not change the window mode.");
    }
  }
  return "";
}

async function startDashboard() {
  const message = await restoreDashboard();
  applyPreferences();
  render();
  setStatus(message);
  const homeArt = Promise.allSettled(Array.from(scene.querySelectorAll("img"), image => image.decode()));
  if (!skipIntro.signal.aborted) {
    const skipButton = prompt(t("Skip Intro"), "A", () => skipIntro.abort());
    skipButton.tabIndex = 0;
    skipButton.setAttribute("aria-keyshortcuts", "Enter Escape");
    const key = element("kbd", "startup-key", "Enter");
    key.setAttribute("aria-hidden", "true");
    skipButton.append(key);
    startup.querySelector("#startup-loading")?.remove();
    startup.append(skipButton);
    if (document.hasFocus()) skipButton.focus({ preventScroll: true });
  }
  const [skipped] = await Promise.all([playIntro(intro, skipIntro.signal), homeArt]);
  // Let the decoded Home scene paint behind the intro before taking it away.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (skipped && !reducedMotion()) {
    await startup.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 150, easing: "cubic-bezier(.23,1,.32,1)", fill: "forwards",
    }).finished.catch(() => {});
  }
  startup.remove();
  intro.removeAttribute("src");
  intro.load();
  input.block();
  scene.inert = false;
  syncFocus(true);
  if (native && document.hasFocus()) play("ambient");
}
function tick(now: number) {
  input.tick(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
