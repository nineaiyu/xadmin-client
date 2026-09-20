# xadmin-client 文档中心

> 2026-09-12 整理建立索引。前端仓库文档集中在 `docs/`；其余约定类内容分布在仓库根目录与 `e2e/`。

## 本目录

| 文档                                               | 内容                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [accessibility-audit.md](accessibility-audit.md)   | 可访问性（a11y）审计记录（N2）：键盘走查 / 读屏语义修复明细、axe-core 门禁豁免登记（随交付追加）               |
| [metadata-driven-crud.md](metadata-driven-crud.md) | 元数据驱动 CRUD 前端方案（RePlusPage + contract/schema）的复用说明：最小依赖集、后端前置、移植步骤、边界与耦合 |

## 仓库内其他约定文档

| 文档                                     | 内容                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南：分支模型、commitlint、提交前门禁、上游 vue-pure-admin 不可覆盖清单、组件/工具移植规范 |
| [../e2e/README.md](../e2e/README.md)     | E2E 测试说明：运行命令、环境固化（sqlite + eager + 种子）、smoke/全量两档、教训表               |

## 跨仓库文档（xadmin-server 仓库承载）

框架级文档统一放在 [xadmin-server/docs/](../../xadmin-server/docs/README.md)，前端相关重点：

- [框架开发遵循准则.md](../../xadmin-server/docs/框架开发遵循准则.md) —— 前端开发准则（RePlusPage 页面模式、API 模块写法、i18n、按钮交互约定）与服务端准则、常见坑速查；
- [architecture/framework-cookbook.md](../../xadmin-server/docs/architecture/framework-cookbook.md) —— 框架能力速查：BaseApi 方法清单、RePlusPage props/emits/expose 契约；
- [metrics.md](../../xadmin-server/docs/metrics.md) —— 基线指标看板（含前端用例数/首屏体积/E2E KPI）；
- [plans/](../../xadmin-server/docs/plans/README.md) —— 项目规划与治理文档（半年规划、排期、优化台账，跨仓库）。

## 二开教程

面向二次开发的前端教程在文档站仓库 [xadmin-docs](../../xadmin-docs/)：`example/new-app-client.md`（BaseApi + RePlusPage 页面）等，站点构建与目录见其 README。
