import {
  AdditiveBlending, BackSide, BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  ShaderMaterial, SphereGeometry, Vector3,
} from "three";

const orbVertex = `
  varying vec3 surface;
  varying vec3 normalInView;
  varying vec3 towardCamera;

  void main() {
    surface = normalize(position);
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    normalInView = normalize(normalMatrix * normal);
    towardCamera = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

function orbMaterial(shell: boolean) {
  return new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    defines: shell ? { SHELL: 1 } : {},
    vertexShader: orbVertex,
    fragmentShader: `
      uniform float time;
      varying vec3 surface;
      varying vec3 normalInView;
      varying vec3 towardCamera;

      void main() {
        vec3 p = normalize(surface);
        vec3 n = normalize(normalInView);
        float facing = clamp(abs(dot(n, normalize(towardCamera))), 0.0, 1.0);
        float rim = pow(1.0 - facing, 2.5);
        float drift = sin(p.x * 5.0 + p.y * 3.0 + sin(p.z * 5.0 - time * .34) + time * .43);
        float light = .5 + .5 * drift;
        vec3 color;
        float alpha;

        #ifdef SHELL
          float film = sin(p.y * 13.0 + p.x * 4.0 + drift * 1.6 - time * .23);
          float edge = smoothstep(.75, 1.0, film);
          float shine = pow(max(dot(n, normalize(vec3(-.44, .57, .72))), 0.0), 15.0);
          color = mix(vec3(.018, .13, .005), vec3(.46, .79, .10), clamp(rim + shine * .45, 0.0, 1.0));
          float falloff = 1.0 - smoothstep(11.0, 29.0, length(towardCamera));
          alpha = (.055 + .31 * rim + .18 * edge + .25 * shine) * falloff;
        #else
          float hot = smoothstep(-.7, .78, p.x * .47 - p.y * .69 + drift * .34);
          color = mix(vec3(.026, .18, .008), vec3(.82, .84, .032), hot);
          color *= .62 + .38 * facing;
          color += vec3(.12, .39, .025) * rim;
          float sheen = pow(max(dot(n, normalize(vec3(-.44, .51, .72))), 0.0), 34.0);
          color += vec3(.36, .47, .14) * sheen;

          vec2 emblem = p.xy + vec2(0.015, -0.025);
          float arm = abs(abs(emblem.x) - abs(emblem.y) * .94 + .075 * emblem.y);
          float reach = max(abs(emblem.x), abs(emblem.y));
          float taper = max(.006, .12 - reach * .22);
          float cut = (1.0 - smoothstep(taper, taper + .018, arm)) *
            (1.0 - smoothstep(.51, .57, reach)) * smoothstep(.35, .8, p.z);
          float bevel = smoothstep(taper - .029, taper + .006, arm);
          color *= 1.0 - cut * .54;
          color += vec3(.36, .44, .16) * cut * bevel * (.57 + .43 * light);
          alpha = 1.0;
        #endif

        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: shell,
    depthWrite: !shell,
  });
}

