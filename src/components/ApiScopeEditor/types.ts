/**
 * ApiScopeEditor 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 接口范围编辑器：按权限目录勾选接口，并可维护自定义锚定正则条目。
 */
import type { ScopeCatalogResponse } from "@/utils/scopeDisplay";

export interface ApiScopeEditorProps {
  /** 隐藏「自定义条目」区（创建弹窗空间有限时用） */
  hideCustom?: boolean;
  /** 选项目录加载器（令牌 / 应用两套端点由调用方注入，组件不绑定具体接口） */
  loadOptions: () => Promise<ScopeCatalogResponse>;
}
