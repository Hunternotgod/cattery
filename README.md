# cattery

肥猫叉烧的个人作品集：项目、代码仓库、笔记，以及猫、猪和柯基一起住的赛博电竞房。

标语：**猫、猪、柯基，和一个写代码的人。**

## 技术栈

- Astro 5 静态站
- Three.js + GSAP 站点式 3D 镜头
- 程序化角色与赛博电竞房
- Markdown 笔记与项目内容
- Pagefind 站内搜索
- Gitee 仓库与 release 数据同步
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
- 喵秘书 release 快照：`src/data/miao-secretary-release.json`
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

## 同步 Gitee 数据

```bash
npm run repos:sync
npm run release:sync
# 或一次同步全部
npm run content:sync
```

- `repos:sync` 更新仓库书架快照。
- `release:sync` 获取喵秘书最新 release 和 Windows `.exe` 下载地址。
- 下载按钮会优先实时请求 Gitee latest release；请求失败时回退到同步直链。

需要更高 API 限额时可以设置：

```powershell
$env:GITEE_TOKEN="你的 token"
npm run repos:sync
```

## 3D 与灯光

- 全站默认深色霓虹模式；浅色模式代表“开灯”，主题开关同时控制 2D UI 和 3D 灯光。
- 首页首屏同时展示三只角色；猫、猪、柯基各有独立全身机位。
- 手机/平板底部面板默认收起，展开后镜头会为面板让出安全区。
- 开启“减少动态效果”时切换为静态海报和普通长页面。
- WebGL 不可用时同样回退静态海报。
- 海报：`public/images/room-poster.webp`

## 角色与 Tripo

当前三只角色为程序化模型，不依赖外部生成服务。以后配置 `TRIPO_API_KEY` 后，可以通过现有角色接口替换为 Tripo 生成的 GLB，不需要重写场景和镜头。

## 部署到 EdgeOne Pages

1. 把仓库推到 GitHub / GitLab，并在 EdgeOne Pages 导入项目。
2. Node 版本：22。
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 环境变量：`SITE_URL=https://你的域名`
6. 绑定自定义域名前，需要完成 ICP 备案。

> 部署前务必设置 `SITE_URL`，否则 canonical、RSS、sitemap 和分享卡片里仍然是示例域名。
