import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { Input, type Action, type Direction, type PadState } from "./input.ts";
import "./style.css";

type Save = { id: string; title: string; name: string; blocks: number };
type Route = "home" | "device" | "saves" | "actions" | "confirm";
type Frame = { route: Route; focus: string; scroll?: number; save?: Save };
type Row = { id: string; label: string; note?: string; disabled?: boolean; run?: () => void };

const dashboard = document.querySelector<HTMLElement>("#dashboard")!;
const scene = document.querySelector<HTMLElement>("#scene")!;
const status = document.querySelector<HTMLElement>("#status")!;
const stack: Frame[] = [{ route: "home", focus: "music" }];
const current = () => stack.at(-1)!;
const input = new Input(act);
let saves: Save[] = [];
let rows: Row[] = [];
let rowElements: HTMLButtonElement[] = [];
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
  rowElements.forEach((node, index) => {
    const selected = rows[index].id === frame.focus;
    node.tabIndex = selected ? 0 : -1;
    node.classList.toggle("focused", selected);
    if (selected && !transition) {
      node.focus({ preventScroll: true });
      const list = node.parentElement!;
      if (restoreScroll) list.scrollTop = frame.scroll ?? 0;
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
      frame.scroll = list.scrollTop;
    }
  });
  if (detail && frame.route === "saves") {
    const selected = saves.find(save => save.id === frame.focus);
    detail.replaceChildren();
    if (selected) {
      detail.append(element("strong", "", selected.title),
        element("span", "", selected.name), element("span", "", `${selected.blocks} blocks`));
    }
  }
  if (frame.route === "home" && rows.find(row => row.id === frame.focus)?.disabled) {
    setStatus("This section is unavailable in this build.");
  } else if (frame.route === "home") {
    setStatus("");
  }
}

function setStatus(message: string) {
  status.textContent = message;
  status.hidden = !message;
}

function render() {
  const frame = current();
  const view = element("section", `view view-${frame.route}`);
  const controls = element("div", "controls");
  const list = element("div", "rows");
  detail = undefined;
  rows = [];
  setStatus("");
  dashboard.dataset.route = frame.route;

  switch (frame.route) {
    case "home":
      view.setAttribute("aria-label", "Home");
      view.append(art("home-orb"));
      rows = [
        { id: "memory", label: "Memory", run: () => enter("device", "disk") },
        { id: "music", label: "Music", disabled: true },
        { id: "live", label: "Xbox Live", disabled: true },
        { id: "settings", label: "Settings", disabled: true },
      ];
      break;
    case "device":
      view.setAttribute("aria-label", "Memory device selector");
      view.append(art("disk-orb"));
      rows = [{
        id: "disk", label: "Xbox Hard Disk",
        note: "App storage · sample saves", run: () => void openDisk(),
      }];
      break;
    case "saves":
      view.append(art("disk-orb"));
      controls.append(element("h1", "plate-heading", "Xbox Hard Disk"));
      detail = element("div", "save-detail");
      view.append(detail);
      rows = saves.map(save => ({
        id: save.id, label: save.title, note: `${save.blocks} blocks`,
        run: () => enter("actions", "remove", save),
      }));
      if (loadFailed) {
        rows = [{ id: "retry", label: "Try again", run: () => void openDisk(true) }];
        controls.append(element("p", "empty-copy", "The hard disk could not be read."));
      } else if (!rows.length) {
        controls.append(element("p", "empty-copy", "There are no saved games on this hard disk."));
        rows = [{ id: "empty", label: "Back", run: back }];
      }
      break;
    case "actions":
      view.append(art("disk-orb"));
      controls.append(element("h1", "plate-heading", "Save actions"),
        element("p", "save-name", frame.save!.name));
      rows = [
        { id: "remove", label: "Remove save", run: () => enter("confirm", "cancel", frame.save) },
        { id: "cancel", label: "Cancel", run: back },
      ];
      break;
    case "confirm":
      view.setAttribute("role", "alertdialog");
      view.setAttribute("aria-modal", "true");
      view.setAttribute("aria-labelledby", "remove-heading");
      view.setAttribute("aria-describedby", "remove-copy");
      view.append(art("disk-orb"));
      const heading = element("h1", "plate-heading", "Remove saved game?");
      heading.id = "remove-heading";
      const copy = element("p", "save-name", `${frame.save!.name} will be permanently removed.`);
      copy.id = "remove-copy";
      controls.append(heading, copy);
      rows = [
        { id: "cancel", label: "Cancel", run: back },
        { id: "confirm", label: "Remove", run: () => void remove(frame.save!.id) },
      ];
      break;
  }

  if (!rows.some(row => row.id === frame.focus)) frame.focus = rows[0].id;
  rowElements = rows.map(row => {
    const button = element("button", "blade");
    button.type = "button";
    if (row.disabled) button.setAttribute("aria-disabled", "true");
    if (frame.route === "home") button.append(art("pod"));
    const label = element("span", "blade-label", row.label);
    if (frame.route === "home") label.dataset.glyph = row.id;
    button.append(label);
    if (row.note) button.append(element("span", "blade-note", row.note));
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
    return button;
  });
  list.append(...rowElements);
  controls.append(list);
  view.append(controls);
  const prompts = element("div", "prompts");
  if (frame.route !== "home") prompts.append(prompt("Back", "B", () => act("back")));
  prompts.append(prompt("Select", "A", () => act("confirm")));
  view.append(prompts);
  scene.replaceChildren(view);
  syncFocus(true);
}

async function animateChange(change: () => void, returning = false) {
  transition = true;
  scene.inert = true;
  input.block();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scale = returning ? .65 : 1.55;
  await scene.animate([
    { transform: "scale(1)", opacity: 1 },
    { transform: `scale(${reduced ? 1 : scale})`, opacity: 0 },
  ], { duration: reduced ? 60 : 250, easing: "cubic-bezier(.42,0,.7,1)" }).finished;
  change();
  render();
  await scene.animate([
    { transform: `scale(${reduced ? 1 : returning ? 1.34 : .76})`, opacity: 0 },
    { transform: "scale(1)", opacity: 1 },
  ], { duration: reduced ? 70 : 400, easing: "cubic-bezier(.18,.72,.26,1)" }).finished;
  transition = false;
  scene.inert = false;
  input.block();
  syncFocus(true);
}

function enter(route: Route, focus: string, save?: Save) {
  play("in");
  void animateChange(() => stack.push({ route, focus, save }));
}

function back() {
  if (stack.length < 2) return;
  play("out");
  void animateChange(() => stack.pop(), true);
}

async function openDisk(retry = false) {
  busy = true;
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
    enter("saves", saves[0]?.id ?? "empty");
  }
}

async function remove(id: string) {
  busy = true;
  setStatus("");
  const index = saves.findIndex(save => save.id === id);
  try {
    saves = await invoke<Save[]>("remove_save", { id });
    play("remove");
    const list = stack[stack.length - 3];
    list.focus = saves[index]?.id ?? saves[index - 1]?.id ?? "empty";
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
  const index = rows.findIndex(row => row.id === frame.focus);
  const next = rows[index + step];
  if (!next) return;
  play(frame.route === "home" ? direction === "up" ? "up" : "down" : "move");
  frame.focus = next.id;
  syncFocus();
}

function act(action: Action) {
  if (transition || busy || !document.hasFocus()) return;
  if (sounds.ambient.paused) play("ambient");
  if (action === "confirm") {
    const row = rows.find(row => row.id === current().focus);
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
