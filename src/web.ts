import type { PadState } from "./input.ts";
import type { Track } from "./player.ts";
import type { Language } from "./strings.ts";
import sampleSaves from "./sample-saves.json" with { type: "json" };

const savesKey = "xbox-dashboard:saves";
const preferencesKey = "xbox-dashboard:preferences";

export function listWebSaves(): typeof sampleSaves {
  const stored = localStorage.getItem(savesKey);
  if (stored === null) return sampleSaves;
  const ids: unknown = JSON.parse(stored);
  if (!Array.isArray(ids) || !ids.every(id => sampleSaves.some(save => save.id === id))) {
    throw new Error("Invalid sample saves");
  }
  return sampleSaves.filter(save => ids.includes(save.id));
}

export function removeWebSave(id: string) {
  const saves = listWebSaves().filter(save => save.id !== id);
  localStorage.setItem(savesKey, JSON.stringify(saves.map(save => save.id)));
  return saves;
}

export type Preferences = {
  language: Language; hour24: boolean; volume: number;
  muted: boolean; fullscreen: boolean; reducedMotion: boolean;
};

export function readWebPreferences(defaults: Preferences): Preferences {
  const stored = localStorage.getItem(preferencesKey);
  if (stored === null) return defaults;
  const saved: Partial<Preferences> = JSON.parse(stored) ?? {};
  const { language, volume, hour24, muted, reducedMotion } = saved;
  return {
    fullscreen: false,
    language: language === "pt-BR" || language === "en" ? language : defaults.language,
    volume: typeof volume === "number" && volume >= 0 && volume <= 100 ? volume : defaults.volume,
    hour24: typeof hour24 === "boolean" ? hour24 : defaults.hour24,
    muted: typeof muted === "boolean" ? muted : defaults.muted,
    reducedMotion: typeof reducedMotion === "boolean" ? reducedMotion : defaults.reducedMotion,
  };
}

export function writeWebPreferences(preferences: Preferences) {
  // Browsers need a fresh user gesture to enter fullscreen.
  const { fullscreen, ...saved } = preferences;
  localStorage.setItem(preferencesKey, JSON.stringify(saved));
}

const library = new Map<number, { file: File; url: string }>();
let nextId = 0;

export function listWebTracks(): Track[] {
  return Array.from(library, ([id, { file }]) => ({ id, name: file.name, available: true }));
}

export function removeWebTrack(id: number) {
  const entry = library.get(id);
  if (entry) URL.revokeObjectURL(entry.url);
  library.delete(id);
  return listWebTracks();
}

export async function resolveWebTrack(id: number) {
  const entry = library.get(id);
  if (!entry) throw new Error("Track unavailable");
  return entry.url;
}

export async function pickWebTracks(replace?: number) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".mp3,.wav";
  picker.multiple = replace === undefined;
  picker.hidden = true;
  document.body.append(picker);
  let files: File[];
  try {
    files = await new Promise<File[]>(resolve => {
      picker.addEventListener("change", () => resolve(Array.from(picker.files ?? [])), { once: true });
      picker.addEventListener("cancel", () => resolve([]), { once: true });
      picker.showPicker();
    });
  } finally {
    picker.remove();
  }
  if (!files.length) return null;
  if (files.some(file => !/\.(mp3|wav)$/i.test(file.name) || !file.size)) throw "unavailable";
  if (replace !== undefined) {
    const old = library.get(replace);
    if (old) URL.revokeObjectURL(old.url);
  }
  for (const file of files) {
    library.set(replace ?? nextId++, { file, url: URL.createObjectURL(file) });
  }
  return listWebTracks();
}

export function readWebGamepad(activePort?: number): PadState | null {
  let pads: (Gamepad | null)[];
  try {
    pads = navigator.getGamepads?.() ?? [];
  } catch {
    return null;
  }
  const pad = pads.find(pad => pad && pad.index === activePort && pad.mapping === "standard")
    ?? pads.find(pad => pad?.mapping === "standard");
  if (!pad) return null;
  return {
    port: pad.index,
    dpad: [12, 13, 14, 15].map(index => Boolean(pad.buttons[index]?.pressed)),
    x: (pad.axes[0] ?? 0) * 32768,
    y: -(pad.axes[1] ?? 0) * 32768,
    confirm: Boolean(pad.buttons[0]?.pressed),
    back: Boolean(pad.buttons[1]?.pressed),
  };
}
