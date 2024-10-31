<script lang="ts" setup>
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { searchRoleApi } from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";

defineOptions({ name: "SearchRole" });

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();

const selectValue = defineModel<object | object[] | string>();
const { multiple = true } = defineProps<{ multiple?: boolean }>();

const api = reactive(searchRoleApi);
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:SearchRole')"
    v-model="selectValue"
    :multiple="multiple"
    locale-name="systemRole"
    :api="api"
    :valueProps="{
      value: 'pk',
      label: 'name'
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
