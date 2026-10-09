import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElProgress
} from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { deviceDetection } from "@pureadmin/utils";
import { AesEncrypted } from "@/utils/aes";
import { passwordStrengthLevels } from "@/utils/password";
import { buildPasswordValidator } from "./passwordRules";
import type { Ref, UnwrapNestedRefs } from "vue";
import type { userApi } from "@/api/system/user";
import type { PasswordRule } from "@/api/auth";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 重置密码弹窗依赖（状态归 useUserResetPassword，本模块只负责渲染与提交） */
type ResetPasswordDialogOptions = {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  passwordRules: { value: PasswordRule[] };
  row: RecordType;
  ruleFormRef: Ref;
  pwdForm: { newPwd: string };
  curScore: Ref<number>;
  onGeneratePassword: () => void;
};

/** 重置密码弹窗：表单 + 密码强度进度条（zxcvbn 实时评分，评分状态由调用方持有） */
export function openUserResetPasswordDialog({
  t,
  api,
  passwordRules,
  row,
  ruleFormRef,
  pwdForm,
  curScore,
  onGeneratePassword
}: ResetPasswordDialogOptions) {
  const pwdProgress = passwordStrengthLevels(t);
  addDialog({
    title: t("systemUser.resetPasswd", { user: row.username }),
    width: "30%",
    draggable: true,
    fullscreen: deviceDetection(),
    closeOnClickModal: false,
    contentRenderer: () => (
      <>
        <ElForm ref={ruleFormRef} model={pwdForm}>
          <ElFormItem
            prop="newPwd"
            rules={[
              {
                required: true,
                validator: buildPasswordValidator(t, passwordRules),
                trigger: "blur"
              }
            ]}
          >
            <ElInput
              clearable
              show-password
              type="password"
              v-model={pwdForm.newPwd}
              placeholder={t("systemUser.password")}
            >
              {{
                append: () => (
                  <ElButton type="primary" plain onClick={onGeneratePassword}>
                    {t("systemUser.generatePassword")}
                  </ElButton>
                )
              }}
            </ElInput>
          </ElFormItem>
        </ElForm>
        <div class="my-4 flex">
          {pwdProgress.map(({ color, text }, idx) => (
            <div class="w-[19vw]" style={{ marginLeft: idx !== 0 ? "4px" : 0 }}>
              <ElProgress
                striped
                striped-flow
                duration={curScore.value === idx ? 6 : 0}
                percentage={curScore.value >= idx ? 100 : 0}
                color={color}
                stroke-width={10}
                show-text={false}
              />
              <p
                class="text-center"
                style={{ color: curScore.value === idx ? color : "" }}
              >
                {text}
              </p>
            </div>
          ))}
        </div>
      </>
    ),
    closeCallBack: () => (pwdForm.newPwd = ""),
    beforeSure: done => {
      ruleFormRef.value.validate(async (valid: boolean) => {
        if (valid) {
          const password = await AesEncrypted(row.username, pwdForm.newPwd);
          api
            .resetPassword(row.pk, { password })
            .then(res => {
              if (res.code === SUCCESS_CODE) {
                message(t("results.success"), { type: "success" });
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
              }
            })
            // 关闭弹框收口到 settle：请求异常（http 层已提示）不能悬挂按钮 loading
            .finally(() => done());
        }
      });
    }
  });
}
