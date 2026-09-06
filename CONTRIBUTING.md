# 贡献指南（CONTRIBUTING）

感谢参与 xadmin-client 开发。请先阅读后端仓库的[架构总览](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/overview.md)了解元数据驱动机制，再开始编码。

## 1. 分支模型

| 分支                      | 用途                                  | 保护                             |
| ------------------------- | ------------------------------------- | -------------------------------- |
| `main`                    | 稳定发布分支，tag `v*` 触发发布流水线 | 禁止直推                         |
| `dev`                     | 集成分支，CI 门禁挂载于此             | PR 合入；push 自动触发 lint/门禁 |
| `feat/*` `fix/*` `docs/*` | 功能/修复/文档开发分支                | 从 dev 切出，合回 dev            |

注意：**前后端版本号需保持一致**，server 的发布流水线会校验 tag 与本仓 `package.json` version 相同后才构建镜像。

## 2. 提交信息规范

husky + commitlint 强制（Conventional Commits，header ≤108 字符）：

```
<type>(<scope>): <subject>
```

- 允许的 type：`feat` `fix` `perf` `style` `docs` `test` `refactor` `build` `ci` `chore` `revert` `wip` `workflow` `types` `release`；
- scope 用模块/组件名（如 `RePlusPage`、`store`、`router`、`layout`）；
- 关联半年规划任务的，在 subject 或 body 中带上任务号（如 `t3.4`）。

## 3. 开发环境

```shell
pnpm install
pnpm dev        # 开发服务器
pnpm build      # 生产构建
```

需配合后端（见 server 仓库 [docs/ops/deployment.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/ops/deployment.md)）。

## 4. 提交前门禁（本地自查，CI 同款）

| 门禁             | 命令                                                             | 说明                                                                                   |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ESLint           | `pnpm lint`                                                      | `no-explicit-any`/`prefer-as-const` 为 **error**（T4.6 收官，全仓 any 归零，禁止新增） |
| 类型检查         | `pnpm typecheck`                                                 | vue-tsc 全量                                                                           |
| 单测 + 覆盖率    | `pnpm test:coverage`                                             | store/RePlusPage 注册表均有阈值（T4.2）                                                |
| 元数据类型 regen | `pnpm gen:metadata-types && git diff --exit-code src/api/types/` | 改动依赖 schema 时执行（CI regen-check 门禁）                                          |
| E2E              | `pnpm test:e2e`                                                  | 涉及核心流程/权限场景时本地跑受影响用例                                                |

约束清单：

- 页面开发优先使用元数据驱动：`new BaseApi("/api/...")` + `<RePlusPage />`，不要手写重复 CRUD 模板；
- 前后端契约变更需先改 server 的 [docs/schema/](https://github.com/nineaiyu/xadmin-server/tree/dev/docs/schema) 并重新生成类型；
- 状态管理统一走 Pinia（用户态勿直接读写 localStorage/cookie，走 `store/modules/user` 与 utils 封装）；
- 巨型文件红线 ≤400 行，新组件按 composables/子组件拆分（T2.5 约定）。

## 5. PR 流程

1. 从 `dev` 切出分支，提交前跑齐 §4 门禁；
2. 使用 PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`）填写变更说明与自查项；
3. CI 全绿后请求合并，默认 squash；
4. 行为变更（含组件拆分重构）必须保证纯搬迁零行为变更或在变更说明中列明差异。

## 6. 安全问题

请勿通过公开 Issue/PR 报告安全漏洞（如发现 Token 处理、XSS、上传等链路问题），先私下联系维护者。
