import { message } from "@/utils/message";
import type { Ref } from "vue";
import { isArray } from "@pureadmin/utils";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";
import { handleOperation, openDialogDrawer } from "./handle";
import { applyServerErrors } from "./serverErrors";
import DetailDataForm from "../components/DetailData.vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/** 表单与详情：新增/编辑弹层（含脱敏字段原文回取）、详情、删除与批量删除（拆分自 hook.tsx，行为不变） */
export function usePlusPageForm({
  props,
  t,
  pageTitle,
  detailColumns,
  addOrEditColumns,
  addOrEditRules,
  addOrEditDefaultValue,
  selectedNum,
  onSelectionCancel,
  getSelectPks,
  handleGetData
}: {
  props: RePlusPageProps;
  t: TFunction;
  pageTitle: { value: string };
  detailColumns: BaseColumnsReturn["detailColumns"];
  addOrEditColumns: BaseColumnsReturn["addOrEditColumns"];
  addOrEditRules: BaseColumnsReturn["addOrEditRules"];
  addOrEditDefaultValue: BaseColumnsReturn["addOrEditDefaultValue"];
  selectedNum: Ref<number>;
  onSelectionCancel: () => void;
  getSelectPks: (key?: string) => (string | number)[];
  handleGetData: (queryParams?: object) => void;
}) {
  const { api, addOrEditOptions, plusDescriptionsProps } = props;

  // 删除
  const handleDelete = (row, requestEnd) => {
    handleOperation({
      t,
      apiReq: api.destroy(row?.pk ?? row?.id),
      success() {
        handleGetData();
      },
      requestEnd
    });
  };

  // 批量删除
  const handleManyDelete = () => {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }

    handleOperation({
      t,
      apiReq: api.batchDestroy(getSelectPks("pk")),
      success() {
        onSelectionCancel();
        handleGetData();
      }
    });
  };

  // 查看详情
  const handleDetail = row => {
    openDialogDrawer({
      t,
      title: t("buttons.detail"),
      rawRow: { ...row },
      rawColumns: detailColumns.value,
      dialogDrawerOptions: { width: "60vw", hideFooter: true },
      minWidth: "600px",
      formProps: { ...plusDescriptionsProps },
      form: DetailDataForm
    });
  };

  /**
   * 编辑态取原文：脱敏字段的列表行是掩码值，直接作为表单初始值会让编辑者
   * 「看不见原文就改不动」。这里显式走 `?mask=false` 详情通道（服务端按
   * 「对该菜单有更新权限」放行，无权限仍返回掩码），失败/无权限时静默回退
   * 当前行数据，不阻断编辑。
   */
  const fetchOriginalRow = async (row: Record<string, unknown>) => {
    const pk = (row?.pk ?? row?.id) as number | string | undefined;
    const detail = api?.detail;
    if (pk === undefined || pk === null || typeof detail !== "function") {
      return null;
    }
    try {
      const res = await detail(pk, { mask: "false" });
      if (
        res?.code === 1000 &&
        res.data &&
        typeof res.data === "object" &&
        !isArray(res.data)
      ) {
        return res.data;
      }
    } catch (error) {
      // 静默回退：失败提示由 http 拦截器统一处理，这里只留调试信息
      console.debug("[RePlusPage] fetch original row failed", error);
    }
    return null;
  };

  //新增或编辑
  const handleAddOrEdit = async (
    isAdd = true,
    row: Record<string, unknown> = {}
  ) => {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    let rawRow = isAdd
      ? { ...addOrEditDefaultValue.value, ...row }
      : { ...row };
    if (!isAdd) {
      const original = await fetchOriginalRow(row);
      if (original) {
        rawRow = { ...rawRow, ...original };
      }
    }
    openDialogDrawer({
      t,
      isAdd,
      title: `${title} ${addOrEditOptions?.title ?? pageTitle.value}`,
      rawRow,
      form: addOrEditOptions?.form,
      rawColumns: addOrEditColumns.value,
      rawFormProps: {
        rules: addOrEditRules.value
      },
      saveCallback: ({
        formData,
        done,
        closeLoading,
        formRef,
        formOptions
      }) => {
        handleOperation({
          t,
          apiReq:
            (addOrEditOptions?.apiReq &&
              addOrEditOptions?.apiReq({ ...formOptions, formData })) ||
            (isAdd
              ? api.create(formData)
              : api.partialUpdate(formData?.pk ?? formData?.id, formData)),
          success() {
            done();
            handleGetData();
          },
          failed: res => {
            // 业务失败（HTTP 200 + code!=1000）携带的 errors 内联到表单项
            applyServerErrors(formRef, res?.errors);
          },
          exception: err => {
            // 校验失败（HTTP 400，http 层 reject 响应体）携带的 errors 内联到表单项
            applyServerErrors(formRef, err?.errors);
          },
          requestEnd() {
            closeLoading();
          }
        });
      },
      ...addOrEditOptions?.props
    });
  };

  return { handleAddOrEdit, handleDetail, handleDelete, handleManyDelete };
}
