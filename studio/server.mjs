import http from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import matter from 'gray-matter';
import { marked } from 'marked';
import sharp from 'sharp';

const ROOT = process.cwd();
const STUDIO_ROOT = path.join(ROOT, 'studio');
const NOTES_ROOT = path.join(ROOT, 'src/content/notes');
const NOTE_IMAGES_ROOT = path.join(ROOT, 'public/images/notes');
const DIST_ROOT = path.join(ROOT, 'dist');
const TRASH_ROOT = path.join(ROOT, '.content-trash/notes');
const HOST = '127.0.0.1';
const PORT = Number(process.env.STUDIO_PORT || 4322);
const MAX_JSON = 2 * 1024 * 1024;
const MAX_UPLOAD = 15 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
};

const readBuffer = (req, limit) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > limit) {
      reject(new Error('请求内容过大'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const readJson = async (req) => JSON.parse((await readBuffer(req, MAX_JSON)).toString('utf8'));
const toDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};
const assertNoteId = (id) => {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error('文章文件名只能使用小写英文字母、数字和连字符');
  }
  return id;
};
const noteFile = (id) => path.join(NOTES_ROOT, `${assertNoteId(id)}.md`);

async function listNotes() {
  await fs.mkdir(NOTES_ROOT, { recursive: true });
  const files = (await fs.readdir(NOTES_ROOT)).filter((file) => file.endsWith('.md'));
  const notes = await Promise.all(files.map(async (file) => {
    const parsed = matter(await fs.readFile(path.join(NOTES_ROOT, file), 'utf8'));
    return {
      id: file.replace(/\.md$/, ''),
      title: String(parsed.data.title ?? '未命名'),
      description: String(parsed.data.description ?? ''),
      pubDate: toDateString(parsed.data.pubDate),
      updatedDate: toDateString(parsed.data.updatedDate),
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
      draft: Boolean(parsed.data.draft),
    };
  }));
  return notes.sort((a, b) => String(b.pubDate ?? '').localeCompare(String(a.pubDate ?? '')) || a.title.localeCompare(b.title, 'zh-CN'));
}

async function getNote(id) {
  const parsed = matter(await fs.readFile(noteFile(id), 'utf8'));
  return {
    id,
    title: String(parsed.data.title ?? ''),
    description: String(parsed.data.description ?? ''),
    pubDate: toDateString(parsed.data.pubDate) ?? new Date().toISOString().slice(0, 10),
    updatedDate: toDateString(parsed.data.updatedDate),
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
    draft: Boolean(parsed.data.draft),
    cover: parsed.data.cover ? String(parsed.data.cover) : '',
    body: parsed.content.replace(/^\r?\n/, ''),
  };
}

function normalizeNote(input) {
  const id = assertNoteId(input.id);
  const title = String(input.title ?? '').trim();
  const description = String(input.description ?? '').trim();
  if (!title) throw new Error('标题不能为空');
  if (!description) throw new Error('摘要不能为空');
  const pubDate = String(input.pubDate ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pubDate)) throw new Error('发布日期格式应为 YYYY-MM-DD');
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
  return {
    id,
    data: {
      title,
      description,
      pubDate,
      ...(input.updatedDate ? { updatedDate: String(input.updatedDate).slice(0, 10) } : {}),
      tags,
      draft: Boolean(input.draft),
      ...(input.cover ? { cover: String(input.cover) } : {}),
    },
    body: String(input.body ?? '').replace(/\r\n/g, '\n'),
  };
}

async function saveNote(input, create = false) {
  const normalized = normalizeNote(input);
  const target = noteFile(normalized.id);
  if (create && existsSync(target)) {
    const error = new Error('这个文件名已经存在');
    error.statusCode = 409;
    throw error;
  }
  if (!create && !existsSync(target)) {
    const error = new Error('文章不存在');
    error.statusCode = 404;
    throw error;
  }
  const output = matter.stringify(normalized.body, normalized.data);
  await fs.writeFile(target, `${output.trimEnd()}\n`, 'utf8');
  return getNote(normalized.id);
}

