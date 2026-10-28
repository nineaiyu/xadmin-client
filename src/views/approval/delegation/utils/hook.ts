import { approvalDelegationApi } from "@/api/approval/approvalDelegation";
import { ElTag } from "element-plus";
import { h, reactive, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { useUserStoreHook } from "@/store/modules/user";
import {
  formatPageColumns,
  renderSwitch,
  usePublicHooks,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useDelegationFlowOptions } from "./useDelegationFlowOptions";
import { buildDelegationFormColumns } from "./delegationFormColumns";
import { buildDelegationStatusColumn } from "./delegationStatusColumn";
import { createDelegationToggleGuard } from "./delegationToggle";

/**
 * 审批委托管理。
 *
 * 列表与表单由服务端元数据驱动：delegator/delegate 为用户外键（用户搜索选择器）、
 * start_time/end_time 为 datetime、flow_codes 为流程 code 列表（空 = 全部流程）。
 * 解析语义：生效委托用代理人替换原审批人（不递归、期外回落、申请人剔除）。
 */
export function useApprovalDelegation() {
  const api = reactive(approvalDelegationApi);
  const auth = usePageAuth();
  const { t } = useI18n();
  const userStore = useUserStoreHook();

  /** 非超管只能以本人名义委托：新增时预填并锁定委托人，避免选错后 400 */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: userStore.is_superuser
        ? {}
        : {
            delegator: {
              pk: userStore.pk,
              username: userStore.username,
              nickname: userStore.nickname
            }
          }
    }
  });

  const { flowNames, flowOptions } = useDelegationFlowOptions(t);
  const baseColumnsFormat = buildDelegationFormColumns({
    flowOptions,
    isSuperuser: Boolean(userStore.is_superuser),
    t
  });

  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const canImpact = hasAuth("impact:SystemApprovalDelegation");

  const guardedPartialUpdate = createDelegationToggleGuard({
    t,
    api,
    canImpact
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const formatted = formatPageColumns(columns, {
      is_active: column => {
        column["cellRenderer"] = renderSwitch({
          t,
          updateApi: guardedPartialUpdate,
          switchLoadMap,
          switchStyle,
          field: "is_active"
        });
      }
    });
    formatted.forEach(column => {
      if (column._column?.key === "flow_codes") {
        column["minWidth"] = 200;
        column["cellRenderer"] = ({ row }) => {
          const codes = ((row?.flow_codes as string[] | null) ??
            []) as string[];
          if (!codes.length) {
            return h(ElTag, { size: "small", type: "info" }, () =>
              t("systemApprovalDelegation.allFlows")
            );
          }
          return h(
            "div",
            { class: "flex flex-wrap gap-1" },
            codes.map(code =>
              h(
                ElTag,
                { size: "small", key: code, class: "mt-1" },
                () => flowNames.value[code] ?? code
              )
            )
          );
        };
      }
    });
    const endIndex = formatted.findIndex(
      column => column._column?.key === "end_time"
    );
    formatted.splice(
      endIndex >= 0 ? endIndex + 1 : formatted.length,
      0,
      buildDelegationStatusColumn(t)
    );
    return formatted;
  };

  return {
    api,
    auth,
    addOrEditOptions,
    baseColumnsFormat,
    listColumnsFormat
  };
}
