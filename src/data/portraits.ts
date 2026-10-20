export type PortraitKind = 'cat' | 'pig' | 'corgi';

export interface CharacterPortrait {
  kind: PortraitKind;
  src: string;
  width: number;
  height: number;
}

export const PORTRAITS: Record<PortraitKind, CharacterPortrait> = {
  cat: {
    kind: 'cat',
    src: '/images/portraits/cat.png',
    width: 1024,
    height: 1024,
  },
  pig: {
    kind: 'pig',
    src: '/images/portraits/pig.png',
    width: 1024,
    height: 1024,
  },
  corgi: {
    kind: 'corgi',
    src: '/images/portraits/corgi.png',
    width: 1024,
    height: 1024,
  },
};