async function deleteNote(id) {
  const source = noteFile(id);
  if (!existsSync(source)) {
    const error = new Error('文章不存在');
    error.statusCode = 404;
    throw error;
  }
  await fs.mkdir(TRASH_ROOT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${id}-${stamp}.md`;
  await fs.rename(source, path.join(TRASH_ROOT, file));
  return { id, file };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
      shell: Boolean(options.shell),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); if (stdout.length > 50000) stdout = stdout.slice(-50000); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); if (stderr.length > 50000) stderr = stderr.slice(-50000); });
    child.on('error', (error) => resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}`.trim() }));
    child.on('exit', (code) => resolve({ code: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function buildSite() {
  const check = await run(npmCommand, ['run', 'check'], { shell: process.platform === 'win32' });
  if (check.code !== 0) return { ok: false, step: '类型检查', ...check };
  const build = await run(npmCommand, ['run', 'build'], { shell: process.platform === 'win32' });
  if (build.code !== 0) return { ok: false, step: '构建', ...build };
  return { ok: true, steps: ['类型检查通过', '站点构建完成'], output: build.stdout };
}

function safeTrashFile(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(name) || name.includes('..')) {
    throw new Error('无效的回收站文件名');
  }
  return name;
}

function trashOriginalId(file) {
  return file.replace(/-\d{4}-\d{2}-\d{2}T.*\.md$/, '').replace(/\.md$/, '');
}

async function listTrash() {
  if (!existsSync(TRASH_ROOT)) return [];
  const files = (await fs.readdir(TRASH_ROOT)).filter((file) => file.endsWith('.md'));
  const entries = await Promise.all(files.map(async (file) => {
    const filePath = path.join(TRASH_ROOT, file);
    const [text, stat] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)]);
    const parsed = matter(text);
    return {
      file,
      id: trashOriginalId(file),
      title: String(parsed.data.title ?? file.replace(/\.md$/, '')),
      pubDate: toDateString(parsed.data.pubDate),
      deletedAt: stat.mtime.toISOString(),
    };
  }));
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

async function restoreTrash(file) {
  const safeFile = safeTrashFile(file);
  const source = path.join(TRASH_ROOT, safeFile);
  if (!existsSync(source)) {
    const error = new Error('回收站文件不存在');
    error.statusCode = 404;
    throw error;
  }
  const id = assertNoteId(trashOriginalId(safeFile));
  const target = noteFile(id);
  if (existsSync(target)) {
    const error = new Error('同名文章已存在，无法恢复');
    error.statusCode = 409;
    throw error;
  }
  await fs.rename(source, target);
  return getNote(id);
}

async function permanentlyDeleteTrash(file) {
  const safeFile = safeTrashFile(file);
  const source = path.join(TRASH_ROOT, safeFile);
  if (!existsSync(source)) {
    const error = new Error('回收站文件不存在');
    error.statusCode = 404;
    throw error;
  }
  await fs.unlink(source);
}

async function publishTrashDeletion(file) {
  const safeFile = safeTrashFile(file);
  const id = assertNoteId(trashOriginalId(safeFile));
  const relative = path.posix.join('src/content/notes', `${id}.md`);
  const tracked = await run('git', ['ls-files', '--error-unmatch', '--', relative]);
  if (tracked.code !== 0) {
    return { ok: true, skipped: true, steps: ['这篇文章没有提交过，线上无需删除'] };
  }
  const staged = await run('git', ['diff', '--cached', '--name-only']);
  if (staged.code !== 0) return { ok: false, step: '检查暂存区', ...staged };
  if (staged.stdout.trim()) {
    return { ok: false, step: '安全检查', stderr: '当前 Git 暂存区还有其他变更。请先清空或提交暂存区，再执行“仅同步删除”。' };
  }
  const build = await buildSite();
  if (!build.ok) return build;
  const stage = await run('git', ['add', '--update', '--', relative]);
  if (stage.code !== 0) return { ok: false, step: '暂存删除操作', ...stage };
  const diff = await run('git', ['diff', '--cached', '--name-status']);
  if (diff.code !== 0) return { ok: false, step: '确认删除范围', ...diff };
  const changed = diff.stdout.split('\n').filter(Boolean);
  if (changed.length !== 1 || !changed[0].startsWith('D\t')) {
    return { ok: false, step: '安全检查', stderr: '删除范围异常，已停止发布。' };
  }
  const commit = await run('git', ['commit', '-m', `content: delete ${id}`]);
  if (commit.code !== 0) return { ok: false, step: '提交删除', ...commit };
  const gitee = await run('git', ['push', 'https://gitee.com/fat-cat-barbecue/cattery.git', 'main']);
  if (gitee.code !== 0) return { ok: false, step: '推送 Gitee', ...gitee, hint: '删除 commit 已在本地，Gitee 推送失败。' };
  const github = await run('git', ['push', 'github', 'main']);
  if (github.code !== 0) return { ok: false, step: '推送 GitHub', ...github, hint: 'Gitee 已删除，GitHub 推送失败，请重试。' };
  return { ok: true, steps: [...build.steps, '已提交仅删除操作', '已推送 Gitee', '已推送 GitHub；EdgeOne 将自动部署'] };
}

