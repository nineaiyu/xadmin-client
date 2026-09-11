<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { oauthApi, type OAuthProvider } from "@/api/system/oauth";
import { message } from "@/utils/message";

/**
 * 第三方登录入口：**无 provider 配置时不渲染**（后端 OAUTH_PROVIDERS 默认空 = 整体休眠）。
 *
 * 只拉取已启用的 provider（接口不返回密钥），点击后取一次性 state 的授权地址再整体跳转。
 */

defineOptions({ name: "OAuthEntry" });

const { t } = useI18n();
const providers = ref<OAuthProvider[]>([]);

onMounted(() => {
  oauthApi
    .providers()
    .then(res => {
      if (res.code === 1000) {
        providers.value = (res.data?.providers ?? []) as OAuthProvider[];
      }
    })
    .catch(() => undefined);
});

const goAuthorize = (key: string) => {
  oauthApi
    .authorize(key)
    .then(res => {
      if (res.code === 1000 && res.data?.url) {
        window.location.href = String(res.data.url);
      } else if (res.detail) {
        message(res.detail, { type: "warning" });
      }
    })
    .catch(() => undefined);
};
</script>

<template>
  <div v-if="providers.length > 0" class="oauth-entry">
    <el-divider>{{ t("login.thirdPartyLogin") }}</el-divider>
    <div class="flex flex-wrap justify-center gap-2">
      <el-button
        v-for="item in providers"
        :key="item.key"
        plain
        @click="goAuthorize(item.key)"
      >
        {{ item.name }}
      </el-button>
    </div>
  </div>
</template>
