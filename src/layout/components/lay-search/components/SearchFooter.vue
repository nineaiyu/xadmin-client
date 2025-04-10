<script lang="ts" setup>
import { useNav } from "@/layout/hooks/useNav";
import MdiKeyboardEsc from "@/assets/svg/keyboard_esc.svg?component";
import EnterOutlined from "@/assets/svg/enter_outlined.svg?component";
import ArrowUpLine from "~icons/ri/arrow-up-line";
import ArrowDownLine from "~icons/ri/arrow-down-line";

withDefaults(defineProps<{ total?: number }>(), {
  total: 0
});

const { device, t } = useNav();
</script>

<template>
  <div class="search-footer text-[#333] dark:text-white">
    <span class="search-footer-item">
      <EnterOutlined class="icon" />
      {{ t("buttons.sure") }}
    </span>
    <span class="search-footer-item">
      <IconifyIconOffline :icon="ArrowUpLine" class="icon" />
      <IconifyIconOffline :icon="ArrowDownLine" class="icon" />
      {{ t("buttons.switch") }}
    </span>
    <span class="search-footer-item">
      <MdiKeyboardEsc class="icon" />
      {{ t("buttons.close") }}
    </span>
    <p v-if="device !== 'mobile' && total > 0" class="search-footer-total">
      {{ t("layout.total", { total: total }) }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.search-footer {
  display: flex;

  .search-footer-item {
    display: flex;
    align-items: center;
    margin-right: 14px;
  }

  .icon {
    padding: 2px;
    margin-right: 3px;
    font-size: 20px;
    box-shadow:
      inset 0 -2px #cdcde6,
      inset 0 0 1px 1px #fff,
      0 1px 2px 1px #1e235a66;
  }

  .search-footer-total {
    position: absolute;
    right: 20px;
  }
}
</style>
