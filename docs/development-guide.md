# 前端开发指引（含独立检出）

> 定位：README（环境 / 启动 / 门禁）与 CONTRIBUTING（分支 / 提交 / 移植规范）之外的**开发导航**——
> 回答"独立检出入门怎么跑、代码在哪、改哪里、参考什么"。
> **权威开发文档在 `xadmin-server` 仓库 `docs/`**（组件手册 / 扩展流程 / 选型对比，见 §四），
> 本仓库文档只保留前端特有内容。

## 一、独立检出（只 clone 本仓库）

大多数场景（改页面 / 改组件 / 调样式 / 补测试）**只检出本仓库即可**：

| 场景                            | 前置                                                                                        | 命令                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 开发页面                        | 一个可达的后端（远程环境，或本机 `xadmin-server` 的 `bash utils/dev_up.sh --backend-only`） | `pnpm install && pnpm dev`（默认代理到 `127.0.0.1:8896`，见 README） |
| 单元测试 / lint / 构建          | 无                                                                                          | `pnpm test:run` / `pnpm lint` / `pnpm build`                         |
| 契约校验 / 版本校验             | 需要 `xadmin-server` 检出（`XADMIN_SERVER_DIR` 指向它）                                     | `XADMIN_SERVER_DIR=<server 路径> pnpm check:contract`                |
| E2E（Playwright，自带测试后端） | 需要 `xadmin-server` 检出                                                                   | `E2E_SERVER_DIR=<server 路径> pnpm test:e2e:smoke`                   |

- 后端不可达时：只影响"页面调接口"的联调，**测试 / 构建 / lint 不受影响**；
- 独立检出的 E2E 完整说明（含 `E2E_PYTHON` 覆盖解释器）见 [../e2e/README.md](../e2e/README.md) 的「独立检出运行」章节；
- 环境要求：Node ≥ 22.22.1（`.nvmrc` = v24）、pnpm ≥ 11（`preinstall` 强校验）。

## 二、目录速览（改哪里）

| 目录              | 职责                                                                                    | 常见改动               |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| `src/views/`      | 业务页面（每页 `index.vue` + `utils/hook.tsx` + `components/`）                         | 新增 / 修改页面        |
| `src/components/` | Re\* 组件体系（RePlusPage / ReDialog / ReDrawer / ReIcon / RePlusSearch…）              | 改通用交互与渲染       |
| `src/api/`        | 接口层（`BaseApi` / `ViewBaseApi` 子类、`types.ts` 响应壳类型）                         | 新增接口封装           |
| `src/utils/`      | 工具库（`http/` / `dict` / `aes` / `sse` / `websocket` / `fetchAllRows`…）              | 公共逻辑               |
| `src/router/`     | 静态路由收集 + 动态路由生成（`utils/async-routes.ts`）+ 权限判定                        | 路由 / 权限            |
| `src/store/`      | Pinia 七个模块（user / permission / multiTags / app / settings / epTheme / siteConfig） | 跨页共享状态           |
| `src/layout/`     | 框架外壳（导航 / 多标签 / 设置面板 / iframe 容器）                                      | 布局外观               |
| `src/plugins/`    | 全局组件登记（`elementPlus.ts` 等，**新增 `el-*` 用法必须登记**）                       | 新增 Element Plus 组件 |
| `locales/`        | 词条（`zh-CN.yaml` + `en.yaml` **成对补**）                                             | 新增文案               |
| `e2e/`            | Playwright 用例 + 陷阱表（项目经验数据库）                                              | 端到端测试             |

## 三、高频任务索引

> 权威步骤在 `xadmin-server/docs`（相对路径链接按仓库内约定书写）。

