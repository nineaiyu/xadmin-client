import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { aiProfileApi, type AiProfileItem } from "@/api/ai/ai";
import AiProfileFields from "../components/AiProfileFields.vue";

/**
 * 档案新建/编辑弹窗：与「添加用户」同形态——RePlusPage 的 `addOrEditOptions`
 * 通道，表单由后端 search-columns 元数据驱动（PlusForm 两列 + label 右对齐
 * + help_text 问号），不再手写 el-form。
 *
 * 定制点（aiProfileFields.ts）：api_key 建号必填 / 编辑留空沿用、采样与行为
 * 参数的必填回退默认值、禁用框架默认提交按钮由 beforeSure 统一收口。
 */
export function useAiProfileDialog({
  t,
  refresh
}: {
  t: ReturnType<typeof useI18n>["t"];
  refresh: () => void;
}) {
  // 仅用于触发弹窗（表单内容由框架列渲染）：toolbar「新建档案」走后装配
  const formRef = ref();

  const openDialog = (row: AiProfileItem | null) => {
    // 显式指定载荷泛型：ref 包装的实例类型无法反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? aiProfileApi.partialUpdate(row.pk, payload)
          : aiProfileApi.create(payload),
      successText: t("aiConfig.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: refresh
    });
    addDialog({
      title: row ? t("aiConfig.edit") : t("aiConfig.create"),
      // 档案字段 19 项（连接/采样/行为三组）：xxl(960) 宽 + 两列栅格，
      // 与「宽表格 / 权限树 / 变更历史」同一档（该类表单字段量最大的形态）
      width: dialogSize("xxl"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(AiProfileFields, {
          ref: formRef,
          row: row ?? undefined
        }),
      beforeSure
    });
  };

  return { openDialog };
}
