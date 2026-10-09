<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  OAUTH_BIND_FLAG,
  oauthApi,
  type OAuthProvider
} from "@/api/identity/oauth";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import AccountPanel from "./AccountPanel.vue";

/**
 * 个人中心「第三方账号」：已绑定清单（解绑需口令二次确认）+ 可绑定入口。
 *
 * 绑定走 IdP 授权跳转（带「绑定意图」state，回调完成后回到本页并刷新清单）；
 * 后端在解绑时校验「最后一种登录方式」——无密码账号只绑一个第三方时拒绝解绑，
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
const providers = ref<OAuthProvider[]>([]);
const loading = ref(false);
const providersLoading = ref(false);
/** 正在发起跳转的 provider key（绑定按钮 loading，跳转后页面即卸载） */
const bindingKey = ref("");

/** 可绑定 provider：同 key 已有绑定就不重复提供入口（取消绑定后自动回到列表） */
const bindableProviders = computed(() =>
  providers.value.filter(
    item => !rows.value.some(row => row.provider === item.key)
  )
);

const load = () => {
  loading.value = true;
  oauthApi
    .bindings()
    .then(res => {
      if (res.code === SUCCESS_CODE)
        rows.value = (res.data ?? []) as BindingRow[];
    })
    .catch(() => undefined)
    .finally(() => {
      loading.value = false;
    });
};

const loadProviders = () => {
  providersLoading.value = true;
  oauthApi
    .providers()
    .then(res => {
      if (res.code === SUCCESS_CODE)
        providers.value = (res.data?.providers ?? []) as OAuthProvider[];
    })
    .catch(() => undefined)
    .finally(() => {
      providersLoading.value = false;
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
      if (res.code === SUCCESS_CODE) {
        message(t("oauth.unbindSuccess"), { type: "success" });
        load();
      } else if (res.detail) {
        message(res.detail, { type: "warning" });
      }
    })
    .catch(() => undefined);
};

/** 发起绑定：取授权地址后整体跳转，IdP 回跳 `/#/oauth/callback` 完成绑定 */
const bind = (provider: OAuthProvider) => {
  bindingKey.value = provider.key;
  oauthApi
    .bindAuthorize(provider.key)
    .then(res => {
      if (res.code === SUCCESS_CODE && res.data?.url) {
        // 标记绑定意图（时间戳）：失败分支（后端错误响应/IdP error 回跳都不回传意图）
        // 的出口按钮只能靠它区分「返回账户设置」；成功跳转以后端载荷为准，不读它
        sessionStorage.setItem(OAUTH_BIND_FLAG, String(Date.now()));
        window.location.href = String(res.data.url);
        return;
      }
      message(res.detail || t("oauth.bindFailed"), { type: "warning" });
      bindingKey.value = "";
    })
    .catch(() => {
      bindingKey.value = "";
    });
};

onMounted(() => {
  load();
  loadProviders();
});

defineExpose({ load });
</script>

<template>
  <AccountPanel :title="t('oauth.tabTitle')" :description="t('oauth.bindTip')">
    <p class="account-section-title">{{ t("oauth.bound") }}</p>
    <div v-loading="loading">
      <div v-if="rows.length === 0" class="account-empty">
        <ReEmpty :description="t('oauth.noBindings')" :image-size="60" />
      </div>
      <!-- provider-row / binding-row：既有 E2E 的行定位钩子，与样式类并存 -->
      <div v-for="row in rows" :key="row.pk" class="account-row binding-row">
        <div class="account-row__main">
          <div class="account-row__title truncate">
            {{ row.provider_name || row.provider }} · {{ displayName(row) }}
          </div>
          <span class="account-row__desc">{{ row.created_time }}</span>
        </div>
        <el-button link type="danger" @click="unbind(row)">
          {{ t("oauth.unbind") }}
        </el-button>
      </div>
    </div>

    <p class="account-section-title">{{ t("oauth.bindable") }}</p>
    <div v-loading="providersLoading">
      <div
        v-for="item in bindableProviders"
        :key="item.key"
        class="account-row provider-row"
      >
        <div class="account-row__main truncate">{{ item.name }}</div>
        <el-button
          type="primary"
          plain
          :loading="bindingKey === item.key"
          @click="bind(item)"
        >
          {{ t("oauth.bind") }}
        </el-button>
      </div>
      <el-alert
        v-if="!providersLoading && providers.length === 0"
        type="warning"
        :closable="false"
        :title="t('oauth.providerNotConfigured')"
      />
      <el-alert
        v-else-if="!providersLoading && bindableProviders.length === 0"
        type="success"
        :closable="false"
        :title="t('oauth.allBound')"
      />
    </div>
  </AccountPanel>
</template>
