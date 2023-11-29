interface FormItemProps {
  pk?: string;
  owner_id?: string;
  user_name?: string;
  nick_name?: string;
  user_id?: string;
  default_drive_id?: string;
  default_sbox_drive_id?: string;
  avatar?: string;
  expire_time?: string;
  x_device_id?: string;
  used_size?: string;
  total_size?: string;
  description?: string;
  enable?: string;
  private?: string;
  created_time?: string;
  updated_time?: string;
  active?: "";
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
