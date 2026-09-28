<script lang="ts" setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import SearchUser from "@/views/system/components/SearchUser.vue";
import { pickUsername } from "../utils/instanceFormShared";

/**
 * 转交表单：把我的当前待办交给他人处理（一次性，区别于「委托」的长期代理）。
 *
 * 选人复用 SearchUser 单选；无 `list:SearchUser` 权限时回退用户名输入。
 * 提交契约 `getPayload()`：返回 `{ username, comment }`；`null` = 校验未过（保持弹窗）。
 * 单行「转交」与工具栏「批量转交」共用本组件。
 */
const { t } = useI18n();
const canPickUser = computed(() => hasAuth("list:SearchUser"));

const form = reactive({
  user: undefined as object | undefined,
  username: "",
  comment: ""
});

const getPayload = () => {
  const username = canPickUser.value
    ? form.username.trim() || pickUsername(form.user)
    : form.username.trim();
  if (!username) {
    message(t("systemApprovalInstance.transferRequired"), { type: "error" });
    return null;
  }
  return { username, comment: form.comment.trim() };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form :model="form">
    <el-form-item
      :label="t('systemApprovalInstance.transferTarget')"
      prop="user"
      required
    >
      <SearchUser v-if="canPickUser" v-model="form.user" :multiple="false" />
      <el-input
        v-else
        v-model="form.username"
        :placeholder="t('systemApprovalInstance.transferPlaceholder')"
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
