import type { ViewBaseApi } from "@/api/base";

export interface settingItemProps {
  api: ViewBaseApi;
  title?: string;
  label?: string;
  localeName?: string;
  autoSubmit?: boolean;
  formProps?: object;
  queryParams?: object;
  auth?: {
    partialUpdate?: boolean;
    retrieve: boolean;
    test?: boolean;
  };
}
