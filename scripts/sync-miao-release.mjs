import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const target = 'src/data/miao-secretary-release.json';
const endpoint = 'https://gitee.com/api/v5/repos/fat-cat-barbecue/miao-secretary/releases/latest';

try {
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'cattery-site' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Gitee release API returned ${response.status}`);
  const release = await response.json();
  const asset = (release.assets ?? []).find((item) => /\.exe$/i.test(item.name));
  if (!asset) throw new Error('No Windows .exe asset found');
  const tag = release.tag_name ?? '';
  const output = {
    syncedAt: new Date().toISOString(),
    tag,
    name: release.name ?? tag,
    assetName: asset.name,
    downloadUrl: asset.browser_download_url,
    releaseUrl: tag
      ? `https://gitee.com/fat-cat-barbecue/miao-secretary/releases/tag/${tag}`
      : 'https://gitee.com/fat-cat-barbecue/miao-secretary/releases',
    publishedAt: release.created_at ?? null,
  };
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Synced ${output.tag} (${output.assetName})`);
} catch (error) {
  if (existsSync(target)) {
    console.warn(`Miao release sync failed; keeping existing snapshot. ${error.message}`);
  } else {
    await writeFile(target, `${JSON.stringify({ syncedAt: null, tag: null, name: null, assetName: null, downloadUrl: null, releaseUrl: 'https://gitee.com/fat-cat-barbecue/miao-secretary/releases', publishedAt: null }, null, 2)}\n`, 'utf8');
    console.warn(`Miao release sync failed; wrote fallback snapshot. ${error.message}`);
  }
}
