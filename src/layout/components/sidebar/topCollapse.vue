<script lang="ts" setup>
import MenuFold from "@iconify-icons/ri/menu-fold-fill";
import MenuUnfold from "@iconify-icons/ri/menu-unfold-fill";
import { useI18n } from "vue-i18n";

interface Props {
  isActive: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false
});

const emit = defineEmits<{
  (e: "toggleClick"): void;
}>();

const toggleClick = () => {
  emit("toggleClick");
};
const { t } = useI18n();
</script>

<template>
  <div
    :title="props.isActive ? t('layout.fold') : t('layout.unfold')"
    class="px-3 mr-1 navbar-bg-hover"
    @click="toggleClick"
  >
    <IconifyIconOffline
      :icon="props.isActive ? MenuFold : MenuUnfold"
      class="inline-block align-middle hover:text-primary dark:hover:!text-white"
    />
  </div>
</template>
