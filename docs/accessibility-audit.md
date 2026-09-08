# 可访问性（a11y）审计：菜单与表单（N2）

> 审计日期：2026-09-08。范围：登录链路 + 全局导航（顶栏/侧栏）+ 表单输入的可访问性。
> 方法：键盘走查（Tab/Enter/Space）+ 屏幕阅读器语义核对（role/aria-label/label 关联）+ 源码静态排查。

## 一、已修复

| #   | 位置                                  | 问题                                                           | 修复                                                                                  |
| --- | ------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `SidebarTopCollapse.vue` 折叠按钮     | `div` 纯点击目标：无 role/tabindex，键盘完全不可达，读屏无名称 | `role="button"` + `tabindex="0"` + `aria-label`（随展开态切换文案）+ Enter/Space 触发 |
| 2   | `SidebarFullScreen.vue` 全屏切换      | `span` 无任何可访问名称（连 title 都没有）                     | 补 `title` + `role="button"` + `tabindex="0"` + `aria-label` + 键盘触发               |
| 3   | 顶栏「项目配置」齿轮（`lay-navbar`）  | 有 title 但无 role/tabindex，读屏读不出用途                    | `role="button"` + `tabindex="0"` + `aria-label` + 键盘触发                            |
| 4   | 顶栏语言切换触发器                    | `div` 无名称                                                   | `role="button"` + `tabindex="0"` + `aria-label`（EP dropdown 自带键盘导航）           |
| 5   | 顶栏用户菜单触发器与头像              | 触发器无名称；`img` 无 alt，读屏读出图片地址                   | `aria-label`（用户菜单）+ `:alt="username"`                                           |
| 6   | 顶栏消息通知触发器（`lay-notice`）    | 无名称                                                         | `role="button"` + `aria-label`                                                        |
| 7   | 登录页账号/密码输入框                 | 仅有 placeholder（读屏不视作标签）                             | `el-input` 透传 `aria-label`                                                          |
| 8   | 登录页「记住天数」原生 select         | 无关联标签（axe label，critical）                              | `aria-label`                                                                          |
| 9   | 第三方登录图标（微信/支付宝/QQ/微博） | svg `role="img"` 无替代文本（axe svg-img-alt，serious）        | `aria-hidden="true"`（父级 span 已有 title，属装饰图标）                              |
| 10  | 用户列表头像列 `el-image`             | 无头像用户 alt 属性缺失（axe image-alt，critical）             | alt 兜底「用户头像」                                                                  |

> 备注：曾一并实现「适老模式主题（大字号/高对比）」，因观感不佳已于 2026-09-08 整体回滚（产品决策不做）。

## 二、核对后无需修改

- `el-menu` / `el-dropdown` / `el-dialog` / `el-tabs` 等 Element Plus 组件自带完整 role/aria 语义；
- 面包屑使用 `el-breadcrumb`（nav + ol/li 语义）；
- `RePlusPage` 动态表单经 `el-form-item` 关联 label，无需额外 aria；
- 图标按钮若为 `el-button` + 文案（如表格操作列）有可访问名称。

## 三、待办（滚动，不阻塞 N2 收口）

| #   | 项                | 说明                                                                                                                                                                                                                                                                              |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 表格数据语义      | `el-table` 数据表的 caption/aria-describedby 缺失，读屏逐格浏览体验一般                                                                                                                                                                                                           |
| 2   | tabindex 显式编排 | 登录/注册/重置页 `tabindex="100/300/800/1000"` 是**跨组件 Tab 键序编排**（Motion 动画 + el-tabs 多认证方式 + 条件渲染的验证码输入，DOM 顺序 ≠ 视觉顺序），2026-09-08 曾误当硬编码债移除，**待键盘走查确认影响后决定去留**                                                         |
| 3   | 焦点管理          | 弹窗关闭后焦点返回触发器依赖 EP 默认行为，未逐项验证                                                                                                                                                                                                                              |
| 4   | 自动化门禁        | **✅ 2026-09-08 完成**：`e2e/a11y.e2e.ts`（axe-core，登录页 + 用户管理页，wcag2a/2aa 的 critical/serious 阻断）。豁免登记见该文件 `ALLOWED_VIOLATIONS`（EP 菜单 ARIA 结构、主题色对比度、RePlusPage 图标工具按钮、Iconify 装饰图标等第三方/框架级问题），扩大白名单须同步登记本表 |
| 5   | 豁免项消化        | 白名单中的可自治项：RePlusPage 工具栏图标按钮补 aria-label、Iconify 渲染层统一 aria-hidden——消化后从 `ALLOWED_VIOLATIONS` 移除                                                                                                                                                    |
