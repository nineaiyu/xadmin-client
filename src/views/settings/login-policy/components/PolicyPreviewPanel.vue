<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { loginPolicyApi, type LoginPolicyPreview } from "@/api/system/security";

/**
 * 登录策略命中预演：给出样例用户 / IP / 时间，逐条策略展示匹配结果与最终判定。
 *
 * 保存前预演可避免「一条 reject 把全员挡在门外」——预演不写库、不依赖当前登录用户。
 */
const { t } = useI18n();

const form = reactive({ username: "", ip: "", when: "" });
const loading = ref(false);
const result = ref<LoginPolicyPreview | null>(null);

/** 动作裸值 → 可读文案 */
const ACTION_KEYS: Record<string, string> = {
  accept: "loginPolicy.actionAccept",
  reject: "loginPolicy.actionReject",
  require_mfa: "loginPolicy.actionRequireMfa",
  record: "loginPolicy.actionRecord"
};
const actionLabel = (value: string | null) => {
  const key = ACTION_KEYS[String(value ?? "")];
  return key ? t(key) : String(value ?? "-");
};

const runPreview = async () => {
  loading.value = true;
  try {
    const res = await loginPolicyApi.preview({
      username: form.username || undefined,
      ip: form.ip || undefined,
      when: form.when || undefined
    });
    if (res.code === 1000) {
      result.value = res.data;
    } else {
      ElMessage.error(String(res.detail));
    }
  } catch (error: unknown) {
    ElMessage.error(String((error as Error)?.message ?? error));
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <el-form :inline="true" @submit.prevent>
      <el-form-item :label="t('loginPolicy.previewUser')">
        <el-input
          v-model="form.username"
          :placeholder="t('loginPolicy.previewUserTip')"
          clearable
        />
      </el-form-item>
      <el-form-item :label="t('loginPolicy.previewIp')">
        <el-input v-model="form.ip" placeholder="127.0.0.1" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="runPreview">
          {{ t("loginPolicy.previewRun") }}
        </el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="result"
      class="mb-3"
      :closable="false"
      show-icon
      :type="
        result.action === 'reject'
          ? 'error'
          : result.matched
            ? 'success'
            : 'info'
      "
      :title="
        result.matched
          ? t('loginPolicy.previewResult', {
              action: actionLabel(result.action),
              policy: result.policy
            })
          : t('loginPolicy.previewNoMatch')
      "
    />

    <el-table v-if="result" :data="result.items" border size="small">
      <el-table-column
        prop="priority"
        :label="t('loginPolicy.priority')"
        width="80"
      />
      <el-table-column
        prop="name"
        :label="t('loginPolicy.name')"
        min-width="140"
      />
      <el-table-column :label="t('loginPolicy.action')" width="140">
        <template #default="{ row }">{{ actionLabel(row.action) }}</template>
      </el-table-column>
      <el-table-column :label="t('loginPolicy.previewMatched')" width="100">
        <template #default="{ row }">
          <el-tag :type="row.matched ? 'success' : 'info'" effect="light">
            {{ row.matched ? t("labels.yes") : t("labels.no") }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('loginPolicy.previewEffective')" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.effective" type="danger" effect="dark">
            {{ t("loginPolicy.effective") }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
