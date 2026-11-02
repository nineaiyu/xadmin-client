<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useBoolean } from "../../hooks/useBoolean";
import SearchModal from "./components/SearchModal.vue";

const { t } = useI18n();
const { bool: show, toggle } = useBoolean();
function handleSearch() {
  toggle();
}
</script>

<template>
  <div>
    <div
      class="navbar-action search-container navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
      role="button"
      tabindex="0"
      :aria-label="t('layout.commandPaletteEntry')"
      @click="handleSearch"
      @keydown.enter.prevent="handleSearch"
      @keydown.space.prevent="handleSearch"
    >
      <IconifyIconOffline icon="ri/search-line" />
    </div>
    <SearchModal v-model:value="show" />
  </div>
</template>
