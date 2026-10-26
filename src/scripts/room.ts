import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { CharacterKind } from './room/characters';

const C = {
  paper: 0x070a12,
  paperDeep: 0x0c1320,
  ink: 0x05070c,
  inkSoft: 0x6f849a,
  tomato: 0xff3ea5,
  tomatoDark: 0x4debff,
  cat: 0xff9a3d,
  catDark: 0xe56a12,
  pig: 0xff6fae,
  pigDark: 0xe95599,
  corgi: 0xff9a3d,
  cream: 0xf4fbff,
  white: 0xf4fbff,
  wood: 0x1a2433,
  woodDark: 0x0f1724,
  mint: 0x4debff,
  sky: 0x0b1222,
  green: 0x4debff,
  dark: 0x05070c,
};

export type Character = THREE.Group & {
  userData: { parts: Record<string, THREE.Object3D>; kind?: CharacterKind };
};

type RoomRole = 'wall' | 'wallSide' | 'floor' | 'wood' | 'woodDark' | 'rug' | 'rugInner' | 'accent' | 'accentAlt' | 'propCream';

const CHARACTER_LINES: Record<CharacterKind, string[]> = {
  cat: [
    '这个 Bug 不是我写的，是昨天的我写的。',
    '再给我五分钟，我把日志看完。',
    '上线前先深呼吸，然后提交。',
    '键盘声音再大一点，问题就会怕。',
    '我不是在摸鱼，我在等待构建。',
    '耳机里没有音乐，只有风扇声。',
  ],
  pig: [
    '这个需求可以上线，但得先加个开关。',
    '我看过了，整体没问题，除了所有问题。',
    '仓库不是仓库，是团队的记忆。',
    '先别加功能，把 README 写明白。',
    '这个排期……我们再同步一下。',
    '可以，但不要今晚发版。',
  ],
  corgi: [
    '你的待办清单我刚才踩乱了。',
    '这个链接看起来能吃。',
    '我没有撞翻纸堆，是纸堆先动的手。',
    '再点一下，我可能会跑得更快。',
    '笔记写完了吗？我叼走了一页。',
    '柯基不负责 Bug，只负责热闹。',
  ],
};

const CHARACTER_NAMES: Record<CharacterKind, string> = {
  cat: '猫工程师',
  pig: '猪老板',
  corgi: '柯基捣蛋鬼',
};

const ROOM_PALETTES: Record<'night' | 'lightsOn', Record<RoomRole, number>> = {
  night: {
    wall: 0x0b111b,
    wallSide: 0x080d16,
    floor: 0x111927,
    wood: 0x1b2634,
    woodDark: 0x0d141f,
    rug: 0x331520,
    rugInner: 0x111822,
    accent: 0x4debff,
    accentAlt: 0xff4fa3,
    propCream: 0x8b806f,
  },
  lightsOn: {
    wall: 0x756e64,
    wallSide: 0x5f5950,
    floor: 0x4d392c,
    wood: 0x715239,
    woodDark: 0x3f2b21,
    rug: 0x7a4638,
    rugInner: 0x5e574d,
    accent: 0xc89b62,
    accentAlt: 0xb7654d,
    propCream: 0xd7c4a8,
  },
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

interface CharacterControlState {
  object: Character;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
  baseScale: THREE.Vector3;
  dragging: boolean;
  reactionCount: number;
  reaction: gsap.core.Timeline | null;
  returnTween: gsap.core.Tween | null;
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

const characterMaterialCache = new Map<number, THREE.MeshStandardMaterial>();
function characterMaterial(color: number): THREE.MeshStandardMaterial {
  const cached = characterMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
    emissive: new THREE.Color(color).multiplyScalar(0.035),
  });
  characterMaterialCache.set(color, material);
  return material;
}

function finishCharacter(group: Character, kind: CharacterKind): Character {
  group.userData.kind = kind;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return group;
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
export function snapToSurface(object: THREE.Object3D, surfaceY: number): void {
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
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, 640, 180);
    ctx.strokeStyle = '#4debff';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 624, 164);
    ctx.shadowColor = '#ff3ea5';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff3ea5';
    ctx.font = '800 88px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('cattery', 320, 112);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4debff';
    ctx.fillRect(250, 134, 140, 6);
  });
}

