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

## 历史教训速查

| 教训                                                                    | 处置                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 8896 与本机 compose nginx 端口冲突 → reuseExistingServer 误复用容器服务 | 统一用 `test:e2e` 注入的 18896 隔离端口                                    |
| 改后端代码后复用旧进程 → 假失败                                         | `test:e2e:fresh` / `test:e2e:smoke:fresh`                                  |
| eager celery 下 `send_task` 不流转执行状态                              | dispatch 层走 `apply`（见 `system/views/task.py::_dispatch_periodic_run`） |
| sqlite 并发 database is locked                                          | settings_e2e 已开 WAL + busy_timeout + IMMEDIATE                           |
