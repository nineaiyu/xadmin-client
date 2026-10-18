# AGENTS.md — xadmin-client（前端）

> 继承工作区根 `../AGENTS.md`（环境、E2E 铁律、安全禁区、验证口径都在那里）；
> 本文件只写**前端仓库特有的约定**。规则优先级：用户当前指令 > 本文件 > 工作区根。

## 一、仓库地图

| 目录                          | 内容                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/`                    | 接口层：按域分组（`system/` `dataset/` `approval/` …），统一走 `BaseApi` 家族，返回 `{code, data, detail}`                              |
| `src/components/`             | 自研组件库：`RePlusPage`（元数据驱动列表页，**核心**）、`ReDialog` / `ReDrawer`（弹层）、`ReIcon`、`RePureTableBar`、`ReActionPanel` 等 |
| `src/views/`                  | 页面：一个页面 = `index.vue`（壳）+ `utils/hook.tsx`（列渲染 / 按钮 / 搜索区格式化）+ `components/*Form.vue`（弹窗表单）                |
| `src/store/`                  | Pinia：user / permission / siteConfig / multiTags…                                                                                      |
| `src/utils/`                  | 工具（sse、dict、auth、desktopNotify、fetchAllRows…）                                                                                   |
| `src/style/`                  | 样式与设计令牌（UnoCSS + scss + tokens）                                                                                                |
| `public/platform-config.json` | 项目参数（站点标题 / 布局 / 主题…）——**改偏好必须同步这里**                                                                             |
| `e2e/`                        | Playwright 用例（`*.e2e.ts`）+ `helpers.ts` + `quarantine.json`（隔离清单）+ `README.md`（运行表与陷阱表）                              |
| `scripts/`                    | 门禁脚本（`check-*.mjs`）与 E2E 编排（`e2e-run.mjs`）                                                                                   |

## 二、常用命令

```bash
pnpm install
pnpm dev                     # :8848，代理 /api、/ws → :8896（后端）
pnpm build                   # 生产构建（含图标/动画子集预生成 + 版本文件）
pnpm test:run                # vitest 单测
pnpm typecheck               # tsc + vue-tsc
pnpm lint                    # eslint --max-warnings 0 + prettier + stylelint
```

## 三、页面开发约定（RePlusPage 范式）

1. 列表页 = **RePlusPage + 后端元数据**，页面只写 `listColumnsFormat` / `searchColumnsFormat` /
   `operationButtonsProps`；不要手写 `el-table` + 权限判断（既有历史页面正在逐步迁移，新页面一律走框架）。
2. **权限从 `auth` 快照来**：默认按钮的显示由框架按 `动作:组件名` 判定；跨资源 / 自定义按钮用
   `hasAuth("动作:组件名")` 显式判定——`getDefaultAuths` 只按组件名拼通用动作清单。
3. 弹层统一用 `addDialog` / `addDrawer`（ReDialog / ReDrawer）：表单组件抽成 `XxxForm.vue` +
   `getPayload()`（校验失败返回 null 以保持弹层）；**先 `done()` 关弹层再 `await load*()` 刷新**。
4. API 调用统一 `.catch(error => ({code: -1, data: null, detail}))` 归一异常，避免 `beforeSure`
   抛错导致 loading 悬挂。
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
   只有跨应用共用的键才留在平台层 `loadjson/systemconfig.json`）；
6. 跑 `pnpm check:platform-config`（死参数 / 断链双检）。

## 五、样式与组件约定

- 样式用 UnoCSS 原子类 + 设计令牌（`src/style/tokens/`）；**不要写死字号与颜色字面量**
  （`pnpm check:font-size-literals` / `check:color-literals` 会拦），用语义令牌。
- 暗色适配走令牌（`html.dark` 分支），别用 `!important` 堆叠。
- 新用 Element Plus 组件要同时登记组件与 `element-plus/es/components/xxx/style/css`。
- 图表统一走 `useECharts` 封装；canvas 导出动画需等待渲染完成。
- 组合式函数超过 100 行、单文件超过 500 行会被门禁拦（`check:hook-length` / `check-file-length`），
  拆分而不是登记基线。
- 模块依赖环由 `pnpm check:module-cycles` 拦截；新增跨模块引用前先想清楚方向。
- **SFC 必须单根，模板注释写在根元素内部**（`<template>` 后不要直接跟 `<!-- -->`）：
  根级注释会让组件在 dev 下渲染成「多根」（dev Fragment 根），与布局的
  `<Transition mode="out-in">` 组合会卡死——离开该页面后内容区永久空白且切页不恢复；
  由 `pnpm check:template-root` 拦截，守护用例见 `e2e/system-pages.e2e.ts`「关于页」。

## 六、测试与门禁

```bash
pnpm test:run                                  # vitest（含契约 / 词条 / 格式函数等纯逻辑用例）
pnpm typecheck && pnpm lint
for g in bundle-size entry-closure success-code platform-config i18n as-unknown hook-length \
         font-size-literals color-literals module-cycles contract contract-usage menu-permissions \
         version quarantine template-root; do pnpm check:$g || break; done
node scripts/check-file-length.mjs        # 行数门禁（单文件 ≤ 500 行，无基线豁免）
```

E2E（**改了后端必须 `*:fresh`**）：

```bash
node scripts/e2e-run.mjs smoke:fresh                                    # 冒烟（chromium）
node scripts/e2e-run.mjs run e2e/xxx.e2e.ts --project=chromium          # 定向单 spec
node scripts/e2e-run.mjs fresh                                          # 全量双浏览器
node scripts/e2e-run.mjs parallel                                       # 4 路分片
```

- 端口：后端 `18896`、前端 `8848`、桩 LLM `18897`（CSP 用 `18899`）；
  E2E 会 DROP/CREATE 独立库 `xadmin_e2e` 并跑 `xadmin-server/scripts/e2e_seed.py`。
- 定位与断言规范见 `e2e/README.md`（含「表格容器无 testid 时用工具栏按钮做加载锚点」等既有结论）；
  写用例前先读它，能省一轮失败。
- 视觉基线：`pnpm test:e2e:visual`（差异先看 diff 图判断是布局还是数据，别直接重录基线）；
  基线快照目录已 gitignore，重录需人工确认。
- 用例必须幂等：双浏览器共享库、跨用例共享数据，唯一名 + 自清理。

## 七、提交纪律

- 只有用户明确要求才 `git commit`；`type(scope): 中文描述`，**subject 禁止以大写单词开头**，
  **commit body 每行 ≤ 100 字符**（commitlint 两个硬规则）。
- 源码注释 / 测试名 / 基线 JSON 说明字段里**不写台账编号**（`T03-01` / `O10-2` 一类），
  需要交代来龙去脉时写一句自足的语义说明。
- 提交前 `git add -A` 全量暂存（避免 lint-staged 在「部分暂存」下污染提交），提交后核对
  `git show --stat` 与 `git status --short`。
