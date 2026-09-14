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

| 教训                                                                                                                                                                                                                                                            | 处置                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8896 与本机 compose nginx 端口冲突 → reuseExistingServer 误复用容器服务                                                                                                                                                                                         | 统一用 `test:e2e` 注入的 18896 隔离端口                                                                                                                                                                                                                                                                                                                                          |
| 改后端代码后复用旧进程 → 假失败                                                                                                                                                                                                                                 | `test:e2e:fresh` / `test:e2e:smoke:fresh`                                                                                                                                                                                                                                                                                                                                        |
| eager celery 下 `send_task` 不流转执行状态                                                                                                                                                                                                                      | dispatch 层走 `apply`（见 `system/views/task.py::_dispatch_periodic_run`）                                                                                                                                                                                                                                                                                                       |
| sqlite 并发 database is locked                                                                                                                                                                                                                                  | settings_e2e 已开 WAL + busy_timeout + IMMEDIATE                                                                                                                                                                                                                                                                                                                                 |
| 敏感操作告警 WS 弹窗盖住抽屉按钮 → 点击持续 `element is not stable`                                                                                                                                                                                             | e2e_seed 用哨兵值关闭（`SENSITIVE_OPERATION_METHODS=["__E2E_DISABLED__"]`；**空清单=不按方法过滤=全告警**，且该配置走 SysConfig DB 值，settings 覆盖无效）                                                                                                                                                                                                                       |
| 断言目标行在「第一页」→ 全量跑越到后面越失败（只在 webkit 暴露，曾误判 flaky）                                                                                                                                                                                  | 用 `openList` 真实触发搜索过滤 / 断言「已加载出数据行」；详见上节「列表断言陷阱」                                                                                                                                                                                                                                                                                                |
| 菜单点击后 hash 未生效（页面停在 welcome）→ 后续 `expect(table)` 报 element not found                                                                                                                                                                           | `openMenuPath` 点击后校验 hash，未生效则重开目录重试一次（见 helpers.ts 实现注释）                                                                                                                                                                                                                                                                                               |
| 机器负载高（IDE 满载 / 多浏览器并发）→ 10s 断言超时被击穿，基础用例也失败                                                                                                                                                                                       | 先看 `uptime`；失败行落在 login/导航/渲染等待处时按环境假失败处理，隔离重跑复核                                                                                                                                                                                                                                                                                                  |
| `waitForTimeout` 盲等（快机器白等、慢机器仍超时，掩盖真实原因）                                                                                                                                                                                                 | 全量改 web-first 断言（`toBeVisible` / `waitFor` 状态 / `expect.poll` 轮询结果）；仅服务端时间域约束（强制下线 iat）用 `expect.poll`（详见上节）                                                                                                                                                                                                                                 |
| 登录页落到「当前服务器不允许登录」→ 找不到账号输入框（站点配置拉取失败/被拖慢，等价 config 为空分支）                                                                                                                                                           | `login()` 先等账号框可见；超时则 `reload()` 一次重新拉取配置再重试（不硬等、不重复提交）；同一页面内二次登录（登出后再登录）概率更高                                                                                                                                                                                                                                             |
| a11y 扫描命中瞬态 color-contrast（el-tree 入场 opacity 未结束时 axe 把半透明文字与背景混色）                                                                                                                                                                    | `scanBlockingViolations` 先注入 `transition/animation: none` 样式让动画瞬移终态再扫（扩豁免清单是下策，勿绕过该函数直接扫）                                                                                                                                                                                                                                                      |
| 并行分片（`test:e2e:parallel`）高负载下登录 POST + 路由拉取可超 15s → `login()` 离开登录页断言被击穿                                                                                                                                                            | 断言上限放宽到 30s（auto-retry 上界）；仍失败交给 retries 兜底。注意：并行跑批的 `freePort` 起手会杀 18896/8848 段端口——**串行 E2E 运行中途不要再起并行跑批**，会把在跑的服务杀掉造成大面积假失败                                                                                                                                                                                |
| 并行分片共用 `./test-results` → 各 shard 启动阶段并发清理/写入同一目录，随机 shard「启动即失败」（Node 安全删除 shim 下直接 `FSMoveObjectToTrashSync` 抛错退出，易误判为用例失败）                                                                              | `e2e-parallel.mjs` 给每个 shard 传 `--output=test-results-shard-<i>` 隔离产物目录（2026-09-11 修复；串行跑批不受影响）                                                                                                                                                                                                                                                           |
| 并行分片高负载下 `async-import` 的 `waitForEvent("download")` 30s 超时（仅 webkit，retries 内重跑即过）                                                                                                                                                         | 已知负载型瞬态：先核对是否为并行跑批（`E2E_PARALLEL>1`）时出现；隔离/串行重跑通过即按环境假失败处理，反复出现再查下载链路超时上限                                                                                                                                                                                                                                                |
| 全量串行跑批（~17min）后段 webkit 多点失败：a11y/ai/analysis/dashboard/dform/webhook/oauth-im 同批出现（元素未稳定、60s 超时）                                                                                                                                  | 高负载环境假失败特征：**成批 + 跨模块 + 同一浏览器阶段**。隔离重跑对应 spec（`--project=webkit`）应全通过；真回归的特征是单 spec 稳定复现、且失败点固定在业务断言上（2026-09-13 两批实测：7 例、8 例隔离全绿）                                                                                                                                                                   |
| 新增内置种子数据（loadjson 示例）后 a11y 扩面用例突然出现「列表从未有行」按钮的违规（如 icon-only 详情按钮无 aria-label 的 button-name critical）                                                                                                               | 种子改变了 a11y 扫描的页面形态（列表从空到有行）：**隔离复跑仍失败 ≠ 回归，先看违规点是不是既有 UI 缺陷被数据首次暴露**（2026-09-13：审批/表单示例种子让流程定义列表有行，暴露 RePlusPage 详情按钮无可访问名，修 `aria-label` 而非回滚种子）                                                                                                                                     |
| 隔离复跑时「login 卡 30s 仍停在 #/login」成批出现（连 a11y 登录页基线都挂）                                                                                                                                                                                     | 先确认 E2E 后端还活着（`curl 127.0.0.1:18896/api/common/api/health`）：fresh 跑完 webServer 已退出，`E2E_SEED=0 E2E_REUSE_SERVER=1` 复跑会复用已死/被污染的旧库；直接 `pnpm test:e2e:fresh`（或手动 kill 后 `E2E_API_PORT=18896 npx playwright test`）重建环境。另注意直跑 `npx` 不带 `E2E_API_PORT` 会撞 docker nginx 的 8896 端口（health 恰好命中导致种子被跳过）             |
| 懒加载页签（`el-tab-pane :lazy`）未激活即不挂载 → 按 `.el-tab-pane` 索引定位面板随访问路径漂移（点过邮件/钉钉/飞书后，飞书是 nth(2) 而非 nth(3)）                                                                                                               | 面板一律按页签名定位 `getByRole("tabpanel", { name })`，勿用 DOM 索引（notify-im 首跑即因此误判「飞书字段未渲染」，实际 DOM 正常）                                                                                                                                                                                                                                               |
| 行操作按钮默认只渲染 3 个（`ButtonOperation` 的 `showNumber` 默认 3），第 4 个起折叠进「更多」下拉 → 直接 `getByRole("button", { name })` 点击恒超时（DOM 里根本没有该按钮）                                                                                    | 先 `hover` 该行的 `.el-dropdown` 展开下拉，再点 `.el-dropdown-menu__item`（change-history 的「变更历史」按钮即此情形，曾稳定失败）                                                                                                                                                                                                                                               |
| 页面顶部统计面板内含 `el-table`（文件中心「占用最大的文件」）时，列表断言的 `.el-table__row` 会先命中面板里的行（按文件名 `hasText` 过滤同样命中）→ 主列表行断言恒失败                                                                                          | 统计面板内的数据列表用轻量自绘列表（文件中心 Top5 已如此），或定位时限定到主列表；给页面加面板后先数一遍 `.el-table` 数量                                                                                                                                                                                                                                                        |
| Element Plus `el-input`（`type="textarea"`）不保证把 `data-testid` 透传到内部 `<textarea>` 上 → `[data-testid="x"] textarea` 一直等不到元素（页面其余断言全过，极易误判为「组件没渲染」）                                                                       | 需要子树定位时把 `data-testid` 挂**原生 wrapper div**；或直接 `getByPlaceholder()` / `getByRole()`。同类：icon-only 按钮（如抽屉开关）要显式 `aria-label`（2026-09-14 聊天室重构实测）                                                                                                                                                                                           |
| 权限门控页面（聊天室等按菜单权限点放行的页面）在 E2E 里不能用普通用户参与：`scripts/e2e_seed.py` 造的普通用户没有对应菜单授权 → REST 403 + WS 4403，表现与「后端没部署」极像                                                                                    | 多参与者用例统一用**两个超管**（`ADMIN` / `APPROVER`），页面权限本身由后端守护测试（种子权限点 path ↔ 真实路由）覆盖；新页面若要普通用户参与，需先给 e2e_seed 补菜单授权（2026-09-14）                                                                                                                                                                                           |
| Element Plus `el-switch` 的 `click` 是**切换**语义且根元素上**没有** `aria-checked`（在内部隐藏 checkbox 上）→ 对「可能已被前序用例打开的开关」直接 click 会把它**关掉**（双浏览器共享库时表现为同一用例跨浏览器 flaky，重试才过）                              | 封装 `ensureSwitchOn`：`sw.locator("input[type=checkbox]").isChecked()` 为 false 才 click（ai.e2e.ts 全局开关实测）；el-switch 上挂 `data-testid` 会透传到根元素，`getByTestId(...).click()` 可用                                                                                                                                                                                |
| 双浏览器（chromium+webkit）共享同一 E2E sqlite 库：先跑的浏览器留下的状态（开关已开/行已建/激活态已翻转）会让后跑浏览器按「初始态」写的断言失败 → 表现为 flaky，重试才过                                                                                        | 要么断言容忍多种合法状态（`expect(...).toPass` 轮询），要么行名/数据加随机后缀防唯一约束冲突；保存系统设置后立即断言生效不可靠（pub/sub 异步回写），留缓冲或 reload 再断言（2026-09-14 ai 档案页实测）                                                                                                                                                                           |
| a11y 登录页 color-contrast 首扫命中（chromium 首跑失败、retries 内重跑通过；共享库下 webkit 通常绿）                                                                                                                                                            | 登录页表单是**异步渲染**（站点配置拉取后才渲染 + Motion 入场动画）：采样时机不同会时而命中「忘记密码 / 登录按钮」等**既有的主题级低对比度**节点。2026-09-14 用干净 HEAD + 相同等待条件复核，命中节点完全相同 → 非回归；命中形态（`.is-(link/plain) > span`、`el-divider__text`）已按治理流程补进 `ALLOWED_VIOLATIONS` 并登记 `docs/accessibility-audit.md`（换全局主题色后摘除） |
| 聊天室公共房间历史消息持久保留 + 断言用宽正则（如 `/E2E 实时推送验证/`）→ 双浏览器共享库时后跑浏览器命中多条消息，`getByText` strict mode violation（webkit 稳定失败、隔离复跑才过）                                                                            | 断言精确到本次消息文本（含 `Date.now()` 后缀，如 notice-push 的 `getByText(text)`）；类比同页「共享库状态」模式的处置                                                                                                                                                                                                                                                            |
| 分析/集成系数据名唯一约束（Dataset/Dashboard/Report/Screen/WebhookSubscription.name `unique=True`）+ 双浏览器共享库 + 固定测试名（`E2E数据集`、`E2E外部系统` 等）→ 后跑浏览器创建同名必失败（曾误判负载瞬态）                                                   | 测试数据名加随机后缀（`E2E数据集-${Math.random().toString(36).slice(2, 8)}`）并以变量贯穿断言/下拉选择（2026-09-14 dashboard/analysis/webhook 实测）                                                                                                                                                                                                                             |
| 表单设计（dform）用例漏了上条处置：固定名 `E2E设备登记` → webkit 名称唯一约束冲突 → 保存失败弹窗不关（报 `not.toBeVisible` 误导性断言）；改名后提交内容断言 `page.getByText("device_name: E2E路由器")` 又命中 chromium/webkit 两条提交（strict mode violation） | 名称加随机后缀；**表格行内的文本断言必须限定 scope**（`submissionRow.getByText(...)`）——共享库下的行断言与消息断言同理（2026-09-14 dform 实测，迁移 RePlusPage 后暴露）                                                                                                                                                                                                          |