function cyberWindowTexture(lightsOn = false): THREE.CanvasTexture {
  return makeTexture(1024, 640, (ctx) => {
    const bands = lightsOn
      ? ['#4a4540', '#5a4d43', '#69584b', '#786354', '#3b3834']
      : ['#050810', '#091224', '#101b32', '#17233b', '#08101c'];
    const bandHeight = 640 / bands.length;
    bands.forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, index * bandHeight, 1024, bandHeight + 1);
    });

    const colors = lightsOn
      ? ['#c8884d', '#87a9a5', '#b86b55', '#d6b178']
      : ['#4debff', '#ff3ea5', '#8d6bff', '#ff9a3d'];
    for (let i = 0; i < 28; i += 1) {
      const w = 22 + ((i * 37) % 52);
      const h = 100 + ((i * 73) % 260);
      const x = (i * 79) % 990;
      const y = 250 - h;
      ctx.fillStyle = lightsOn ? (i % 3 === 0 ? '#494640' : '#3d3b38') : (i % 3 === 0 ? '#0b1725' : '#101d30');
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = colors[i % colors.length];
      for (let j = 0; j < 8; j += 1) {
        if ((i + j * 3) % 4 === 0) continue;
        ctx.globalAlpha = lightsOn ? 0.35 + (j % 3) * 0.08 : 0.55 + (j % 3) * 0.15;
        ctx.fillRect(x + 5 + (j % 3) * 9, y + 12 + Math.floor(j / 3) * 17, 3, 7);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = lightsOn ? '#272827' : '#07101a';
    ctx.fillRect(0, 420, 1024, 220);
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 47) % 1024;
      const w = 3 + (i % 5);
      const h = 30 + (i * 11) % 80;
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = lightsOn ? 0.16 : 0.35;
      ctx.fillRect(x, 440 + (i % 6) * 18, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = lightsOn ? 'rgba(224,162,90,.28)' : 'rgba(77,235,255,.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 101) % 1024;
      const y = (i * 53) % 620;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12, y + 36);
      ctx.stroke();
    }
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
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, 360, 480);
    ctx.strokeStyle = '#4debff';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 340, 460);
    ctx.shadowColor = '#ff3ea5';
    ctx.shadowBlur = 18;
    ctx.fillStyle = variant === 0 ? '#ff3ea5' : '#4debff';
    ctx.beginPath();
    ctx.arc(180, 210, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#4debff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(70, 320);
    ctx.lineTo(290, 320);
    ctx.stroke();
    ctx.fillStyle = '#e9f7ff';
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText('CATTERY', 82, 70);
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('NEON ROOM / 2026', 82, 104);
  });
}
export function createCat(): Character {
  const group = new THREE.Group() as Character;
  const orange = characterMaterial(C.cat);
  const orangeDark = characterMaterial(C.catDark);
  const cream = characterMaterial(C.cream);
  const ink = characterMaterial(C.ink);
  const pink = characterMaterial(0xef7890);
  const lens = new THREE.MeshBasicMaterial({ color: 0x83ecf2, transparent: true, opacity: 0.34, depthWrite: false });

  addMesh(group, new THREE.CapsuleGeometry(0.4, 0.42, 8, 18), orange, [0, 0.62, 0], [0, 0, 0], [1, 1, 0.9]);
  addMesh(group, new THREE.SphereGeometry(0.235, 24, 16), cream, [0, 0.62, 0.3], [0, 0, 0], [1, 0.92, 0.48]);
  for (let i = 0; i < 3; i += 1) {
    addMesh(group, new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), orangeDark, [0.03 + i * 0.1, 0.82 - i * 0.07, -0.2], [0.2, 0.3, -0.22], [1, 1, 0.45]);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.11, 0.04);
  group.add(head);
  addMesh(head, new THREE.SphereGeometry(0.4, 32, 24), orange, [0, 0, 0], [0, 0, 0], [1.02, 0.95, 0.94]);
  addMesh(head, new THREE.ConeGeometry(0.18, 0.34, 3), orange, [-0.23, 0.34, 0], [0, 0.2, -0.12]);
  addMesh(head, new THREE.ConeGeometry(0.18, 0.34, 3), orange, [0.23, 0.34, 0], [0, -0.2, 0.12]);
  addMesh(head, new THREE.ConeGeometry(0.1, 0.2, 3), pink, [-0.23, 0.34, 0.035], [0, 0.2, -0.12]);
  addMesh(head, new THREE.ConeGeometry(0.1, 0.2, 3), pink, [0.23, 0.34, 0.035], [0, -0.2, 0.12]);

  addMesh(head, new THREE.SphereGeometry(0.065, 16, 12), cream, [-0.14, 0.08, 0.335], [0, 0, 0], [1.15, 1.05, 0.55]);
  addMesh(head, new THREE.SphereGeometry(0.065, 16, 12), cream, [0.14, 0.08, 0.335], [0, 0, 0], [1.15, 1.05, 0.55]);
  addMesh(head, new THREE.SphereGeometry(0.043, 16, 12), ink, [-0.14, 0.08, 0.382]);
  addMesh(head, new THREE.SphereGeometry(0.043, 16, 12), ink, [0.14, 0.08, 0.382]);
  addMesh(head, new THREE.SphereGeometry(0.014, 12, 8), cream, [-0.125, 0.097, 0.416]);
  addMesh(head, new THREE.SphereGeometry(0.014, 12, 8), cream, [0.155, 0.097, 0.416]);

  addMesh(head, new THREE.SphereGeometry(0.18, 24, 16), cream, [0, -0.08, 0.31], [0, 0, 0], [1, 0.8, 0.55]);
  addMesh(head, new THREE.SphereGeometry(0.052, 16, 12), pink, [0, -0.035, 0.445], [0, 0, 0], [1, 0.75, 0.6]);

  const goggleBand = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.024, 8, 32), ink);
  goggleBand.rotation.x = Math.PI / 2;
  goggleBand.position.y = 0.16;
  head.add(goggleBand);
  const lensGeo = new THREE.TorusGeometry(0.087, 0.017, 8, 20);
  addMesh(head, lensGeo, ink, [-0.14, 0.08, 0.405], [0, 0, 0], [1, 0.78, 1]);
  addMesh(head, lensGeo.clone(), ink, [0.14, 0.08, 0.405], [0, 0, 0], [1, 0.78, 1]);
  addMesh(head, new THREE.CircleGeometry(0.067, 20), lens, [-0.14, 0.08, 0.423], [0, 0, 0], [1, 0.78, 1]);
  addMesh(head, new THREE.CircleGeometry(0.067, 20), lens, [0.14, 0.08, 0.423], [0, 0, 0], [1, 0.78, 1]);

  const headphoneBand = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.036, 8, 32, Math.PI), ink);
  headphoneBand.position.set(0, 0.08, -0.02);
  head.add(headphoneBand);
  const cupGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.075, 20);
  const cupL = addMesh(head, cupGeo, ink, [-0.405, 0.05, 0.01], [0, 0, Math.PI / 2]);
  const cupR = addMesh(head, cupGeo.clone(), ink, [0.405, 0.05, 0.01], [0, 0, Math.PI / 2]);
  addMesh(cupL, new THREE.TorusGeometry(0.085, 0.012, 6, 20), orangeDark, [0, -0.04, 0], [Math.PI / 2, 0, 0]);
  addMesh(cupR, new THREE.TorusGeometry(0.085, 0.012, 6, 20), orangeDark, [0, -0.04, 0], [Math.PI / 2, 0, 0]);

  const armL = addMesh(group, new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), orange, [-0.4, 0.7, 0.3], [0.85, 0, 0.24]);
  const armR = addMesh(group, new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), orange, [0.4, 0.7, 0.3], [0.85, 0, -0.24]);
  addMesh(armL, new THREE.SphereGeometry(0.075, 14, 10), cream, [0, 0.18, 0]);
  addMesh(armR, new THREE.SphereGeometry(0.075, 14, 10), cream, [0, 0.18, 0]);
  addMesh(group, new THREE.CapsuleGeometry(0.12, 0.2, 4, 8), orange, [-0.2, 0.15, 0.02]);
  addMesh(group, new THREE.CapsuleGeometry(0.12, 0.2, 4, 8), orange, [0.2, 0.15, 0.02]);
  addMesh(group, new THREE.SphereGeometry(0.13, 16, 10), cream, [-0.2, 0.035, 0.09], [0, 0, 0], [1.2, 0.55, 1.35]);
  addMesh(group, new THREE.SphereGeometry(0.13, 16, 10), cream, [0.2, 0.035, 0.09], [0, 0, 0], [1.2, 0.55, 1.35]);

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
  addMesh(tail, new THREE.SphereGeometry(0.08, 12, 8), cream, [0.55, 0.75, -0.05]);

  group.userData.parts = { head, armL, armR, tail, body: group };
  return finishCharacter(group, 'cat');
}

