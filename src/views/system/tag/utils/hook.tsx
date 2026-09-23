import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { tagApi, type TagItem } from "@/api/system/tag";
import TagForm from "../components/TagForm.vue";

/**
 * 标签中心表格（P-1）：标签 CRUD + 使用计数 + 删除保护提示。
 *
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + TagForm（C5 方案 B）；
 * - 删除保留框架默认入口（自带二次确认）；被引用的标签由后端拒绝并给出可读文案；
 * - 颜色列渲染为色块 tag（ElTag 的 color 只改背景，需补文字色与去边框）。
 */
export function useTags(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(tagApi);
  const auth = reactive({
    ...getDefaultAuths("Tag"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:Tag");
  const canEdit = hasAuth("partialUpdate:Tag");

  const refresh = () => tableRef.value?.handleGetData();

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "color":
          column["cellRenderer"] = ({ row }) => {
            const color = (row as TagItem).color;
            return color
              ? h(ElTag, {
                  size: "small",
                  color,
                  style: { border: "none", color: "#fff" }
                })
              : h("span", "-");
          };
          break;
        case "usage_count":
          column["cellRenderer"] = ({ row }) => {
            const count = (row as TagItem).usage_count ?? 0;
            return h(
              ElTag,
              { size: "small", type: count ? "success" : "info" },
              () => String(count)
            );
          };
          break;
        case "builtin":
          column["cellRenderer"] = ({ row }) =>
            (row as TagItem).builtin
              ? h(ElTag, { size: "small", type: "warning" }, () =>
                  t("tag.builtin")
                )
              : h("span", "-");
          break;
      }
    });
    return columns;
  };

  /* ---------------- 新建 / 编辑（ReDialog + TagForm） ---------------- */
  const formRef = ref<InstanceType<typeof TagForm>>();

  const openDialog = (row: TagItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("tag.edit") : t("tag.create"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(TagForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免 beforeSure 抛错导致弹窗 loading 悬挂
        const res = await (
          row ? tagApi.partialUpdate(row.pk, payload) : tagApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("tag.saveOk"), { type: "success" });
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 200,
    buttons: [
      {
        text: t("tag.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as TagItem),
        show: canEdit && 10
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("tag.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
