import { h } from "vue";
import { ElMessageBox } from "element-plus";
import { addDialog, closeDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { dynamicFormApi } from "@/api/dataset/dform";
import TemplatePickerDialog from "../components/TemplatePickerDialog.vue";
import { fetchFormDetail } from "./designerFormDialog";
import type { DynamicFormItem, FormSchema } from "@/api/dataset/dform";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 表单模板复用（自 hook.tsx 抽出）：行内「存为模板」把当前定义复制为模板
 * （is_template，创建权限即可）；「从模板新建」选择模板后预填设计器。
 */
export function createTemplateActions({
  t,
  openDialog
}: {
  t: TFunction;
  openDialog: (
    row: DynamicFormItem | null,
    prefill?: { name?: string; description?: string; schema?: FormSchema }
  ) => void;
}) {
  const openTemplatePicker = () => {
    const options = {
      title: t("dform.fromTemplate"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(TemplatePickerDialog, {
          onPick: (template: DynamicFormItem) => {
            closeDialog(options, 0);
            // 模板行经详情取回 schema 全文后才回调（见 TemplatePickerDialog.pick）
            if (!template.schema) return;
            // 预填名称携带「副本」后缀，避免与模板重名（name 全局唯一）
            openDialog(null, {
              name: t("dform.templateCopyName", { name: template.name }),
              description: template.description,
              schema: template.schema
            });
          }
        })
    };
    addDialog(options);
  };

  const saveAsTemplate = async (row: DynamicFormItem) => {
    // 列表行不含 schema 全文：先取详情再复制为模板（与编辑同口径）
    const source = await fetchFormDetail(row.pk);
    if (!source?.schema) {
      message(t("results.failed"), { type: "warning" });
      return;
    }
    let name: string;
    try {
      const { value } = await ElMessageBox.prompt(
        t("dform.templateNameHint"),
        t("dform.saveAsTemplate"),
        {
          confirmButtonText: t("buttons.sure"),
          cancelButtonText: t("buttons.cancel"),
          inputValue: t("dform.templateNameDefault", { name: row.name }),
          inputValidator: (value: string) =>
            (value ?? "").trim() ? true : t("dform.templateNameRequired"),
          draggable: true
        }
      );
      name = (value ?? "").trim();
    } catch {
      return;
    }
    const res = await dynamicFormApi
      .create({
        name,
        description: source.description,
        schema: source.schema,
        is_template: true,
        is_active: false,
        approval_required: false,
        approval_flow: null
      })
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      message(t("dform.templateSaved"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  return { openTemplatePicker, saveAsTemplate };
}
