<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { isSuccess } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  OAUTH_BIND_FLAG,
  oauthApi,
  type OAuthProvider
} from "@/api/identity/oauth";
import { message } from "@/utils/message";
import { AesEncrypted } from "@/utils/aes";
import { normalizeError } from "@/utils/apiError";
import { formatDateTime } from "@/utils/format";
import { usePrompt } from "@/hooks/useMessageBox";
import { useUserStoreHook } from "@/store/modules/user";
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
const userinfoStore = useUserStoreHook();
const rows = ref<BindingRow[]>([]);
const providers = ref<OAuthProvider[]>([]);
const loading = ref(false);
const providersLoading = ref(false);
const loadError = ref("");
const providersError = ref("");
/** 正在发起跳转的 provider key（绑定按钮 loading，跳转后页面即卸载） */
const bindingKey = ref("");

/** 可绑定 provider：同 key 已有绑定就不重复提供入口（取消绑定后自动回到列表） */
const bindableProviders = computed(() =>
  providers.value.filter(
    item => !rows.value.some(row => row.provider === item.key)
  )
);

const load = async () => {
  loading.value = true;
  loadError.value = "";
  const res = await oauthApi.bindings().catch(normalizeError);
  if (isSuccess(res)) {
    rows.value = (res.data ?? []) as BindingRow[];
  } else {
    // 加载失败不能渲染成「未绑定」：用户会误判并重复绑定
    rows.value = [];
    loadError.value = String(res.detail || t("results.failed"));
  }
  loading.value = false;
};

const loadProviders = async () => {
  providersLoading.value = true;
  providersError.value = "";
  const res = await oauthApi.providers().catch(normalizeError);
  if (isSuccess(res)) {
    providers.value = (res.data?.providers ?? []) as OAuthProvider[];
  } else {
    providers.value = [];
    providersError.value = String(res.detail || t("results.failed"));
  }
  providersLoading.value = false;
};

const displayName = (row: BindingRow) =>
  String(row.profile?.nickname || row.profile?.email || row.subject);

const prompt = usePrompt();

const unbind = async (row: BindingRow) => {
  const input = await prompt(t("oauth.unbindPasswordTip"), t("oauth.unbind"), {
    inputType: "password",
    inputPlaceholder: t("oauth.password"),
    inputValidator: value => Boolean(value),
    // 解绑是破坏性操作：确认钮着危险色（useConfirm 同口径；
    // prompt 模式焦点本就在输入框，不存在回车误确认问题）
    danger: true
  });
  if (!input) return;
  // 与改密同口径：口令按 AESCipherV2(username) 加密后提交，不落明文
  const res = await oauthApi
    .unbind(
      row.pk,
      await AesEncrypted(userinfoStore.username as string, input.value)
    )
    .catch(normalizeError);
  if (isSuccess(res)) {
    message(t("oauth.unbindSuccess"), { type: "success" });
    load();
  } else if (res.detail) {
    message(res.detail, { type: "warning" });
  }
};

/** 发起绑定：取授权地址后整体跳转，IdP 回跳 `/#/oauth/callback` 完成绑定 */
const bind = (provider: OAuthProvider) => {
  bindingKey.value = provider.key;
  oauthApi
    .bindAuthorize(provider.key)
    .then(res => {
      if (isSuccess(res) && res.data?.url) {
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
    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      :closable="false"
      class="mb-2"
    >
      <el-button link type="primary" @click="load">
        {{ t("buttons.retry") }}
      </el-button>
    </el-alert>
    <div v-loading="loading">
      <div v-if="!loadError && rows.length === 0" class="account-empty">
        <ReEmpty :description="t('oauth.noBindings')" :image-size="60" />
      </div>
      <!-- provider-row / binding-row：既有 E2E 的行定位钩子，与样式类并存 -->
      <div v-for="row in rows" :key="row.pk" class="account-row binding-row">
        <div class="account-row__main">
          <div class="account-row__title truncate">
            {{ row.provider_name || row.provider }} · {{ displayName(row) }}
          </div>
          <span class="account-row__desc">
            {{ formatDateTime(row.created_time) || "-" }}
          </span>
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
        v-if="providersError"
        type="error"
        :title="providersError"
        :closable="false"
      >
        <el-button link type="primary" @click="loadProviders">
          {{ t("buttons.retry") }}
        </el-button>
      </el-alert>
      <el-alert
        v-else-if="!providersLoading && providers.length === 0"
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
