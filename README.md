# xadmin-client

xadmin 前端 —— 基于 [vue-pure-admin](https://github.com/pure-admin/vue-pure-admin) 二次开发的**元数据驱动**管理界面
（表格列 / 表单 / 搜索项由后端 `search-columns` / `search-fields` 元数据生成，前端只注册渲染器）。

后端：[xadmin-server](https://github.com/nineaiyu/xadmin-server)（Django 6 + DRF + Channels）

### 在线预览（线上演示）

[https://xadmin.dvcloud.xin/](https://xadmin.dvcloud.xin/)
账号密码：admin/admin123（线上演示账号；本地后端初始化的账号见 `xadmin-server` README）

## 环境要求

| 依赖    | 版本                         | 说明                                   |
| ------- | ---------------------------- | -------------------------------------- |
| Node.js | >= 22.22.1（`.nvmrc` = v24） | `engines` 强校验                       |
| pnpm    | >= 11                        | `preinstall` 强制（`only-allow pnpm`） |

## 快速开始（本地开发）

```shell
pnpm install
pnpm dev                # http://127.0.0.1:8848
```

前置：后端运行在 `127.0.0.1:8896`（后端仓库一键起：`bash xadmin-server/utils/dev_up.sh --backend-only`）。

- 开发代理（`vite.config.ts`）：`/api`、`/media`、`/api-docs` → `http://127.0.0.1:8896`，`/ws` → `ws://127.0.0.1:8896`（默认已配置）；
- 后端不在默认端口：修改上述代理目标，或用环境变量 `E2E_API_PORT` 覆盖代理端口；
- `public/platform-config.json` 为启动必需文件（标题 / 布局 / 主题 / 路由缓存等运行期开关）。

## 环境变量

按 Vite 约定分文件管理（**均已入库**，可直接修改；变量清单与注释见各文件）：

| 文件               | 变量                                                                               | 说明                               |
| ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------- |
| `.env`             | `VITE_PORT`                                                                        | dev server 端口（默认 8848）       |
|                    | `VITE_HIDE_HOME`                                                                   | 是否隐藏首页                       |
| `.env.development` | `VITE_PUBLIC_PATH` / `VITE_ROUTER_HISTORY` / `VITE_API_DOMAIN` / `VITE_WSS_DOMAIN` | 开发态；域名留空 = 相对路径 + 代理 |
| `.env.production`  | `VITE_CDN` / `VITE_COMPRESSION` / `VITE_API_DOMAIN` / `VITE_WSS_DOMAIN`            | 生产构建；域名留空 = 同源反代      |
| `.env.staging`     | 同上                                                                               | 预发环境                           |

## 构建与部署

```shell
pnpm build              # 产物 dist/（同源反代部署可不改配置）
pnpm build:staging      # 预发构建
```

Docker 构建（先改 `.env.production` 的 API 域名）：

```shell
sh build.sh                    # 构建前端产物到 web/data/dist（内部用 node 镜像执行 pnpm build，需交互式终端）
docker compose up -d --build   # 构建并启动 nginx-web 服务（默认 80 端口；SSL/域名见 compose 注释）
```

生产推荐形态：`dist/` 交给 nginx 托管并反代 `/api`、`/ws`、`/media` 到后端（模板见 `xadmin-web/`）。

## 测试与门禁（提交前）

```shell
pnpm typecheck                            # 类型检查（strict 全仓，单轨）
pnpm lint                                 # eslint + prettier + stylelint
pnpm test:run                             # vitest（覆盖率阈值）
pnpm check:contract                       # 与后端契约镜像一致性
pnpm check:version                        # 与后端版本号一致性
pnpm check:bundle-size                    # 首屏体积基线（+15KB 预算）
```

契约变更流程（服务端为唯一真源）：后端改 `xadmin-server/docs/schema/` 后，在本仓执行
`pnpm sync:contract`（同步镜像 + 重新生成 `src/api/types/*.d.ts`），连同生成物一起提交；
版本号提升需两仓同步（`package.json` ↔ `server/const.py`），`pnpm check:version` 与发布 tag 门禁双重校验。

E2E（Playwright，chromium + webkit）：`pnpm test:e2e` / `pnpm test:e2e:smoke`；
**改了后端代码必须用 `pnpm test:e2e:fresh`**（防旧进程假失败）。默认依赖同级目录 `../xadmin-server`（自动拉起 E2E 后端），
独立检出运行方式与陷阱清单见 [e2e/README.md](e2e/README.md)。

## 常见问题

| 问题                         | 解决                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev` 接口 404          | 确认后端在 8896；代理目标见 `vite.config.ts`                                             |
| 页面空白但路由存在           | 后端未下发 `search-columns` 元数据（检查后端 `Meta.table_fields`）或权限码与组件名不一致 |
| 新增 Element Plus 组件不渲染 | 需在 `src/plugins/elementPlus.ts` 手动登记（组件 + 样式）                                |
| 图标不显示                   | 图标需在离线集内（`ep` / `ri` / `fa-solid`）或随包注册，详见 `ReIcon` 组件               |
| 构建产物部署后请求地址错误   | 改 `.env.production` 的 `VITE_API_DOMAIN` / `VITE_WSS_DOMAIN` 后重新构建                 |

## 开发文档

- **前端开发指引（含独立检出）**：[docs/development-guide.md](docs/development-guide.md)
- 开发约定与门禁清单：[CONTRIBUTING.md](CONTRIBUTING.md)
- E2E 纪律与陷阱表：[e2e/README.md](e2e/README.md)
- 后端文档中心（架构 / 三层权限 / 元数据契约）：`xadmin-server/docs/README.md`
- 在线文档：<https://docs.dvcloud.xin/>
