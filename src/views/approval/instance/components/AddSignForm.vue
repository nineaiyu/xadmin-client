<script lang="ts" setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import SearchUser from "@/views/system/components/SearchUser.vue";
import { pickUsernames } from "../utils/instanceFormShared";

/**
 * 加签表单：SearchUser 多选选人（复用权限表单同款的表格面板选择器）；
 * 无 `list:SearchUser` 权限的审批人回退用户名逗号输入，保证加签始终可用。
 *
 * 提交契约 `getPayload()`：返回 `{ usernames, comment }`；`null` = 校验未过（保持弹窗）。
 */
const { t } = useI18n();
/** 选择器有独立权限点：无权限时降级为用户名输入，不阻断加签 */
const canPickUser = computed(() => hasAuth("list:SearchUser"));

const form = reactive({
  /** 选择器产出 `{pk, label}`，提交统一按用户名走服务端校验 */
  users: [] as object[],
  usernames: "",
  comment: ""
});

const getPayload = () => {
  // 选择器分支由 pickUsernames 兜底结构差异；输入框分支直接取值
  const usernames =
    form.usernames.trim() || pickUsernames(form.users).join(",");
  if (!usernames) {
    message(t("systemApprovalInstance.addSignRequired"), { type: "error" });
    return null;
  }
  return { usernames, comment: form.comment.trim() };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form :model="form">
    <el-form-item prop="users" required>
      <SearchUser v-if="canPickUser" v-model="form.users" multiple />
      <el-input
        v-else
        v-model="form.usernames"
        :placeholder="t('systemApprovalInstance.addSignPlaceholder')"
      />
    </el-form-item>
    <el-form-item prop="comment">
      <el-input
        v-model="form.comment"
        type="textarea"
        :rows="2"
        :maxlength="200"
        :placeholder="t('systemApprovalInstance.commentPlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>
