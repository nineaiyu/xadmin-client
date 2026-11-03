<script lang="ts" setup>
import { reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import ApiScopeEditor from "@/components/ApiScopeEditor";
import { loadPatScopeCatalog } from "@/api/user/token";
import { resolveTokenScopePayload } from "./tokenScopePayload";

/**
 * 创建访问令牌表单（弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与明文弹层展示由页面在 `beforeSure` 中处理。
 * 接口范围留空不再默认等于不限：必须显式打开「不限范围」开关（提交体携带
 * `unrestricted: true`）才能以空范围创建，与后端创建校验同字段对齐。
 */
defineOptions({ name: "AccessTokenCreateForm" });

const { t } = useI18n();

const form = reactive<{
  name: string;
  expired_at: string | null;
  scopes: string[];
  unrestricted: boolean;
}>({
  name: "",
  expired_at: null,
  scopes: [],
  unrestricted: false
});

// 勾选了接口范围时「不限范围」开关失去意义：自动复位并禁用，避免两种意图打架
watch(
  () => form.scopes,
  scopes => {
    if (scopes.length) form.unrestricted = false;
  }
);

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name) {
    message(t("accessToken.nameRule"), { type: "warning" });
    return null;
  }
  const scopePayload = resolveTokenScopePayload(form.scopes, form.unrestricted);
  if (!scopePayload) {
    message(t("accessToken.unrestrictedRequired"), { type: "warning" });
    return null;
  }
  return {
    name: form.name,
    expired_at: form.expired_at || null,
    ...scopePayload
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="100px" @submit.prevent>
    <!-- 弹窗内表单统一左置标签 100px（与登录策略 / 消息模板 / 修改密码弹窗同口径） -->
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
      <ApiScopeEditor
        v-model="form.scopes"
        hide-custom
        :load-options="loadPatScopeCatalog"
      />
    </el-form-item>
    <el-form-item :label="t('accessToken.unrestricted')">
      <div class="w-full!">
        <el-switch
          v-model="form.unrestricted"
          :disabled="form.scopes.length > 0"
        />
        <div class="el-form-item__help">
          {{ t("accessToken.unrestrictedTip") }}
        </div>
      </div>
    </el-form-item>
  </el-form>
</template>
