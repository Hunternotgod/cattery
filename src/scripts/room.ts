import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';

const C = {
  paper: 0xf2ebdd,
  paperDeep: 0xe8decc,
  ink: 0x191714,
  inkSoft: 0x5f5a52,
  tomato: 0xd9472b,
  tomatoDark: 0xb9361f,
  cat: 0xf39a3d,
  catDark: 0xe8792b,
  pig: 0xf3a7b9,
  pigDark: 0xe98ba0,
  corgi: 0xe8792b,
  cream: 0xf7e8d4,
  white: 0xfffaf0,
  wood: 0xc89b6a,
  woodDark: 0xa97a4f,
  mint: 0xbdf4e4,
  sky: 0xcfe8e2,
  green: 0x5c7258,
  dark: 0x1b1d22,
};

type Character = THREE.Group & {
  userData: { parts: Record<string, THREE.Object3D> };
};

type StationId = 'establishing' | 'cat' | 'pig' | 'corgi' | 'about';

interface FrameSpec {
  fov: number;
  padding: number;
  direction: THREE.Vector3;
  lateral: number;
  vertical: number;
}

interface CameraPreset {
  desktop: FrameSpec;
  mobile: FrameSpec;
  mobileOpen?: FrameSpec;
  tablet: FrameSpec;
  tabletOpen?: FrameSpec;
}

interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const gradientMap = (() => {
  const data = new Uint8Array([64, 132, 210, 255]);
  const texture = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

const materialCache = new Map<number, THREE.MeshToonMaterial>();
function toon(color: number): THREE.MeshToonMaterial {
  const cached = materialCache.get(color);
  if (cached) return cached;
  const material = new THREE.MeshToonMaterial({ color, gradientMap });
  materialCache.set(color, material);
  return material;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}


function place(
  mesh: THREE.Mesh,
  parent: THREE.Object3D,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function snapToSurface(object: THREE.Object3D, surfaceY: number): void {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  object.position.y += surfaceY - bounds.min.y;
  object.updateMatrixWorld(true);
}

function worldBox(object: THREE.Object3D): THREE.Box3 {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

function rounded(w: number, h: number, d: number, r: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), toon(color));
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
}

function cylinder(rTop: number, rBottom: number, h: number, color: number, segments = 20): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), toon(color));
}

function makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function signTexture(): THREE.CanvasTexture {
  return makeTexture(640, 180, (ctx) => {
    ctx.fillStyle = '#f7e8d4';
    ctx.fillRect(0, 0, 640, 180);
    ctx.strokeStyle = '#191714';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 620, 160);
    ctx.fillStyle = '#191714';
    ctx.font = '800 92px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('cattery', 320, 118);
    ctx.fillStyle = '#d9472b';
    ctx.fillRect(245, 138, 150, 8);
  });
}

function laptopTexture(): THREE.CanvasTexture {
  return makeTexture(640, 400, (ctx) => {
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(0, 0, 640, 400);
    ctx.fillStyle = '#282b32';
    ctx.fillRect(0, 0, 640, 54);
    ctx.fillStyle = '#d9472b';
    ctx.fillRect(28, 16, 22, 22);
    ctx.fillStyle = '#f7e8d4';
    ctx.font = '700 22px Arial, sans-serif';
    ctx.fillText('喵秘书', 66, 35);
    ctx.fillStyle = '#262a30';
    ctx.fillRect(0, 54, 150, 346);
    ctx.fillStyle = '#3a3f48';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(22, 92 + i * 44, 104, 22);
    ctx.fillStyle = '#d9472b';
    ctx.fillRect(22, 92, 104, 22);
    ctx.fillStyle = '#f7e8d4';
    ctx.font = '600 18px Arial, sans-serif';
    ctx.fillText('群日报', 34, 108);
    ctx.fillStyle = '#eff1f4';
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText('计科 2023 级通知群', 190, 112);
    ctx.fillStyle = '#9ba1ab';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('47 条消息  →  5 条要点', 190, 146);
    const cards: Array<[string, string]> = [
      ['#f3a7b9', '9/3 前交操作系统实验报告'],
      ['#f39a3d', '周三 14:00 改到 A 楼 301'],
      ['#bdf4e4', 'ACM 校赛报名截止 9/5'],
    ];
    cards.forEach(([color, text], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(190, 180 + i * 64, 8, 42);
      ctx.fillStyle = '#e6e8ec';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText(text, 214, 208 + i * 64);
    });
  });
}