| 任务                                      | 参考                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 给列表页加列 / 换单元格控件 / 改表单提交  | [component-handbook §2.1](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md) + [recipes R9](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md)     |
| 加弹窗 / 抽屉（ReDialog / ReDrawer 模式） | [component-handbook §2.2](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md) + [recipes R12](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md)    |
| 自定义 `input_type` 渲染器（四通道注册）  | [component-handbook §4.2](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md) + [recipes R10](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md)    |
| 加接口调用（自定义 action / 独立端点）    | [recipes R2 / R3](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md)                                                                                                                        |
| 补 i18n 词条                              | [recipes R13](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md)                                                                                                                            |
| 图标（离线集 / 使用方式）                 | [component-handbook §2.3](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md)                                                                                              |
| 组件选型（弹层 / 选择器 / 状态放哪）      | [方案选型与对比 §三](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/%E6%96%B9%E6%A1%88%E9%80%89%E5%9E%8B%E4%B8%8E%E5%AF%B9%E6%AF%94.md)                                                      |
| 元数据驱动方案移植到其他项目              | [metadata-driven-crud.md](metadata-driven-crud.md)                                                                                                                                                                 |
| 找不到 `v-auth` 指令 / 权限判定           | [component-handbook §2.6](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md)、[dev-pitfalls #11](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md) |
| E2E 用例编写与陷阱                        | [../e2e/README.md](../e2e/README.md)                                                                                                                                                                               |

## 四、跨仓文档地图（权威文档）

框架级开发文档统一在 `xadmin-server/docs/`（只检出了本仓库时，按链接到 GitHub 查看）：

| 文档                                                                                                                                                                      | 内容                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [architecture/component-handbook.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/component-handbook.md)                                          | **组件手册**：RePlusPage / ReDialog / ReDrawer / ReIcon / BaseApi 等组件的职责、用法、依赖、配置项、扩展点（含权威源路径） |
| [guide/recipes.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/guide/recipes.md)                                                                              | **扩展流程处方集**：加字段 / 加按钮 / 渲染器 / 弹窗 / i18n 等按任务索引的步骤                                              |
| [architecture/方案选型与对比.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/%E6%96%B9%E6%A1%88%E9%80%89%E5%9E%8B%E4%B8%8E%E5%AF%B9%E6%AF%94.md) | 方案选择与对比（元数据驱动 vs 手写、组件选型速查）                                                                         |
| [框架开发遵循准则.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/%E6%A1%86%E6%9E%B6%E5%BC%80%E5%8F%91%E9%81%B5%E5%BE%AA%E5%87%86%E5%88%99.md)                | 前端开发准则（RePlusPage 页面模式、API 模块写法、按钮交互约定）                                                            |
| [architecture/framework-cookbook.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/architecture/framework-cookbook.md)                                          | 框架能力速查：BaseApi 方法清单、RePlusPage props/emits/expose 契约                                                         |
| [dev-pitfalls.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md)                                                                                | 高频坑清单（静默失败类：元数据缺失 / 权限码 / 渲染器注册时机…）                                                            |
| [docs/README.md](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/README.md)                                                                                       | 后端文档中心总索引（新人上手路径 / 架构 / 运维）                                                                           |

## 五、提交前自检

命令全表见 [../README.md](../README.md)「测试与门禁」章节；最小自检：

```shell
pnpm lint                 # prettier + eslint(--max-warnings 0) + stylelint
pnpm typecheck            # strict 全仓（CI 门禁，单轨）
pnpm test:run             # vitest（含 locale-keys / 渲染器配对等守护测试）
```

- 改动涉及接口/元数据：先同步契约（`pnpm sync:contract`）再提交生成的类型文件；
- 改动涉及后端行为：E2E 一律 `pnpm test:e2e:fresh`（防复用旧进程的假失败）；
- 新功能必须带测试（单测或 E2E），CI 阻断——与后端仓库同一红线。

## 六、常见问题（快速定位）

| 现象                                         | 先查                                                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 列表有数据但列为空 / 新增字段不显示          | 后端元数据未下发（`search-columns`）——[dev-pitfalls #1](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md)；DEV 页面有元数据缺失警示条               |
| 非超管页面不渲染 / 按钮全消失                | 权限码未授权（`hasAuth("动作:组件名")`，组件名取自 `defineOptions({ name })`）——[dev-pitfalls #2](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md) |
| 自定义渲染器不生效                           | 注册必须早于页面首渲染（模块顶层）——[dev-pitfalls #12](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md)                                            |
| 新增 `el-*` 报 `Failed to resolve component` | 在 `src/plugins/elementPlus.ts` 登记——[dev-pitfalls #13](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md)                                          |
| 图标不显示                                   | 图标全离线，只有 `ep` / `ri` / `fa-solid` 集可用——[dev-pitfalls #14](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md)                              |
| 切路由后请求莫名失败                         | 路由切换会取消来源页在途请求（`skipRouteCancel` 豁免）——[dev-pitfalls #16](https://github.com/nineaiyu/xadmin-server/blob/dev/docs/dev-pitfalls.md)                        |
| WebKit 偶发失败                              | 先隔离单跑该 spec；通过即负载瞬态——[../e2e/README.md](../e2e/README.md)                                                                                                    |
