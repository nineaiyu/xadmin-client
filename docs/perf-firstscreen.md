# 首屏画像与体积治理

> 2026-10-09 建立。回答两个问题：**首屏到底装了什么**（体积构成 + 资源瀑布 + 主线程阻塞），
> 以及**这一轮拆包做了什么、还差多少**。
>
> 三个数据源，口径互不替代：
>
> | 数据源                              | 口径                                                                                      | 命令                                   |
> | ----------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
> | `scripts/bundle-size-baseline.json` | 首屏**静态** JS 闭包（index.html 的 module 入口 + 全部 modulepreload，逐文件 gzip9 求和） | `pnpm build && pnpm check:bundle-size` |
> | `scripts/bundle-analyze.mjs`        | 闭包内**模块级**构成（npm 包 / src 目录聚合）                                             | `pnpm analyze:bundle`                  |
> | `scripts/firstscreen-profile.mjs`   | 运行时**资源瀑布 + Long Task/TBT + LCP**（chromium，CDP + PerformanceObserver）           | 见下文                                 |
>
> 数字随机器变化，**只看同环境趋势**；运行时档位键 = `平台-CI`（`e2e/perf-baseline.json`）。

## 一、体积构成（治理前）

`pnpm analyze:bundle`（闭包内，renderedLength / 模块数）：

| chunk                            | rendered  | gzip≈    |
| -------------------------------- | --------- | -------- |
| `element.js`                     | 1740.5 KB | 608.6 KB |
| `index.js`                       | 814.2 KB  | 235.7 KB |
| `vue.js`                         | 596.4 KB  | 160.6 KB |
| `i18n.js`                        | 554.8 KB  | 103.9 KB |
| `dist.js`（wangeditor 附件插件） | 118.3 KB  | 43.1 KB  |
| `plus.js`                        | 100.0 KB  | 32.8 KB  |

分组 Top（renderedLength）：`element-plus` 1521.8 KB / 722 模块、`virtual:intlify-i18n` 434.7 KB、
`src/components` 345.0 KB、`@vue` 253.6 KB、`axios` 110.3 KB、`vue-tippy` 107.0 KB、
`plus-pro-components` 97.0 KB、`lodash-es` 83.5 KB、`@zxcvbn-ts` 68.1 KB。

门禁口径（gzip9，基线 2026-10-08）：闭包 **567.5 KB**（12 chunks），其中代码 496.3 / i18n 71.1；
主 chunk `index.js` **142.8 KB**；`element-plus` 239.3 KB。

**结论**：闭包的四成是 element-plus，而它由两件事撑起来——
① `src/plugins/elementPlus.ts` 的 78 个组件全量急加载注册；② `plus-pro-components`
（PlusSearch/PlusForm）从 `element-plus` 桶文件具名导入整套 EP 组件。
主 chunk 的头部则被入口模块图里的 **RePlusPage**（含 plus-pro / 表格栈）占据。

## 二、资源瀑布 / Long Task / LCP

`scripts/firstscreen-profile.mjs`：Playwright chromium + CDP `Network.*` 事件与
`PerformanceObserver`（`longtask` / `largest-contentful-paint`），整页直达目标路由，
登录复用一次上下文。TBT = FCP 之后、load 之前 Long Task 超出 50ms 的累计。

**生产产物口径**（dist + `/api` 代理，`scripts/csp-page-server.mjs`，darwin-local）：

| 页面        | TTFB | FCP    | LCP    | DCL   | TBT  | Long Task |
| ----------- | ---- | ------ | ------ | ----- | ---- | --------- |
| welcome     | 1 ms | 160 ms | 760 ms | 45 ms | 0 ms | 1         |
| system-user | 1 ms | 188 ms | 188 ms | 46 ms | 0 ms | 2         |

dev 链路口径（vite 未打包，模块按需转换，只用于对比趋势）：welcome FCP 316 / LCP 928 ms，
system-user FCP/LCP 556 ms、Script 请求 **1000 个 / 1546 KB**——**dev 的数字不能当首屏结论**，
生产态由 modulepreload 闭包决定（上表）。

