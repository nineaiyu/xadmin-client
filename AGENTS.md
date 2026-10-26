# AGENTS.md — xadmin-client（前端）

> 继承工作区根 `../AGENTS.md`（环境、E2E 铁律、安全禁区、验证口径都在那里）；
> 本文件只写**前端仓库特有的约定**。规则优先级：用户当前指令 > 本文件 > 工作区根。

## 一、仓库地图

| 目录                                                    | 内容                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/api/`                                              | 接口层：按域分组（`system/` `dataset/` `approval/` …），统一走 `BaseApi` 家族，返回 `{code, data, detail}`                                                                                                                                                                           |
| `src/components/`                                       | 自研组件库：`RePlusPage`（元数据驱动列表页，**核心**）、`ReDialog` / `ReDrawer`（弹层）、`DataTable` / `ReReadonlyTable`（只读表格，`check:tables` 的合规去向）、`ReIcon`、`RePureTableBar`、`ReActionPanel`、`RePage`、`RePlusSearch`、`ReApiSelect`、`Ai*` 系列、`MarkdownView` 等 |
| `src/views/`                                            | 页面：一个页面 = `index.vue`（壳）+ `utils/hook.tsx`（列渲染 / 按钮 / 搜索区格式化）+ `components/*Form.vue`（弹窗表单）                                                                                                                                                             |
| `src/store/`                                            | Pinia：user / permission / siteConfig / multiTags…                                                                                                                                                                                                                                   |
| `src/layout/` `src/router/` `src/hooks/` `src/plugins/` | 布局体系（7 种布局模式，见 `docs/layout-modes`）/ 路由与组件解析（`resolve-component.ts` 候选链，`check:menu-components` 与它同链）/ 组合式函数 / 插件装配（Element Plus 组件登记处：`src/plugins/elementPlus.ts`）                                                                  |
| `src/utils/`                                            | 工具（sse、dict、auth、desktopNotify、fetchAllRows…）                                                                                                                                                                                                                                |
| `src/style/`                                            | 样式与设计令牌（Tailwind CSS v4 + scss + tokens）                                                                                                                                                                                                                                    |
| `locales/`                                              | i18n 词条（`zh-CN.yaml` + `en.yaml`，unplugin-vue-i18n 的 include 面；zh/en 必须对称）                                                                                                                                                                                               |
| `contract/`                                             | 契约镜像（`openapi.json` + `schema/*.json`，`sync:contract` / `check:contract` 的对账对象）                                                                                                                                                                                          |
| `docs/`                                                 | 仓库内文档（development-guide、layout-modes、metadata-driven-crud、perf-firstscreen、accessibility-audit、component-dependencies）                                                                                                                                                   |
| `CONTRIBUTING.md`                                       | 分支模型、**上游 vue-pure-admin 不可覆盖清单**、组件 / 工具移植规范                                                                                                                                                                                                                  |
| `public/platform-config.json`                           | 项目参数（站点标题 / 布局 / 主题…）——**改偏好必须同步这里**                                                                                                                                                                                                                          |
| `e2e/`                                                  | Playwright 用例（`*.e2e.ts`）+ `helpers.ts` + `quarantine.json`（隔离清单）+ `README.md`（运行表与陷阱表）                                                                                                                                                                           |
| `scripts/`                                              | 门禁脚本（`check-*.mjs`）与 E2E 编排（`e2e-run.mjs`、`e2e-parallel.mjs`、`e2e-flaky-report.mjs`）                                                                                                                                                                                    |

## 二、常用命令

```bash
pnpm install
pnpm dev                     # :8848，代理 /api /media /api-docs（http）与 /ws（ws）→ :8896（后端）
pnpm build                   # 生产构建（含图标/动画子集预生成 + 版本文件）
pnpm test:run                # vitest 单测
pnpm typecheck               # tsc + vue-tsc
pnpm lint                    # eslint --max-warnings 0 + prettier + stylelint
pnpm sync:contract           # 契约同步：拷 server 端 schema 镜像 + 重生成 src/api/types/*.d.ts
pnpm gen:module              # 模块脚手架
```

## 三、页面开发约定（RePlusPage 范式）

1. 列表页 = **RePlusPage + 后端元数据**，页面只写 `listColumnsFormat` / `searchColumnsFormat` /
   `operationButtonsProps`；不要手写 `el-table` + 权限判断（既有历史页面正在逐步迁移，新页面一律走框架）。
   只读 / 弹窗内表格用 `DataTable`（表头样式与可访问名收口）：直接写 `<el-table>` 会被
   `pnpm check:tables` 拦下，存量用法登记在 `scripts/bare-tables-baseline.json`（只减不增）。
   **只读页或无批量操作的页面显式传 `:selection="false"`**：RePlusPage 默认渲染多选列，
   没有批量入口时会出现「能勾选但无动作」的死交互（6 个只读页已补齐）。
2. **权限从 `auth` 快照来**：默认按钮的显示由框架按 `动作:组件名` 判定；跨资源 / 自定义按钮用
   `hasAuth("动作:组件名")` 显式判定——`getDefaultAuths` 只按组件名拼通用动作清单。
3. 弹层统一用 `addDialog` / `addDrawer`（ReDialog / ReDrawer）；随组件生命周期存续的
   常驻面板用声明式壳 `OverlayDialog` / `OverlayDrawer`（`src/components/overlay/`，同一
   overlay 内核）。直接写 `<el-dialog>` / `<el-drawer>` 会被 `pnpm check:overlays` 拦下，
   存量用法登记在 `scripts/declarative-overlays-baseline.json`（只减不增）；确需内联的
   只读展示型场景在登记表写明理由。**新增/编辑表单先按
   `xadmin-server/docs/architecture/component-handbook.md` §六「表单选型判定」选型**：
   标准模型 CRUD 走元数据表单（`addOrEditOptions`，字段来自后端），只有无模型元数据 /
   schema 不同源 / 元数据表达不了的混合形态才手写 `XxxForm.vue` + `getPayload()`
   （校验失败返回 null 以保持弹层），且必须登记 `scripts/handwritten-forms-exempt.json`
   （`pnpm check:forms` 会拦）；**先 `done()` 关弹层再 `await load*()` 刷新**。
4. API 调用统一 `.catch(normalizeError)`（`@/utils/apiError`）归一异常，避免 `beforeSure`
   抛错导致 loading 悬挂；不要手写 `String(error)` 或同构的 `{code: -1, detail}` 映射。
   注意：**列表页（RePlusPage/defineListPage）的请求与错误反馈由框架
   内部消化，页面零 try/catch；该归一样板仅手写调用点需要**（全仓手写 `code: -1` 仅个位数）。
5. **200 + 业务码失败必须页面显式处理**（`res.code === SUCCESS_CODE` 之外的分支要 `ElMessage.error`）——
   http 拦截器只管 4xx/5xx。
6. 新增 / 修改页面后同步 i18n 词条（zh + en 对称，`pnpm check:i18n`）；YAML 里的裸 `@` 要写 `{'@'}`。

## 四、项目参数（偏好）新增流程

新增一个偏好键要**成组登记**，漏一处就是「改了不生效」：

1. `public/platform-config.json` 加默认值；
2. 两处类型声明 + 注入缺省（`src/utils/responsive.ts` 的 `injectResponsiveStorage`）；
3. 本地初始化 / 读取消费点；
4. 站点级配置的读写清单（`src/store/modules/siteConfig.ts` 的 `saveSiteConfig` / `getSiteConfig`）；
5. 后端种子（站点级键进 `settings/seeds/systemconfig.json` 的 `WEB_SITE_CONFIG`；
   平台层 `loadjson/` 已不承载站点配置，别再往那里加）；
6. 跑 `pnpm check:platform-config`（死参数 / 断链双检）。

## 五、样式与组件约定

- 样式用 Tailwind CSS v4 原子类（`src/style/tailwind.css` 的 `@theme` 桥接语义令牌；
  UnoCSS 已全量移除，不存在 `uno.config.*`）+ 设计令牌（`src/style/tokens/`）；
  **不要写死字号与颜色字面量**（`pnpm check:font-size-literals` / `check:color-literals`
  会拦），用语义令牌。
- 暗色适配走令牌（`html.dark` 分支），别用 `!important` 堆叠。
- 新用 Element Plus 组件要同时登记组件与 `element-plus/es/components/xxx/style/css`
  （登记处：`src/plugins/elementPlus.ts`）。
- 图表统一走 `useECharts` 封装；canvas 导出动画需等待渲染完成。
- 组合式函数 ≥ 120 行、单文件超过 500 行会被门禁拦（`check:hook-length` 阈值 120 /
  `check-file-length`），拆分而不是登记基线。
- 模块依赖环由 `pnpm check:module-cycles` 拦截；新增跨模块引用前先想清楚方向。
- **SFC 必须单根，模板注释写在根元素内部**（`<template>` 后不要直接跟 `<!-- -->`）：
  根级注释会让组件在 dev 下渲染成「多根」（dev Fragment 根），与布局的
  `<Transition mode="out-in">` 组合会卡死——离开该页面后内容区永久空白且切页不恢复；
  由 `pnpm check:template-root` 拦截，守护用例见 `e2e/system-pages.e2e.ts`「关于页」。

## 六、测试与门禁

```bash
pnpm test:run                                  # vitest（含契约 / 词条 / 格式函数等纯逻辑用例）
pnpm typecheck && pnpm lint
for g in api-routes as-unknown bundle-size color-literals contract contract-usage docs-components \
         entry-closure font-size-literals forms hook-length i18n ledger-ids menu-components \
         menu-permissions module-cycles openapi-types overlays platform-config quarantine success-code \
         tables template-root version; do pnpm check:$g || break; done
node scripts/check-file-length.mjs        # 行数门禁（≤500；ReIcon/data.ts 与 api/types/openapi.d.ts
                                          # 在脚本内 EXEMPT 豁免，其余基线只减不增）
```

`check:*` 补充说明：`contract` / `contract-usage` / `openapi-types` / `api-routes` 是契约四件套
（前两个对 schema 镜像与用点，后两个防 `openapi.d.ts` 过期与手写 URL 漂移）；`menu-components`
防菜单种子里的组件片段静默断路由；`docs-components` 对账 xadmin-docs 组件示例的 props；
`check:version` 需要同工作区的 `xadmin-server`（或 `XADMIN_SERVER_DIR`）才能核对版本。
`check:menu-permissions` 同样跨仓读取 server 种子（`XADMIN_SERVER_DIR` 可覆盖）。
首屏闭包预算为「代码 / i18n 两个账本各 15 KB 增长」，超预算需在 PR 说明后 `--update`。
CI（`lint-code.yml`）会全量跑这些门禁 + coverage 覆盖率门禁，PR / 推送自动把关。

E2E（**改了后端必须 `*:fresh`**）：

```bash
node scripts/e2e-run.mjs smoke:fresh                                    # 冒烟（chromium）
node scripts/e2e-run.mjs run e2e/xxx.e2e.ts --project=chromium          # 定向单 spec
node scripts/e2e-run.mjs fresh                                          # 全量双浏览器
node scripts/e2e-run.mjs parallel                                       # 4 路分片（独立库 xadmin_e2e_shard<i>）
# 其余 mode：visual(+update) / a11y / perf(+update) / csp / quarantine——全集见 scripts/e2e-run.mjs
```

- 端口：后端 `18896`、前端 `8848`、桩 LLM `18897`（CSP 用 `18899`）；
  E2E 会 DROP/CREATE 独立库 `xadmin_e2e` 并跑 `xadmin-server/scripts/e2e_seed.py`。
- 定位与断言规范见 `e2e/README.md`（「列表断言陷阱」一节 + `helpers.ts` 的 `openList`：
  等 `.el-table` 可见再断言）；写用例前先读它，能省一轮失败。
- 视觉基线：`pnpm test:e2e:visual`（差异先看 diff 图判断是布局还是数据，别直接重录基线）；
  基线快照**入库跟踪**——linux 基线由 `visual-baseline` workflow 生成后人工确认提交，别随手覆盖。
- 用例必须幂等：双浏览器共享库、跨用例共享数据，唯一名 + 自清理。

## 七、提交纪律

- 只有用户明确要求才 `git commit`；`type(scope): 中文描述`，Conventional Commits + type 白名单
  （feat/fix/perf/style/docs/test/refactor/build/ci/chore/revert/wip/workflow/types/release），
  **header ≤ 108 字符**（commitlint 硬规则）。
- 源码注释 / 测试名 / 基线 JSON 说明字段里**不写台账编号**（`ADR-090` 决策编号、
  `T03-01` / `O10-2` 一类），需要交代来龙去脉时写一句自足的语义说明。
  守护：`pnpm check:ledger-ids`。
- 提交前 `git add -A` 全量暂存（避免 lint-staged 在「部分暂存」下污染提交），提交后核对
  `git show --stat` 与 `git status --short`。
