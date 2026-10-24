import { BaseApi } from "@/api/base";

/**
 * 插件示例 API：构造方式与业务页面完全一致（BaseApi 家族 + 资源路径）。
 *
 * 路径 `/api/plugin-demo/note` 是后端插件 `xadmin_demo_plugin/config.py::URLPATTERNS`
 * 注册的前缀；列表 / 详情 / 增删改由 RePlusPage 按约定路径自动调用。
 */
const pluginNoteApi = new BaseApi("/api/plugin-demo/note");
export { pluginNoteApi };