async function publishChanges(message) {
  const noteStatus = await run('git', ['status', '--porcelain', '--', 'src/content/notes']);
  if (noteStatus.code !== 0) return { ok: false, step: '检查文章状态', ...noteStatus };
  const deletions = noteStatus.stdout.split('\n').filter((line) => /^(D | D)/.test(line));
  if (deletions.length > 0) {
    return { ok: false, step: '安全检查', stderr: '检测到未同步的文章删除。请到回收站使用“仅同步删除”，普通发布不会提交删除操作。' };
  }
  const build = await buildSite();
  if (!build.ok) return build;

  const add = await run('git', ['add', '--ignore-removal', '--', 'src/content/notes', 'public/images/notes']);
  if (add.code !== 0) return { ok: false, step: '暂存文章', ...add };

  const staged = await run('git', ['diff', '--cached', '--quiet']);
  if (staged.code === 0) {
    return { ok: true, steps: [...build.steps, '没有需要推送的内容'], unchanged: true };
  }
  if (staged.code !== 1) return { ok: false, step: '检查变更', ...staged };

  const finalMessage = String(message || '').trim() || `content: publish ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const commit = await run('git', ['commit', '-m', finalMessage]);
  if (commit.code !== 0) return { ok: false, step: '提交文章', ...commit };

  const gitee = await run('git', ['push', 'https://gitee.com/fat-cat-barbecue/cattery.git', 'main']);
  if (gitee.code !== 0) {
    return { ok: false, step: '推送 Gitee 主仓库', ...gitee, hint: 'commit 已保存在本地，修复 Gitee 凭据后重试。' };
  }

  const github = await run('git', ['push', 'github', 'main']);
  if (github.code !== 0) {
    return { ok: false, step: '推送 GitHub 镜像', ...github, hint: 'Gitee 已更新，GitHub 镜像失败；修复后再次点击发布即可重试。' };
  }

  return { ok: true, steps: [...build.steps, '已提交', '已推送 Gitee', '已推送 GitHub；EdgeOne 将自动部署'] };
}

async function gitStatus() {
  const [branch, status, remotes, lastCommit] = await Promise.all([
    run('git', ['branch', '--show-current']),
    run('git', ['status', '--short']),
    run('git', ['remote', '-v']),
    run('git', ['log', '-1', '--pretty=%h %s']),
  ]);
  return {
    branch: branch.stdout || 'main',
    changes: status.stdout ? status.stdout.split('\n').filter(Boolean) : [],
    remotes: remotes.stdout ? remotes.stdout.split('\n').filter(Boolean) : [],
    lastCommit: lastCommit.stdout,
  };
}

async function uploadImage(req, query) {
  const slug = assertNoteId(String(query.get('slug') || 'unfiled'));
  const original = path.basename(String(query.get('name') || 'image'));
  const safeBase = original.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'image';
  const input = await readBuffer(req, MAX_UPLOAD);
  if (input.length === 0) throw new Error('图片为空');
  const folder = path.join(NOTE_IMAGES_ROOT, slug);
  await fs.mkdir(folder, { recursive: true });
  const filename = `${Date.now()}-${safeBase}.webp`;
  const output = path.join(folder, filename);
  const optimized = await sharp(input)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
  await fs.writeFile(output, optimized);
  const url = `/images/notes/${slug}/${filename}`;
  return { url, markdown: `![${safeBase}](${url})`, bytes: optimized.length };
}

async function serveStatic(req, res, urlPath) {
  if (urlPath === '/favicon.ico') { res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' }); res.end(); return; }
  const isStudio = urlPath === '/studio' || urlPath.startsWith('/studio/');
  const base = isStudio ? STUDIO_ROOT : DIST_ROOT;
  let targetPath = isStudio
    ? (urlPath === '/studio' || urlPath === '/studio/' ? '/index.html' : urlPath.slice('/studio'.length))
    : urlPath;
  let decoded;
  try { decoded = decodeURIComponent(targetPath); } catch { return json(res, 400, { error: '无效路径' }); }
  let filePath = path.resolve(base, `.${decoded}`);
  if (!filePath.startsWith(`${base}${path.sep}`) && filePath !== base) return json(res, 403, { error: '禁止访问' });
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');
  }
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': base === STUDIO_ROOT ? 'no-store' : (path.extname(filePath) === '.html' ? 'no-store' : 'public, max-age=60'),
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(filePath).pipe(res);
  } catch {
    if (base === DIST_ROOT) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><meta charset="utf-8"><title>尚未构建</title><body style="font-family:sans-serif;padding:40px;background:#0b111a;color:#e9f7ff"><h1>网站尚未构建</h1><p>回到 <a style="color:#4debff" href="/studio/">写作后台</a> 点击“构建预览”。</p></body>');
    } else {
      json(res, 404, { error: '文件不存在' });
    }
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const { pathname, searchParams } = requestUrl;

  if (pathname.startsWith('/api/')) {
    const origin = req.headers.origin;
    const allowedOrigins = new Set([`http://${HOST}:${PORT}`, `http://localhost:${PORT}`]);
    if (origin && !allowedOrigins.has(origin)) return json(res, 403, { error: '只允许本机写作后台访问' });
  }

  try {
    if (req.method === 'GET' && pathname === '/api/trash') {
      return json(res, 200, { items: await listTrash() });
    }
    if (req.method === 'POST' && pathname === '/api/trash/restore') {
      const { file } = await readJson(req);
      return json(res, 200, { note: await restoreTrash(file) });
    }
    if (req.method === 'POST' && pathname === '/api/trash/publish-delete') {
      const { file } = await readJson(req);
      const result = await publishTrashDeletion(file);
      return json(res, result.ok ? 200 : 500, result);
    }
    if (req.method === 'DELETE' && pathname.startsWith('/api/trash/')) {
      await permanentlyDeleteTrash(decodeURIComponent(pathname.slice('/api/trash/'.length)));
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && pathname === '/api/notes') {
      return json(res, 200, { notes: await listNotes() });
    }
    if (req.method === 'GET' && pathname.startsWith('/api/notes/')) {
      return json(res, 200, { note: await getNote(decodeURIComponent(pathname.slice('/api/notes/'.length))) });
    }
    if (req.method === 'POST' && pathname === '/api/notes') {
      return json(res, 201, { note: await saveNote(await readJson(req), true) });
    }
    if (req.method === 'PUT' && pathname.startsWith('/api/notes/')) {
      const id = decodeURIComponent(pathname.slice('/api/notes/'.length));
      const input = await readJson(req);
      input.id = id;
      return json(res, 200, { note: await saveNote(input, false) });
    }
    if (req.method === 'DELETE' && pathname.startsWith('/api/notes/')) {
      const deleted = await deleteNote(decodeURIComponent(pathname.slice('/api/notes/'.length)));
      return json(res, 200, { ok: true, ...deleted });
    }
    if (req.method === 'POST' && pathname === '/api/preview') {
      const { markdown } = await readJson(req);
      return json(res, 200, { html: await marked.parse(String(markdown || ''), { gfm: true, breaks: false }) });
    }
    if (req.method === 'POST' && pathname === '/api/upload') {
      return json(res, 201, await uploadImage(req, searchParams));
    }
    if (req.method === 'POST' && pathname === '/api/build') {
      const result = await buildSite();
      return json(res, result.ok ? 200 : 500, result);
    }
    if (req.method === 'POST' && pathname === '/api/publish') {
      const { message } = await readJson(req);
      const result = await publishChanges(message);
      return json(res, result.ok ? 200 : 500, result);
    }
    if (req.method === 'GET' && pathname === '/api/status') {
      return json(res, 200, await gitStatus());
    }
    if (pathname.startsWith('/api/')) return json(res, 404, { error: '接口不存在' });
    return serveStatic(req, res, pathname);
  } catch (error) {
    const status = Number(error.statusCode) || 400;
    return json(res, status, { error: error.message || '操作失败' });
  }
});

await fs.mkdir(NOTES_ROOT, { recursive: true });
await fs.mkdir(NOTE_IMAGES_ROOT, { recursive: true });
server.listen(PORT, HOST, () => {
  console.log(`cattery studio: http://${HOST}:${PORT}/studio/`);
  console.log(`site preview:  http://${HOST}:${PORT}/`);
});
