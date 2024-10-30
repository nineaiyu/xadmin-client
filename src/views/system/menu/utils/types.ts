// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormMetaProps {
  /** 菜单名称 */
  title: string;
  /** 菜单图标 */
  icon: string;
  /** 菜单右侧额外图标iconfont名称，目前只支持iconfont */
  r_svg_name: string;
  /** 是否显示该菜单 */
  is_show_menu: boolean;
  /** 是否显示父级菜单 */
  is_show_parent: boolean;
  /** 是否开启页面缓存 */
  is_keepalive: boolean;
  /** 内嵌的iframe链接地址 */
  frame_url: string;
  /** 内嵌的iframe页面是否开启首次加载动画 */
  frame_loading: boolean;
  /** 当前页面进场动画 */
  transition_enter: string;
  /** 当前页面离场动画 */
  transition_leave: string;
  /** 当前菜单名称或自定义信息禁止添加到标签页 */
  is_hidden_tag: boolean;
  /** 固定标签页（当前菜单名称是否固定显示在标签页且不可关闭） */
  fixed_tag: boolean;
  /** 显示标签页最大数量 */
  dynamic_level: number;
}

interface FormItemProps {
  /** ID */
  pk?: number;
  menu_type?: number;
  isAdd?: boolean;
  /** 父节点 */
  parent: string;
  parent_ids?: number[];
  /** 菜单名称 */
  title?: string;
  /** 组件英文名称 */
  name: string;
  /** 绑定的模型 */
  model?: number[];
  /** 菜单顺序 */
  rank: number;
  /** 路由地址 */
  path?: string;
  /** 组件地址 */
  component: string;
  method?: string;
  /** 是否启用该菜单 */
  is_active: boolean;
  /** 是否是编辑模式 */
  meta?: FormMetaProps;
}

interface FormProps {
  formInline?: FormItemProps;
  treeData?: any[];
  methodChoices?: any[];
  menuChoices?: any[];
  menuUrlList?: any[];
  modelList?: any[];
  viewList?: object;
}

interface TreeFormProps {
  formInline: FormItemProps;
  treeData: any[];
  defaultData: object;
  parentIds: any[];
}

interface Tree {
  id: number;
  name: string;
  highlight?: boolean;
  children?: Tree[];
}

export type { FormItemProps, FormProps, Tree, TreeFormProps };
