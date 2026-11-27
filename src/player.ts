export type Track = { id: number; name: string; available: boolean };
type PlaybackState = "Stopped" | "Loading track…" | "Playing" | "Paused" | "Unavailable";

export class Player {
  private readonly audio = new Audio();
  private activeId: number | undefined;
  private playbackState: PlaybackState = "Stopped";
  private request = 0;
  private readonly resolveTrack: (id: number) => Promise<string>;
  private readonly stateChanged: () => void;

  constructor(
    resolveTrack: (id: number) => Promise<string>,
    stateChanged: () => void,
    updateTime: () => void,
  ) {
    this.resolveTrack = resolveTrack;
    this.stateChanged = stateChanged;
    this.audio.preload = "none";
    this.audio.addEventListener("ended", () => {
      if (this.audio.ended) this.stop();
    });
    this.audio.addEventListener("error", () => {
      if (this.activeId !== undefined && this.audio.error) this.fail();
    });
    this.audio.addEventListener("timeupdate", updateTime);
    this.audio.addEventListener("durationchange", updateTime);
  }

  get id() { return this.activeId; }
  get state() { return this.playbackState; }

  get elapsed() {
    const seconds = Math.floor(this.audio.currentTime);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  get progress() {
    const { currentTime, duration } = this.audio;
    return Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0;
  }

  setVolume(volume: number, muted: boolean) {
    this.audio.volume = volume;
    this.audio.muted = muted;
  }

  private reset() {
    this.request++;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  private setState(state: PlaybackState) {
    this.playbackState = state;
    this.stateChanged();
  }

  stop() {
    this.reset();
    this.activeId = undefined;
    this.setState("Stopped");
  }

  private fail() {
    this.reset();
    this.setState("Unavailable");
  }

  async play(id: number) {
    if (this.activeId === id && this.state === "Loading track…") return;
    if (this.activeId !== id || this.state !== "Paused") {
      this.reset();
      this.activeId = id;
    }
    const request = ++this.request;
    this.setState("Loading track…");
    try {
      if (!this.audio.getAttribute("src")) {
        const url = await this.resolveTrack(id);
        if (request !== this.request) return;
        this.audio.src = url;
      }
      await this.audio.play();
      if (request === this.request) this.setState("Playing");
    } catch {
      if (request === this.request) this.fail();
    }
  }

  pause() {
    if (this.state !== "Playing") return;
    this.audio.pause();
    this.setState("Paused");
  }
}
