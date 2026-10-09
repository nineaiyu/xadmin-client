import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { SUCCESS_CODE } from "@/api/types";
import { mcpServerApi, type McpServerItem } from "@/api/ai/mcp";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import McpServerForm from "../components/McpServerForm.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * MCP 服务器「新建 / 编辑」自定义表单弹窗（自 mcp/utils/hook 抽出）：
 * 关闭框架默认表单按钮，统一走 ReDialog + McpServerForm。
 */
export function useMcpServerForm({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const formRef = ref<InstanceType<typeof McpServerForm>>();

  const openForm = (row?: McpServerItem) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("mcp.editTitle") : t("mcp.createTitle"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(McpServerForm, { ref: formRef, row: row ?? null }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const res = row
          ? await mcpServerApi
              .partialUpdate(row.pk, payload)
              .catch(normalizeError)
          : await mcpServerApi.create(payload).catch(normalizeError);
        if (res.code !== SUCCESS_CODE) {
          message(`${t("results.failed")}，${String(res.detail ?? "")}`, {
            type: "error"
          });
          return;
        }
        message(res.detail ?? t("mcp.saveDone"), { type: "success" });
        // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
        done();
        refresh();
      }
    });
  };

  return { openForm };
}
