<script lang="ts" setup>
import { h, reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { searchUserApi } from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";
import { ElImage } from "element-plus";

defineOptions({ name: "SearchUser" });

const emit = defineEmits<{
  change: [...args: any[]];
}>();

const selectValue = defineModel<object | object[] | string>();
const { multiple = true } = defineProps<{ multiple?: boolean }>();

const api = reactive(searchUserApi);

const baseColumnsFormat = ({ listColumns }) => {
  listColumns.value.forEach(column => {
    if (
      ["pk", "is_active", "gender", "avatar"].indexOf(column._column.key) > -1
    ) {
      column["width"] = 80;
    }
    if (column._column.key === "avatar") {
      column["cellRenderer"] = ({ row }) =>
        h(ElImage, {
          lazy: true,
          src: row[column._column?.key],
          alt: row[column._column?.key],
          class: ["w-[36px]", "h-[36px]", "align-middle"],
          previewSrcList: [row[column._column?.key]],
          previewTeleported: true
        });
    }
  });
};
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:SearchUser')"
    v-model="selectValue"
    :multiple="multiple"
    locale-name="systemUser"
    :baseColumnsFormat="baseColumnsFormat"
    :api="api"
    :valueProps="{
      value: 'pk',
      label: 'username'
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
