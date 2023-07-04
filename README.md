# xadmin-client

xadmin-基于 Django+vue3 的 rbac 权限管理系统

基于 [vue-pure-admin](https://github.com/pure-admin/vue-pure-admin) 二次开发

Django 做后端服务
[xadmin-server](https://github.com/nineaiyu/xadmin-server)

### 在线预览

[https://xadmin.dvcloud.xin/](https://xadmin.dvcloud.xin/)
账号密码：admin/admin123

## docker 构建

修改 api 配置文件`.env.production`，将 api 域名修改为自己服务器，然后进行构建

```shell
docker compose up xadmin-client-build
```

### docker 启动

```shell
docker compose up xadmin-client-prod
```

然后浏览器 http://localhost:8891 进行访问
