export function playIntro(video: HTMLVideoElement, skip: AbortSignal) {
  if (skip.aborted) return Promise.resolve(true);
  return new Promise<boolean>(resolve => {
    const listeners = new AbortController();
    const finish = (skipped = false) => {
      if (listeners.signal.aborted) return;
      listeners.abort();
      clearTimeout(timeout);
      video.pause();
      resolve(skipped);
    };
    const options = { signal: listeners.signal };
    // Bound even a decoder stall after playback starts; the bundled clip is under ten seconds.
    const timeout = setTimeout(finish, 15_000);
    skip.addEventListener("abort", () => finish(true), options);
    video.addEventListener("ended", () => finish(), options);
    video.addEventListener("error", () => finish(), options);
    video.src = "./assets/xbox-boot.mp4";
    void video.play().catch(() => finish());
  });
}