export function makeOrbs() {
  const core = orbMaterial(false);
  const shell = orbMaterial(true);
  const home = new Group();
  home.position.set(-1.94, .2, 0);
  home.add(new Mesh(new SphereGeometry(1.42, 64, 40), core));

  const memory = new Group();
  memory.position.set(0, .57, -17);
  const capsule = new Mesh(new SphereGeometry(1.58, 56, 32), shell);
  capsule.renderOrder = 1;
  memory.add(capsule);

  const membranes = new Group();
  for (let i = 0; i < 4; i++) {
    const membrane = new Mesh(new SphereGeometry(1.7, 36, 18, 0, Math.PI * 1.22, .81, .49), shell);
    membrane.rotation.set(.28 + i * .87, i * 1.8, -.44 + i * 1.44);
    membrane.scale.set(1.03, .95, 1);
    membrane.renderOrder = i + 2;
    membranes.add(membrane);
  }
  home.add(membranes);

  const memoryBrackets = new Group();
  for (let i = 0; i < 4; i++) {
    const bracket = new Mesh(new SphereGeometry(1.83, 20, 8, 0, .97, 1.37, .29), shell);
    bracket.rotation.set(.62 + i * .4, Math.PI * .5 * i, -.28 + i * .8);
    bracket.renderOrder = i + 2;
    memoryBrackets.add(bracket);
  }
  memory.add(memoryBrackets);

  const consoleModel = new Group();
  const casing = new MeshStandardMaterial({ color: 0x65772b, roughness: .54, metalness: .24,
    emissive: 0x29350b, emissiveIntensity: .45 });
  const ridge = new MeshStandardMaterial({ color: 0xa4b655, roughness: .43, metalness: .23,
    emissive: 0x34410e, emissiveIntensity: .36 });
  const dark = new MeshStandardMaterial({ color: 0x171f0b, roughness: .76 });
  function box(width: number, height: number, depth: number, material: MeshStandardMaterial,
    x = 0, y = 0, z = 0) {
    const part = new Mesh(new BoxGeometry(width, height, depth), material);
    part.position.set(x, y, z);
    consoleModel.add(part);
    return part;
  }
  box(1.77, .39, 1.15, casing);
  box(1.63, .12, 1.04, dark, 0, -.22);
  box(1.06, .04, .095, dark, 0, .095, .583);
  box(.18, .022, .12, ridge, 0, .23, -.035);
  for (const angle of [-.5, .5]) {
    box(1.73, .075, .31, casing, 0, .19).rotation.y = angle;
  }
  for (let i = 0; i < 9; i++) {
    for (const side of [-1, 1]) {
      box(.43, .028, .027, ridge, side * .645, .21, -.46 + i * .115);
    }
  }
  for (const x of [-.66, -.4, .4, .66]) box(.115, .075, .018, dark, x, -.086, .583);
  consoleModel.rotation.set(.46, -.51, .11);
  memory.add(consoleModel);

  return {
    home, memory,
    animate(time: number) {
      core.uniforms.time.value = time;
      shell.uniforms.time.value = time;
      membranes.rotation.set(.12 * Math.sin(time * .27), time * .08, -.09);
      memoryBrackets.rotation.y = time * .09;
      consoleModel.rotation.y = -.51 + .11 * Math.sin(time * .44);
    },
  };
}

export function makeCellWall() {
  const wall = new Group();
  const rings = 35;
  const cells = 30;
  const points: Vector3[][] = [];
  const wallPositions: number[] = [];
  const wallColors: number[] = [];
  const veins: number[] = [];
  const veinColors: number[] = [];

  for (let ring = 0; ring < rings; ring++) {
    const row: Vector3[] = [];
    for (let cell = 0; cell < cells; cell++) {
      const seed = ring * 67.3 + cell * 17.9;
      const angle = (cell + (ring % 2) * .5 + .28 * Math.sin(seed)) * Math.PI * 2 / cells;
      const z = 11 - ring * 1.26 + .38 * Math.sin(seed * 1.73);
      const radius = 4.7 + .68 * Math.cos(z * .23) + .47 * Math.sin(angle * 3 + z * .38);
      row.push(new Vector3(Math.cos(angle) * (radius + 1.05), Math.sin(angle) * radius, z));
    }
    points.push(row);
  }

  const color = new Color();
  function vertex(point: Vector3, positions: number[], colors: number[], line: boolean) {
    const light = .54 + .26 * Math.sin(point.z * .49 + point.x * .62) + .16 * Math.cos(point.y);
    color.setHex(line ? 0x426d1b : 0x101f07).multiplyScalar(light);
    positions.push(point.x, point.y, point.z);
    colors.push(color.r, color.g, color.b);
  }
  function line(a: Vector3, b: Vector3) {
    for (const point of [a, b]) vertex(point, veins, veinColors, true);
  }
  for (let ring = 1; ring < rings; ring++) {
    for (let cell = 0; cell < cells; cell++) {
      const next = (cell + 1) % cells;
      const a = points[ring - 1][cell];
      const b = points[ring - 1][next];
      const c = points[ring][cell];
      const d = points[ring][next];
      for (const point of [a, b, c, b, d, c]) vertex(point, wallPositions, wallColors, false);
      line(a, b);
      line(a, c);
      if (Math.sin(ring * 7.8 + cell * 2.3) > -.39) line(b, c);
    }
  }

  function geometry(positions: number[], colors: number[]) {
    return new BufferGeometry()
      .setAttribute("position", new Float32BufferAttribute(positions, 3))
      .setAttribute("color", new Float32BufferAttribute(colors, 3));
  }
  wall.add(new Mesh(geometry(wallPositions, wallColors),
    new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, polygonOffset: true,
      polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  wall.add(new LineSegments(geometry(veins, veinColors),
    new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending, transparent: true,
      opacity: .65, depthWrite: false })));
  wall.add(new Mesh(new SphereGeometry(48, 16, 12),
    new MeshBasicMaterial({ color: 0x080f03, side: BackSide })));
  return wall;
}