export function createPig(): Character {
  const group = new THREE.Group() as Character;
  const pink = characterMaterial(0xf5adc0);
  const pinkLight = characterMaterial(0xffc7d5);
  const pinkDark = characterMaterial(0xe887a2);
  const rose = characterMaterial(0xc8758d);
  const ink = characterMaterial(C.ink);
  const cream = characterMaterial(0xfff1e5);
  const coral = characterMaterial(0xe97783);
  const blush = new THREE.MeshBasicMaterial({ color: 0xf17d98, transparent: true, opacity: 0.3, depthWrite: false });
  const tablet = new THREE.MeshBasicMaterial({ color: 0x355464 });
  const tabletLine = new THREE.MeshBasicMaterial({ color: 0x8de3dc });
  const tabletAccent = new THREE.MeshBasicMaterial({ color: 0xf2c37b });

  addMesh(group, new THREE.CapsuleGeometry(0.4, 0.34, 8, 22), pink, [0, 0.62, 0], [0, 0, 0], [1.05, 0.98, 0.9]);
  addMesh(group, new THREE.SphereGeometry(0.24, 24, 16), pinkLight, [0, 0.56, 0.31], [0, 0, 0], [1, 1.05, 0.42]);
  addMesh(group, new THREE.SphereGeometry(0.16, 20, 14), pinkLight, [0, 0.43, 0.36], [0, 0, 0], [1.12, 0.8, 0.26]);

  addMesh(group, new RoundedBoxGeometry(0.27, 0.46, 0.08, 4, 0.06), rose, [-0.19, 0.66, 0.31], [0.04, 0, 0.12]);
  addMesh(group, new RoundedBoxGeometry(0.27, 0.46, 0.08, 4, 0.06), rose, [0.19, 0.66, 0.31], [0.04, 0, -0.12]);
  addMesh(group, new THREE.ConeGeometry(0.065, 0.14, 3), cream, [-0.07, 0.82, 0.36], [0, 0, -0.45]);
  addMesh(group, new THREE.ConeGeometry(0.065, 0.14, 3), cream, [0.07, 0.82, 0.36], [0, 0, 0.45]);
  addMesh(group, new THREE.SphereGeometry(0.05, 14, 10), coral, [-0.055, 0.69, 0.39], [0, 0, 0], [1.15, 0.72, 0.5]);
  addMesh(group, new THREE.SphereGeometry(0.05, 14, 10), coral, [0.055, 0.69, 0.39], [0, 0, 0], [1.15, 0.72, 0.5]);
  addMesh(group, new THREE.SphereGeometry(0.035, 12, 8), coral, [0, 0.69, 0.4]);

  const head = new THREE.Group();
  head.position.set(0, 1.27, 0.04);
  group.add(head);
  addMesh(head, new THREE.SphereGeometry(0.36, 32, 22), pink, [0, 0, 0], [0, 0, 0], [1.04, 0.96, 0.96]);
  addMesh(head, new THREE.ConeGeometry(0.13, 0.25, 16), pink, [-0.235, 0.31, 0], [0, 0.18, -0.18]);
  addMesh(head, new THREE.ConeGeometry(0.13, 0.25, 16), pink, [0.235, 0.31, 0], [0, -0.18, 0.18]);
  addMesh(head, new THREE.ConeGeometry(0.075, 0.15, 16), pinkDark, [-0.235, 0.3, 0.025], [0, 0.18, -0.18]);
  addMesh(head, new THREE.ConeGeometry(0.075, 0.15, 16), pinkDark, [0.235, 0.3, 0.025], [0, -0.18, 0.18]);

  addMesh(head, new THREE.SphereGeometry(0.07, 18, 14), cream, [-0.13, 0.065, 0.3], [0, 0, 0], [1, 1.16, 0.48]);
  addMesh(head, new THREE.SphereGeometry(0.07, 18, 14), cream, [0.13, 0.065, 0.3], [0, 0, 0], [1, 1.16, 0.48]);
  addMesh(head, new THREE.SphereGeometry(0.047, 16, 12), ink, [-0.13, 0.055, 0.335], [0, 0, 0], [1, 1.08, 0.62]);
  addMesh(head, new THREE.SphereGeometry(0.047, 16, 12), ink, [0.13, 0.055, 0.335], [0, 0, 0], [1, 1.08, 0.62]);
  addMesh(head, new THREE.SphereGeometry(0.016, 12, 8), cream, [-0.115, 0.075, 0.37]);
  addMesh(head, new THREE.SphereGeometry(0.016, 12, 8), cream, [0.145, 0.075, 0.37]);

  addMesh(head, new THREE.CircleGeometry(0.065, 20), blush, [-0.25, -0.06, 0.335], [0, 0, 0], [1, 0.58, 1]);
  addMesh(head, new THREE.CircleGeometry(0.065, 20), blush, [0.25, -0.06, 0.335], [0, 0, 0], [1, 0.58, 1]);

  addMesh(head, new THREE.CylinderGeometry(0.155, 0.155, 0.1, 24), pinkDark, [0, -0.065, 0.345], [Math.PI / 2, 0, 0], [1.08, 1, 0.78]);
  addMesh(head, new THREE.SphereGeometry(0.024, 12, 8), ink, [-0.055, -0.065, 0.4], [0, 0, 0], [1, 1.2, 0.45]);
  addMesh(head, new THREE.SphereGeometry(0.024, 12, 8), ink, [0.055, -0.065, 0.4], [0, 0, 0], [1, 1.2, 0.45]);
  addMesh(head, new THREE.TorusGeometry(0.048, 0.008, 6, 18, Math.PI), ink, [0, -0.155, 0.39], [0, 0, Math.PI]);

  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), pink, [-0.38, 0.66, 0.12], [0.58, 0, 0.42]);
  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), pink, [0.38, 0.66, 0.12], [0.58, 0, -0.42]);
  addMesh(group, new THREE.SphereGeometry(0.1, 14, 10), pinkDark, [-0.4, 0.55, 0.2], [0, 0, 0], [1, 0.82, 0.82]);
  addMesh(group, new THREE.SphereGeometry(0.1, 14, 10), pinkDark, [0.4, 0.55, 0.2], [0, 0, 0], [1, 0.82, 0.82]);
  addMesh(group, new THREE.CapsuleGeometry(0.135, 0.16, 4, 10), pink, [-0.23, 0.16, 0.04], [0, 0, 0.04]);
  addMesh(group, new THREE.CapsuleGeometry(0.135, 0.16, 4, 10), pink, [0.23, 0.16, 0.04], [0, 0, -0.04]);
  addMesh(group, new THREE.SphereGeometry(0.14, 16, 10), pinkDark, [-0.23, 0.045, 0.12], [0, 0, 0], [1.15, 0.48, 1.25]);
  addMesh(group, new THREE.SphereGeometry(0.14, 16, 10), pinkDark, [0.23, 0.045, 0.12], [0, 0, 0], [1.15, 0.48, 1.25]);

  const tail = addMesh(group, new THREE.TorusGeometry(0.08, 0.022, 8, 24, Math.PI * 1.45), pinkDark, [0, 0.64, -0.43], [Math.PI / 2, 0.3, 0]);
  tail.scale.set(0.9, 0.9, 0.8);

  const board = new THREE.Group();
  board.position.set(0.48, 0.78, 0.38);
  board.rotation.set(-0.12, -0.18, -0.12);
  group.add(board);
  place(new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.42, 0.05, 4, 0.045), rose), board, [0, 0, 0]);
  addMesh(board, new THREE.PlaneGeometry(0.26, 0.3), tablet, [0, 0, 0.031]);
  addMesh(board, new THREE.BoxGeometry(0.17, 0.016, 0.012), tabletLine, [0, 0.075, 0.04]);
  addMesh(board, new THREE.BoxGeometry(0.12, 0.013, 0.012), tabletAccent, [-0.025, 0.02, 0.04]);
  addMesh(board, new THREE.BoxGeometry(0.15, 0.013, 0.012), tabletLine, [0, -0.03, 0.04]);

  group.userData.parts = { head, board, tail, body: group };
  return finishCharacter(group, 'pig');
}

