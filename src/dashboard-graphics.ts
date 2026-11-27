import { AmbientLight, Color, DirectionalLight, FogExp2, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { makeCellWall, makeOrbs } from "./dashboard-art.ts";

export function createDashboardGraphics(stage: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: true });
  const canvas = renderer.domElement;
  canvas.className = "dashboard-graphics";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new Scene();
  scene.background = new Color(0x080f03);
  scene.fog = new FogExp2(0x080f03, .048);
  const camera = new PerspectiveCamera(38, 16 / 9, .1, 59);
  const orbs = makeOrbs();
  const key = new DirectionalLight(0xeeffab, 2.3);
  key.position.set(-3, 5, 7);
  scene.add(makeCellWall(), orbs.home, orbs.memory, key, new AmbientLight(0xb3db60, 1.45));

  let route = "";
  let travel: { start: number; duration: number; returning: boolean } | undefined;
  let request = 0;
  let lastFrame: number | undefined;
  let idleTime = 0;
  let showing = false;
  let needsResize = true;
  let starting = true;
  let hidden = false;
  let reduced = false;
  let failed = false;
  let lost = false;
  const supports = (route: string) => route === "home" || route === "device";

  function showCanvas(visible: boolean) {
    if (showing === visible) return;
    showing = visible;
    stage.toggleAttribute("data-3d", visible);
  }

  const canDraw = () => !failed && !lost && !hidden && supports(route);

  function queueFrame() {
    if (!request && canDraw()) request = requestAnimationFrame(draw);
  }

  function sync() {
    hidden = stage.hasAttribute("data-hidden") || document.hidden;
    reduced = stage.hasAttribute("data-reduced-motion");
    if (!canDraw() || starting || reduced) {
      cancelAnimationFrame(request);
      request = 0;
      lastFrame = undefined;
    }
    if (reduced) travel = undefined;
    queueFrame();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return false;

    // Fit the stage into a 1080p drawing buffer even on high-density displays.
    const ratio = Math.min(devicePixelRatio, 1920 / width, 1080 / height);
    const bufferWidth = Math.max(1, Math.floor(width * ratio));
    const bufferHeight = Math.max(1, Math.floor(height * ratio));
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      renderer.setSize(bufferWidth, bufferHeight, false);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsResize = false;
    return true;
  }

  function invalidateSize() {
    needsResize = true;
    queueFrame();
  }

  function draw(now: number) {
    request = 0;
    if (!canDraw() || (needsResize && !resize())) return;

    const moving = !reduced && !starting;
    if (moving && lastFrame !== undefined) idleTime += Math.min(now - lastFrame, 50) / 1000;
    lastFrame = moving ? now : undefined;
    orbs.animate(reduced ? 0 : idleTime);

    let position = route === "device" ? 1 : 0;
    if (travel) {
      const elapsed = Math.max(0, Math.min(1, (now - travel.start) / travel.duration));
      const eased = elapsed * elapsed * (3 - 2 * elapsed);
      position = travel.returning ? 1 - eased : eased;
    }
    const bend = Math.sin(Math.PI * position);
    camera.position.set(.74 * bend, .18 + .24 * bend, 9 - 17.9 * position);
    camera.lookAt(-.51 * bend, .18 + .24 * bend, camera.position.z - 8);
    try {
      renderer.render(scene, camera);
    } catch (error) {
      failed = true;
      console.error("Could not render the dashboard scene.", error);
    }
    showCanvas(!failed && !lost);
    if (moving) queueFrame();
  }

  renderer.debug.onShaderError = (_gl, _program, vertex, fragment) => {
    failed = true;
    const gl = renderer.getContext();
    console.error("Could not compile the dashboard scene.", gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
  };
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    lost = true;
    showCanvas(false);
    sync();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    sync();
  });
  stage.prepend(canvas);
  new ResizeObserver(invalidateSize).observe(stage);
  window.addEventListener("resize", invalidateSize);
  new MutationObserver(sync).observe(stage, {
    attributes: true,
    attributeFilter: ["data-hidden", "data-reduced-motion"],
  });

  return {
    show(next: string) {
      if (route === next) return;
      route = next;
      if (!supports(route)) showCanvas(false);
      sync();
    },
    finishStartup() {
      starting = false;
      queueFrame();
    },
    beginTravel(next: string | undefined, duration: number) {
      if (!showing || !canDraw() || reduced ||
          next === undefined || next === route || !supports(next) || !supports(route)) return false;
      travel = { start: performance.now(), duration, returning: route === "device" };
      queueFrame();
      return true;
    },
    endTravel() {
      travel = undefined;
      queueFrame();
    },
  };
}
