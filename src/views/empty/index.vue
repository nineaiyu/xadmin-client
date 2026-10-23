<script lang="ts" setup>
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { goBackOrHome, hasInAppHistory } from "@/router/utils";
import back from "@/assets/svg/back_top.svg?component";

defineOptions({
  name: "Empty"
});

const router = useRouter();
const { t } = useI18n();
/** 是否有站内上一页：决定返回落点与提示文案（直达进入时回首页，go(-1) 是无操作） */
const canBack = hasInAppHistory(router);
</script>

<template>
  <div class="flex-c min-h-full flex-col p-6 text-center">
    <h1 class="mb-2 text-xl font-medium">{{ t("emptyPage.title") }}</h1>
    <p class="mb-8 text-(--el-text-color-regular)">
      {{ t("emptyPage.description") }}
    </p>
    <button
      type="button"
      class="back"
      :title="canBack ? t('emptyPage.back') : t('error.goBack')"
      :aria-label="canBack ? t('emptyPage.back') : t('error.goBack')"
      @click="goBackOrHome(router)"
    >
      <back class="size-20" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(96px, 30vw, 200px);
  aspect-ratio: 1;
  cursor: pointer;
  background: var(--el-fill-color-light);
  border: 0;
  border-radius: var(--radius-xl);

  &:hover {
    background: var(--el-fill-color);
    transition: background var(--duration-slower) var(--ease-standard);
  }
}
</style>
