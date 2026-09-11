import { message } from "@/utils/message";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { ElForm, ElFormItem, ElInput, ElProgress } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { deviceDetection, isAllEmpty } from "@pureadmin/utils";
import { watch } from "vue";
import { AesEncrypted } from "@/utils/aes";
import { buildPasswordValidator } from "./passwordRules";
import { reactive, ref, type UnwrapNestedRefs } from "vue";
import type { userApi } from "@/api/system/user";
import type { PasswordRule } from "@/api/auth";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 重置密码弹窗：表单 + 密码强度进度条（zxcvbn 实时评分） */
export function useUserResetPassword({
  t,
  api,
  passwordRules
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  passwordRules: { value: PasswordRule[] };
}) {
  const ruleFormRef = ref();
  // reset password
  const pwdForm = reactive({
    newPwd: ""
  });
  const pwdProgress = [
    { color: "#e74242", text: t("password.veryWeak") },
    { color: "#EFBD47", text: t("password.weak") },
    { color: "#ffa500", text: t("password.average") },
    { color: "#1bbf1b", text: t("password.strong") },
    { color: "#008000", text: t("password.veryStrong") }
  ];
  // 当前密码强度（0-4）
  const curScore = ref();
  const zxcvbnFactory = new ZxcvbnFactory();

  watch(
    pwdForm,
    ({ newPwd }) =>
      (curScore.value = isAllEmpty(newPwd)
        ? -1
        : zxcvbnFactory.check(newPwd).score)
  );

  /** 重置密码 */
  function handleReset(row) {
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
              />
            </ElFormItem>
          </ElForm>
          <div class="my-4 flex">
            {pwdProgress.map(({ color, text }, idx) => (
              <div
                class="w-[19vw]"
                style={{ marginLeft: idx !== 0 ? "4px" : 0 }}
              >
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
        ruleFormRef.value.validate(async valid => {
          if (valid) {
            const password = await AesEncrypted(row.username, pwdForm.newPwd);
            api.resetPassword(row.pk, { password }).then(res => {
              if (res.code === 1000) {
                message(t("results.success"), { type: "success" });
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
              }
              done(); // 关闭弹框
            });
          }
        });
      }
    });
  }

  return { ruleFormRef, pwdForm, pwdProgress, curScore, handleReset };
}
