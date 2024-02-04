<script lang="ts" setup>
import { computed, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import MenuFold from "@iconify-icons/ri/menu-fold-fill";
import { useI18n } from "vue-i18n";

interface Props {
  isActive: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false
});

const visible = ref(false);
const { tooltipEffect } = useNav();

const iconClass = computed(() => {
  return [
    "ml-4",
    "mb-1",
    "w-[16px]",
    "h-[16px]",
    "inline-block",
    "align-middle",
    "cursor-pointer",
    "duration-[100ms]"
  ];
});

const { $storage } = useGlobal<GlobalPropertiesApi>();
const themeColor = computed(() => $storage.layout?.themeColor);
const { t } = useI18n();
const emit = defineEmits<{
  (e: "toggleClick"): void;
}>();

const toggleClick = () => {
  emit("toggleClick");
};
</script>

<template>
  <div class="collapse-container">
    <el-tooltip
      :content="props.isActive ? t('layout.fold') : t('layout.unfold')"
      :effect="tooltipEffect"
      :visible="visible"
      placement="right"
    >
      <IconifyIconOffline
        :class="[iconClass, themeColor === 'light' ? '' : 'text-primary']"
        :icon="MenuFold"
        :style="{ transform: props.isActive ? 'none' : 'rotateY(180deg)' }"
        @click="toggleClick"
        @mouseenter="visible = true"
        @mouseleave="visible = false"
      />
    </el-tooltip>
  </div>
</template>

<style lang="scss" scoped>
.collapse-container {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 40px;
  line-height: 40px;
  box-shadow: 0 0 6px -3px var(--el-color-primary);
}
</style>
