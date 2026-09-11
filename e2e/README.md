# E2E 测试说明

## 运行

| 命令                                           | 说明                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test:e2e`                                | 全量（双浏览器 chromium+webkit，dev push 之外的本地验证）                                                                                                                            |
| `pnpm test:e2e -- e2e/xxx.e2e.ts`              | 只跑单个 spec                                                                                                                                                                        |
| `pnpm test:e2e:smoke`                          | 只跑 `@smoke` 用例 + chromium（快速反馈，约 30s）                                                                                                                                    |
| `pnpm test:e2e:fresh` / `test:e2e:smoke:fresh` | **先杀掉 18896/8848 旧进程再跑**（见下）                                                                                                                                             |
| `pnpm test:e2e:parallel`                       | 并行分片全量（默认 4 路，`E2E_PARALLEL` 可调；每路独立端口 + 独立 sqlite 库，~4min）。CI 全量档用 3 路 + `--reporter=list`。**注意**：起手会清理本分片段端口，串行跑批运行中勿再执行 |

环境：sqlite 文件库（tmp/e2e.sqlite3）+ 进程内 FakeRedis + eager celery + 种子脚本（`scripts/e2e_seed.py`），
零外部服务依赖，不触碰本机 config.yml。配置见 `playwright.config.ts`（`E2E_API_PORT` 等
环境变量说明在文件头注释）。

## ⚠️ reuseExistingServer 陷阱：改动后端代码后必须 fresh

`playwright.config.ts` 的 `reuseExistingServer: !process.env.CI` 会在端口已有服务时
**直接复用旧进程并跳过种子**。这意味着：

> 改了 `xadmin-server` 后端代码（模型/视图/迁移/配置）后，直接跑 `pnpm test:e2e`
> 复用的是**改动前启动的旧后端进程**——新行为不生效、测试结果与代码不符，
> 且极难排查（表现为"代码明明改了但接口行为还是旧的"）。

- 防护：改完后端后用 `pnpm test:e2e:fresh`（或 `test:e2e:smoke:fresh`），
  脚本先 `kill` 18896/8848 旧进程，再由 webServer 重新拉起 + 重新种子；
- 纯前端改动不受影响（vite dev 自带热更新），可放心用 `test:e2e`；
- CI（`CI=1`）下 `reuseExistingServer` 强制关闭，无需关心此问题；
- 历史案例：N3 功能迭代（2026-09-09）中 DataDict 序列化器修复后，复用旧进程
  导致 E2E 两次假失败（400 行为与已修复代码不符）。

## ⚠️ 列表断言陷阱：不要依赖「目标行在第一页」（曾误判为 webkit flaky）

RePlusPage 列表**固定发 `ordering=-created_time` 且默认 `pageSize=15`**（见
`src/components/RePlusPage/src/utils/hook.tsx`）。E2E 一轮里靠前的用例会持续创建带时间戳的
账号（`e2e_sync_*` / `e2e_imp_*` / `e2e_hist_*` 等），于是**早期种子账号（`xadmin`、
`e2e_user`）会被挤出第一页**：

- 表现：`locator(".el-table__row", { hasText: "xadmin" })` 直接「element not found」；
- 为什么只在 webkit 出现：webkit 是**第二个执行的浏览器阶段**，此时库里用户累积最多；
- 为什么看起来像 flaky：隔离重跑（只跑这几个 spec，创建的用户少）就绿了 —— 于是一度被
  登记为「webkit 时序 flaky」。**真实原因是测试数据污染 + 分页边界，不是时序抖动**
  （2026-09-10 定位：同一进程内全量跑必现、隔离跑必绿；直接调 `/api/system/user` 接口
  200 正常、total 已超 pageSize）。

**处置（断言纪律）**：

1. 需要定位具体行时，**先按条件过滤再断言**：
   `helpers.openList(page, "/system/user/index", { placeholder: "请输入用户名", value: "xadmin" })`
   （导航进页面后在搜索区填入并点「搜索」）。
   注意**不要**用 `?username=xadmin` 这种 route.query 预置——RePlusPage 会把 route.query
   合并进 searchFields 并**回填搜索框**，但**首屏列表请求并不带该条件**（实测：搜索框显示
   xadmin、表格仍是未过滤的第一页），必须在页面上真实触发一次搜索；
2. 只验证「列表能加载」时，断言**已渲染出数据行 + 分页可见**，不要绑定具体账号；
3. 弹层内选择器（`api-search-user`）同理：等目标行渲染后按需退化到首行，并等
   `.el-loading-mask` 等浮层消失再点击（否则点击被 `intercepts pointer events` 拦截）。

## ⚠️ 禁止固定延时：一律用 web-first 断言（`waitForTimeout` 已清零）

`page.waitForTimeout(ms)` 是**盲等**：快机器白等、慢机器照样挂，且掩盖真实原因。
除下表的例外外，所有「等一会儿再看」都必须换成 Playwright 的自动重试断言：

| 场景                       | 不要用                               | 改用                                                                                   |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| 等元素出现 / 下拉展开      | `waitForTimeout(800)`                | `await expect(locator).toBeVisible({ timeout })`                                       |
| 等元素消失 / 弹层关闭      | `waitForTimeout(300)`                | `await locator.waitFor({ state: "hidden" })`                                           |
| 等折叠菜单展开             | `waitForTimeout(300)`                | 等**下一级子元素可见**（`el-menu` 无 `aria-expanded`，但折叠时子级不可见）             |
| 等路由切换                 | `waitForTimeout(300)`                | `await page.waitForURL(...)`（或重试点击后以此断言）                                   |
| 等异步结果变为可接受       | `waitForTimeout(1100)`               | `await expect.poll(async () => …, { intervals }).toBe(期望值)`                         |
| 等保存 / 校验路径稳定      | `waitForTimeout(1500)`               | 竞速「弹层关闭」与「校验报错出现」，**只在真被拦下时**补点一次                         |
| 等瞬时消息（`el-message`） | 裸 `locator(".el-message--success")` | 加 `.last()` 收敛到最新一条（上一条还在淡出时会命中 2 个元素 → strict mode violation） |

**唯一例外（服务端时间域约束）**：`online.e2e.ts` 的强制下线恢复用例。服务端按
`float(iat) <= float(revoked_at)` 判定被踢（`common/core/auth.py`），新签发 token 的
`iat` 必须跨过失效秒 —— 这不是 UI 状态，任何 DOM 断言都无法表达，故用
`expect.poll` 轮询「签发 → 以新 token 访问 userinfo」代替盲等（既拿到确定性，也不白等）。

## 历史教训速查

| 教训                                                                                                  | 处置                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8896 与本机 compose nginx 端口冲突 → reuseExistingServer 误复用容器服务                               | 统一用 `test:e2e` 注入的 18896 隔离端口                                                                                                                                                           |
| 改后端代码后复用旧进程 → 假失败                                                                       | `test:e2e:fresh` / `test:e2e:smoke:fresh`                                                                                                                                                         |
| eager celery 下 `send_task` 不流转执行状态                                                            | dispatch 层走 `apply`（见 `system/views/task.py::_dispatch_periodic_run`）                                                                                                                        |
| sqlite 并发 database is locked                                                                        | settings_e2e 已开 WAL + busy_timeout + IMMEDIATE                                                                                                                                                  |
| 敏感操作告警 WS 弹窗盖住抽屉按钮 → 点击持续 `element is not stable`                                   | e2e_seed 用哨兵值关闭（`SENSITIVE_OPERATION_METHODS=["__E2E_DISABLED__"]`；**空清单=不按方法过滤=全告警**，且该配置走 SysConfig DB 值，settings 覆盖无效）                                        |
| 断言目标行在「第一页」→ 全量跑越到后面越失败（只在 webkit 暴露，曾误判 flaky）                        | 用 `openList` 真实触发搜索过滤 / 断言「已加载出数据行」；详见上节「列表断言陷阱」                                                                                                                 |
| 菜单点击后 hash 未生效（页面停在 welcome）→ 后续 `expect(table)` 报 element not found                 | `openMenuPath` 点击后校验 hash，未生效则重开目录重试一次（见 helpers.ts 实现注释）                                                                                                                |
| 机器负载高（IDE 满载 / 多浏览器并发）→ 10s 断言超时被击穿，基础用例也失败                             | 先看 `uptime`；失败行落在 login/导航/渲染等待处时按环境假失败处理，隔离重跑复核                                                                                                                   |
| `waitForTimeout` 盲等（快机器白等、慢机器仍超时，掩盖真实原因）                                       | 全量改 web-first 断言（`toBeVisible` / `waitFor` 状态 / `expect.poll` 轮询结果）；仅服务端时间域约束（强制下线 iat）用 `expect.poll`（详见上节）                                                  |
| 登录页落到「当前服务器不允许登录」→ 找不到账号输入框（站点配置拉取失败/被拖慢，等价 config 为空分支） | `login()` 先等账号框可见；超时则 `reload()` 一次重新拉取配置再重试（不硬等、不重复提交）；同一页面内二次登录（登出后再登录）概率更高                                                              |
| a11y 扫描命中瞬态 color-contrast（el-tree 入场 opacity 未结束时 axe 把半透明文字与背景混色）          | `scanBlockingViolations` 先注入 `transition/animation: none` 样式让动画瞬移终态再扫（扩豁免清单是下策，勿绕过该函数直接扫）                                                                       |
| 并行分片（`test:e2e:parallel`）高负载下登录 POST + 路由拉取可超 15s → `login()` 离开登录页断言被击穿  | 断言上限放宽到 30s（auto-retry 上界）；仍失败交给 retries 兜底。注意：并行跑批的 `freePort` 起手会杀 18896/8848 段端口——**串行 E2E 运行中途不要再起并行跑批**，会把在跑的服务杀掉造成大面积假失败 |
