import type { DetailResult, SearchColumnsResult } from "@/api/types";
import type { FieldValues } from "plus-pro-components";

/**
 * 设置页签消费的接口面（SettingItem 实际调用的四个方法）：以结构化契约而非
 * 具体 API 类描述——类实例的私有成员按声明身份参与可赋值判定，把具体类放进
 * 混有动态子项的数组字面量会被判不兼容；结构化接口让静态页签项与动态生成的
 * 子项可统一为 settingItemProps[]。
 */
export interface SettingItemApi {
  columns: (params?: object) => Promise<SearchColumnsResult>;
  create: (params?: object, data?: object) => Promise<DetailResult>;
  retrieve: (params?: object) => Promise<DetailResult>;
  partialUpdate: (params?: object, data?: object) => Promise<DetailResult>;
}

/**
 * 设置页导航面板（骨架的数据契约）：
 * - 表单型面板给 `item`（骨架内渲染 SettingItem）；
 * - 自定义面板给页面的具名插槽 `#<key>`（如列表、实时预览等复合内容）；
 * - 单页签页面不渲染左导航（内容纸铺满），多页签时导航项与面板一一对应。
 */
export interface settingsPane {
  /** 唯一键：导航定位 + 自定义面板的具名插槽名 */
  key: string;
  /** 导航与面板标题（缺省按 item 的 localeName/title 推导，再兜底 key） */
  label?: string;
  /** 面板描述（次要文案，渲染在面板标题下方，可选） */
  desc?: string;
  /** 导航图标（离线图标名如 `ep/setting`，可选） */
  icon?: string;
  /** 表单型面板配置（与自定义插槽二选一） */
  item?: settingItemProps;
}

export interface settingItemProps {
  api: SettingItemApi;
  title?: string;
  label?: string;
  localeName?: string;
  /** 表单字段白名单（按后端字段名精确匹配）：设置页按渠道拆分页签时各页签只渲染自己的字段；缺省渲染全部 */
  fields?: string[];
  autoSubmit?: boolean;
  formProps?: object;
  queryParams?: object;
  /** 保存成功后的回调（autoSubmit 请求 code=1000 时触发；失败不回调） */
  onSaved?: (values: FieldValues) => void | Promise<void>;
  auth?: {
    partialUpdate?: boolean;
    retrieve: boolean;
    test?: boolean;
  };
}