瀑布里的两个大件与首屏闭包无关，是**懒加载**被提前触发：

- `echarts`（raw 1062 KB）——`src/plugins/echarts.ts` 的启动预热。本轮已从「启动即预热」
  改为「load 后空闲预热」，首屏不再争带宽；图表页仍由 `echartsReady` 门控（见下节改进项）。
  追加轮次（下节 §五）已把预热整体移除，改为消费方门控——非图表页不再拉取这块。
- `ri` 图标集（raw 750 KB）——离线图标集按需加载（`ReIcon/src/iconRegistry.ts`），
  由用 `ri:` 图标的组件触发。

## 三、本轮改动与体积账

| 改动                          | 手法                                                                                                                                                                                                                                                                                                                         | 前 → 后                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| RePlusPage 移出入口模块图     | `src/views/system/apiSearch.ts` 由 `@/components/RePlusPage` 桶导入改为 `.../utils/apiSearch` + `.../utils/suggest` 子路径；`main.ts` 里 RePlusPage 改 `defineAsyncComponent`                                                                                                                                                | 主 chunk 142.8 → 105.6 KB（该步之后主态）                                  |
| element-plus 桶文件退出入口图 | 急加载组件一律改用 `element-plus/es/components/<dir>/index.mjs` 子路径（`elementPlus.ts` / `App.vue` / `utils/cellRender.ts` / `utils/tagTone.ts` / `utils/message.ts` / `utils/http/*.ts` / `store/modules/notice.ts` / `hooks/useConfirm.ts`）；`@pureadmin/table` 取消全局 `app.use`（唯一消费方 RePlusPage 内部 import） | —                                                                          |
| 页面级 EP 组件按需            | `elementPlus.ts` 拆 `components`（外壳急加载）/ `lazyComponents`（`defineAsyncComponent`，同一 EP 模块共用一次动态 import）；漂移守卫同步识别两档                                                                                                                                                                            | 按需块脱离入口图                                                           |
| plus-pro 按需                 | `plusProComponents.ts` 全局 `app.use` 改为 `PlusSearch`/`PlusForm` 异步组件注册；取消 `plus-pro` / `element-plus` 的 `advancedChunks` 手工分组（分组会把「外壳共享内部模块」与「按需组件」并成同一 chunk，该 chunk 一旦被急加载侧引用就整体回到首屏，实测闭包无收益）                                                        | `plus-pro` chunk 249.6 → 按需                                              |
| 启动期带宽                    | `plugins/echarts.ts` 预热推迟到 `load` 后的空闲窗口（并记住 app 引用，页面自行 `loadEcharts()` 时同样能挂 `$echarts`）；`utils/routePrefetch.ts` 的无 `requestIdleCallback` 兜底由「固定 2s」改为「`load` 事件之后」                                                                                                         | LCP 改善（perf 门禁 welcome -48ms、user -64ms、monitor -56ms、logs -32ms） |
| 单测同步                      | 4 个 spec 的 `vi.mock("element-plus")` 改指子路径（message / message-box）                                                                                                                                                                                                                                                   | —                                                                          |

**最终对比**：

| 指标                  | 基线（2026-10-08） | 本轮                                | 目标               | 达成 |
| --------------------- | ------------------ | ----------------------------------- | ------------------ | ---- |
| 首屏 JS 闭包（gzip9） | 567.5 KB           | **432.6 KB**（-134.9 / **-23.8%**） | ≤ 482 KB（-15%）   | ✅   |
| 主 chunk（gzip9）     | 142.8 KB           | **78.2 KB**（-45.2%）               | ≤ 128.5 KB（-10%） | ✅   |
| 代码账本              | 496.3 KB           | 359.3 KB                            | —                  | —    |
| i18n 账本             | 71.1 KB            | 73.3 KB（+2.2，分账内部搬移）       | ≤ +15 KB           | ✅   |

**代价与遗留**：

1. **闭包内 chunk 数 13 → 94**：取消 EP/plus-pro 手工分组后，共享模块按 import 边界粒度拆分。
   总字节大幅下降，但首屏 `<link rel="modulepreload">` 数量上升（HTTP/2 多路复用下可接受）。
   若要收敛请求数，可评估 `advancedChunks` 的 `minSize` 类选项，或只为**纯懒加载**的
   EP 目录设组（注意 §三 记录的「分组把按需拉回急加载」陷阱）。
