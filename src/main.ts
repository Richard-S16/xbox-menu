import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { Input, type Action, type Direction, type PadState } from "./input.ts";
import "./style.css";

type Save = { id: string; title: string; name: string; blocks: number };
type Frame = { focus: string; scroll?: number } & (
  { route: "home" | "device" | "saves" } | { route: "actions" | "confirm"; save: Save }
);
type Row = { id: string; label: string; note?: string; run?: () => void };

const scene = document.querySelector<HTMLElement>("#scene")!;
const status = document.querySelector<HTMLElement>("#status")!;
const stack: Frame[] = [{ route: "home", focus: "music" }];
const current = () => stack.at(-1)!;
const input = new Input(act);
let saves: Save[] = [];
let controls: { row: Row; button: HTMLButtonElement }[] = [];
let selectPrompt: HTMLButtonElement;
let busy = false;
let transition = false;
let loadFailed = false;
let detail: HTMLElement | undefined;

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
  const selected = controls.find(control => control.row.id === frame.focus)!;
  for (const { button } of controls) {
    button.tabIndex = button === selected.button ? 0 : -1;
    button.classList.toggle("focused", button === selected.button);
  }
  selectPrompt.hidden = !selected.row.run;
  if (!transition) {
    const button = selected.button;
    const list = button.parentElement!;
    button.focus({ preventScroll: true });
    if (restoreScroll) list.scrollTop = frame.scroll ?? 0;
    if (list.scrollHeight > list.clientHeight) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    frame.scroll = list.scrollTop;
  }
  if (detail && frame.route === "saves") {
    const save = saves.find(save => save.id === frame.focus);
    detail.replaceChildren();
    detail.hidden = !save;
    if (save) {
      detail.append(element("strong", "", save.name), element("span", "", `${save.blocks} blocks`));
    }
  }
}

function setStatus(message: string) {
  status.textContent = message;
  status.hidden = !message;
}

