<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import PatScopeEditor from "./PatScopeEditor.vue";

/**
 * 创建访问令牌表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与明文弹层展示由页面在 `beforeSure` 中处理。
 */
defineOptions({ name: "AccessTokenCreateForm" });

const { t } = useI18n();

const form = reactive<{
  name: string;
  expired_at: string | null;
  scopes: string[];
}>({
  name: "",
  expired_at: null,
  // 接口范围留空 = 不限（其后可在行内「接口范围」里补配）
  scopes: []
});

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name) {
    message(t("accessToken.nameRule"), { type: "warning" });
    return null;
  }
  return {
    name: form.name,
    expired_at: form.expired_at || null,
    scopes: form.scopes
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="90px" @submit.prevent>
    <el-form-item :label="t('accessToken.name')" required>
      <el-input
        v-model="form.name"
        :placeholder="t('accessToken.nameRule')"
        maxlength="128"
        clearable
      />
    </el-form-item>
    <el-form-item :label="t('accessToken.expiredAt')">
      <el-date-picker
        v-model="form.expired_at"
        type="datetime"
        class="w-full!"
        value-format="YYYY-MM-DDTHH:mm:ss"
        :placeholder="t('accessToken.neverExpire')"
      />
    </el-form-item>
    <el-form-item :label="t('accessToken.scope')">
      <PatScopeEditor v-model="form.scopes" hide-custom />
    </el-form-item>
  </el-form>
</template>
