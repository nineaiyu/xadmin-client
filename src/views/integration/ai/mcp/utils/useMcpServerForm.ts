import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { mcpServerApi, type McpServerItem } from "@/api/ai/mcp";
import { message } from "@/utils/message";
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
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? mcpServerApi.partialUpdate(row.pk, payload)
          : mcpServerApi.create(payload),
      // 失败 / 成功文案均以服务端 detail 优先（onFail 接管，避免默认提示重复）
      onFail: res =>
        message(`${t("results.failed")}，${String(res.detail ?? "")}`, {
          type: "error"
        }),
      onSuccess: res => {
        message(String(res.detail ?? t("mcp.saveDone")), { type: "success" });
        refresh();
      }
    });
    addDialog({
      title: row ? t("mcp.editTitle") : t("mcp.createTitle"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(McpServerForm, { ref: formRef, row: row ?? null }),
      beforeSure
    });
  };

  return { openForm };
}
