import release from './miao-secretary-release.json';

export interface MiaoRelease {
  syncedAt: string | null;
  tag: string | null;
  name: string | null;
  assetName: string | null;
  downloadUrl: string | null;
  releaseUrl: string;
  publishedAt: string | null;
}

export const MIAO_RELEASE = release as MiaoRelease;
