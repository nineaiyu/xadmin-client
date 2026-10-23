import { onMounted, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 委托页流程目录（列表渲染与表单多选同源；不依赖流程定义管理权限） */
export function useDelegationFlowOptions(t: TFunction) {
  const flowNames = ref<Record<string, string>>({});
  const flowOptions = ref<Array<{ label: string; value: string }>>([]);

  onMounted(async () => {
    const res = await approvalInstanceApi.availableFlows().catch(() => null);
    if (!res || !Array.isArray(res.data)) {
      message(t("systemApprovalDelegation.flowOptionsLoadFailed"), {
        type: "warning"
      });
      return;
    }
    const rows = res.data as Array<{ code: string; name: string }>;
    flowNames.value = Object.fromEntries(rows.map(row => [row.code, row.name]));
    flowOptions.value = rows.map(row => ({
      label: row.name,
      value: row.code
    }));
  });

  return { flowNames, flowOptions };
}
