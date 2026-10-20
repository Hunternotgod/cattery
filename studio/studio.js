const $ = (selector) => document.querySelector(selector);
const noteList = $('#note-list');
const editorPanel = $('#editor-panel');
const emptyState = $('#studio-empty');
const toast = $('#studio-toast');
const publishDialog = $('#publish-dialog');
const publishSteps = $('#publish-steps');
const publishLog = $('#publish-log');
const fields = {
  title: $('#note-title'), id: $('#note-id'), date: $('#note-date'), updated: $('#note-updated'),
  tags: $('#note-tags'), description: $('#note-description'), draft: $('#note-draft'), body: $('#note-body'),
};
const previewPane = $('#preview-pane');
const saveState = $('#save-state');
const editorHeading = $('#editor-heading');
const editorEyebrow = $('#editor-eyebrow');
const openArticle = $('#open-article');
const deleteButton = $('#delete-note');
const buildButton = $('#build-button');
const publishQuick = $('#publish-quick');
const publishNote = $('#publish-note');
const saveDraft = $('#save-draft');
const imageInput = $('#image-input');
let notes = [];
let currentId = null;
let dirty = false;
let previewTimer = 0;
let busy = false;
let noteFilter = 'all';
let trashItems = [];

class ApiError extends Error { constructor(message, data) { super(message); this.data = data; } }
async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || data.hint || `${response.status} ${response.statusText}`, data);
  return data;
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const defaultSlug = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `note-${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
};
const showToast = (message, timeout = 3200) => {
  toast.textContent = message; toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, timeout);
};
const setBusy = (value) => {
  busy = value;
  [buildButton, publishQuick, publishNote, saveDraft, deleteButton].forEach((button) => { if (button) button.disabled = value; });
};
const setDirty = (value) => {
  dirty = value; saveState.classList.toggle('is-dirty', value);
  saveState.querySelector('span:last-child').textContent = value ? '有未保存修改' : '已保存';
};
const payload = () => ({
  id: fields.id.value.trim(), title: fields.title.value.trim(), description: fields.description.value.trim(),
  pubDate: fields.date.value, updatedDate: fields.updated.value,
  tags: fields.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean), draft: fields.draft.checked, body: fields.body.value,
});
const setForm = (note) => {
  currentId = note?.id ?? null;
  fields.id.value = note?.id ?? defaultSlug(); fields.id.readOnly = Boolean(note);
  fields.title.value = note?.title ?? ''; fields.description.value = note?.description ?? '';
  fields.date.value = note?.pubDate ?? today(); fields.updated.value = note?.updatedDate ?? '';
  fields.tags.value = (note?.tags ?? []).join(', '); fields.draft.checked = note?.draft ?? true;
  fields.body.value = note?.body ?? '## 小标题\n\n从这里开始写。\n';
  editorHeading.textContent = note?.title || '新建文章'; editorEyebrow.textContent = note ? `article / ${note.id}` : 'draft / unsaved';
  openArticle.hidden = !note; if (note) openArticle.href = `/notes/${encodeURIComponent(note.id)}/`;
  deleteButton.hidden = !note; emptyState.hidden = true; editorPanel.hidden = false;
  setDirty(!note); updatePreview();
};
const renderNotes = () => {
  const term = ($('#note-search').value || '').trim().toLowerCase();
  noteList.replaceChildren();
  if (noteFilter === 'trash') {
    const visibleTrash = trashItems.filter((item) => !term || item.title.toLowerCase().includes(term));
    if (visibleTrash.length === 0) {
      const empty = document.createElement('p'); empty.className = 'trash-empty'; empty.textContent = '回收站是空的。删除的文章会先保存在这里。'; noteList.append(empty); return;
    }
    for (const item of visibleTrash) {
      const card = document.createElement('div'); card.className = 'trash-item';
      const title = document.createElement('strong'); title.textContent = item.title;
      const meta = document.createElement('small'); meta.textContent = `${item.id} · 删除于 ${new Date(item.deletedAt).toLocaleString('zh-CN')}`;
      const actions = document.createElement('div'); actions.className = 'trash-actions';
      const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = '恢复';
      restore.addEventListener('click', () => restoreTrashItem(item.file));
      const syncDelete = document.createElement('button'); syncDelete.type = 'button'; syncDelete.textContent = '仅同步删除';
      syncDelete.addEventListener('click', () => publishTrashDeletion(item.file));
      const purge = document.createElement('button'); purge.type = 'button'; purge.className = 'danger-action'; purge.textContent = '永久删除';
      purge.addEventListener('click', () => permanentlyDeleteTrash(item.file));
      actions.append(restore, syncDelete, purge); card.append(title, meta, actions); noteList.append(card);
    }
    return;
  }
  const visible = notes.filter((note) => {
    if (noteFilter === 'draft' && !note.draft) return false;
    if (noteFilter === 'published' && note.draft) return false;
    return !term || `${note.title} ${note.description} ${note.tags.join(' ')}`.toLowerCase().includes(term);
  });
  if (visible.length === 0) {
    const empty = document.createElement('p'); empty.className = 'preview-placeholder'; empty.textContent = term ? '没有匹配的文章。' : '这个分类里还没有文章。'; noteList.append(empty); return;
  }
  for (const note of visible) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `note-list-item${note.id === currentId ? ' is-active' : ''}`;
    const title = document.createElement('strong'); title.textContent = note.title;
    const meta = document.createElement('small'); meta.textContent = `${note.pubDate || '无日期'} · ${note.draft ? '草稿' : '已发布'}`;
    button.append(title, meta);
    button.addEventListener('click', async () => { if (await maybeLeave()) await openNote(note.id); });
    noteList.append(button);
  }
};
const loadNotes = async () => { const data = await api('/api/notes'); notes = data.notes; renderNotes(); };
const loadTrash = async () => { const data = await api('/api/trash'); trashItems = data.items; renderNotes(); };
const openNote = async (id) => { const data = await api(`/api/notes/${encodeURIComponent(id)}`); noteFilter = 'all'; syncFilterButtons(); setForm(data.note); renderNotes(); };
const syncFilterButtons = () => document.querySelectorAll('[data-note-filter]').forEach((button) => button.classList.toggle('is-active', button.dataset.noteFilter === noteFilter));

const maybeLeave = async () => !dirty || window.confirm('当前文章还有未保存修改，确定放弃吗？');
const newNote = () => { if (!maybeLeave()) return; noteFilter = 'all'; syncFilterButtons(); setForm(null); renderNotes(); fields.title.focus(); };

const saveNote = async () => {
  const data = payload();
  if (!data.id || !data.title || !data.description || !data.pubDate) {
    showToast('标题、文件名、摘要和发布日期不能为空'); fields.title.focus(); return null;
  }
  setBusy(true);
  try {
    const result = await api(currentId ? `/api/notes/${encodeURIComponent(currentId)}` : '/api/notes', {
      method: currentId ? 'PUT' : 'POST', body: JSON.stringify(data),
    });
    currentId = result.note.id; fields.id.readOnly = true;
    editorHeading.textContent = result.note.title; editorEyebrow.textContent = `article / ${result.note.id}`;
    openArticle.hidden = false; openArticle.href = `/notes/${encodeURIComponent(result.note.id)}/`;
    deleteButton.hidden = false; setDirty(false); await loadNotes();
    showToast(result.note.draft ? '草稿已保存' : '文章已保存'); return result.note;
  } catch (error) { showToast(error.message, 5000); return null; }
  finally { setBusy(false); }
};
const updatePreview = async () => {
  try {
    const data = await api('/api/preview', { method: 'POST', body: JSON.stringify({ markdown: fields.body.value }) });
    previewPane.innerHTML = data.html || '<p class="preview-placeholder">预览会显示在这里。</p>';
  } catch { previewPane.innerHTML = '<p class="preview-placeholder">预览暂时不可用。</p>'; }
};
const schedulePreview = () => { window.clearTimeout(previewTimer); previewTimer = window.setTimeout(updatePreview, 320); };
const refreshGitStatus = async () => {
  try {
    const status = await api('/api/status');
    const changes = status.changes.length ? `${status.changes.length} 个未提交变更` : '工作区干净';
    const track = $('[data-git-status]');
    if (track) track.innerHTML = `<strong>${status.branch}</strong> · ${changes} · ${status.lastCommit}`;
  } catch {}
};
const buildPreview = async () => {
  setBusy(true); showToast('正在构建站点预览…', 60000);
  try { const result = await api('/api/build', { method: 'POST', body: '{}' }); showToast(result.ok ? '构建完成，打开网站即可查看' : `构建失败：${result.step || '未知错误'}`, 5000); await refreshGitStatus(); }
  catch (error) { showToast(error.message, 6000); }
  finally { setBusy(false); }
};
const showPublishResult = (result, error = null) => {
  if (!publishDialog.open) publishDialog.showModal();
  publishSteps.replaceChildren();
  $('#publish-title').textContent = error ? '发布未完成' : '发布完成';
  const steps = result?.steps || (error ? [error.message] : []);
  steps.forEach((step) => { const item = document.createElement('li'); item.textContent = step; if (error) item.classList.add('is-error'); publishSteps.append(item); });
  const hint = result?.hint || error?.data?.hint;
  if (hint) { const item = document.createElement('li'); item.textContent = hint; item.classList.add('is-error'); publishSteps.append(item); }
  const log = result?.stderr || result?.stdout || error?.data?.stderr || error?.data?.stdout || '';
  publishLog.hidden = !log; publishLog.textContent = log;
};
const publish = async () => {
  if (!currentId || dirty) { const saved = await saveNote(); if (!saved) return; }
  if (fields.draft.checked) {
    if (!window.confirm('这篇文章仍是草稿。取消草稿并发布到线上吗？')) return;
    fields.draft.checked = false; const saved = await saveNote(); if (!saved) return;
  }
  const message = window.prompt('提交说明', `content: publish ${fields.title.value.trim()}`)?.trim();
  if (!message) return;
  setBusy(true);
  try {
    const result = await api('/api/publish', { method: 'POST', body: JSON.stringify({ message }) });
    showPublishResult(result); setDirty(false); await loadNotes(); await refreshGitStatus();
  } catch (error) { showPublishResult(error.data, error); }
  finally { setBusy(false); }
};
const deleteCurrent = async () => {
  if (!currentId || !window.confirm(`确定删除《${fields.title.value}》吗？文件会先移入本地回收站。`)) return;
  setBusy(true);
  try {
    const deleted = await api(`/api/notes/${encodeURIComponent(currentId)}`, { method: 'DELETE' });
    currentId = null; setDirty(false); editorPanel.hidden = true; emptyState.hidden = false;
    noteFilter = 'trash'; syncFilterButtons(); await loadNotes(); await loadTrash();
    const syncOnline = window.confirm('现在只把这个删除同步到 Gitee/GitHub 吗？\n\n只会提交这一篇文章的删除，不会提交其他文章、草稿或图片。');
    if (syncOnline && deleted.file) {
      const result = await api('/api/trash/publish-delete', { method: 'POST', body: JSON.stringify({ file: deleted.file }) });
      showPublishResult(result); await refreshGitStatus();
    } else {
      showToast('文章只在本地回收站，线上仓库尚未删除');
    }
  } catch (error) { showPublishResult(error.data, error); }
  finally { setBusy(false); }
};
const restoreTrashItem = async (file) => {
  setBusy(true);
  try {
    const result = await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ file }) });
    noteFilter = 'all'; syncFilterButtons(); await loadNotes(); await loadTrash();
    await openNote(result.note.id);
    showToast('文章已从回收站恢复');
  } catch (error) { showToast(error.message, 5000); }
  finally { setBusy(false); }
};
const publishTrashDeletion = async (file) => {
  if (!window.confirm('只同步删除这一篇文章？不会提交其他新增、修改或草稿。')) return;
  setBusy(true);
  try {
    const result = await api('/api/trash/publish-delete', { method: 'POST', body: JSON.stringify({ file }) });
    showPublishResult(result); await loadTrash(); await refreshGitStatus();
  } catch (error) { showPublishResult(error.data, error); }
  finally { setBusy(false); }
};
const permanentlyDeleteTrash = async (file) => {
  if (!window.confirm('永久删除这个回收站备份？此操作无法从后台恢复。')) return;
  setBusy(true);
  try { await api(`/api/trash/${encodeURIComponent(file)}`, { method: 'DELETE' }); await loadTrash(); showToast('回收站备份已永久删除'); }
  catch (error) { showToast(error.message); }
  finally { setBusy(false); }
};

const uploadImage = async () => {
  const file = imageInput.files?.[0]; if (!file) return;
  const slug = fields.id.value.trim(); if (!slug) return showToast('请先填写文件名');
  if (file.size > 15 * 1024 * 1024) return showToast('图片不能超过 15MB');
  try {
    setBusy(true);
    const response = await fetch(`/api/upload?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '上传失败');
    const start = fields.body.selectionStart; const end = fields.body.selectionEnd;
    fields.body.setRangeText(`${data.markdown}\n`, start, end, 'end'); setDirty(true);
    showToast('图片已压缩为 WebP；构建预览后可查看');
  } catch (error) { showToast(error.message); }
  finally { setBusy(false); imageInput.value = ''; }
};

