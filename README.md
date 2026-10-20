# cattery

肥猫叉烧的个人作品集：项目、代码仓库、笔记，以及猫、猪和柯基一起住的 3D 小房间。

## 技术栈

- Astro 5 静态站
- Three.js + GSAP ScrollTrigger 3D 首页
- Markdown 笔记与项目内容
- Pagefind 站内搜索
- Gitee API 仓库数据快照
- EdgeOne Pages 静态部署

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://localhost:4321>。

## 构建

```bash
npm run build
npm run preview
```

类型检查：

```bash
npm run check
```

## 内容结构

- 笔记：`src/content/notes/`
- 项目：`src/content/projects/`
- 站点信息：`src/data/site.ts`
- Gitee 仓库快照：`src/data/gitee-repos.json`
- 3D 首页：`src/pages/index.astro` + `src/scripts/room.ts`
- 全局样式与设计 token：`src/styles/global.css`

主要路由：

- `/` 3D 首页
- `/projects/` 项目与仓库书架
- `/projects/miao-secretary/` 喵秘书案例
- `/notes/` 笔记
- `/about/` 关于
- `/search/` 搜索
- `/archive/` 归档

## 同步 Gitee 仓库

```bash
npm run repos:sync
```

脚本会读取 `fat-cat-barbecue` 的公开仓库，过滤 fork、空描述和学习/测试类仓库，取最近更新的 6 个写入快照。

需要更高 API 限额时可以设置：

```powershell
$env:GITEE_TOKEN="你的 token"
npm run repos:sync
```

## 3D 与降级

- 桌面、平板和手机都会加载 3D 房间；手机使用更低像素比、关闭阴影。
- 首页使用站点式镜头：首屏同时展示三只角色，滚动到猫、猪、柯基时分别切到完整全身机位。
- 窄屏底部面板默认收起，点击后展开阅读，再收起可恢复完整角色视野。
- 开启“减少动态效果”时，首页自动切换为静态海报和普通长页面。
- WebGL 不可用时同样回退到静态海报。
- 海报：`public/images/room-poster.webp`
- 页面内容始终是普通 HTML，不依赖 canvas 才能阅读。

## 部署到 EdgeOne Pages

1. 把仓库推到 GitHub / GitLab，并在 EdgeOne Pages 导入项目。
2. Node 版本：22。
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 环境变量：`SITE_URL=https://你的域名`
6. 绑定自定义域名前，需要完成 ICP 备案。

> 部署前务必设置 `SITE_URL`，否则 canonical、RSS、sitemap 和分享卡片里仍然是示例域名。
