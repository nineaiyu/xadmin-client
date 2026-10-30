import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { handleOperation, type RePlusPageProps } from "@/components/RePlusPage";
import { applyServerErrors } from "@/components/RePlusPage/src/utils/serverErrors";
import { message } from "@/utils/message";
import { LEAVE_DRAFT_SAVED_CODE, leaveApi } from "@/api/approval/leave";
import { buildLeaveSaveRequest } from "./leaveSave";
import { buildLeaveFormColumns } from "./leaveFormColumns";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 请假新增加载/编辑弹层选项（自 hook.tsx 抽出，行数门禁）：字段控件定制
 * （事由多行、天数半天步进、起止日期联动）与保存回调（新增即提交）。
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
      // 新增即 create→submit：按钮文案必须明确「保存并提交」，不能写「保存」
      sureBtnText: t("leaveApply.saveAndSubmit"),
      columns: buildLeaveFormColumns(t),
      saveCallback: ({
        formData,
        done,
        closeLoading,
        formRef,
        formOptions,
        setActiveName,
        success: notifySuccess,
        failed: notifyFailed
      }) => {
        // 新增 = create（保存即提交）；编辑 = partialUpdate（原 pk），
        // 否则改一次日期就会新建一张重复请假单
        const apiReq = buildLeaveSaveRequest(
          leaveApi,
          formData,
          formOptions?.isAdd
        );
        // 新增即提交：成功 / 已存草稿 / 失败三种口径分别提示（覆盖框架默认保存回调）
        handleOperation({
          t,
          showSuccessMsg: false,
          showFailedMsg: false,
          apiReq,
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
