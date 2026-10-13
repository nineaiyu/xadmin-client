<script setup lang="ts">
import { useBoolean } from "../../hooks/useBoolean";
import SearchModal from "./components/SearchModal.vue";

const { bool: show, toggle } = useBoolean();
function handleSearch() {
  toggle();
}
</script>

<template>
  <div>
    <div
      class="navbar-action search-container navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
      @click="handleSearch"
    >
      <IconifyIconOffline icon="ri/search-line" />
    </div>
    <SearchModal v-model:value="show" />
  </div>
</template>
