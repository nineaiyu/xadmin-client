import type SortableJs from "sortablejs";
import { $t, transformI18n } from "@/plugins/i18n";
import type { CheckboxValueType } from "element-plus";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import {
  computed,
  defineComponent,
  getCurrentInstance,
  nextTick,
  ref,
  unref,
  watch
} from "vue";
import {
  cloneDeep,
  delay,
  getKeyList,
  isBoolean,
  isFunction
} from "@pureadmin/utils";

import PinAngle from "~icons/bi/pin-angle";
import Fullscreen from "~icons/ri/fullscreen-fill";
import PinAngleFill from "~icons/bi/pin-angle-fill";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import DragIcon from "@/assets/table-bar/drag.svg?component";
import ExpandIcon from "@/assets/table-bar/expand.svg?component";
import RefreshIcon from "@/assets/table-bar/refresh.svg?component";
import SettingIcon from "@/assets/table-bar/settings.svg?component";
import CollapseIcon from "@/assets/table-bar/collapse.svg?component";
import { useI18n } from "vue-i18n";

import {
  ICON_CLASS,
  TOP_CLASS,
  buildRenderClass,
  rendTippyProps,
  resolveFixedState,
  tableBarProps,
  toggleRowExpansionAll,
  type TableColumnLike
} from "./utils";
import { useTablePrefs } from "./useTablePrefs";

