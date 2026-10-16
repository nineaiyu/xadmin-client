import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { userLoginLogApi } from "@/api/user/logs";
import type { PaginationProps } from "@pureadmin/table";
import {
  type PageTableColumn,
  renderBooleanTag,
  formatPageColumns
} from "@/components/RePlusPage";
import { usePublicHooks } from "@/views/system/hooks";

/** 安全日志（登录记录）列表装配；自 utils/hook 拆出，行为不变 */
export function useUserLoginLog() {
  const { t } = useI18n();
  const api = reactive(userLoginLogApi);

  const auth = reactive({
    list: hasAuth("list:UserLoginLog")
  });

  const { tagStyle } = usePublicHooks();

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 15,
    currentPage: 1,
    background: true,
    layout: "prev, pager, next"
  });

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      status: column => {
        column["cellRenderer"] = renderBooleanTag({
          t,
          tagStyle,
          field: column.prop as string,
          actionMap: { true: t("labels.success"), false: t("labels.failed") }
        });
      }
    });

  return {
    t,
    api,
    auth,
    pagination,
    listColumnsFormat
  };
}
