/**
 * 命令面板可访问性常量（SearchModal / SearchResult / SearchHistory 三处同源）。
 *
 * combobox 模式：输入框持有 `role="combobox"` + `aria-activedescendant`，
 * 指向当前导航选中项的选项节点 id；各选项节点以同一构造声明 `id` 与
 * `role="option"` + `aria-selected`。导航指针（activeNav）的取值即这里的 key：
 * `cmd:<id>` / 菜单路径 / `global:<组>:<pk>` / `ask:ai` / 历史路径。
 */
export const PALETTE_LISTBOX_ID = "palette-search-listbox";

/** 选项节点 id（aria-activedescendant 与选项节点两侧必须同源构造） */
export const paletteOptionId = (key: string) => `palette-option-${key}`;

/**
 * 把 combobox 角色补写到 EP el-input 的**原生输入框**上。
 *
 * EP el-input 的 useAttrs 排除表会丢弃 `role`（不透传内层 input），而 `aria-*`
 * 正常透传——模板里直接写 `role="combobox"` 会让角色消失、aria 独留，axe 判
 * `aria-allowed-attr`（input 的隐式 textbox 角色不允许 aria-haspopup），读屏的
 * activedescendant 指针也失去宿主。ARIA combobox 模式要求 role 与 aria-* 同体，
 * 故面板打开后在原生 input 上补写角色。
 */
export function applyPaletteComboboxRole(
  instance: { input?: HTMLInputElement | null } | null
): void {
  instance?.input?.setAttribute("role", "combobox");
}
