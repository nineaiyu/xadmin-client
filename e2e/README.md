# E2E 测试说明

## 运行

| 命令                                           | 说明                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `pnpm test:e2e`                                | 全量（双浏览器 chromium+webkit，dev push 之外的本地验证） |
| `pnpm test:e2e -- e2e/xxx.e2e.ts`              | 只跑单个 spec                                             |
| `pnpm test:e2e:smoke`                          | 只跑 `@smoke` 用例 + chromium（快速反馈，约 30s）         |
| `pnpm test:e2e:fresh` / `test:e2e:smoke:fresh` | **先杀掉 18896/8848 旧进程再跑**（见下）                  |

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

1. 需要定位具体行时，**先按条件过滤进入页面**（`helpers.openListWithQuery(page, "/system/user/index", { username: "xadmin" })`，
   RePlusPage 会把 `route.query` 合并进首屏 searchFields），或先点搜索区过滤；
2. 只验证「列表能加载」时，断言**已渲染出数据行 + 分页可见**，不要绑定具体账号；
3. 弹层内选择器（`api-search-user`）同理：等目标行渲染后按需退化到首行，并等
   `.el-loading-mask` 等浮层消失再点击（否则点击被 `intercepts pointer events` 拦截）。

## 历史教训速查

| 教训                                                                           | 处置                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8896 与本机 compose nginx 端口冲突 → reuseExistingServer 误复用容器服务        | 统一用 `test:e2e` 注入的 18896 隔离端口                                                                                                                    |
| 改后端代码后复用旧进程 → 假失败                                                | `test:e2e:fresh` / `test:e2e:smoke:fresh`                                                                                                                  |
| eager celery 下 `send_task` 不流转执行状态                                     | dispatch 层走 `apply`（见 `system/views/task.py::_dispatch_periodic_run`）                                                                                 |
| sqlite 并发 database is locked                                                 | settings_e2e 已开 WAL + busy_timeout + IMMEDIATE                                                                                                           |
| 敏感操作告警 WS 弹窗盖住抽屉按钮 → 点击持续 `element is not stable`            | e2e_seed 用哨兵值关闭（`SENSITIVE_OPERATION_METHODS=["__E2E_DISABLED__"]`；**空清单=不按方法过滤=全告警**，且该配置走 SysConfig DB 值，settings 覆盖无效） |
| 断言目标行在「第一页」→ 全量跑越到后面越失败（只在 webkit 暴露，曾误判 flaky） | 用 `openListWithQuery` 过滤进入 / 断言「已加载出数据行」；详见上节「列表断言陷阱」                                                                         |