export function createCorgi(): Character {
  const group = new THREE.Group() as Character;
  const orange = characterMaterial(C.corgi);
  const orangeDark = characterMaterial(0xc75f21);
  const cream = characterMaterial(C.cream);
  const ink = characterMaterial(C.ink);
  const pink = characterMaterial(0xef7890);

  addMesh(group, new THREE.CapsuleGeometry(0.4, 0.26, 8, 18), orange, [0, 0.5, 0], [0, 0, 0], [1, 0.9, 0.85]);
  addMesh(group, new THREE.SphereGeometry(0.245, 22, 16), cream, [0, 0.48, 0.29], [0, 0, 0], [1, 1.05, 0.52]);
  addMesh(group, new THREE.SphereGeometry(0.22, 20, 14), cream, [0, 0.33, 0.21], [0, 0, 0], [1.1, 1.1, 0.55]);
  addMesh(group, new THREE.SphereGeometry(0.18, 18, 12), orangeDark, [0, 0.55, -0.26], [0, 0, 0], [1.15, 0.95, 0.5]);

  const head = new THREE.Group();
  head.position.set(0, 1.02, 0.05);
  group.add(head);
  addMesh(head, new THREE.SphereGeometry(0.36, 30, 20), orange, [0, 0, 0], [0, 0, 0], [1.08, 0.96, 0.95]);
  addMesh(head, new THREE.ConeGeometry(0.17, 0.44, 3), orange, [-0.25, 0.38, 0], [0, 0.18, -0.35]);
  addMesh(head, new THREE.ConeGeometry(0.17, 0.44, 3), orange, [0.25, 0.38, 0], [0, -0.18, 0.35]);
  addMesh(head, new THREE.ConeGeometry(0.09, 0.27, 3), cream, [-0.25, 0.38, 0.02], [0, 0.18, -0.35]);
  addMesh(head, new THREE.ConeGeometry(0.09, 0.27, 3), cream, [0.25, 0.38, 0.02], [0, -0.18, 0.35]);

  addMesh(head, new THREE.SphereGeometry(0.045, 16, 12), ink, [-0.125, 0.08, 0.36]);
  addMesh(head, new THREE.SphereGeometry(0.045, 16, 12), ink, [0.125, 0.08, 0.36]);
  addMesh(head, new THREE.SphereGeometry(0.014, 12, 8), cream, [-0.11, 0.095, 0.391]);
  addMesh(head, new THREE.SphereGeometry(0.014, 12, 8), cream, [0.14, 0.095, 0.391]);

  addMesh(head, new THREE.SphereGeometry(0.205, 24, 16), cream, [0, -0.08, 0.285], [0, 0, 0], [1.12, 0.8, 0.72]);
  addMesh(head, new THREE.SphereGeometry(0.16, 20, 14), cream, [0, 0.035, 0.325], [0, 0, 0], [0.6, 1.35, 0.28]);
  addMesh(head, new THREE.SphereGeometry(0.046, 12, 8), ink, [0, -0.035, 0.45]);
  addMesh(head, new THREE.BoxGeometry(0.1, 0.07, 0.035), pink, [0, -0.125, 0.41], [0.18, 0, 0]);
  addMesh(head, new THREE.SphereGeometry(0.065, 14, 10), cream, [-0.2, -0.09, 0.33], [0, 0, 0], [1.15, 0.8, 0.45]);
  addMesh(head, new THREE.SphereGeometry(0.065, 14, 10), cream, [0.2, -0.09, 0.33], [0, 0, 0], [1.15, 0.8, 0.45]);

  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.18, 4, 8), cream, [-0.2, 0.16, 0.03]);
  addMesh(group, new THREE.CapsuleGeometry(0.09, 0.18, 4, 8), cream, [0.2, 0.16, 0.03]);
  addMesh(group, new THREE.SphereGeometry(0.105, 14, 10), cream, [-0.2, 0.035, 0.09], [0, 0, 0], [1.2, 0.5, 1.3]);
  addMesh(group, new THREE.SphereGeometry(0.105, 14, 10), cream, [0.2, 0.035, 0.09], [0, 0, 0], [1.2, 0.5, 1.3]);
  addMesh(group, new THREE.TorusGeometry(0.23, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: 0x8c4e2b }), [0, 0.79, 0], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CapsuleGeometry(0.08, 0.16, 4, 8), orange, [-0.35, 0.55, -0.05], [0, 0, 0.4]);
  addMesh(group, new THREE.CapsuleGeometry(0.08, 0.16, 4, 8), orange, [0.35, 0.55, -0.05], [0, 0, -0.4]);
  addMesh(group, new THREE.SphereGeometry(0.085, 12, 8), cream, [-0.35, 0.46, 0.02]);
  addMesh(group, new THREE.SphereGeometry(0.085, 12, 8), cream, [0.35, 0.46, 0.02]);

  const tail = addMesh(group, new THREE.ConeGeometry(0.1, 0.22, 12), orange, [0, 0.62, -0.48], [1.18, 0, 0]);
  addMesh(group, new THREE.SphereGeometry(0.07, 12, 8), cream, [0, 0.1, -0.08]).position.set(0, 0.72, -0.54);

  group.userData.parts = { head, tail, body: group };
  return finishCharacter(group, 'corgi');
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
  const windowTextures = {
    night: cyberWindowTexture(false),
    lightsOn: cyberWindowTexture(true),
  };
  const skyMaterial = new THREE.MeshBasicMaterial({ map: windowTextures.night });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), skyMaterial);
  sky.position.set(0.2, 2.85, -3.79);
  scene.add(sky);
  scene.userData.windowTextures = windowTextures;
  scene.userData.skyMaterial = skyMaterial;

  const neonMaterial = new THREE.MeshBasicMaterial({ color: C.tomatoDark });
  const magentaMaterial = new THREE.MeshBasicMaterial({ color: C.tomato });
  const makeGlowStrip = (w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Material) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color);
    strip.position.set(x, y, z);
    scene.add(strip);
    return strip;
  };
  makeGlowStrip(3.1, 0.035, 0.035, 0.2, 1.78, -3.76, neonMaterial);
  makeGlowStrip(0.035, 1.9, 0.035, -1.42, 2.85, -3.76, magentaMaterial);
  makeGlowStrip(0.035, 1.9, 0.035, 1.82, 2.85, -3.76, neonMaterial);
  makeGlowStrip(9.4, 0.035, 0.035, 0, 0.18, -3.78, magentaMaterial);
  makeGlowStrip(2.8, 0.025, 0.025, 2.9, 3.25, -3.4, neonMaterial);
  makeGlowStrip(2.8, 0.025, 0.025, 2.9, 0.35, -3.4, magentaMaterial);

  for (let i = 0; i < 8; i += 1) {
    const panel = rounded(0.38, 0.38, 0.08, 0.04, i % 2 === 0 ? C.paperDeep : C.woodDark);
    panel.position.set(-3.8 + (i % 4) * 0.42, 3.8 - Math.floor(i / 4) * 0.42, -3.88);
    scene.add(panel);
  }

  const cityRainGeometry = new THREE.BufferGeometry();
  const cityRainPositions = new Float32Array(80 * 3);
  for (let i = 0; i < 80; i += 1) {
    cityRainPositions[i * 3] = -1.4 + ((i * 37) % 280) / 100;
    cityRainPositions[i * 3 + 1] = 1.9 + ((i * 23) % 170) / 100;
    cityRainPositions[i * 3 + 2] = -3.73;
  }
  cityRainGeometry.setAttribute('position', new THREE.BufferAttribute(cityRainPositions, 3));
  const cityRain = new THREE.Points(cityRainGeometry, new THREE.PointsMaterial({ color: 0x9beeff, size: 0.018, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(cityRain);
  scene.userData.cityRain = cityRain;
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

  const screenGlows: THREE.PointLight[] = [];
  [-3.6, -2.7, -1.8].forEach((x, index) => {
    const frame = rounded(0.86, 0.54, 0.06, 0.03, C.dark);
    frame.position.set(x, 1.76, -2.3);
    scene.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.46), new THREE.MeshBasicMaterial({ map: laptopTexture() }));
    screen.position.set(x, 1.76, -2.26);
    scene.add(screen);
    const glow = new THREE.PointLight(index === 1 ? 0xff4fa3 : 0x4debff, 0.48, 2.25, 2);
    glow.position.set(x, 1.6, -2.0);
    scene.add(glow);
    screenGlows.push(glow);
  });
  scene.userData.screenGlows = screenGlows;

  const keyboard = box(0.78, 0.035, 0.24, C.dark);
  keyboard.position.set(-2.7, 1.11, -1.08);
  scene.add(keyboard);
  const keyboardGlow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.008, 0.018), neonMaterial);
  keyboardGlow.position.set(-2.7, 1.13, -0.96);
  scene.add(keyboardGlow);

  const pcTower = rounded(0.62, 1.25, 0.56, 0.05, C.dark);
  pcTower.position.set(-1.05, 0.72, -2.35);
  scene.add(pcTower);
  const pcWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.86), new THREE.MeshBasicMaterial({ color: 0x101d2f }));
  pcWindow.position.set(-1.05, 0.8, -2.06);
  scene.add(pcWindow);
  [0.95, 0.72, 0.49].forEach((y, index) => {
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 8, 24), index === 1 ? magentaMaterial : neonMaterial);
    fan.position.set(-1.05, y, -2.04);
    scene.add(fan);
  });

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

  const chair = new THREE.Group();
  chair.position.set(-2.9, 0, 0.05);
  scene.add(chair);
  const chairSeat = rounded(1.2, 0.16, 1.0, 0.08, C.dark);
  chairSeat.position.set(0, 0.55, 0);
  chair.add(chairSeat);
  const chairBack = rounded(1.2, 1.0, 0.16, 0.08, C.dark);
  chairBack.position.set(0, 1.0, -0.48);
  chairBack.rotation.x = -0.08;
  chair.add(chairBack);
  addMesh(chair, new THREE.BoxGeometry(1.1, 0.028, 0.04), neonMaterial, [0, 1.48, -0.52]);
  addMesh(chair, new THREE.BoxGeometry(0.028, 0.8, 0.04), magentaMaterial, [-0.58, 0.96, -0.39]);
  const chairBase = cylinder(0.06, 0.2, 0.4, C.dark, 12);
  chairBase.position.set(0, 0.22, 0);
  chair.add(chairBase);

  const pigStage = rounded(1.55, 0.22, 1.3, 0.05, C.dark);
  pigStage.position.set(2.45, 0.12, -1.55);
  scene.add(pigStage);
  addMesh(scene, new THREE.BoxGeometry(1.35, 0.025, 0.025), neonMaterial, [2.45, 0.24, -0.92]);
  addMesh(scene, new THREE.BoxGeometry(1.85, 0.025, 0.025), magentaMaterial, [0.8, 0.2, 2.18]);

  const corgiBed = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.22, 14, 36), toon(C.tomato));
  corgiBed.scale.set(1.25, 0.65, 1);
  corgiBed.rotation.x = Math.PI / 2;
  corgiBed.position.set(0.8, 0.27, 1.55);
  scene.add(corgiBed);
  const corgiCushion = new THREE.Mesh(new THREE.SphereGeometry(0.56, 28, 16), toon(C.paperDeep));
  corgiCushion.scale.set(1.2, 0.22, 0.9);
  corgiCushion.position.set(0.8, 0.3, 1.55);
  scene.add(corgiCushion);

  const pig = createPig();
  pig.position.set(2.45, 0, -1.55);
  pig.rotation.y = -0.18;
  snapToSurface(pig, 0.24);
  scene.add(pig);
  scene.userData.pig = pig;

  const cat = createCat();
  cat.position.set(-2.9, 0, 0.05);
  cat.rotation.y = 0.36;
  snapToSurface(cat, 0.64);
  scene.add(cat);
  scene.userData.cat = cat;

  const corgi = createCorgi();
  corgi.position.set(0.8, 0, 1.55);
  corgi.rotation.y = -0.2;
  snapToSurface(corgi, 0.34);
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
    new THREE.PointsMaterial({ color: 0x9beeff, size: 0.035, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  scene.add(dust);
  const ceilingPanel = rounded(3.2, 0.06, 1.1, 0.04, C.dark);
  ceilingPanel.position.set(0, 4.55, 0.4);
  const ceilingPanelMaterial = new THREE.MeshBasicMaterial({ color: 0x182333 });
  ceilingPanel.material = ceilingPanelMaterial;
  scene.add(ceilingPanel);
  scene.userData.ceilingPanel = ceilingPanel;
  scene.userData.dust = dust;

  const setRole = (object: THREE.Object3D, role: RoomRole) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.roomRole = role;
    });
  };
  const setRoleByMaterial = (root: THREE.Object3D, color: number, role: RoomRole) => {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (materials.some((material) => 'color' in material && material.color instanceof THREE.Color && material.color.getHex() === color)) {
        child.userData.roomRole = role;
      }
    });
  };

  setRole(floor, 'floor');
  setRole(backWall, 'wall');
  setRole(leftWall, 'wallSide');
  setRole(rightWall, 'wallSide');
  setRole(skirting, 'woodDark');
  setRole(rug, 'rug');
  setRole(rugInner, 'rugInner');
  setRole(rugRing, 'accentAlt');
  setRole(windowFrame, 'woodDark');
  setRole(mullionV, 'woodDark');
  setRole(mullionH, 'woodDark');
  setRole(sill, 'wood');
  setRole(deskTop, 'wood');
  setRole(drawer, 'woodDark');
  setRoleByMaterial(desk, C.wood, 'wood');
  setRoleByMaterial(desk, C.woodDark, 'woodDark');
  setRole(pigStage, 'woodDark');
  setRole(corgiBed, 'rug');
  setRole(corgiCushion, 'rugInner');
  setRoleByMaterial(catTree, C.wood, 'wood');
  setRoleByMaterial(catTree, C.woodDark, 'woodDark');
  setRoleByMaterial(catTree, C.tomato, 'accentAlt');
  setRoleByMaterial(catTree, C.cream, 'propCream');
  setRoleByMaterial(plant, C.tomato, 'accentAlt');
  setRoleByMaterial(boxes, C.wood, 'wood');
  setRoleByMaterial(boxes, C.cream, 'propCream');
  setRoleByMaterial(boxes, C.tomato, 'accentAlt');
  setRoleByMaterial(shelf, C.wood, 'wood');
  setRoleByMaterial(shelf, C.woodDark, 'woodDark');
  neonMaterial.userData.roomRole = 'accent';
  magentaMaterial.userData.roomRole = 'accentAlt';
  scene.userData.useNightPalette = () => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const role = (object.userData.roomRole ?? materials.find((material) => material.userData.roomRole)?.userData.roomRole) as RoomRole | undefined;
      if (!role) return;
      materials.forEach((material) => {
        if ('color' in material && material.color instanceof THREE.Color) material.color.setHex(ROOM_PALETTES.night[role]);
      });
    });
  };
  scene.userData.useLightsOnPalette = () => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const role = (object.userData.roomRole ?? materials.find((material) => material.userData.roomRole)?.userData.roomRole) as RoomRole | undefined;
      if (!role) return;
      materials.forEach((material) => {
        if ('color' in material && material.color instanceof THREE.Color) material.color.setHex(ROOM_PALETTES.lightsOn[role]);
      });
    });
  };

  scene.userData.viewBlockers = [shelf, chair, corgiBed, corgiCushion, corgi, catTree, pcTower, plant, boxes, deskTop];

  [
    ['desk', deskTop],
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
  renderer.toneMappingExposure = 0.96;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.paper);
  scene.fog = new THREE.Fog(C.paper, 12, 26);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);

  const hemi = new THREE.HemisphereLight(0x365a71, 0x11151a, 0.62);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0x9bbbc9, 0.46);
  key.position.set(-4, 7, 5);
  key.castShadow = !isMobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.025;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5e7087, 0.18);
  fill.position.set(4, 3, 2);
  scene.add(fill);
  const lampLight = new THREE.PointLight(0xffb37b, 0.45, 4.2, 2);
  lampLight.position.set(-3.9, 2.15, -1.85);
  scene.add(lampLight);
  const ceilingLight = new THREE.PointLight(0xffd6aa, 0, 10, 2);
  ceilingLight.position.set(0, 4.15, 0.2);
  scene.add(ceilingLight);
  const windowLight = new THREE.PointLight(0x6fa4b8, 0.52, 5.5, 2);
  windowLight.position.set(0.2, 2.8, -3.15);
  scene.add(windowLight);
  const shelfLight = new THREE.PointLight(0xff4fa3, 0.4, 3.4, 2);
  shelfLight.position.set(2.8, 2.45, -2.8);
  scene.add(shelfLight);
  const frontFill = new THREE.DirectionalLight(0xc2dce4, 0.3);
  frontFill.position.set(0, 2.8, 6);
  scene.add(frontFill);
  const characterKey = new THREE.DirectionalLight(0xe4eef1, 0.62);
  characterKey.position.set(2.8, 3.6, 4.8);
  characterKey.castShadow = false;
  scene.add(characterKey);
  const characterFill = new THREE.DirectionalLight(0x91b4c4, 0.28);
  characterFill.position.set(-2.4, 2.1, 3.2);
  characterFill.castShadow = false;
  scene.add(characterFill);
  scene.userData.lighting = { hemi, key, fill, lampLight, ceilingLight, windowLight, shelfLight, frontFill, characterKey, characterFill };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isMobile ? 0.1 : 0.2,
    0.3,
    0.9,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const applyLighting = (lightsOn: boolean) => {
    const lighting = scene.userData.lighting as {
      hemi: THREE.HemisphereLight;
      key: THREE.DirectionalLight;
      fill: THREE.DirectionalLight;
      lampLight: THREE.PointLight;
      ceilingLight: THREE.PointLight;
      windowLight: THREE.PointLight;
      shelfLight: THREE.PointLight;
      frontFill: THREE.DirectionalLight;
      characterKey: THREE.DirectionalLight;
      characterFill: THREE.DirectionalLight;
    };
    if (lightsOn) {
      lighting.hemi.color.setHex(0xd9c8b3);
      lighting.hemi.groundColor.setHex(0x49382c);
      lighting.hemi.intensity = 1.08;
      lighting.key.color.setHex(0xffd6a5);
      lighting.key.intensity = 1.08;
      lighting.fill.color.setHex(0xc8ad8e);
      lighting.fill.intensity = 0.2;
      lighting.lampLight.color.setHex(0xffbd7c);
      lighting.lampLight.intensity = 2.1;
      lighting.ceilingLight.color.setHex(0xffd7a7);
      lighting.ceilingLight.intensity = 7.2;
      lighting.windowLight.color.setHex(0xd9b98e);
      lighting.windowLight.intensity = 0.24;
      lighting.shelfLight.color.setHex(0xd39154);
      lighting.shelfLight.intensity = 0.22;
      lighting.frontFill.color.setHex(0xffe1bf);
      lighting.frontFill.intensity = 0.34;
      lighting.characterKey.color.setHex(0xffe4c4);
      lighting.characterKey.intensity = 0.42;
      lighting.characterFill.color.setHex(0xc6aa8c);
      lighting.characterFill.intensity = 0.16;
      renderer.toneMappingExposure = 1;
      bloom.strength = isMobile ? 0.015 : 0.03;
    } else {
      lighting.hemi.color.setHex(0x365a71);
      lighting.hemi.groundColor.setHex(0x11151a);
      lighting.hemi.intensity = isMobile ? 0.7 : 0.62;
      lighting.key.color.setHex(0x9bbbc9);
      lighting.key.intensity = isMobile ? 0.52 : 0.46;
      lighting.fill.color.setHex(0x5e7087);
      lighting.fill.intensity = 0.18;
      lighting.lampLight.color.setHex(0xffb37b);
      lighting.lampLight.intensity = 0.45;
      lighting.ceilingLight.intensity = 0;
      lighting.windowLight.color.setHex(0x6fa4b8);
      lighting.windowLight.intensity = 0.52;
      lighting.shelfLight.color.setHex(0xff4fa3);
      lighting.shelfLight.intensity = 0.4;
      lighting.frontFill.color.setHex(0xc2dce4);
      lighting.frontFill.intensity = 0.3;
      lighting.characterKey.color.setHex(0xe4eef1);
      lighting.characterKey.intensity = 0.62;
      lighting.characterFill.color.setHex(0x91b4c4);
      lighting.characterFill.intensity = 0.28;
      renderer.toneMappingExposure = 0.98;
      bloom.strength = isMobile ? 0.1 : 0.2;
    }

    const background = lightsOn ? 0x302d28 : 0x05080f;
    scene.background = new THREE.Color(background);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.setHex(background);
      scene.fog.near = lightsOn ? 14 : 12;
      scene.fog.far = lightsOn ? 34 : 30;
    }

    const ceilingPanel = scene.userData.ceilingPanel as THREE.Mesh | undefined;
    if (ceilingPanel && ceilingPanel.material instanceof THREE.MeshBasicMaterial) {
      ceilingPanel.material.color.setHex(lightsOn ? 0xd8c29f : 0x182333);
    }
    const skyMaterial = scene.userData.skyMaterial as THREE.MeshBasicMaterial | undefined;
    const windowTextures = scene.userData.windowTextures as { night: THREE.Texture; lightsOn: THREE.Texture } | undefined;
    if (skyMaterial && windowTextures) skyMaterial.map = lightsOn ? windowTextures.lightsOn : windowTextures.night;
    const cityRain = scene.userData.cityRain as THREE.Points | undefined;
    if (cityRain?.material instanceof THREE.PointsMaterial) cityRain.material.opacity = lightsOn ? 0.22 : 0.62;
    const screenGlows = (scene.userData.screenGlows ?? []) as THREE.PointLight[];
    screenGlows.forEach((glow) => { glow.intensity = lightsOn ? 0.1 : 0.22; });
    const applyPalette = scene.userData[lightsOn ? 'useLightsOnPalette' : 'useNightPalette'] as (() => void) | undefined;
    applyPalette?.();
  };
  const onTheme = (event: Event) => {
    const detail = (event as CustomEvent<{ theme?: string }>).detail;
    applyLighting(detail?.theme === 'light');
  };
  window.addEventListener('cattery:theme', onTheme);

  createRoom(scene);
  applyLighting(document.documentElement.dataset.theme === 'light');

  const cat = scene.userData.cat as Character;
  const pig = scene.userData.pig as Character;
  const corgi = scene.userData.corgi as Character;
  const dust = scene.userData.dust as THREE.Points | undefined;

  const characterEntries: Array<[CharacterKind, Character]> = [
    ['cat', cat],
    ['pig', pig],
    ['corgi', corgi],
  ];
  const controls = new Map<CharacterKind, CharacterControlState>();
  const hitProxies: THREE.Mesh[] = [];
  for (const [kind, character] of characterEntries) {
    character.userData.kind = kind;
    controls.set(kind, {
      object: character,
      basePosition: character.position.clone(),
      baseRotation: character.rotation.clone(),
      baseScale: character.scale.clone(),
      dragging: false,
      reactionCount: 0,
      reaction: null,
      returnTween: null,
    });

    const box = worldBox(character);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(size.x * 1.12, size.y * 1.05, size.z * 1.16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    );
    proxy.position.copy(center);
    proxy.userData.characterKind = kind;
    proxy.renderOrder = -10;
    scene.add(proxy);
    hitProxies.push(proxy);
  }

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
      desktop: { fov: 38, padding: 0.68, direction: new THREE.Vector3(0.5, 0.18, 1), lateral: 0.73, vertical: 0 },
      mobile: { fov: 44, padding: 0.36, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.3 },
      mobileOpen: { fov: 46, padding: 0.8, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.95 },
      tablet: { fov: 44, padding: 0.7, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.15 },
      tabletOpen: { fov: 46, padding: 1.6, direction: new THREE.Vector3(0.45, 0.16, 1), lateral: 0, vertical: -0.8 },
    },
    pig: {
      desktop: { fov: 46, padding: 0.38, direction: new THREE.Vector3(0.7, 0.56, 1), lateral: -0.66, vertical: -0.02 },
      mobile: { fov: 50, padding: 0.3, direction: new THREE.Vector3(0.34, 0.42, 1), lateral: 0, vertical: -0.34 },
      mobileOpen: { fov: 56, padding: 1.22, direction: new THREE.Vector3(0.3, 0.55, 1), lateral: 0, vertical: -1.44 },
      tablet: { fov: 50, padding: 0.42, direction: new THREE.Vector3(0.44, 0.46, 1), lateral: 0, vertical: -0.22 },
      tabletOpen: { fov: 56, padding: 2.35, direction: new THREE.Vector3(0.38, 0.58, 1), lateral: 0, vertical: -1.18 },
    },
    corgi: {
      desktop: { fov: 38, padding: 0.68, direction: new THREE.Vector3(0.5, 0.2, 1), lateral: 0.78, vertical: 0 },
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
  const pigFallback: FrameSpec = isMobile
    ? { fov: 54, padding: 0.4, direction: new THREE.Vector3(0.12, 1.15, 0.78), lateral: 0, vertical: -0.24 }
    : { fov: 48, padding: 0.46, direction: new THREE.Vector3(0.25, 1.05, 0.8), lateral: -0.52, vertical: -0.05 };
  const occlusionRay = new THREE.Raycaster();
  const basePosition = new THREE.Vector3();
  const baseTarget = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const startedAt = performance.now();
  const stations = [...root.querySelectorAll<HTMLElement>('[data-station]')];
  const progressDots = [...root.querySelectorAll<HTMLElement>('.room-progress-dots i')];
  let currentStation: StationId = 'establishing';
  let panelOpen = Boolean(root.querySelector('[data-station-panel].is-open'));
  let pigOccluded = false;
  let raf = 0;
  let visible = true;

  const pigViewOccluded = (position: THREE.Vector3) => {
    const target = worldBox(pig).getCenter(new THREE.Vector3());
    const direction = target.clone().sub(position);
    const distance = direction.length();
    occlusionRay.set(position, direction.normalize());
    const blockers = (scene.userData.viewBlockers ?? []) as THREE.Object3D[];
    const hits = occlusionRay.intersectObjects(blockers, true);
    return hits.some((hit) => hit.distance > 0.08 && hit.distance < distance - 0.32);
  };

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
    window.dispatchEvent(new CustomEvent('cattery:station-change', { detail: { station } }));
    const preset = !isMobile
      ? presets[station].desktop
      : isPhone
        ? (panelOpen && presets[station].mobileOpen ? presets[station].mobileOpen! : presets[station].mobile)
        : (panelOpen && presets[station].tabletOpen ? presets[station].tabletOpen! : presets[station].tablet);
    let frame = frameBox(boxForStation(station), preset);
    pigOccluded = false;
    if (station === 'pig' && pigViewOccluded(frame.position)) {
      pigOccluded = true;
      frame = frameBox(worldBox(pig), pigFallback);
      if (!import.meta.env.DEV) pigOccluded = false;
    }
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
        duration: 1.0,
        ease: 'power2.inOut',
        overwrite: true,
      });
      gsap.to(baseTarget, {
        x: frame.target.x,
        y: frame.target.y,
        z: frame.target.z,
        duration: 1.0,
        ease: 'power2.inOut',
        overwrite: true,
      });
      gsap.to(camera, {
        fov: frame.fov,
        duration: 1.0,
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

  const interactionRaycaster = new THREE.Raycaster();
  const interactionPointer = new THREE.Vector2();
  interface ActiveInteraction {
    kind: CharacterKind;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    dragging: boolean;
  }
  let hoveredCharacter: CharacterKind | null = null;
  let activeInteraction: ActiveInteraction | null = null;

  const isUiTarget = (target: EventTarget | null) => (
    target instanceof Element
    && Boolean(target.closest('.site-header, .site-footer, .station-panel, .room-progress, .room-skip, a, button, input, textarea, select'))
  );

  const characterAt = (clientX: number, clientY: number): CharacterKind | null => {
    interactionPointer.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    camera.updateMatrixWorld();
    interactionRaycaster.setFromCamera(interactionPointer, camera);
    const hit = interactionRaycaster.intersectObjects(hitProxies, false)[0];
    return (hit?.object.userData.characterKind as CharacterKind | undefined) ?? null;
  };

  const setHoveredCharacter = (kind: CharacterKind | null) => {
    hoveredCharacter = kind;
    root.classList.toggle('is-character-hover', Boolean(kind) && !activeInteraction?.dragging);
  };

  const stopCharacterMotion = (control: CharacterControlState) => {
    control.reaction?.kill();
    control.reaction = null;
    control.returnTween?.kill();
    control.returnTween = null;
    gsap.killTweensOf(control.object.position);
    gsap.killTweensOf(control.object.rotation);
    gsap.killTweensOf(control.object.scale);
    const head = control.object.userData.parts.head;
    if (head) gsap.killTweensOf(head.rotation);
  };

  const restoreBasePose = (control: CharacterControlState) => {
    control.object.position.copy(control.basePosition);
    control.object.rotation.copy(control.baseRotation);
    control.object.scale.copy(control.baseScale);
    const head = control.object.userData.parts.head;
    if (head) head.rotation.x = 0;
  };

  const playReaction = (kind: CharacterKind) => {
    const control = controls.get(kind);
    if (!control) return;
    stopCharacterMotion(control);
    restoreBasePose(control);
    control.dragging = false;
    control.reactionCount += 1;
    window.dispatchEvent(new CustomEvent('cattery:character-interaction', { detail: { kind } }));
    const object = control.object;
    const base = control.baseRotation;
    const timeline = gsap.timeline({
      onComplete: () => {
        restoreBasePose(control);
        control.reaction = null;
      },
    });

    if (kind === 'cat') {
      const head = object.userData.parts.head;
      timeline
        .to(object.scale, { x: 1.045, y: 0.94, z: 1.045, duration: 0.1, ease: 'power2.out' }, 0)
        .to(object.position, { y: control.basePosition.y + 0.11, duration: 0.16, ease: 'power2.out' }, 0)
        .to(head.rotation, { x: -0.12, duration: 0.12, ease: 'power2.out' }, 0)
        .to(object.scale, { x: 1, y: 1.02, z: 1, duration: 0.18, ease: 'power2.inOut' }, 0.1)
        .to(object.position, { y: control.basePosition.y, duration: 0.34, ease: 'bounce.out' }, 0.16)
        .to(head.rotation, { x: 0, duration: 0.2, ease: 'power2.inOut' }, 0.16)
        .to(object.scale, { x: 1, y: 1, z: 1, duration: 0.2, ease: 'power2.out' }, 0.3);
    } else if (kind === 'pig') {
      const head = object.userData.parts.head;
      timeline
        .to(object.scale, { x: 1.04, y: 0.965, z: 1.04, duration: 0.1, ease: 'power2.out' }, 0)
        .to(object.rotation, { y: base.y + 0.16, duration: 0.2, ease: 'power2.out' }, 0)
        .to(head.rotation, { x: 0.12, duration: 0.13, ease: 'power2.out' }, 0)
        .to(object.rotation, { y: base.y, duration: 0.28, ease: 'power2.inOut' }, 0.18)
        .to(head.rotation, { x: 0, duration: 0.2, ease: 'power2.inOut' }, 0.16)
        .to(object.scale, { x: 1, y: 1, z: 1, duration: 0.24, ease: 'elastic.out(1, 0.5)' }, 0.16);
    } else {
      timeline
        .to(object.scale, { x: 1.045, y: 0.95, z: 1.045, duration: 0.09, ease: 'power2.out' }, 0)
        .to(object.rotation, { z: 0.1, duration: 0.11, ease: 'power2.out' }, 0)
        .to(object.rotation, { z: -0.09, duration: 0.11, ease: 'power2.inOut' }, 0.1)
        .to(object.rotation, { z: 0.055, duration: 0.11, ease: 'power2.inOut' }, 0.2)
        .to(object.rotation, { z: 0, duration: 0.2, ease: 'power2.out' }, 0.3)
        .to(object.scale, { x: 1, y: 1, z: 1, duration: 0.26, ease: 'elastic.out(1, 0.45)' }, 0.12);
    }
    control.reaction = timeline;
  };

  const returnCharacterToBase = (kind: CharacterKind) => {
    const control = controls.get(kind);
    if (!control) return;
    stopCharacterMotion(control);
    control.dragging = false;
    control.returnTween = gsap.to(control.object.rotation, {
      x: control.baseRotation.x,
      y: control.baseRotation.y,
      z: control.baseRotation.z,
      duration: 0.35,
      ease: 'power3.out',
      overwrite: true,
      onComplete: () => {
        restoreBasePose(control);
        control.returnTween = null;
      },
    });
  };

  const beginDrag = (interaction: ActiveInteraction) => {
    const control = controls.get(interaction.kind);
    if (!control) return;
    stopCharacterMotion(control);
    restoreBasePose(control);
    control.dragging = true;
    interaction.dragging = true;
    root.classList.remove('is-character-hover');
    root.classList.add('is-character-dragging');
  };

  const releaseActiveInteraction = (springBack: boolean) => {
    const interaction = activeInteraction;
    if (!interaction) return;
    const control = controls.get(interaction.kind);
    if (control) control.dragging = false;
    activeInteraction = null;
    root.classList.remove('is-character-dragging');
    if (interaction.dragging && springBack) returnCharacterToBase(interaction.kind);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || activeInteraction || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (isUiTarget(event.target)) return;
    const kind = characterAt(event.clientX, event.clientY);
    if (!kind) return;
    window.dispatchEvent(new CustomEvent('cattery:character-interaction', { detail: { kind } }));
    activeInteraction = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      dragging: false,
    };
    try { root.setPointerCapture(event.pointerId); } catch {}
    setHoveredCharacter(kind);
  };

  const onPointerMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;

    if (!activeInteraction) {
      setHoveredCharacter(isUiTarget(event.target) ? null : characterAt(event.clientX, event.clientY));
      return;
    }
    if (event.pointerId !== activeInteraction.pointerId) return;

    const dx = event.clientX - activeInteraction.startX;
    const dy = event.clientY - activeInteraction.startY;
    if (!activeInteraction.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      beginDrag(activeInteraction);
    }
    if (activeInteraction.dragging) {
      const control = controls.get(activeInteraction.kind);
      if (control) {
        control.object.rotation.y = control.baseRotation.y + THREE.MathUtils.clamp(dx / 200, -0.55, 0.55);
      }
      if (event.cancelable) event.preventDefault();
    } else if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      activeInteraction.moved = true;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const interaction = activeInteraction;
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const shouldReact = !interaction.dragging
      && !interaction.moved
      && !isUiTarget(event.target);
    releaseActiveInteraction(true);
    try { root.releasePointerCapture(event.pointerId); } catch {}
    if (shouldReact) playReaction(interaction.kind);
    setHoveredCharacter(isUiTarget(event.target) ? null : characterAt(event.clientX, event.clientY));
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!activeInteraction || event.pointerId !== activeInteraction.pointerId) return;
    releaseActiveInteraction(true);
    try { root.releasePointerCapture(event.pointerId); } catch {}
  };

  const onWindowBlur = () => {
    releaseActiveInteraction(true);
    setHoveredCharacter(null);
  };

  root.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerCancel, { passive: true });
  window.addEventListener('blur', onWindowBlur);

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-poke]') : null;
    if (target?.dataset.poke) playReaction(target.dataset.poke as CharacterKind);
  });

  const corgiBaseY = corgi.position.y;
  const render = () => {
    raf = requestAnimationFrame(render);
    if (!visible || document.hidden) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    camera.position.copy(basePosition);
    if (!isTouch && !activeInteraction?.dragging) {
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
    const cityRain = scene.userData.cityRain as THREE.Points | undefined;
    if (cityRain) {
      const positions = cityRain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i += 1) {
        let y = positions.getY(i) - 0.012;
        if (y < 1.85) y = 3.55;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    composer.render();
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
      pigOccluded,
      pigCamera: currentStation === 'pig' ? (pigOccluded ? 'fallback-high' : 'right-front-high') : null,
    };
  };

  const speech = root.querySelector<HTMLElement>('[data-character-speech]');
  const speechName = speech?.querySelector<HTMLElement>('[data-character-speech-name]');
  const speechText = speech?.querySelector<HTMLElement>('[data-character-speech-text]');
  const lastLine = new Map<CharacterKind, string>();
  let speechTimer = 0;
  let speechHideTimer = 0;

  const hideSpeech = () => {
    window.clearTimeout(speechHideTimer);
    if (!speech || speech.hidden) return;
    speech.classList.remove('is-visible');
    speechHideTimer = window.setTimeout(() => {
      if (speech) speech.hidden = true;
    }, 240);
  };

  const chooseLine = (kind: CharacterKind) => {
    const lines = CHARACTER_LINES[kind];
    const previous = lastLine.get(kind);
    const available = lines.length > 1 ? lines.filter((line) => line !== previous) : lines;
    const line = available[Math.floor(Math.random() * available.length)] ?? lines[0];
    lastLine.set(kind, line);
    return line;
  };

  const showSpeech = (kind?: CharacterKind, fixedLine?: string) => {
    if (!speech || !speechName || !speechText || !visible || document.hidden) return;
    const speakingKind = kind ?? (['cat', 'pig', 'corgi'] as CharacterKind[])[Math.floor(Math.random() * 3)];
    const control = controls.get(speakingKind);
    if (!control) return;
    const rect = screenRect(control.object);
    const bubbleWidth = Math.min(340, window.innerWidth - 32);
    const x = THREE.MathUtils.clamp(
      (rect.left + rect.right) / 2,
      bubbleWidth / 2 + 16,
      window.innerWidth - bubbleWidth / 2 - 16,
    );
    const y = Math.max(112, Math.min(rect.top + 28, window.innerHeight - (isPhone ? 340 : 130)));
    speech.style.setProperty('--speech-x', `${x}px`);
    speech.style.setProperty('--speech-y', `${y}px`);
    speech.dataset.kind = speakingKind;
    speechName.textContent = CHARACTER_NAMES[speakingKind];
    speechText.textContent = fixedLine ?? chooseLine(speakingKind);
    speech.hidden = false;
    requestAnimationFrame(() => speech.classList.add('is-visible'));
    window.clearTimeout(speechHideTimer);
    speechHideTimer = window.setTimeout(hideSpeech, 3600);
  };

  const speechDelay = () => 4000 + Math.random() * 2000;

  function scheduleNextSpeech(delay = speechDelay()) {
    window.clearTimeout(speechTimer);
    speechTimer = window.setTimeout(() => {
      if (!visible || document.hidden) {
        scheduleNextSpeech(2000);
        return;
      }
      const stationKind = currentStation === 'cat' || currentStation === 'pig' || currentStation === 'corgi'
        ? currentStation
        : undefined;
      showSpeech(stationKind);
      scheduleNextSpeech();
    }, delay);
  }

  const onCharacterInteraction = () => {
    hideSpeech();
    scheduleNextSpeech(2400 + Math.random() * 1200);
  };
  const onStationChange = () => {
    hideSpeech();
    scheduleNextSpeech(1800 + Math.random() * 1200);
  };
  const onVisibilityChange = () => {
    if (document.hidden) {
      window.clearTimeout(speechTimer);
      hideSpeech();
    } else {
      scheduleNextSpeech(1000 + Math.random() * 1000);
    }
  };
  window.addEventListener('cattery:character-interaction', onCharacterInteraction);
  window.addEventListener('cattery:station-change', onStationChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  scheduleNextSpeech(1600 + Math.random() * 1200);

  if (import.meta.env.DEV || new URLSearchParams(location.search).has('room-debug')) {
    (window as unknown as {
      __catteryRoomDebug?: {
        getFraming: () => unknown;
        getCollisions: () => string[];
        setStation: (station: StationId) => void;
        getCharacterState: (kind: CharacterKind) => unknown;
        poke: (kind: CharacterKind) => void;
        emitCharacterLine: (kind: CharacterKind) => void;
      };
    }).__catteryRoomDebug = {
      getFraming,
      getCollisions: () => findCollisions(scene),
      setStation: (station: StationId) => applyStation(station, true),
      getCharacterState: (kind: CharacterKind) => {
        const control = controls.get(kind);
        if (!control) return null;
        return {
          positionY: control.object.position.y,
          basePositionY: control.basePosition.y,
          rotationY: control.object.rotation.y,
          baseRotationY: control.baseRotation.y,
          dragging: control.dragging,
          reactionCount: control.reactionCount,
          hovered: hoveredCharacter,
        };
      },
      poke: (kind: CharacterKind) => playReaction(kind),
      emitCharacterLine: (kind: CharacterKind) => showSpeech(kind),
    };
  }

  const onPanelToggle = (event: Event) => {
    const detail = (event as CustomEvent<{ open?: boolean }>).detail;
    panelOpen = Boolean(detail?.open);
    if (isMobile) applyStation(currentStation);
  };
  window.addEventListener('cattery:panel-toggle', onPanelToggle);

  const collisions = findCollisions(scene);
  if (import.meta.env.DEV && collisions.length > 0) {
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
    composer.setSize(window.innerWidth, window.innerHeight);
    applyStation(currentStation, true);
  };
  window.addEventListener('resize', resize, { passive: true });

  const cleanup = () => {
    cancelAnimationFrame(raf);
    stationObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener('cattery:panel-toggle', onPanelToggle);
    window.removeEventListener('cattery:theme', onTheme);
    window.removeEventListener('resize', resize);
    root.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', onWindowBlur);
    window.clearTimeout(speechTimer);
    hideSpeech();
    window.clearTimeout(speechHideTimer);
    window.removeEventListener('cattery:character-interaction', onCharacterInteraction);
    window.removeEventListener('cattery:station-change', onStationChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    composer.dispose();
    renderer.dispose();
  };
  window.addEventListener('pagehide', cleanup, { once: true });

  root.classList.add('is-ready');
  applyStation('establishing', true);
  render();
}