export default defineComponent({
  name: "PureTableBar",
  props: tableBarProps,
  emits: ["refresh", "fullscreen", "change"],
  setup(props, { emit, slots, attrs }) {
    // 表格偏好：列显隐/顺序/密度跨刷新保持（本地 + 可选跨设备同步）
    const tablePrefs = useTablePrefs();
    const size = ref(tablePrefs.size.value);
    const loading = ref(false);
    const checkAll = ref(true);
    const isFullscreen = ref(false);
    const isIndeterminate = ref(false);
    const instance = getCurrentInstance()!;
    const isExpandAll = ref(props.isExpandAll);
    const filterColumns = computed(() => {
      return cloneDeep(props?.columns).filter((column: TableColumnLike) =>
        isBoolean(column?.hide)
          ? !column.hide
          : !(isFunction(column?.hide) && column?.hide())
      );
    });
    const checkedColumns = ref(
      getKeyList(cloneDeep(filterColumns.value ?? []), "label")
    );
    const checkColumnList = ref(
      getKeyList(cloneDeep(props?.columns ?? []), "label")
    );
    const dynamicColumns = ref(cloneDeep(props?.columns));
    const { t } = useI18n();

    // 密度下拉项样式：选中项用主题色高亮
    const themeColor = computed(() => useEpThemeStoreHook().epThemeColor);
    const getDropdownItemStyle = computed(() => (s: string) => ({
      background: s === size.value ? themeColor.value : "",
      color: s === size.value ? "#fff" : "var(--el-text-color-primary)"
    }));

    const iconClass = computed(() => ICON_CLASS);

    const topClass = computed(() => TOP_CLASS);

    const renderClass = computed(() => buildRenderClass(isFullscreen.value));

    function onReFresh() {
      loading.value = true;
      emit("refresh");
      delay(500).then(() => (loading.value = false));
    }

    function onExpand() {
      isExpandAll.value = !isExpandAll.value;
      const rows = props.tableRef?.data;
      if (rows) toggleRowExpansionAll(props.tableRef, rows, isExpandAll.value);
    }

    function onFullscreen() {
      isFullscreen.value = !isFullscreen.value;
      emit("fullscreen", isFullscreen.value);
    }

    function handleCheckAllChange(val: CheckboxValueType) {
      checkedColumns.value = val ? checkColumnList.value : [];
      isIndeterminate.value = false;
      dynamicColumns.value.map((column: TableColumnLike) =>
        val ? (column.hide = false) : (column.hide = true)
      );
    }

    function handleCheckedColumnsChange(value: CheckboxValueType[]) {
      checkedColumns.value = value;
      const checkedCount = value.length;
      checkAll.value = checkedCount === checkColumnList.value.length;
      isIndeterminate.value =
        checkedCount > 0 && checkedCount < checkColumnList.value.length;
    }

    function handleCheckColumnListChange(
      val: CheckboxValueType,
      label: string
    ) {
      dynamicColumns.value.filter(
        (item: TableColumnLike) =>
          transformI18n(item.label) === transformI18n(label)
      )[0].hide = !val;
    }

    function handleToggleColumnFixed(
      fixed: boolean | "left" | "right",
      label: string
    ) {
      const column = dynamicColumns.value.find(
        (item: TableColumnLike) =>
          transformI18n(item.label) === transformI18n(label)
      );
      if (column) {
        column.fixed = fixed;
      }
    }

    async function onReset() {
      checkAll.value = true;
      isIndeterminate.value = false;
      dynamicColumns.value = cloneDeep(props?.columns);
      tablePrefs.apply(dynamicColumns.value);
      checkColumnList.value = getKeyList(
        cloneDeep(props?.columns ?? []),
        "label"
      );
      checkedColumns.value = getKeyList(
        cloneDeep(filterColumns.value),
        "label"
      );
    }

    const handleChange = () => {
      emit("change", {
        dynamicColumns: dynamicColumns.value,
        size: size.value,
        renderClass: slots?.default ? "" : renderClass.value
      });
      tablePrefs.save(dynamicColumns.value, size.value);
    };

    watch(props?.columns, () => {
      onReset();
    });

    // 首帧即应用偏好（放在 change watcher 之前，父组件先拿到带偏好的列）
    onReset();

    watch(
      () => [dynamicColumns.value, renderClass.value],
      () => {
        handleChange();
      },
      { deep: true, immediate: true }
    );

    const sizeChange = (event: MouseEvent, val: string) => {
      event.stopPropagation();
      size.value = val;
      handleChange();
    };
    const dropdown = {
      dropdown: () => (
        <el-dropdown-menu class="translation">
          <el-dropdown-item
            style={getDropdownItemStyle.value("large")}
            onClick={event => sizeChange(event, "large")}
          >
            {t("tableBar.loose")}
          </el-dropdown-item>
          <el-dropdown-item
            style={getDropdownItemStyle.value("default")}
            onClick={event => sizeChange(event, "default")}
          >
            {t("tableBar.default")}
          </el-dropdown-item>
          <el-dropdown-item
            style={getDropdownItemStyle.value("small")}
            onClick={event => sizeChange(event, "small")}
          >
            {t("tableBar.compact")}
          </el-dropdown-item>
        </el-dropdown-menu>
      )
    };

    /** 列展示拖拽排序 */
    // 复用同一 Sortable 实例：rowDrop 会在每次触发拖拽按钮时重整实例，
    // 重复 create 会在同一 wrapper 上叠加监听，需先销毁旧实例
    // R9 触屏降级：原先仅 mouseenter 触发（触屏无 hover，列排序不可用），
    // 现由 mousedown / touchstart 同样触发（Sortable 自身支持 touch 拖拽）
    let sortableInstance: ReturnType<typeof SortableJs.create> | null = null;
    const rowDrop = (event: { preventDefault: () => void }) => {
      event.preventDefault();
      nextTick(async () => {
        // sortablejs 仅由“列排序”交互触发时加载（静态引入会被打进入口闭包）；
        // 加载完成后的行为与原先一致：每次重整前先销毁旧实例
        const { default: Sortable } = await import("sortablejs");
        const wrapper: HTMLElement = (
          instance?.proxy?.$refs[`GroupRef${unref(props.tableKey)}`] as {
            $el: HTMLElement;
          }
        ).$el.firstElementChild as HTMLElement;
        sortableInstance?.destroy();
        sortableInstance = Sortable.create(wrapper, {
          animation: 300,
          handle: ".drag-btn",
          onEnd: ({ newIndex, oldIndex, item }) => {
            if (newIndex === undefined || oldIndex === undefined) return;
            const targetThElem = item;
            const wrapperElem = targetThElem.parentNode as HTMLElement;
            const oldColumn = dynamicColumns.value[oldIndex];
            const newColumn = dynamicColumns.value[newIndex];
            if (oldColumn?.fixed || newColumn?.fixed) {
              // 当前列存在fixed属性 则不可拖拽
              const oldThElem = wrapperElem.children[oldIndex] as HTMLElement;
              if (newIndex > oldIndex) {
                wrapperElem.insertBefore(targetThElem, oldThElem);
              } else {
                wrapperElem.insertBefore(
                  targetThElem,
                  oldThElem ? oldThElem.nextElementSibling : oldThElem
                );
              }
              return;
            }
            const currentRow = dynamicColumns.value.splice(oldIndex, 1)[0];
            dynamicColumns.value.splice(newIndex, 0, currentRow);
          }
        });
      });
    };

    const isFixedColumn = (label: string) => {
      const column = dynamicColumns.value.find(
        (item: TableColumnLike) =>
          transformI18n(item.label) === transformI18n(label)
      );
      return resolveFixedState(column);
    };

    const reference = {
      reference: () => (
        <SettingIcon
          class={["w-4", iconClass.value]}
          v-tippy={rendTippyProps(t("tableBar.columnSettings"))}
          // a11y：图标按钮需可访问名；显式 aria-hidden=false 保证名称生效
          aria-label={t("tableBar.columnSettings")}
          aria-hidden={false}
        />
      )
    };

    return () => (
      <>
        <div {...attrs} class={[slots?.default ? renderClass.value : ""]}>
          <div class="flex justify-between w-full h-15 p-4">
            {slots?.title ? (
              slots.title()
            ) : (
              <p class="font-bold truncate">{props.title}</p>
            )}
            <div class="flex-ac">
              {slots?.buttons ? (
                <div class="flex mr-4">{slots.buttons()}</div>
              ) : null}
              {props.tableRef?.size ? (
                <>
                  <ExpandIcon
                    class={["w-4", iconClass.value]}
                    style={{
                      transform: isExpandAll.value ? "none" : "rotate(-90deg)"
                    }}
                    v-tippy={rendTippyProps(
                      isExpandAll.value
                        ? t("tableBar.fold")
                        : t("tableBar.unfold")
                    )}
                    aria-label={
                      isExpandAll.value
                        ? t("tableBar.fold")
                        : t("tableBar.unfold")
                    }
                    aria-hidden={false}
                    onClick={() => onExpand()}
                  />
                  <el-divider direction="vertical" />
                </>
              ) : null}
              <RefreshIcon
                class={[
                  "w-4",
                  iconClass.value,
                  loading.value ? "animate-spin" : ""
                ]}
                v-tippy={rendTippyProps(t("tableBar.refresh"))}
                aria-label={t("tableBar.refresh")}
                aria-hidden={false}
                onClick={() => onReFresh()}
              />
              <el-divider direction="vertical" />
              <el-dropdown
                v-slots={dropdown}
                trigger="click"
                v-tippy={rendTippyProps(t("tableBar.density"))}
              >
                <CollapseIcon
                  class={["w-4", iconClass.value]}
                  aria-label={t("tableBar.density")}
                  aria-hidden={false}
                />
              </el-dropdown>
              <el-divider direction="vertical" />

              <el-popover
                v-slots={reference}
                placement="bottom-start"
                popper-style={{ padding: 0 }}
                width="245"
                trigger="click"
              >
                <div class={[topClass.value]}>
                  <el-checkbox
                    class="-mr-1!"
                    label={t("tableBar.columnDisplay")}
                    v-model={checkAll.value}
                    indeterminate={isIndeterminate.value}
                    onChange={value => handleCheckAllChange(value)}
                  />
                  <el-button type="primary" link onClick={() => onReset()}>
                    {t("buttons.reset")}
                  </el-button>
                </div>

                <div class="pt-1.5 pl-2.75">
                  <el-scrollbar max-height="36vh">
                    <el-checkbox-group
                      ref={`GroupRef${unref(props.tableKey)}`}
                      modelValue={checkedColumns.value}
                      onChange={value => handleCheckedColumnsChange(value)}
                    >
                      <el-space
                        direction="vertical"
                        alignment="flex-start"
                        size={0}
                      >
                        {checkColumnList.value.map((item, index) => {
                          const { fixed, left, right } = isFixedColumn(item);
                          return (
                            <div class="flex items-center">
                              <DragIcon
                                class={[
                                  "drag-btn w-4 mr-2",
                                  fixed ? "cursor-no-drop!" : "cursor-grab!"
                                ]}
                                onMouseenter={(event: {
                                  preventDefault: () => void;
                                }) => rowDrop(event)}
                                onMousedown={(event: {
                                  preventDefault: () => void;
                                }) => rowDrop(event)}
                                onTouchstart={(event: {
                                  preventDefault: () => void;
                                }) => rowDrop(event)}
                              />
                              <el-checkbox
                                key={index}
                                label={item}
                                value={item}
                                onChange={value =>
                                  handleCheckColumnListChange(value, item)
                                }
                              >
                                <span
                                  title={transformI18n(item)}
                                  class="inline-block w-30 truncate hover:text-text_color_primary"
                                >
                                  {transformI18n(item)}
                                </span>
                              </el-checkbox>
                              <iconify-icon-offline
                                class={[
                                  "ml-2",
                                  "size-4",
                                  "hover:text-primary",
                                  "cursor-pointer",
                                  left ? "text-primary" : ""
                                ]}
                                icon={left ? PinAngleFill : PinAngle}
                                v-tippy={
                                  left
                                    ? transformI18n($t("tableBar.unpin"))
                                    : transformI18n($t("tableBar.pinLeft"))
                                }
                                aria-label={
                                  left
                                    ? transformI18n($t("tableBar.unpin"))
                                    : transformI18n($t("tableBar.pinLeft"))
                                }
                                aria-hidden={false}
                                onClick={() =>
                                  handleToggleColumnFixed(
                                    left ? false : "left",
                                    item
                                  )
                                }
                              />
                              <iconify-icon-offline
                                class={[
                                  "ml-2",
                                  "size-4",
                                  "hover:text-primary",
                                  "scale-x-[-1]",
                                  "cursor-pointer",
                                  right ? "text-primary" : ""
                                ]}
                                icon={right ? PinAngleFill : PinAngle}
                                v-tippy={
                                  right
                                    ? transformI18n($t("tableBar.unpin"))
                                    : transformI18n($t("tableBar.pinRight"))
                                }
                                aria-label={
                                  right
                                    ? transformI18n($t("tableBar.unpin"))
                                    : transformI18n($t("tableBar.pinRight"))
                                }
                                aria-hidden={false}
                                onClick={() =>
                                  handleToggleColumnFixed(
                                    right ? false : "right",
                                    item
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                      </el-space>
                    </el-checkbox-group>
                  </el-scrollbar>
                </div>
              </el-popover>
              <el-divider direction="vertical" />

              <iconify-icon-offline
                class={["w-4", iconClass.value]}
                icon={isFullscreen.value ? ExitFullscreen : Fullscreen}
                v-tippy={
                  isFullscreen.value
                    ? t("tableBar.exitFullscreen")
                    : t("tableBar.fullscreen")
                }
                aria-label={
                  isFullscreen.value
                    ? t("tableBar.exitFullscreen")
                    : t("tableBar.fullscreen")
                }
                aria-hidden={false}
                onClick={() => onFullscreen()}
              />
            </div>
          </div>
          {slots?.default &&
            slots?.default({
              size: size.value,
              dynamicColumns: dynamicColumns.value
            })}
        </div>
      </>
    );
  }
});
