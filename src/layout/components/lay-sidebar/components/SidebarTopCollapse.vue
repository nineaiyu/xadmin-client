<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import MenuFold from "~icons/ri/menu-fold-fill";
import MenuUnfold from "~icons/ri/menu-unfold-fill";

withDefaults(defineProps<{ isActive?: boolean }>(), {
  isActive: false
});

const { t } = useI18n();

const emit = defineEmits<{
  toggleClick: [];
}>();

const toggleClick = () => {
  emit("toggleClick");
};
</script>

<template>
  <div
    :title="isActive ? t('layout.fold') : t('layout.unfold')"
    class="px-3 mr-1 navbar-bg-hover"
    role="button"
    tabindex="0"
    :aria-label="isActive ? t('layout.fold') : t('layout.unfold')"
    @click="toggleClick"
    @keydown.enter.prevent="toggleClick"
    @keydown.space.prevent="toggleClick"
  >
    <IconifyIconOffline
      :icon="isActive ? MenuFold : MenuUnfold"
      class="inline-block! align-middle hover:text-primary dark:hover:text-white!"
    />
  </div>
</template>
