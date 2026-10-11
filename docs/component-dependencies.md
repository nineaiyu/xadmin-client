# 组件依赖映射（依赖治理复核）

> 口径：核对「组件体系实际消费了哪些三方依赖、各自被谁消费、是否可以裁剪」。
> 数据来源：`src/` 静态引用扫描（2026-10-11）+ `package.json` 归类。
> 复核目的：为后续「升级某依赖时知道要回归哪些组件」与「裁剪死依赖」提供单一依据。

## 一、运行期依赖 → 消费组件映射

| 依赖                              | 版本              | 主要消费点                                                                                             | 是否可裁剪 | 备注                                                        |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------- |
| `element-plus`                    | ^2.14.5           | 全站基础组件（所有 `Re*` / 业务页）                                                                    | 否         | 不换组件库是既定边界                                        |
| `plus-pro-components`             | ^0.1.31           | `RePlusPage`（`PlusSearch` / `PlusForm` / `PlusDescriptions`）及其 121 处引用                          | 否         | 列表页元数据驱动的承载层                                    |
| `vue-json-pretty`                 | ^2.6.0            | `ReJsonViewer`、`RePlusPage` 的 `renderers-detail`（JSON 详情）                                        | 否         | 懒加载，不进首屏闭包                                        |
| `vue-tippy`                       | ^6.8.0            | `ReText`、`RePureTableBar`、`ReCropper`、`ReIcon/Select`、`main.ts` 指令注册                           | 否         | 全局 `v-tippy` 指令 + 组件内贴士                            |
| `sortablejs`                      | ^1.15.7           | `hooks/useSortable`（唯一入口）→ `RePureTableBar` 列序、`lay-tag` 拖拽、表单设计器字段序、设置面板编排 | 否         | 三期已收敛到单一 hook，动态 import 分片                     |
| `echarts`                         | ^6.1.0            | `plugins/echarts`、`utils/chart*`、仪表盘/大屏/监控图表、`utils/imageExport`                           | 否         | 按需注册                                                    |
| `cropperjs`                       | ^1.6.3            | `ReCropper`（+ `RePictureUpload` 头像裁剪链路）                                                        | 否         |                                                             |
| `@wangeditor/editor` + `-for-vue` | ^5.1.23 / ^5.1.12 | `utils/wangEditorBoot`（懒注册）、`RePlusPage/components/WangEditor`、公告展示 `NoticeShow`            | 需产品确认 | 首屏已拆出（`wangEditorBoot` 懒注册），仅富文本场景按需加载 |
| `vue3-ts-jsoneditor`              | ^3.4.1            | `RePlusPage/components/JsonInput`（JSON 字段输入）                                                     | 否         | 懒加载                                                      |
| `highlight.js`                    | ^11.12.0          | 代码生成页 `ArtifactPreview`（代码高亮）                                                               | 可评估     | 仅一处消费；若后续不再展示代码可移除                        |
| `qrcode`                          | ^1.5.4            | `views/account/components/ReQrcode`（MFA / 绑定二维码）                                                | 否         |                                                             |
| `@iconify/vue`                    | 5.0.1             | `ReIcon`（`IconifyIconOffline` / `iconRegistry` / `offlineIcon`）                                      | 否         | 离线图标体系渲染层                                          |
| `dayjs`                           | ^1.11.23          | `plugins/elementPlus`（EP 语言包）、通知/表格/回收站时间格式化                                         | 否         | EP 内部同样依赖                                             |
| `@vueuse/core`                    | ^15.0.0           | `ReDialog`/`ReDrawer` 的 `useTimeoutFn`、`lay-*` 布局交互、`useNav` 等 20 处                           | 否         |                                                             |
| `axios`                           | ^1.20.0           | `utils/http`（请求层）、`config`（平台配置拉取）                                                       | 否         |                                                             |

## 二、构建期依赖（`devDependencies`）

| 依赖                                                                               | 消费点                                                                                        | 说明                                                                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@iconify/json`                                                                    | `scripts/gen-icon-subset.mjs`（`postinstall` / `prebuild` 生成 `ReIcon/data/subsets/*.json`） | **仅构建期**：运行时只加载生成后的「引用并集」子集，不直接读全集合；子集文件 gitignore，缺文件构建期即失败 |
| `unplugin-icons`                                                                   | 全站 `~icons/<set>/<name>` 静态图标                                                           | 构建期编译为组件                                                                                           |
| `sass` / `postcss` / `stylelint` / `eslint` / `prettier` / `vitest` / `playwright` | 门禁与样式编译                                                                                | 见 `package.json` scripts                                                                                  |

## 三、复核结论

1. **无多余依赖**：上表运行期依赖均有实际消费点，未发现「引入但零引用」的包；
2. **单点消费待评估**：`highlight.js`（仅代码生成预览）、`@wangeditor/*`（仅富文本）——两者都已走懒加载，不影响首屏体积，裁剪与否取决于产品是否保留这两类能力；
3. **收敛成果**：`sortablejs` 已收敛到 `hooks/useSortable` 单一入口（三期批次三）；`vue-json-pretty` / `vue3-ts-jsoneditor` / `@wangeditor/*` 均按需分片（`check:bundle-size` 守护首屏闭包）；
4. **升级回归清单**：升级任一依赖时，按本表「主要消费点」列出的组件跑 `pnpm test:run` + 相关 E2E（`table-sort` / `knowledge` / `ai` / `monitor` / `dashboard` 等）。
