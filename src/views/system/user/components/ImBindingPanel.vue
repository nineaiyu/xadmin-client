<script lang="ts" setup>
import { onMounted, ref } from "vue";
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect
} from "element-plus";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

import { userApi } from "@/api/system/user";
import { SUCCESS_CODE } from "@/api/types";

/**
 * 管理员代录 IM 账号（免扫码绑定，审批流外的 IM 三期项）。
 *
 * 与自助扫码绑定共用 UserOAuthBinding：subject 为 IdP 侧唯一标识
 * （钉钉必须填 unionId），写操作由后端落 OperationLog（module=IM:binding）。
 */
const props = defineProps<{ row: RecordType; done?: () => void }>();
const { t } = useI18n();

const PROVIDERS = ["dingtalk", "wecom", "feishu"];
const form = ref({ provider: "dingtalk", subject: "", nickname: "" });
const bindings = ref<
  Array<{
    pk: string;
    provider: string;
    subject: string;
    profile: Record<string, unknown>;
  }>
>([]);
const loading = ref(false);

async function load() {
  const res = await userApi.imBindingList(props.row.pk).catch(() => null);
  if (res && res.code === SUCCESS_CODE) {
    bindings.value = res.data ?? [];
  }
}

async function save() {
  if (!form.value.provider || !form.value.subject.trim()) {
    ElMessage.error(t("imBinding.required"));
    return;
  }
  loading.value = true;
  const res = await userApi
    .imBinding(props.row.pk, { ...form.value })
    .catch(() => null);
  loading.value = false;
  if (res?.code === SUCCESS_CODE) {
    ElMessage.success(t("imBinding.saved"));
    form.value.subject = "";
    form.value.nickname = "";
    await load();
    props.done?.();
  } else {
    ElMessage.error(String(res?.detail || t("results.failed")));
  }
}

async function unbind(provider: string) {
  const res = await userApi.imUnbind(props.row.pk, provider).catch(() => null);
  if (res?.code === SUCCESS_CODE) {
    ElMessage.success(t("imBinding.unbound"));
    await load();
  } else {
    ElMessage.error(String(res?.detail || t("results.failed")));
  }
}

onMounted(load);
</script>

<template>
  <div class="im-binding-panel">
    <el-form :model="form" label-width="110px" class="mb-3">
      <el-form-item :label="t('imBinding.provider')">
        <el-select v-model="form.provider" :style="{ width: '190px' }">
          <el-option
            v-for="item in PROVIDERS"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('imBinding.subject')">
        <el-input
          v-model="form.subject"
          :placeholder="t('imBinding.subjectPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('imBinding.nickname')">
        <el-input v-model="form.nickname" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="save">
          {{ t("buttons.confirm") }}
        </el-button>
      </el-form-item>
    </el-form>
    <el-form-item :label="t('imBinding.current')">
      <div
        v-if="bindings.length === 0"
        class="text-(--el-text-color-secondary)"
      >
        {{ t("imBinding.empty") }}
      </div>
      <div
        v-for="item in bindings"
        :key="item.pk"
        class="flex items-center gap-2 mb-1"
      >
        <el-tag>{{ item.provider }}</el-tag>
        <span>{{ item.subject }}</span>
        <el-button link type="danger" @click="unbind(item.provider)">
          {{ t("imBinding.unbind") }}
        </el-button>
      </div>
    </el-form-item>
  </div>
</template>

<style scoped>
.im-binding-panel {
  padding: 0 12px;
}
</style>
