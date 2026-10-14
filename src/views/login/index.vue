<script lang="ts" setup>
import { computed, toRaw, watch } from "vue";
import { useGlobal } from "@pureadmin/utils";
import Motion from "./utils/motion";
import basic from "./components/Basic.vue";
import TypeIt from "./components/ReTypeit";
import register from "./components/Register.vue";
import resetPassword from "./components/ResetPassword.vue";
import login from "./components/Login.vue";
import { LOGIN_PAGE } from "./utils/enums";
import { useNav } from "@/layout/hooks/useNav";
import { useLayout } from "@/layout/hooks/useLayout";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { avatar, bg, illustration } from "./utils/static";

import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { SITE_LINKS } from "@/config/site";
import { useI18n } from "vue-i18n";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Check from "~icons/ep/check";

defineOptions({
  name: "LoginIndex"
});

const currentPage = computed(() => {
  return useLoginPageStoreHook().currentPage;
});

const { initStorage } = useLayout();
initStorage();
const { dataTheme, themeMode, dataThemeChange } = useDataThemeChange();
dataThemeChange(themeMode.value);

/** el-switch 的 change 载荷为 boolean/string/number，按既有调用口径透传给主题切换 */
const handleDataThemeChange = (value: string | number | boolean) => {
  dataThemeChange(value as string);
};
const { title, getDropdownItemStyle, getDropdownItemClass } = useNav();
const { locale, translationCh, translationEn } = useTranslationLang();
const { t } = useI18n();

/** 认证页外壳形态（设置面板 →「通用」→「登录页」）：panel-left / panel-center / panel-right */
const { $storage } = useGlobal<GlobalPropertiesApi>();
const authPanel = computed(
  () => $storage?.configure?.authPageLayout ?? "panel-left"
);

/**
 * 站点配置到达后重新应用明暗：登录页在布局之外，布局层的主题响应链路覆盖不到这里，
 * 首帧只拿得到本地默认值（platform-config）。
 *
 * 边界：站点配置（WEB_SITE_CONFIG）仅在已登录会话中拉取（main.ts 的 getToken 分支），
 * 因此**未登录首访**时本页拿不到服务端 DarkMode，仍按本地默认渲染；一旦配置已到达
 * （如登出回到登录页），本监听会让登录页与应用壳保持一致。
 */
watch(
  () => $storage?.layout?.darkMode,
  dark => {
    dataTheme.value = Boolean(dark);
    dataThemeChange(themeMode.value);
  }
);
</script>

<template>
  <div class="select-none" :data-auth-panel="authPanel">
    <img :src="bg" alt="" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <!-- 主题 -->
      <el-switch
        v-model="dataTheme"
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        inline-prompt
        :aria-label="t('layout.theme')"
        @change="handleDataThemeChange"
      />
      <!-- 国际化 -->
      <el-dropdown trigger="click">
        <globalization
          class="hover:text-primary hover:bg-transparent! size-5 ml-1.5 cursor-pointer outline-hidden duration-300"
          :aria-label="t('buttons.language')"
        />
        <template #dropdown>
          <el-dropdown-menu class="translation">
            <el-dropdown-item
              :class="['dark:text-white!', getDropdownItemClass(locale, 'zh')]"
              :style="getDropdownItemStyle(locale, 'zh')"
              @click="translationCh"
            >
              <IconifyIconOffline
                v-show="locale === 'zh'"
                :icon="Check"
                class="check-zh"
              />
              简体中文
            </el-dropdown-item>
            <el-dropdown-item
              :class="['dark:text-white!', getDropdownItemClass(locale, 'en')]"
              :style="getDropdownItemStyle(locale, 'en')"
              @click="translationEn"
            >
              <span v-show="locale === 'en'" class="check-en">
                <IconifyIconOffline :icon="Check" />
              </span>
              English
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="login-container">
      <div class="img enter-y">
        <component :is="toRaw(illustration)" />
      </div>
      <div class="login-box enter-y">
        <div class="login-form">
          <avatar class="avatar" />
          <Motion>
            <h2 class="outline-hidden">
              <TypeIt
                :options="{ strings: [title ?? ''], cursor: false, speed: 100 }"
              />
            </h2>
          </Motion>
          <!-- 账户密码登录 -->
          <basic v-if="currentPage === LOGIN_PAGE.basic" />

          <!-- 验证码登录 -->
          <login v-if="currentPage === LOGIN_PAGE.verifyCode" />
          <!-- 注册 -->
          <register v-if="currentPage === LOGIN_PAGE.register" />
          <!-- 忘记密码 -->
          <resetPassword v-if="currentPage === LOGIN_PAGE.resetPassword" />
        </div>
      </div>
    </div>
    <div class="w-full flex-c absolute bottom-3 text-sm text-fg-muted">
      Copyright © 2026-present
      <a class="hover:text-primary!" :href="SITE_LINKS.author" target="_blank">
        &nbsp;{{ title }}
      </a>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

.translation {
  :deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh {
    position: absolute;
    left: 20px;
  }

  .check-en {
    position: absolute;
    left: 20px;
  }
}
</style>
