<script lang="ts" setup>
// 顶栏「国际化」（弹层类组件：固定在顶栏，不收进「更多」下拉）
import { useNav } from "@/layout/hooks/useNav";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import GlobalizationIcon from "@/assets/svg/globalization.svg?component";
import Check from "~icons/ep/check";

const { t, getDropdownItemStyle, getDropdownItemClass } = useNav();
const { locale, translationCh, translationEn } = useTranslationLang();
</script>

<template>
  <el-dropdown id="header-translation" trigger="click">
    <div
      class="globalization-icon navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
      role="button"
      tabindex="0"
      :aria-label="t('buttons.language')"
    >
      <IconifyIconOffline :icon="GlobalizationIcon" />
    </div>
    <template #dropdown>
      <el-dropdown-menu class="translation">
        <el-dropdown-item
          :style="getDropdownItemStyle(locale, 'zh')"
          :class="['dark:text-white!', getDropdownItemClass(locale, 'zh')]"
          @click="translationCh"
        >
          <IconifyIconOffline
            v-show="locale === 'zh'"
            class="check-zh"
            :icon="Check"
          />
          简体中文
        </el-dropdown-item>
        <el-dropdown-item
          :style="getDropdownItemStyle(locale, 'en')"
          :class="['dark:text-white!', getDropdownItemClass(locale, 'en')]"
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
</template>

<style lang="scss" scoped>
.translation {
  :deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh,
  .check-en {
    position: absolute;
    left: 20px;
  }
}
</style>
