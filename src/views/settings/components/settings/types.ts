import type { ViewBaseApi } from "@/api/base";
import type { FieldValues } from "plus-pro-components";

export interface settingItemProps {
  api: ViewBaseApi;
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