2. ~~**echarts 预热仍会在 load 后的空闲窗口拉取**（非图表页也会）。~~ **已解决（2026-10-09
   追加轮，见 §五）**：预热整体移除，改为「谁用谁加载」+ 消费方门控。
3. **i18n 账本 +2.2 KB**：`vue-i18n` / 少量共享模块被划入 i18n chunk，非语料增长。

## 四、复跑方式

```bash
# 1) 体积（静态闭包）
pnpm build && node scripts/check-bundle-size.mjs --format md

# 2) 模块级构成
KEEP_ANALYSIS_DIR=1 pnpm analyze:bundle

# 3) 运行时画像（需先在跑 E2E 栈）
#    后端：cd xadmin-server && DJANGO_SETTINGS_MODULE=tests.settings_e2e \
#          .venv/bin/python -m daphne -b 127.0.0.1 -p 18896 server.asgi:application
#    前端（dev 口径）：cd xadmin-client && E2E_API_PORT=18896 pnpm dev --port 8848 --strictPort
#    生产口径：pnpm build && node scripts/csp-page-server.mjs   # 18899：dist + /api 代理
node scripts/firstscreen-profile.mjs                       # 打印读数
E2E_BASE_URL=http://127.0.0.1:18899 node scripts/firstscreen-profile.mjs --update
```

`--update` 写入 `e2e/perf-baseline.json` 的 `firstscreen.<平台-CI>.<页面>` 键
（`{ ttfb, fcp, lcp, dcl, load, tbt, longTaskCount, longTasks[], waterfall[], heaviest[] }`），
与既有 `perf.e2e.ts` 的 TTFB/FCP/LCP/CLS 档位并存、互不覆盖。

## 五、追加轮：首屏之后的「不该花的字节」（2026-10-09）

§三 解决的是「首屏闭包多少字节」，本轮收口的是「首屏之后仍然花掉的字节」，并修掉
一处拆包本身引入的渲染回归（拆包后必须跑到的用例此前不在验收面内，全量跑批才暴露）。

| 改动                    | 内容                                                                                                                                                                                                                                          | 影响                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| echarts 预热整体移除    | `plugins/echarts.ts` 不再在 `load` 后空闲拉取；共用图表卡新增门控包装 `views/dashboard/components/ChartCardAsync.ts`（`await loadEcharts()` 后再挂载 `ChartCard`），仪表盘 / 大屏展示 / 看板设计器 / 报表设计器统一改经包装挂载（4 个消费方） | 非图表页不再拉取 raw 1062 KB；图表页行为不变（挂载即加载、共用同一 promise），且冷启动直链不再依赖「预热是否刚好跑赢页面挂载」的竞态                                     |
| descriptions 改同步注册 | `plugins/elementPlus.ts` 的 `ElDescriptions` / `ElDescriptionsItem` 由异步档移回急加载档                                                                                                                                                      | `el-descriptions` 用 `flattedChildren` 扫描插槽 vnode 并按 `type.name === "ElDescriptionsItem"` 收集子项；异步包装（AsyncComponentWrapper）匹配不到 → 描述列表渲染成空表 |
| 守护                    | `plugins/__tests__/elementPlus.spec.ts` 新增用例：`ElDescriptionsItem` 必须登记在 `components`（同步档）                                                                                                                                      | 同类「父组件按类型名收集子组件」的组件被移入异步档时立即失败，不再等 E2E                                                                                                 |

**回归的暴露面**：受影响的抽屉资料区（成员详情 / 提交详情 / 审批详情 / 岗位预览 / MCP 配置等）
在双浏览器全部失败且重试同挂——**稳定失败即真回归**，不是 flaky；定位靠失败快照里
`el-descriptions` 渲染出「table + 空 rowgroup」这一特征形态。

**非图表页实测**（darwin-local，生产产物 + `csp-page-server` 口径，同 §二 环境）：

<MEASURE_PLACEHOLDER>
