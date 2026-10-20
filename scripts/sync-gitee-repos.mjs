import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const owner = 'fat-cat-barbecue';
const target = 'src/data/gitee-repos.json';
const endpoint = new URL(`https://gitee.com/api/v5/users/${owner}/repos`);
endpoint.searchParams.set('per_page', '100');
endpoint.searchParams.set('sort', 'updated');

if (process.env.GITEE_TOKEN) {
  endpoint.searchParams.set('access_token', process.env.GITEE_TOKEN);
}

const exclude = new Set(['miao-secretary']);
const lowSignal = /(学习|crud|demo|测试|test)/i;

try {
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'cattery-site' },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Gitee API returned ${response.status}`);
  }

  const repos = await response.json();
  const selected = repos
    .filter((repo) => {
      const description = typeof repo.description === 'string' ? repo.description.replace(/\s+/g, ' ').trim() : '';
      return (
        !repo.fork &&
        !exclude.has(repo.name) &&
        description.length >= 4 &&
        !lowSignal.test(description)
      );
    })
    .sort((a, b) => new Date(b.updated_at).valueOf() - new Date(a.updated_at).valueOf())
    .slice(0, 6)
    .map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description.replace(/\s+/g, ' ').trim(),
      url: repo.html_url.replace(/\.git$/, ''),
      platform: 'gitee',
      language: repo.language ?? null,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      updatedAt: repo.updated_at,
    }));

  await writeFile(
    target,
    `${JSON.stringify({ syncedAt: new Date().toISOString(), repos: selected }, null, 2)}\n`,
    'utf8',
  );
  console.log(`Synced ${selected.length} Gitee repositories to ${target}`);
} catch (error) {
  if (existsSync(target)) {
    console.warn(`Gitee sync failed; keeping existing snapshot. ${error.message}`);
  } else {
    await writeFile(target, `${JSON.stringify({ syncedAt: null, repos: [] }, null, 2)}\n`, 'utf8');
    console.warn(`Gitee sync failed; wrote empty snapshot. ${error.message}`);
  }
}