function artTexture(variant: number): THREE.CanvasTexture {
  return makeTexture(360, 480, (ctx) => {
    ctx.fillStyle = '#f7e8d4';
    ctx.fillRect(0, 0, 360, 480);
    ctx.fillStyle = variant === 0 ? '#d9472b' : '#e8792b';
    ctx.beginPath();
    ctx.arc(180, 210, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3a7b9';
    ctx.fillRect(70, 300, 220, 26);
    ctx.fillStyle = '#191714';
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText('CATTERY', 82, 70);
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('room notes / 2026', 82, 104);
  });
}
function createCat(): Character {
  const group = new THREE.Group() as Character;
  const orange = toon(C.cat);
  const orangeDark = toon(C.catDark);
  const cream = toon(C.cream);
  const ink = toon(C.ink);
  const pink = toon(0xef7890);

  addMesh(group, new THREE.CapsuleGeometry(0.38, 0.42, 8, 16), orange, [0, 0.62, 0], [0, 0, 0], [1, 1, 0.9]);
  addMesh(group, new THREE.SphereGeometry(0.24, 24, 16), cream, [0, 0.62, 0.29], [0, 0, 0], [1, 0.9, 0.5]);

  const head = new THREE.Group();
  head.position.set(0, 1.11, 0.04);
  group.add(head);
  addMesh(head, new THREE.SphereGeometry(0.4, 32, 24), orange, [0, 0, 0], [0, 0, 0], [1.02, 0.95, 0.94]);

  const ear = new THREE.ConeGeometry(0.18, 0.34, 3);
  addMesh(head, ear, orange, [-0.23, 0.34, 0], [0, 0.2, -0.12]);
  addMesh(head, ear.clone(), orange, [0.23, 0.34, 0], [0, -0.2, 0.12]);
  addMesh(head, new THREE.ConeGeometry(0.1, 0.2, 3), orangeDark, [-0.23, 0.33, 0.03], [0, 0.2, -0.12]);
  addMesh(head, new THREE.ConeGeometry(0.1, 0.2, 3), orangeDark, [0.23, 0.33, 0.03], [0, -0.2, 0.12]);

  addMesh(head, new THREE.SphereGeometry(0.055, 16, 12), ink, [-0.14, 0.08, 0.34]);
  addMesh(head, new THREE.SphereGeometry(0.055, 16, 12), ink, [0.14, 0.08, 0.34]);
  addMesh(head, new THREE.SphereGeometry(0.018, 12, 8), cream, [-0.125, 0.1, 0.385]);
  addMesh(head, new THREE.SphereGeometry(0.018, 12, 8), cream, [0.155, 0.1, 0.385]);

  addMesh(head, new THREE.SphereGeometry(0.17, 24, 16), cream, [0, -0.08, 0.31], [0, 0, 0], [1, 0.8, 0.55]);
  addMesh(head, new THREE.SphereGeometry(0.052, 16, 12), pink, [0, -0.035, 0.445], [0, 0, 0], [1, 0.75, 0.6]);

  const goggleBand = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.024, 8, 32), ink);
  goggleBand.rotation.x = Math.PI / 2;
  goggleBand.position.y = 0.16;
  head.add(goggleBand);
  const lensGeo = new THREE.TorusGeometry(0.082, 0.017, 8, 20);
  addMesh(head, lensGeo, ink, [-0.14, 0.08, 0.395], [0, 0, 0], [1, 0.78, 1]);
  addMesh(head, lensGeo.clone(), ink, [0.14, 0.08, 0.395], [0, 0, 0], [1, 0.78, 1]);

  addMesh(head, new THREE.CylinderGeometry(0.23, 0.25, 0.12, 18), orangeDark, [0, 0.37, 0], [0, 0.1, 0]);

  const armL = addMesh(group, new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), orange, [-0.4, 0.7, 0.3], [0.85, 0, 0.24]);
  const armR = addMesh(group, new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), orange, [0.4, 0.7, 0.3], [0.85, 0, -0.24]);
  addMesh(group, new THREE.CapsuleGeometry(0.12, 0.2, 4, 8), orange, [-0.2, 0.15, 0.02]);
  addMesh(group, new THREE.CapsuleGeometry(0.12, 0.2, 4, 8), orange, [0.2, 0.15, 0.02]);

  const tail = new THREE.Group();
  tail.position.set(0.38, 0.45, -0.3);
  group.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.3, 0.1, -0.18),
    new THREE.Vector3(0.55, 0.35, -0.2),
    new THREE.Vector3(0.55, 0.75, -0.05),
  ]);
  addMesh(tail, new THREE.TubeGeometry(tailCurve, 24, 0.075, 8, false), orange, [0, 0, 0]);
  group.userData.parts = { head, armL, armR, tail, body: group };
  return group;
}