function render() {
  const frame = current();
  const view = element("section", `view view-${frame.route}`);
  const panel = element("div", "controls");
  const list = element("div", "rows");
  let rows: Row[];
  detail = undefined;
  setStatus("");

  switch (frame.route) {
    case "home":
      view.setAttribute("aria-label", "Home");
      view.append(art("home-orb"));
      rows = [
        { id: "memory", label: "Memory", run: () => enter({ route: "device", focus: "disk" }) },
        { id: "music", label: "Music" },
        { id: "live", label: "Xbox Live" },
        { id: "settings", label: "Settings" },
      ];
      break;
    case "device":
      view.setAttribute("aria-label", "Memory device selector");
      view.append(art("disk-orb"));
      rows = [{
        id: "disk", label: "Xbox Hard Disk",
        note: "Sample saves", run: () => void openDisk(),
      }];
      break;
    case "saves":
      view.append(art("disk-orb"));
      panel.append(element("h1", "plate-heading", "Saved Games"));
      detail = element("div", "save-detail");
      view.append(detail);
      rows = saves.map(save => ({
        id: save.id, label: save.title, note: `${save.blocks} blocks`,
        run: () => enter({ route: "actions", focus: "remove", save }),
      }));
      if (loadFailed) {
        rows = [{ id: "retry", label: "Try again", run: () => void openDisk(true) }];
        panel.append(element("p", "panel-copy", "The hard disk could not be read."));
      } else if (!rows.length) {
        panel.append(element("p", "panel-copy", "There are no saved games on this hard disk."));
        rows = [{ id: "empty", label: "Back", run: back }];
      }
      break;
    case "actions": {
      const { save } = frame;
      view.append(art("disk-orb"));
      panel.append(element("h1", "plate-heading", save.title),
        element("p", "panel-copy", save.name));
      rows = [
        { id: "remove", label: "Remove save", run: () => enter({ route: "confirm", focus: "cancel", save }) },
        { id: "cancel", label: "Cancel", run: back },
      ];
      break;
    }
    case "confirm": {
      const { save } = frame;
      view.setAttribute("role", "alertdialog");
      view.setAttribute("aria-modal", "true");
      view.setAttribute("aria-labelledby", "remove-heading");
      view.setAttribute("aria-describedby", "remove-copy");
      view.append(art("disk-orb"));
      const heading = element("h1", "plate-heading", "Remove saved game?");
      heading.id = "remove-heading";
      const copy = element("p", "panel-copy", `“${save.name}” will be permanently removed.`);
      copy.id = "remove-copy";
      panel.append(heading, copy);
      rows = [
        { id: "cancel", label: "Cancel", run: back },
        { id: "confirm", label: "Remove", run: () => void remove(save.id) },
      ];
      break;
    }
  }

  if (!rows.some(row => row.id === frame.focus)) frame.focus = rows[0].id;
  controls = rows.map(row => {
    const button = element("button", "blade");
    button.type = "button";
    if (!row.run) button.setAttribute("aria-disabled", "true");
    if (frame.route === "home") button.append(art("pod"));
    const label = element("span", "blade-label", row.label);
    if (frame.route === "home") label.dataset.glyph = row.id;
    button.append(label);
    if (row.note) button.append(element("span", "blade-note", row.note));
    if (!row.run) button.append(element("span", "blade-note", "Unavailable"));
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
  list.append(...controls.map(({ button }) => button));
  panel.append(list);
  view.append(panel);
  const prompts = element("div", "prompts");
  if (frame.route !== "home") prompts.append(prompt("Back", "B", () => act("back")));
  selectPrompt = prompt("Select", "A", () => act("confirm"));
  prompts.append(selectPrompt);
  view.append(prompts);
  (frame.route === "confirm" ? panel : view).append(status);
  scene.replaceChildren(view);
  syncFocus(true);
}

async function animateChange(change: () => void, returning = false, modal = false) {
  transition = true;
  scene.inert = true;
  input.block();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  void animateChange(() => stack.push(frame), false, frame.route === "confirm");
}

function back() {
  if (stack.length < 2) return;
  play("out");
  void animateChange(() => stack.pop(), true, current().route === "confirm");
}

async function openDisk(retry = false) {
  busy = true;
  setStatus("Reading the hard disk…");
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
  setStatus("Removing the saved game…");
  const index = saves.findIndex(save => save.id === id);
  try {
    saves = await invoke<Save[]>("remove_save", { id });
    play("remove");
    const list = stack[stack.length - 3];
    list.focus = saves[index]?.id ?? saves[index - 1]?.id ?? "empty";
    setStatus("");
    void animateChange(() => stack.splice(-2, 2), true);
  } catch (error) {
    setStatus(typeof error === "string" ? error : "Could not remove the save. Try again.");
  } finally {
    busy = false;
  }
}

function move(direction: Direction) {
  const frame = current();
  const horizontal = frame.route === "confirm";
  if (horizontal !== (direction === "left" || direction === "right")) return;
  const step = direction === "up" || direction === "left" ? -1 : 1;
  const index = controls.findIndex(({ row }) => row.id === frame.focus);
  const next = controls[index + step]?.row;
  if (!next) return;
  play(frame.route === "home" ? direction === "up" ? "up" : "down" : "move");
  frame.focus = next.id;
  syncFocus();
}

function act(action: Action) {
  if (transition || busy || !document.hasFocus()) return;
  if (sounds.ambient.paused) play("ambient");
  if (action === "confirm") {
    const row = controls.find(({ row }) => row.id === current().focus)?.row;
    if (row?.run) {
      play("select");
      row.run();
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
  if (event.code === "Tab" && current().route === "confirm") {
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
  if (!transition) syncFocus(true);
});
document.addEventListener("mousedown", event => {
  // Keep middle-click from starting browser autoscroll in a dashboard list.
  if (event.button === 1) event.preventDefault();
});
document.addEventListener("pointerdown", () => {
  if (sounds.ambient.paused) play("ambient");
}, { passive: true });

render();
if (isTauri()) {
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
function tick(now: number) {
  input.tick(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
