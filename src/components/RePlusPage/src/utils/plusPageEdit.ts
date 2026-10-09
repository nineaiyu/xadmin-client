import { SUCCESS_CODE } from "@/api/types";
import { isArray } from "@pureadmin/utils";
import { handleOperation, openDialogDrawer } from "./handle";
import { applyServerErrors } from "./serverErrors";
import type { useBaseColumns } from "./columns";
import type { PlusPageFormApi } from "./plusPageFormApi";
import type { RePlusPageProps } from "./types";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/**
 * 新增/编辑弹层（自 usePlusPageForm.ts 抽出）：含脱敏字段原文回取
 * （编辑态 `?mask=false` 详情通道）与服务端校验错误内联。
 */
export function createAddOrEditAction({
  props,
  api,
  t,
  pageTitle,
  addOrEditColumns,
  addOrEditRules,
  addOrEditDefaultValue,
  handleGetData
}: {
  props: RePlusPageProps;
  api: PlusPageFormApi;
  t: TFunction;
  pageTitle: { value: string };
  addOrEditColumns: BaseColumnsReturn["addOrEditColumns"];
  addOrEditRules: BaseColumnsReturn["addOrEditRules"];
  addOrEditDefaultValue: BaseColumnsReturn["addOrEditDefaultValue"];
  handleGetData: (queryParams?: object) => void;
}) {
  const { addOrEditOptions } = props;

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
        res?.code === SUCCESS_CODE &&
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

  return async (
    isAdd = true,
    row: Record<string, unknown> = {}
  ): Promise<void> => {
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
        rules: addOrEditRules.value as Record<string, Record<string, unknown>>
      },
      saveCallback: ({
        formData,
        done,
        closeLoading,
        formRef,
        formOptions,
        setActiveName
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
            // 业务失败（HTTP 200 + code!=SUCCESS_CODE）携带的 errors 内联到表单项；
            // 命中后滚动/聚焦首个错误字段（跨页签先切页签）
            applyServerErrors(formRef, res?.errors, {
              activateTab: setActiveName
            });
          },
          exception: err => {
            // 校验失败（HTTP 400，http 层 reject 响应体）携带的 errors 内联到表单项
            applyServerErrors(formRef, err?.errors, {
              activateTab: setActiveName
            });
          },
          requestEnd() {
            closeLoading();
          }
        });
      },
      ...addOrEditOptions?.props
    });
  };
}
