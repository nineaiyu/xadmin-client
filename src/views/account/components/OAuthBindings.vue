<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { oauthApi } from "@/api/system/oauth";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";

/**
 * 个人中心「第三方账号绑定」：列出本人绑定，解绑需口令二次确认。
 *
 * 后端还会在解绑时校验「最后一种登录方式」——无密码账号只绑一个第三方时拒绝解绑，
 * 避免把账号解成自锁（前端不重复实现该规则，只展示后端文案）。
 */

defineOptions({ name: "OAuthBindings" });

type BindingRow = {
  pk: string;
  provider: string;
  provider_name?: string;
  subject: string;
  profile?: Record<string, unknown>;
  created_time?: string;
};

const { t } = useI18n();
const rows = ref<BindingRow[]>([]);
const loading = ref(false);

const load = () => {
  loading.value = true;
  oauthApi
    .bindings()
    .then(res => {
      if (res.code === 1000) rows.value = (res.data ?? []) as BindingRow[];
    })
    .catch(() => undefined)
    .finally(() => {
      loading.value = false;
    });
};

const displayName = (row: BindingRow) =>
  String(row.profile?.nickname || row.profile?.email || row.subject);

const unbind = (row: BindingRow) => {
  void ElMessageBox.prompt(t("oauth.unbindPasswordTip"), t("oauth.unbind"), {
    inputType: "password",
    inputPlaceholder: t("oauth.password"),
    inputValidator: value => Boolean(value)
  })
    .then(({ value }) => oauthApi.unbind(row.pk, String(value)))
    .then(res => {
      if (res.code === 1000) {
        message(t("oauth.unbindSuccess"), { type: "success" });
        load();
      } else if (res.detail) {
        message(res.detail, { type: "warning" });
      }
    })
    .catch(() => undefined);
};

onMounted(load);

defineExpose({ load });
</script>

<template>
  <div v-loading="loading">
    <el-empty
      v-if="rows.length === 0"
      :description="t('oauth.noBindings')"
      :image-size="60"
    />
    <div v-else class="binding-list">
      <div v-for="row in rows" :key="row.pk" class="binding-row">
        <div class="min-w-0 flex-1">
          <div class="truncate">
            {{ row.provider_name || row.provider }} · {{ displayName(row) }}
          </div>
          <div class="mt-1 text-xs text-gray-500">{{ row.created_time }}</div>
        </div>
        <el-button link type="danger" @click="unbind(row)">
          {{ t("oauth.unbind") }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.binding-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.binding-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;

  & + .binding-row {
    border-top: 1px solid var(--el-border-color-lighter);
  }
}
</style>
