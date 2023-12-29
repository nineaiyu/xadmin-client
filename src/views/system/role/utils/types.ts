// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  /** ID */
  pk?: number;
  /** 角色名称 */
  name: string;
  /** 角色编号 */
  code: string;
  /** 备注 */
  description: string;
  /** 是否启用 */
  is_active: boolean;
  /** 菜单信息 */
  menu: number[];
}

interface FormProps {
  formInline: FormItemProps;
  menuTreeData: any[];
}

export type { FormItemProps, FormProps };
