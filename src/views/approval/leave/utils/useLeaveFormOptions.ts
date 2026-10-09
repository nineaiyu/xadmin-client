import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { handleOperation, type RePlusPageProps } from "@/components/RePlusPage";
import { applyServerErrors } from "@/components/RePlusPage/src/utils/serverErrors";
import { message } from "@/utils/message";
import { LEAVE_DRAFT_SAVED_CODE, leaveApi } from "@/api/approval/leave";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 请假新增加载/编辑弹层选项（自 hook.tsx 抽出，行数门禁）：字段控件定制
 * （事由多行、天数半天步进、起止日期 valueFormat）与保存回调（新增即提交）。
 */
export function useLeaveFormOptions({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        // 事由用多行输入（后端是 CharField，默认渲染单行）
        reason: ({ column }) => {
          column.valueType = "textarea";
          column["fieldProps"] = {
            ...(column["fieldProps"] ?? {}),
            autosize: { minRows: 3 }
          };
          return column;
        },
        // 天数支持半天步进（后端 DecimalField 1 位小数）
        days: ({ column }) => {
          column.valueType = "input-number";
          column["fieldProps"] = {
            ...(column["fieldProps"] ?? {}),
            min: 0.5,
            step: 0.5,
            precision: 1
          };
          return column;
        },
        start_date: ({ column }) => {
          column.fieldProps = {
            ...(column["fieldProps"] ?? {}),
            valueFormat: "YYYY-MM-DD"
          };
          return column;
        },
        end_date: ({ column }) => {
          column.fieldProps = {
            ...(column["fieldProps"] ?? {}),
            valueFormat: "YYYY-MM-DD"
          };
          return column;
        }
      },
      saveCallback: ({
        formData,
        done,
        closeLoading,
        formRef,
        setActiveName,
        success: notifySuccess,
        failed: notifyFailed
      }) => {
        // 新增即提交：成功 / 已存草稿 / 失败三种口径分别提示（覆盖框架默认保存回调）
        handleOperation({
          t,
          showSuccessMsg: false,
          showFailedMsg: false,
          apiReq: leaveApi.create(formData),
          success: res => {
            refresh();
            notifySuccess(String(res?.detail || t("leaveApply.submitSuccess")));
          },
          failed: res => {
            if (res?.code === LEAVE_DRAFT_SAVED_CODE) {
              // 已存草稿：既非成功也非失败，黄色警示避免误当已提交；关闭表单并刷新列表
              message(String(res?.detail || t("leaveApply.savedAsDraft")), {
                type: "warning"
              });
              closeLoading();
              done();
              refresh();
              return;
            }
            notifyFailed(String(res?.detail || t("results.failed")));
            applyServerErrors(formRef, res?.errors, {
              activateTab: setActiveName
            });
          },
          exception: err => {
            // 校验失败（HTTP 400）：提示由拦截器统一处理，错误内联到表单项
            applyServerErrors(formRef, err?.errors, {
              activateTab: setActiveName
            });
          }
        });
      },
      minWidth: "560px"
    }
  });

  return { addOrEditOptions };
}