fields.title.addEventListener('input', () => { editorHeading.textContent = fields.title.value || '新建文章'; setDirty(true); });
fields.body.addEventListener('input', () => { setDirty(true); schedulePreview(); });
[fields.id, fields.date, fields.updated, fields.tags, fields.description, fields.draft].forEach((field) => {
  field.addEventListener('input', () => setDirty(true)); field.addEventListener('change', () => setDirty(true));
});
$('#new-note').addEventListener('click', newNote);
$('#empty-new').addEventListener('click', newNote);
$('#note-search').addEventListener('input', renderNotes);
document.querySelectorAll('[data-note-filter]').forEach((button) => {
  button.addEventListener('click', async () => {
    noteFilter = button.dataset.noteFilter || 'all'; syncFilterButtons();
    if (noteFilter === 'trash') await loadTrash(); else renderNotes();
  });
});
saveDraft.addEventListener('click', saveNote);
publishNote.addEventListener('click', publish);
publishQuick.addEventListener('click', publish);
buildButton.addEventListener('click', buildPreview);
$('#preview-refresh').addEventListener('click', updatePreview);
$('#upload-image').addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', uploadImage);
deleteButton.addEventListener('click', deleteCurrent);
$('#publish-close').addEventListener('click', () => publishDialog.close());
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveNote(); }
});
window.addEventListener('beforeunload', (event) => { if (!dirty) return; event.preventDefault(); });

(async () => {
  try {
    await loadNotes(); await refreshGitStatus();
    if (notes.length > 0) await openNote(notes[0].id);
  } catch (error) { showToast(`后台初始化失败：${error.message}`, 8000); }
})();
