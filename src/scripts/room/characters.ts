import type * as THREE from 'three';

export type CharacterKind = 'cat' | 'pig' | 'corgi';

export interface CharacterAsset {
  kind: CharacterKind;
  root: THREE.Group;
  update(time: number): void;
  react(kind: CharacterKind): void;
  dispose(): void;
}

export interface CharacterFactory {
  create(kind: CharacterKind): CharacterAsset;
}

// Future Tripo GLB assets can implement CharacterFactory without changing the
// room, camera director, or station UI. The current procedural characters are
// constructed directly inside room.ts.