function createPig(): Character {
  const group = new THREE.Group() as Character;
  const pink = toon(C.pig);
  const pinkDark = toon(C.pigDark);
  const ink = toon(C.ink);
  const cream = toon(C.cream);
  const tomato = toon(C.tomato);

  addMesh(group, new THREE.CapsuleGeometry(0.43, 0.45, 8, 16), pink, [0, 0.62, 0], [0, 0, 0], [1.05, 1, 0.9]);
  addMesh(group, new THREE.SphereGeometry(0.25, 24, 16), pinkDark, [0, 0.6, 0.31], [0, 0, 0], [1, 0.85, 0.55]);

  const head = new THREE.Group();
  head.position.set(0, 1.18, 0.03);
  group.add(head);
  addMesh(head, new THREE.SphereGeometry(0.4, 28, 20), pink, [0, 0, 0], [0, 0, 0], [1.05, 0.96, 0.94]);
  addMesh(head, new THREE.ConeGeometry(0.16, 0.3, 3), pink, [-0.26, 0.35, 0], [0, 0.2, -0.4]);
  addMesh(head, new THREE.ConeGeometry(0.16, 0.3, 3), pink, [0.26, 0.35, 0], [0, -0.2, 0.4]);
  addMesh(head, new THREE.ConeGeometry(0.09, 0.17, 3), pinkDark, [-0.26, 0.35, 0.02], [0, 0.2, -0.4]);
  addMesh(head, new THREE.ConeGeometry(0.09, 0.17, 3), pinkDark, [0.26, 0.35, 0.02], [0, -0.2, 0.4]);

  addMesh(head, new THREE.SphereGeometry(0.052, 16, 12), ink, [-0.14, 0.09, 0.34]);
  addMesh(head, new THREE.SphereGeometry(0.052, 16, 12), ink, [0.14, 0.09, 0.34]);
  addMesh(head, new THREE.SphereGeometry(0.017, 12, 8), cream, [-0.125, 0.11, 0.382]);
  addMesh(head, new THREE.SphereGeometry(0.017, 12, 8), cream, [0.155, 0.11, 0.382]);

  addMesh(head, new THREE.CylinderGeometry(0.18, 0.18, 0.12, 18), pinkDark, [0, -0.06, 0.4], [Math.PI / 2, 0, 0]);
  addMesh(head, new THREE.SphereGeometry(0.03, 12, 8), ink, [-0.06, -0.06, 0.47]);
  addMesh(head, new THREE.SphereGeometry(0.03, 12, 8), ink, [0.06, -0.06, 0.47]);

  addMesh(group, new THREE.ConeGeometry(0.1, 0.2, 3), tomato, [0, 0.85, 0.29], [0, 0, Math.PI]);
  addMesh(group, new THREE.BoxGeometry(0.12, 0.22, 0.03), tomato, [0, 0.68, 0.28], [0, 0, 0.1]);

  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), pink, [-0.36, 0.72, 0.1], [0.9, 0, 0.35]);
  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), pink, [0.36, 0.72, 0.1], [0.9, 0, -0.35]);
  addMesh(group, new THREE.CapsuleGeometry(0.13, 0.18, 4, 8), pink, [-0.22, 0.15, 0.02]);
  addMesh(group, new THREE.CapsuleGeometry(0.13, 0.18, 4, 8), pink, [0.22, 0.15, 0.02]);

  const board = new THREE.Group();
  board.position.set(0.58, 0.82, 0.46);
  board.rotation.z = -0.08;
  group.add(board);
  addMesh(board, new THREE.BoxGeometry(0.34, 0.46, 0.04), cream, [0, 0, 0]);
  addMesh(board, new THREE.BoxGeometry(0.12, 0.04, 0.05), ink, [0, 0.22, 0.02]);
  for (let i = 0; i < 4; i += 1) {
    addMesh(board, new THREE.BoxGeometry(0.22, 0.018, 0.01), ink, [-0.02, 0.08 - i * 0.075, 0.026]);
  }

  group.userData.parts = { head, board, body: group };
  return group;
}

function createCorgi(): Character {
  const group = new THREE.Group() as Character;
  const orange = toon(C.corgi);
  const cream = toon(C.cream);
  const ink = toon(C.ink);
  const pink = toon(0xef7890);

  addMesh(group, new THREE.CapsuleGeometry(0.4, 0.3, 8, 16), orange, [0, 0.52, 0], [0, 0, 0], [1, 0.92, 0.85]);
  addMesh(group, new THREE.SphereGeometry(0.24, 20, 14), cream, [0, 0.48, 0.28], [0, 0, 0], [1, 0.8, 0.55]);

  const head = new THREE.Group();
  head.position.set(0, 1.02, 0.05);
  group.add(head);
  addMesh(head, new THREE.SphereGeometry(0.35, 28, 20), orange, [0, 0, 0], [0, 0, 0], [1.05, 0.95, 0.95]);
  addMesh(head, new THREE.ConeGeometry(0.15, 0.4, 3), orange, [-0.24, 0.36, 0], [0, 0.2, -0.35]);
  addMesh(head, new THREE.ConeGeometry(0.15, 0.4, 3), orange, [0.24, 0.36, 0], [0, -0.2, 0.35]);
  addMesh(head, new THREE.ConeGeometry(0.08, 0.24, 3), cream, [-0.24, 0.37, 0.02], [0, 0.2, -0.35]);
  addMesh(head, new THREE.ConeGeometry(0.08, 0.24, 3), cream, [0.24, 0.37, 0.02], [0, -0.2, 0.35]);

  addMesh(head, new THREE.SphereGeometry(0.05, 16, 12), ink, [-0.12, 0.08, 0.3]);
  addMesh(head, new THREE.SphereGeometry(0.05, 16, 12), ink, [0.12, 0.08, 0.3]);
  addMesh(head, new THREE.SphereGeometry(0.016, 12, 8), cream, [-0.105, 0.1, 0.34]);
  addMesh(head, new THREE.SphereGeometry(0.016, 12, 8), cream, [0.135, 0.1, 0.34]);

  addMesh(head, new THREE.SphereGeometry(0.2, 24, 16), cream, [0, -0.08, 0.27], [0, 0, 0], [1.1, 0.78, 0.72]);
  addMesh(head, new THREE.SphereGeometry(0.045, 12, 8), ink, [0, -0.03, 0.44]);
  addMesh(head, new THREE.BoxGeometry(0.09, 0.07, 0.03), pink, [0, -0.12, 0.4], [0.2, 0, 0]);

  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.18, 4, 8), orange, [-0.2, 0.16, 0.03]);
  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.18, 4, 8), orange, [0.2, 0.16, 0.03]);
  addMesh(group, new THREE.CapsuleGeometry(0.08, 0.16, 4, 8), cream, [-0.35, 0.55, -0.05], [0, 0, 0.4]);
  addMesh(group, new THREE.CapsuleGeometry(0.08, 0.16, 4, 8), cream, [0.35, 0.55, -0.05], [0, 0, -0.4]);

  const tail = addMesh(group, new THREE.ConeGeometry(0.1, 0.26, 12), orange, [0, 0.62, -0.5], [1.2, 0, 0]);

  group.userData.parts = { head, tail, body: group };
  return group;
}

