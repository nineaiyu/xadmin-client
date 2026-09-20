# xadmin-client 文档中心

> 2026-09-12 整理建立索引。前端仓库文档集中在 `docs/`；其余约定类内容分布在仓库根目录与 `e2e/`。

## 本目录

| 文档                                               | 内容                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [development-guide.md](development-guide.md)       | **前端开发指引（含独立检出）**：独立检出场景与前置、目录速览、高频任务索引、跨仓文档地图、提交前自检、常见问题 |
| [accessibility-audit.md](accessibility-audit.md)   | 可访问性（a11y）审计记录（N2）：键盘走查 / 读屏语义修复明细、axe-core 门禁豁免登记（随交付追加）               |
| [metadata-driven-crud.md](metadata-driven-crud.md) | 元数据驱动 CRUD 前端方案（RePlusPage + contract/schema）的复用说明：最小依赖集、后端前置、移植步骤、边界与耦合 |

## 仓库内其他约定文档

| 文档                                     | 内容                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南：分支模型、commitlint、提交前门禁、上游 vue-pure-admin 不可覆盖清单、组件/工具移植规范 |
| [../e2e/README.md](../e2e/README.md)     | E2E 测试说明：运行命令、环境固化（sqlite + eager + 种子）、smoke/全量两档、教训表               |

## 跨仓库文档（xadmin-server 仓库承载）

框架级文档统一放在 [xadmin-server/docs/](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/README.md)，前端相关重点（跨仓引用一律用 GitHub 绝对链接，相对路径出仓即 404）：

- [architecture/component-handbook.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md) —— **组件手册**：RePlusPage / ReDialog / ReDrawer / ReIcon / BaseApi 等前端组件与工具库的职责、用法、依赖、配置项、扩展点（含权威源路径）；
- [guide/recipes.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md) —— **扩展流程处方集**：加字段 / 加按钮 / 自定义渲染器 / 独立页面 / 弹窗 / i18n 等按任务索引的步骤；
- [architecture/方案选型与对比.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/%E6%96%B9%E6%A1%88%E9%80%89%E5%9E%8B%E4%B8%8E%E5%AF%B9%E6%AF%94.md) —— 元数据驱动 vs 手写、弹层/选择器等组件选型速查与对比；
- [框架开发遵循准则.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/%E6%A1%86%E6%9E%B6%E5%BC%80%E5%8F%91%E9%81%B5%E5%BE%AA%E5%87%86%E5%88%99.md) —— 前端开发准则（RePlusPage 页面模式、API 模块写法、i18n、按钮交互约定）与服务端准则、常见坑速查；
- [architecture/framework-cookbook.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/framework-cookbook.md) —— 框架能力速查：BaseApi 方法清单、RePlusPage props/emits/expose 契约；
- [metrics.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/metrics.md) —— 基线指标看板（含前端用例数/首屏体积/E2E KPI）；
- [plans/](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/plans/README.md) —— 项目规划与治理文档（半年规划、排期、优化台账，跨仓库）。

## 二开教程

- **快速入门（推荐主线）**：[first-module-30min.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/first-module-30min.md)——从零建业务模块（生成器主线）；
- 手写理解版（BaseApi + RePlusPage 逐层拆解）在文档站仓库 [xadmin-docs](https://github.com/nineaiyu/xadmin-docs)：`example/new-app-client.md` 等，站点构建与目录见其 README。
