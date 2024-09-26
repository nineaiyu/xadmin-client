<template>
  <div class="filter-field">
    <el-tag
      v-for="(v, k) in filterTags"
      :key="k"
      :disable-transitions="true"
      :type="tagType(v)"
      closable
      size="default"
      @click="handleTagClick(v, k)"
      @close="handleTagClose(v)"
    >
      {{ v }}
    </el-tag>
    <component
      :is="component"
      ref="SearchInput"
      v-model.trim="filterValue"
      :fetch-suggestions="autocomplete"
      :placeholder="iPlaceholder"
      :type="inputType"
      class="search-input"
      @blur="focus = false"
      @change="handleChange"
      @focus="focus = true"
      @select="handleSelect"
      @keyup.enter.prevent="handleConfirm"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { debounce } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";

interface TagInputProps {
  tagType?: Function;
  autocomplete?: boolean;
  placeholder?: string;
  inputType?: string;
}

defineOptions({ name: "TagInput" });

const filterTags = defineModel<Array<any>>({ default: [] });

const props = withDefaults(defineProps<TagInputProps>(), {
  tagType: () => "info",
  autocomplete: false,
  placeholder: undefined,
  inputType: "text"
});
const emit = defineEmits<{
  (e: "change", values: any): void;
}>();

const SearchInput = ref(null);
const { t } = useI18n();

const focus = ref(false);
const filterValue = ref("");
const component = ref(
  computed(() => (props.autocomplete ? "el-autocomplete" : "el-input"))
);
const iPlaceholder = computed(
  () => props.placeholder ?? t("tagInput.placeholder")
);
const handleTagClose = tag => {
  filterTags.value.splice(filterTags.value.indexOf(tag), 1);
  emit("change", filterTags.value);
};

const handleSelect = item => {
  filterTags.value = item.value;
  handleConfirm();
};

const handleConfirm = () => {
  if (filterValue.value === "") return;
  if (!filterTags.value.includes(filterValue.value)) {
    filterTags.value.push(filterValue.value);
    filterValue.value = "";
    emit("change", filterTags.value);
  }
  SearchInput.value.focus();
};

const handleChange = debounce(() => {
  handleConfirm();
}, 200);

const handleTagClick = (v, k) => {
  filterTags.value.splice(k, 1);
  handleConfirm();
  filterValue.value = v;
  SearchInput.value.focus();
};
</script>

<style lang="scss" scoped>
.el-tag + .el-tag {
  margin-left: 4px;
}

.filter-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  padding: 1px 2px;
  line-height: 30px;
  border-radius: var(--el-input-border-radius, var(--el-border-radius-base));
  box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color));

  & ::v-deep(.el-tag) {
    margin-top: 1px;
    font-family: sans-serif !important;
  }

  & ::v-deep(.el-autocomplete) {
    height: 28px;
  }
}

.search-input {
  flex: 1;

  & ::v-deep(.el-input__inner) {
    max-width: 100%;
    padding-left: 10px;
    border: none;
  }
}

.el-input ::v-deep(.el-input__inner) {
  font-size: 13px;
  border: none !important;
  box-shadow: none !important;
}

::v-deep(.el-input__wrapper) {
  box-shadow: none !important;
}

.filter-field ::v-deep(.el-input__inner) {
  height: 28px;
}
</style>