function createRoom(scene: THREE.Scene): void {
  const colliders: Array<{ name: string; box: THREE.Box3 }> = [];
  const addCollider = (name: string, object: THREE.Object3D) => {
    colliders.push({ name, box: worldBox(object) });
  };

  const floor = rounded(10, 0.2, 8, 0.08, C.wood);
  floor.position.set(0, -0.1, 0);
  scene.add(floor);

  const backWall = box(10, 5, 0.2, C.paper);
  backWall.position.set(0, 2.5, -4);
  scene.add(backWall);

  const leftWall = box(0.2, 5, 8, C.paperDeep);
  leftWall.position.set(-5, 2.5, 0);
  scene.add(leftWall);

  const rightWall = box(0.2, 5, 8, C.paperDeep);
  rightWall.position.set(5, 2.5, 0);
  scene.add(rightWall);

  const skirting = box(9.7, 0.16, 0.1, C.woodDark);
  skirting.position.set(0, 0.08, -3.88);
  scene.add(skirting);

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.045, 48), toon(C.tomato));
  rug.scale.set(1.25, 1, 0.8);
  rug.position.set(1.65, 0.025, 1.2);
  rug.receiveShadow = true;
  scene.add(rug);

  const rugInner = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.05, 48), toon(C.paperDeep));
  rugInner.scale.set(1.2, 1, 0.74);
  rugInner.position.set(1.65, 0.028, 1.2);
  scene.add(rugInner);

  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.035, 6, 48), toon(C.tomatoDark));
  rugRing.scale.set(1.22, 0.72, 1);
  rugRing.rotation.x = Math.PI / 2;
  rugRing.position.set(1.65, 0.055, 1.2);
  scene.add(rugRing);

  const windowFrame = box(3.2, 2.2, 0.12, C.cream);
  windowFrame.position.set(0.2, 2.85, -3.86);
  scene.add(windowFrame);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), new THREE.MeshBasicMaterial({ color: C.sky }));
  sky.position.set(0.2, 2.85, -3.79);
  scene.add(sky);
  const mullionV = box(0.06, 1.8, 0.05, C.woodDark);
  mullionV.position.set(0.2, 2.85, -3.77);
  scene.add(mullionV);
  const mullionH = box(2.8, 0.06, 0.05, C.woodDark);
  mullionH.position.set(0.2, 2.85, -3.77);
  scene.add(mullionH);
  const sill = box(3.5, 0.12, 0.3, C.wood);
  sill.position.set(0.2, 1.7, -3.75);
  scene.add(sill);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.68),
    new THREE.MeshBasicMaterial({ map: signTexture() }),
  );
  sign.position.set(0.2, 4.22, -3.84);
  scene.add(sign);

  const desk = new THREE.Group();
  desk.position.set(-2.8, 0, -1.8);
  scene.add(desk);
  const deskTop = rounded(3.2, 0.16, 1.35, 0.05, C.wood);
  deskTop.position.set(0, 1.0, 0);
  desk.add(deskTop);
  for (const x of [-1.35, 1.35]) {
    for (const z of [-0.48, 0.48]) {
      const leg = cylinder(0.07, 0.08, 1, C.woodDark, 12);
      leg.position.set(x, 0.5, z);
      desk.add(leg);
    }
  }
  const drawer = rounded(0.8, 0.3, 0.7, 0.04, C.woodDark);
  drawer.position.set(0.4, 0.72, 0.08);
  desk.add(drawer);

  const laptopBase = rounded(1.1, 0.06, 0.68, 0.03, C.dark);
  laptopBase.position.set(-1.8, 1.12, -1.06);
  scene.add(laptopBase);
  const laptopScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 0.64),
    new THREE.MeshBasicMaterial({ map: laptopTexture() }),
  );
  laptopScreen.position.set(-1.8, 1.45, -1.39);
  laptopScreen.rotation.x = -0.08;
  scene.add(laptopScreen);
  const laptopFrame = box(1.16, 0.72, 0.05, C.dark);
  laptopFrame.position.set(-1.8, 1.45, -1.42);
  laptopFrame.rotation.x = -0.08;
  scene.add(laptopFrame);

  const mug = cylinder(0.11, 0.11, 0.22, C.cream, 16);
  mug.position.set(-1.95, 1.2, -1.65);
  scene.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 16), toon(C.cream));
  handle.position.set(-1.83, 1.2, -1.65);
  handle.rotation.y = Math.PI / 2;
  scene.add(handle);

  const lampPole = cylinder(0.025, 0.025, 1.2, C.ink, 8);
  lampPole.position.set(-3.95, 1.55, -2.05);
  scene.add(lampPole);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.28, 18), toon(C.tomato));
  lampShade.position.set(-3.95, 2.16, -2.05);
  lampShade.rotation.x = Math.PI;
  scene.add(lampShade);

  const shelf = new THREE.Group();
  shelf.position.set(2.9, 0, -3.65);
  scene.add(shelf);
  place(box(2.8, 0.14, 0.52, C.woodDark), shelf, [0, 0.08, 0]);
  place(box(0.12, 3.2, 0.52, C.woodDark), shelf, [-1.34, 1.6, 0]);
  place(box(0.12, 3.2, 0.52, C.woodDark), shelf, [1.34, 1.6, 0]);
  for (let i = 0; i < 4; i += 1) place(box(2.7, 0.08, 0.5, C.wood), shelf, [0, 0.7 + i * 0.72, 0]);
  const bookColors = [C.tomato, C.cream, C.cat, C.pig, C.green, C.woodDark];
  for (let row = 0; row < 4; row += 1) {
    let x = -1.15;
    for (let i = 0; i < 7; i += 1) {
      const w = 0.12 + ((i * 7 + row * 3) % 4) * 0.025;
      const h = 0.34 + ((i * 5 + row) % 4) * 0.035;
      const book = box(w, h, 0.32, bookColors[(i + row) % bookColors.length]);
      book.position.set(x, 0.78 + row * 0.72 + h / 2, 0.04);
      book.rotation.z = (i % 3 - 1) * 0.025;
      shelf.add(book);
      x += w + 0.04;
    }
  }

  const pig = createPig();
  pig.position.set(2.55, 0, -1.9);
  pig.rotation.y = -0.1;
  snapToSurface(pig, 0);
  scene.add(pig);
  scene.userData.pig = pig;

  const cat = createCat();
  cat.position.set(-3.8, 0, -1.32);
  cat.rotation.y = 0.16;
  snapToSurface(cat, 1.08);
  scene.add(cat);
  scene.userData.cat = cat;

  const corgi = createCorgi();
  corgi.position.set(2.0, 0, 1.1);
  corgi.rotation.y = -0.28;
  snapToSurface(corgi, 0.05);
  scene.add(corgi);
  scene.userData.corgi = corgi;

  for (let i = 0; i < 3; i += 1) {
    const paper = box(0.38, 0.018, 0.28, C.cream);
    paper.position.set(0.65 + i * 0.32, 0.06 + i * 0.004, 2.05);
    paper.rotation.y = i * 0.25;
    paper.rotation.z = (i % 2) * 0.06;
    scene.add(paper);
  }

  const catTree = new THREE.Group();
  catTree.position.set(-4.25, 0, -0.3);
  scene.add(catTree);
  place(cylinder(0.42, 0.5, 0.12, C.woodDark, 18), catTree, [0, 0.06, 0]);
  place(cylinder(0.1, 0.1, 1.6, C.wood, 10), catTree, [0, 0.85, 0]);
  place(rounded(0.8, 0.1, 0.6, 0.05, C.cream), catTree, [0, 1.58, 0]);
  place(cylinder(0.1, 0.1, 0.8, C.wood, 10), catTree, [0.28, 0.42, 0.2], [0, 0, -0.2]);
  place(rounded(0.6, 0.08, 0.45, 0.04, C.tomato), catTree, [0.42, 0.82, 0.32], [0, 0.2, 0]);

  const plant = new THREE.Group();
  plant.position.set(4.15, 0, 1.8);
  scene.add(plant);
  place(cylinder(0.28, 0.2, 0.42, C.tomato, 16), plant, [0, 0.21, 0]);
  place(cylinder(0.035, 0.045, 1.1, C.green, 8), plant, [0, 0.9, 0]);
  for (let i = 0; i < 5; i += 1) {
    const leaf = addMesh(plant, new THREE.SphereGeometry(0.2, 16, 10), toon(C.green), [Math.sin(i * 2.4) * 0.3, 1.2 + (i % 3) * 0.18, Math.cos(i * 2.4) * 0.22], [0, i, 0], [1.4, 0.4, 0.8]);
    leaf.rotation.z = (i % 2 ? 1 : -1) * 0.5;
  }

  const boxes = new THREE.Group();
  boxes.position.set(-4.1, 0, 2.5);
  scene.add(boxes);
  const box1 = rounded(1.0, 0.7, 0.8, 0.04, C.wood);
  box1.position.set(0, 0.35, 0);
  boxes.add(box1);
  const box2 = rounded(0.8, 0.55, 0.7, 0.04, C.cream);
  box2.position.set(0.12, 0.96, -0.05);
  box2.rotation.y = -0.15;
  boxes.add(box2);
  const tape = box(0.08, 0.72, 0.82, C.tomato);
  tape.position.set(0, 0.37, 0);
  boxes.add(tape);

  const art1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.85), new THREE.MeshBasicMaterial({ map: artTexture(0) }));
  art1.position.set(2.9, 3.45, -3.83);
  scene.add(art1);
  const frame1 = box(1.55, 2.0, 0.06, C.woodDark);
  frame1.position.set(2.9, 3.45, -3.87);
  scene.add(frame1);

  const art2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.45), new THREE.MeshBasicMaterial({ map: artTexture(1) }));
  art2.position.set(-2.9, 3.55, -3.83);
  scene.add(art2);
  const frame2 = box(1.24, 1.6, 0.06, C.woodDark);
  frame2.position.set(-2.9, 3.55, -3.87);
  scene.add(frame2);

  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ map: artTexture(1) }));
  poster.position.set(-4.88, 2.7, 1.6);
  poster.rotation.y = Math.PI / 2;
  scene.add(poster);

  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i += 1) {
    dustPositions[i * 3] = (Math.sin(i * 13.7) * 0.5 + 0.5) * 9 - 4.5;
    dustPositions[i * 3 + 1] = 0.4 + ((i * 7.3) % 5) * 0.75;
    dustPositions[i * 3 + 2] = (Math.cos(i * 9.1) * 0.5 + 0.5) * 7 - 3.5;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({ color: 0xfff6e7, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  scene.add(dust);
  scene.userData.dust = dust;

  [
    ['desk', deskTop],
    ['laptop base', laptopBase],
    ['laptop screen', laptopFrame],
    ['bookshelf', shelf],
    ['cat tree', catTree],
    ['boxes', boxes],
    ['plant', plant],
    ['back wall', backWall],
    ['left wall', leftWall],
    ['right wall', rightWall],
    ['window', windowFrame],
  ].forEach(([name, object]) => addCollider(String(name), object as THREE.Object3D));

  scene.userData.colliders = colliders;
}

function findCollisions(scene: THREE.Scene): string[] {
  const colliders = (scene.userData.colliders ?? []) as Array<{ name: string; box: THREE.Box3 }>;
  const characters: Array<[string, THREE.Object3D | undefined]> = [
    ['cat', scene.userData.cat as THREE.Object3D | undefined],
    ['pig', scene.userData.pig as THREE.Object3D | undefined],
    ['corgi', scene.userData.corgi as THREE.Object3D | undefined],
  ];
  const collisions: string[] = [];
  for (const [characterName, character] of characters) {
    if (!character) continue;
    const characterBox = worldBox(character).expandByScalar(-0.025);
    for (const collider of colliders) {
      if (characterBox.intersectsBox(collider.box.clone().expandByScalar(-0.025))) {
        collisions.push(characterName + ' × ' + collider.name);
      }
    }
  }
  return collisions;
}

export function initRoom(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-room-canvas]');
  if (!canvas) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exposeStaticPanels = () => {
    root.querySelectorAll<HTMLElement>('[data-panel-body]').forEach((body) => { body.hidden = false; });
    root.querySelectorAll<HTMLElement>('[data-panel-toggle]').forEach((toggle) => { toggle.hidden = true; });
  };
  const mobileQuery = window.matchMedia('(max-width: 1280px)');
  let isMobile = mobileQuery.matches;
  const phoneQuery = window.matchMedia('(max-width: 760px)');
  let isPhone = phoneQuery.matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  if (reduced) {
    root.classList.add('is-static');
    exposeStaticPanels();
    return;
  }

  const test = document.createElement('canvas');
  const supported = Boolean(test.getContext('webgl2') || test.getContext('webgl'));
  if (!supported) {
    root.classList.add('is-static');
    exposeStaticPanels();
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    root.classList.add('is-static');
    exposeStaticPanels();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.paper);
  scene.fog = new THREE.Fog(C.paper, 12, 26);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);

  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x7a6553, 1.7));
  const key = new THREE.DirectionalLight(0xfff2dc, 2.4);
  key.position.set(-4, 7, 5);
  key.castShadow = !isMobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd2b0, 0.9);
  fill.position.set(4, 3, 2);
  scene.add(fill);
  const lampLight = new THREE.PointLight(0xffb46a, 13, 7, 2);
  lampLight.position.set(-3.9, 2.2, -1.9);
  scene.add(lampLight);

  createRoom(scene);

  const cat = scene.userData.cat as Character;
  const pig = scene.userData.pig as Character;
  const corgi = scene.userData.corgi as Character;
  const dust = scene.userData.dust as THREE.Points | undefined;

  const stationOrder: StationId[] = ['establishing', 'cat', 'pig', 'corgi', 'about'];
  const presets: Record<StationId, CameraPreset> = {
    establishing: {
      desktop: { fov: 48, padding: 0.14, direction: new THREE.Vector3(0, 0.22, 1), lateral: 0, vertical: -0.22 },
      mobile: { fov: 58, padding: 0.16, direction: new THREE.Vector3(0, 0.24, 1), lateral: 0, vertical: -0.3 },
      mobileOpen: { fov: 62, padding: 0.26, direction: new THREE.Vector3(0, 0.24, 1), lateral: 0, vertical: -0.42 },
      tablet: { fov: 58, padding: 0.2, direction: new THREE.Vector3(0, 0.24, 1), lateral: 0, vertical: -0.18 },
      tabletOpen: { fov: 62, padding: 0.35, direction: new THREE.Vector3(0, 0.24, 1), lateral: 0, vertical: -0.3 },
    },
    cat: {
      desktop: { fov: 38, padding: 0.68, direction: new THREE.Vector3(0.5, 0.18, 1), lateral: 0.71, vertical: 0 },
      mobile: { fov: 44, padding: 0.36, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.3 },
      mobileOpen: { fov: 46, padding: 0.8, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.95 },
      tablet: { fov: 44, padding: 0.7, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.15 },
      tabletOpen: { fov: 46, padding: 1.6, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.8 },
    },
    pig: {
      desktop: { fov: 38, padding: 0.68, direction: new THREE.Vector3(-0.5, 0.16, 1), lateral: -0.66, vertical: 0 },
      mobile: { fov: 44, padding: 0.36, direction: new THREE.Vector3(-0.4, 0.16, 1), lateral: 0, vertical: -0.3 },
      mobileOpen: { fov: 46, padding: 0.8, direction: new THREE.Vector3(-0.4, 0.16, 1), lateral: 0, vertical: -0.95 },
      tablet: { fov: 44, padding: 0.7, direction: new THREE.Vector3(-0.4, 0.16, 1), lateral: 0, vertical: -0.15 },
      tabletOpen: { fov: 46, padding: 1.6, direction: new THREE.Vector3(-0.4, 0.16, 1), lateral: 0, vertical: -0.8 },
    },
    corgi: {
      desktop: { fov: 38, padding: 0.68, direction: new THREE.Vector3(0.5, 0.2, 1), lateral: 0.74, vertical: 0 },
      mobile: { fov: 44, padding: 0.36, direction: new THREE.Vector3(0.45, 0.2, 1), lateral: 0, vertical: -0.3 },
      mobileOpen: { fov: 46, padding: 0.8, direction: new THREE.Vector3(0.45, 0.2, 1), lateral: 0, vertical: -0.95 },
      tablet: { fov: 44, padding: 0.7, direction: new THREE.Vector3(0.45, 0.2, 1), lateral: 0, vertical: -0.15 },
      tabletOpen: { fov: 46, padding: 1.6, direction: new THREE.Vector3(0.45, 0.2, 1), lateral: 0, vertical: -0.8 },
    },
    about: {
      desktop: { fov: 46, padding: 0.1, direction: new THREE.Vector3(0, 0.12, 1), lateral: -0.25, vertical: 0 },
      mobile: { fov: 50, padding: 0.12, direction: new THREE.Vector3(0, 0.12, 1), lateral: 0, vertical: -0.15 },
      mobileOpen: { fov: 52, padding: 0.45, direction: new THREE.Vector3(0, 0.12, 1), lateral: 0, vertical: -0.35 },
      tablet: { fov: 50, padding: 0.2, direction: new THREE.Vector3(0, 0.12, 1), lateral: 0, vertical: -0.1 },
      tabletOpen: { fov: 52, padding: 0.5, direction: new THREE.Vector3(0, 0.12, 1), lateral: 0, vertical: -0.25 },
    },
  };

  const windowBox = new THREE.Box3(
    new THREE.Vector3(-2.2, 0.4, -4.0),
    new THREE.Vector3(2.8, 4.7, -3.35),
  );
  const basePosition = new THREE.Vector3();
  const baseTarget = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const startedAt = performance.now();
  const stations = [...root.querySelectorAll<HTMLElement>('[data-station]')];
  const progressDots = [...root.querySelectorAll<HTMLElement>('.room-progress-dots i')];
  let currentStation: StationId = 'establishing';
  let panelOpen = Boolean(root.querySelector('[data-station-panel].is-open'));
  let raf = 0;
  let visible = true;

  const unionBoxes = (boxes: THREE.Box3[]) =>
    boxes.reduce((union, box) => union.union(box), new THREE.Box3());
  const characterBoxes = () => [worldBox(cat), worldBox(pig), worldBox(corgi)];
  const boxForStation = (station: StationId) => {
    if (station === 'cat') return worldBox(cat);
    if (station === 'pig') return worldBox(pig);
    if (station === 'corgi') return worldBox(corgi);
    if (station === 'about') return windowBox.clone();
    return unionBoxes(characterBoxes());
  };

  const frameBox = (box: THREE.Box3, spec: FrameSpec) => {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const vFov = THREE.MathUtils.degToRad(spec.fov);
    const aspect = Math.max(camera.aspect, 0.35);
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * aspect;
    const margin = 1 + spec.padding;
    const distanceV = (size.y * margin * 0.5) / tanV;
    const distanceH = (size.x * margin * 0.5) / tanH;
    const distance = Math.max(distanceV, distanceH, 1.2) + size.z * 0.5;
    const direction = spec.direction.clone().normalize();
    const position = center.clone().addScaledVector(direction, distance);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const target = center.clone().addScaledVector(right, spec.lateral * size.x);
    target.y += spec.vertical * size.y;
    return { position, target, fov: spec.fov };
  };

  const updateStationUI = (station: StationId) => {
    const index = stationOrder.indexOf(station);
    root.style.setProperty('--room-progress', String(Math.max(0, index) / 4));
    progressDots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
    stations.forEach((element, stationIndex) => {
      element.classList.toggle('is-active', stationIndex === index);
    });
  };

  const applyStation = (station: StationId, immediate = false) => {
    currentStation = station;
    updateStationUI(station);
    const preset = !isMobile
      ? presets[station].desktop
      : isPhone
        ? (panelOpen && presets[station].mobileOpen ? presets[station].mobileOpen! : presets[station].mobile)
        : (panelOpen && presets[station].tabletOpen ? presets[station].tabletOpen! : presets[station].tablet);
    const frame = frameBox(boxForStation(station), preset);
    gsap.killTweensOf(basePosition);
    gsap.killTweensOf(baseTarget);
    gsap.killTweensOf(camera);

    if (immediate) {
      basePosition.copy(frame.position);
      baseTarget.copy(frame.target);
      camera.fov = frame.fov;
      camera.updateProjectionMatrix();
    } else {
      gsap.to(basePosition, {
        x: frame.position.x,
        y: frame.position.y,
        z: frame.position.z,
        duration: 1.1,
        ease: 'power2.inOut',
        overwrite: true,
      });
      gsap.to(baseTarget, {
        x: frame.target.x,
        y: frame.target.y,
        z: frame.target.z,
        duration: 1.1,
        ease: 'power2.inOut',
        overwrite: true,
      });
      gsap.to(camera, {
        fov: frame.fov,
        duration: 1.1,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    }
  };

  const stationObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries.find((item) => item.isIntersecting);
      if (!entry) return;
      const index = Number(entry.target.getAttribute('data-station'));
      const next = stationOrder[index];
      if (next) applyStation(next);
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
  );
  stations.forEach((station) => stationObserver.observe(station));

  window.addEventListener(
    'pointermove',
    (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  const playReaction = (kind: string) => {
    const character = kind === 'cat' ? cat : kind === 'pig' ? pig : corgi;
    if (!character) return;
    gsap.killTweensOf(character.scale);
    gsap.timeline()
      .to(character.scale, { x: 1.04, y: 0.97, z: 1.04, duration: 0.1, ease: 'power2.out' })
      .to(character.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'elastic.out(1, 0.45)' });
    if (kind === 'cat') {
      gsap.fromTo(character.position, { y: character.position.y }, { y: character.position.y + 0.08, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' });
    } else if (kind === 'pig') {
      gsap.to(character.rotation, { y: character.rotation.y + 0.15, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.inOut' });
    } else {
      gsap.to(character.rotation, { z: 0.08, duration: 0.12, yoyo: true, repeat: 3, ease: 'power1.inOut', onComplete: () => { character.rotation.z = 0; } });
    }
  };

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-poke]') : null;
    if (target?.dataset.poke) playReaction(target.dataset.poke);
  });

  const corgiBaseY = corgi.position.y;
  const render = () => {
    raf = requestAnimationFrame(render);
    if (!visible || document.hidden) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    camera.position.copy(basePosition);
    if (!isTouch) {
      camera.position.x += THREE.MathUtils.clamp(pointer.x, -1, 1) * 0.08;
      camera.position.y -= THREE.MathUtils.clamp(pointer.y, -1, 1) * 0.04;
    }
    camera.lookAt(baseTarget);

    if (cat) {
      cat.userData.parts.head.rotation.y = Math.sin(elapsed * 0.8) * 0.04;
      cat.userData.parts.tail.rotation.z = Math.sin(elapsed * 1.8) * 0.1;
      cat.userData.parts.armL.rotation.x = 0.85 + Math.sin(elapsed * 5.2) * 0.06;
      cat.userData.parts.armR.rotation.x = 0.85 + Math.cos(elapsed * 5.4) * 0.06;
    }
    if (pig) {
      pig.userData.parts.head.rotation.y = Math.sin(elapsed * 0.65 + 1) * 0.03;
      pig.userData.parts.head.rotation.z = Math.sin(elapsed * 0.9) * 0.015;
      pig.userData.parts.board.rotation.z = -0.08 + Math.sin(elapsed * 0.7) * 0.015;
    }
    if (corgi) {
      corgi.position.y = corgiBaseY + Math.abs(Math.sin(elapsed * 1.8)) * 0.02;
      corgi.userData.parts.tail.rotation.z = Math.sin(elapsed * 3.2) * 0.14;
      corgi.userData.parts.head.rotation.z = Math.sin(elapsed * 0.9) * 0.02;
    }
    if (dust) dust.rotation.y = elapsed * 0.012;

    renderer.render(scene, camera);
  };

  const screenRect = (object: THREE.Object3D): ScreenRect => {
    const box = worldBox(object);
    const min = box.min;
    const max = box.max;
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
    ];
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const corner of corners) {
      const projected = corner.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };

  const getFraming = () => {
    const activePanel = root.querySelector<HTMLElement>('.room-station.is-active .station-panel');
    const panelBox = activePanel?.getBoundingClientRect();
    return {
      station: currentStation,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      characters: { cat: screenRect(cat), pig: screenRect(pig), corgi: screenRect(corgi) },
      panel: panelBox ? { left: panelBox.left, top: panelBox.top, right: panelBox.right, bottom: panelBox.bottom, width: panelBox.width, height: panelBox.height } : null,
      collisions: findCollisions(scene),
    };
  };

  (window as unknown as { __catteryRoomDebug?: { getFraming: () => unknown; getCollisions: () => string[]; setStation: (station: StationId) => void } }).__catteryRoomDebug = {
    getFraming,
    getCollisions: () => findCollisions(scene),
    setStation: (station: StationId) => applyStation(station, true),
  };

  const onPanelToggle = (event: Event) => {
    const detail = (event as CustomEvent<{ open?: boolean }>).detail;
    panelOpen = Boolean(detail?.open);
    if (isMobile) applyStation(currentStation);
  };
  window.addEventListener('cattery:panel-toggle', onPanelToggle);

  const collisions = findCollisions(scene);
  if (collisions.length > 0) {
    console.warn('[cattery room] collision audit:', collisions);
  }

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
    },
    { threshold: 0.01 },
  );
  visibilityObserver.observe(root);

  const resize = () => {
    isMobile = mobileQuery.matches;
    isPhone = phoneQuery.matches;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    applyStation(currentStation, true);
  };
  window.addEventListener('resize', resize, { passive: true });

  const cleanup = () => {
    cancelAnimationFrame(raf);
    stationObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener('cattery:panel-toggle', onPanelToggle);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    renderer.dispose();
  };
  window.addEventListener('pagehide', cleanup, { once: true });

  root.classList.add('is-ready');
  applyStation('establishing', true);
  render();
}



