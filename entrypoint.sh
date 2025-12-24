#!/bin/bash
set -e

# 环境变量配置
DOMAIN=${DOMAIN:-}
EMAIL=${EMAIL:-}
CERT_DIR="/web/cert/${DOMAIN}"
ACME_CMD="/root/.acme.sh/acme.sh"

# 命令参数
action="${1:-}"
service="${2:-}"

# 日志函数
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

log_warn() {
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

# 验证域名格式
validate_domain() {
    local domain="$1"
    if [[ -z "$domain" ]]; then
        log_error "DOMAIN is not set"
        return 1
    fi
    return 0
}

# 检查端口是否被占用
check_port_availability() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -tuln | grep -q ":$port " && return 1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln | grep -q ":$port " && return 1
    else
        # 如果没有ss或netstat，假设端口可用
        return 0
    fi
    return 0
}

# 确保必要的目录存在
ensure_directories() {
    local dirs=("/etc/nginx/conf.d" "/var/www/acme-challenge" "/web/dist" "/var/log/nginx" "/root/.acme.sh")
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_info "Creating directory: $dir"
            mkdir -p "$dir"
        fi
    done
}

# 检查必要命令
check_dependencies() {
    local deps=("nginx" "openssl")
    if [[ -n "$DOMAIN" ]]; then
        deps+=("cron")
    fi

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            log_error "Required command not found: $dep"
            exit 1
        fi
    done
}

# 添加HTTP配置
addHttpConf() {
    log_info "Adding HTTP configuration"

    # 清理可能的残留配置
    rm -f /etc/nginx/conf.d/https-xadmin.conf
    rm -f /etc/nginx/conf.d/default.conf

    cat > /etc/nginx/conf.d/http-xadmin.conf <<EOF
server {
    listen 80;
    server_name _;

    root /web/dist/;
    index index.html index.htm;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/acme-challenge;
        default_type "text/plain";
        try_files \$uri =404;
    }

    # api 服务
    location ~ ^/(api|ws|flower|media|api-docs) {
        include conf.d/xadmin-api-conf;
    }

    # 前端
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    access_log /var/log/nginx/xadmin_web_access.log;
    error_log /var/log/nginx/xadmin_web_error.log;
}
EOF

    # 测试配置
    if ! nginx -t 2>/dev/null; then
        log_error "Nginx configuration test failed"
        return 1
    fi
}

# 添加HTTPS配置
addHttpsConf() {
    log_info "Adding HTTPS configuration for domain: $DOMAIN"

    # 清理HTTP配置
    rm -f /etc/nginx/conf.d/http-xadmin.conf
    rm -f /etc/nginx/conf.d/default.conf

    cat > /etc/nginx/conf.d/https-xadmin.conf <<EOF
server {
    listen 80;
    listen 443 ssl http2;
    server_name ${DOMAIN};

    root /web/dist/;
    index index.html index.htm;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/acme-challenge;
        default_type "text/plain";
        try_files \$uri =404;
    }

    # SSL证书配置
    ssl_certificate       ${CERT_DIR}.pem;
    ssl_certificate_key   ${CERT_DIR}.key;

    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:DES-CBC3-SHA:!DSS;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # api 服务
    location ~ ^/(api|ws|flower|media|api-docs) {
        include conf.d/xadmin-api-conf;
    }

    # 前端
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    access_log /var/log/nginx/xadmin_web_access.log;
    error_log /var/log/nginx/xadmin_web_error.log;
}
EOF

    # 测试配置
    if ! nginx -t 2>/dev/null; then
        log_error "Nginx HTTPS configuration test failed"
        return 1
    fi
}

# 检查并安装acme.sh
checkAcme() {
    log_info "Checking acme.sh installation"

    if [[ ! -f /root/.acme.sh/acme.sh ]]; then
        log_info "acme.sh not found. Installing..."
        if [[ -d /web/acme.sh ]]; then
            cd /web/acme.sh && bash acme.sh --install --home /root/.acme.sh
            if [[ -n "$EMAIL" ]]; then
                bash acme.sh --set-default-ca --server letsencrypt --accountemail "$EMAIL"
            else
                bash acme.sh --set-default-ca --server letsencrypt
            fi
        else
            log_error "acme.sh directory not found at /web/acme.sh"
            exit 1
        fi
    else
        log_info "acme.sh already installed"
    fi
}

# 申请证书
requestCertificate() {
    log_info "Requesting certificate for domain: $DOMAIN"

    # 检查证书是否已存在且未过期
    if [[ -f "${CERT_DIR}.pem" && -f "${CERT_DIR}.key" ]]; then
        local cert_exp_date
        cert_exp_date=$(openssl x509 -in "${CERT_DIR}.pem" -noout -enddate | cut -d= -f2)
        local exp_timestamp
        exp_timestamp=$(date -d "$cert_exp_date" +%s)
        local current_timestamp
        current_timestamp=$(date +%s)

        # 如果证书在7天内过期，则重新申请
        if (( exp_timestamp - current_timestamp > 7 * 24 * 3600 )); then
            log_info "Certificate is valid, skipping renewal"
            return 0
        else
            log_info "Certificate will expire soon, renewing..."
        fi
    fi

    # 启动临时HTTP服务器处理ACME挑战
    log_info "Starting temporary HTTP server for ACME challenge"
    addHttpConf
    nginx -g 'daemon off;' &
    local nginx_pid=$!

    # 等待nginx启动
    sleep 2

    # 验证nginx是否正常运行
    if ! kill -0 $nginx_pid 2>/dev/null; then
        log_error "Failed to start temporary nginx server"
        return 1
    fi

    # 申请证书
    log_info "Running acme.sh to issue certificate"
    if $ACME_CMD --issue -d "$DOMAIN" --webroot /var/www/acme-challenge \
        ${EMAIL:+--accountemail "$EMAIL"} \
        --home /root/.acme.sh; then

        log_info "Certificate issued successfully"

        # 安装证书
        if $ACME_CMD --install-cert -d "$DOMAIN" \
            --key-file "${CERT_DIR}.key" \
            --fullchain-file "${CERT_DIR}.pem" \
            --reloadcmd "nginx -s reload" \
            --home /root/.acme.sh; then
            log_info "Certificate installed successfully"
        else
            log_error "Failed to install certificate"
            kill $nginx_pid
            wait $nginx_pid 2>/dev/null || true
            return 1
        fi
    else
        log_error "Failed to issue certificate"
        kill $nginx_pid
        wait $nginx_pid 2>/dev/null || true
        return 1
    fi

    # 停止临时nginx服务器
    log_info "Stopping temporary HTTP server"
    kill $nginx_pid
    wait $nginx_pid 2>/dev/null || true
}

# 设置自动续签
setupAutoRenewal() {
    log_info "Setting up auto-renewal cron job"

    local cron_job="0 2 * * * /root/.acme.sh/acme.sh --cron --home /root/.acme.sh > /proc/1/fd/1 2>/proc/1/fd/2"

    # 获取当前crontab并添加新任务（避免覆盖用户已有的任务）
    local current_crontab
    current_crontab=$(crontab -l 2>/dev/null | grep -v "acme.sh --cron" || true)
    echo -e "$current_crontab\n$cron_job" | crontab -

    log_info "Auto-renewal cron job added"
}

# 主函数
main() {
    log_info "Starting Nginx configuration script"

    # 检查依赖
    check_dependencies

    # 确保目录存在
    ensure_directories

    # 检查端口可用性
    if ! check_port_availability 80; then
        log_error "Port 80 is already in use"
        exit 1
    fi

    if [[ -n "$DOMAIN" ]] && ! check_port_availability 443; then
        log_error "Port 443 is already in use"
        exit 1
    fi

    # ================================
    # 模式 1：未提供 DOMAIN → 仅运行普通 HTTP Nginx
    # ================================
    if [[ -z "$DOMAIN" ]]; then
        log_info "DOMAIN not set. Running Nginx in HTTP-only mode (port 80)."
        log_info "No ACME, no HTTPS, no auto-redirect."

        addHttpConf
        exec nginx -g 'daemon off;'
    fi

    # ================================
    # 模式 2：提供 DOMAIN → 启用 ACME + HTTPS
    # ================================
    if ! validate_domain "$DOMAIN"; then
        exit 1
    fi

    log_info "Domain: $DOMAIN"
    log_info "Email: ${EMAIL:-not set}"

    # 设置环境变量
    export HOME=/root
    [[ -n "$EMAIL" ]] && export ACCOUNT_EMAIL="$EMAIL"

    # 创建challenge目录
    mkdir -p /var/www/acme-challenge

    # 检查并安装acme.sh
    checkAcme

    # 申请证书
    requestCertificate || {
        log_error "Failed to get certificate"
        exit 1
    }

    # 添加HTTPS配置
    addHttpsConf

    # 设置自动续签
    setupAutoRenewal

    # 启动cron服务
    log_info "Starting cron service"
    cron

    # 启动nginx
    log_info "Starting nginx server"
    exec nginx -g 'daemon off;'
}

# 脚本入口点
if [[ "${action:0:1}" == "/" ]]; then
    # 执行传入的命令
    "$@"
elif [[ "$action" == "bash" || "$action" == "sh" ]]; then
    # 启动bash shell
    exec bash
elif [[ "$action" == "sleep" ]]; then
    # 休眠模式
    log_info "Sleeping for 365 days"
    exec sleep 31536000
elif [[ "$action" == "status" ]]; then
    # 检查状态
    log_info "Checking nginx status..."
    if nginx -t 2>/dev/null; then
        log_info "Nginx configuration is valid"
    else
        log_error "Nginx configuration is invalid"
        exit 1
    fi

    if [[ -n "$DOMAIN" ]]; then
        log_info "Checking certificate status for $DOMAIN..."
        if [[ -f "${CERT_DIR}.pem" ]]; then
            cert_exp_date=$(openssl x509 -in "${CERT_DIR}.pem" -noout -enddate | cut -d= -f2)
            log_info "Certificate expires on: $cert_exp_date"
        else
            log_warn "Certificate file not found"
        fi
    fi
elif [[ "$action" == "renew" ]]; then
    # 手动续签证书
    log_info "Manually renewing certificate for $DOMAIN..."
    if [[ -n "$DOMAIN" ]]; then
        checkAcme
        if $ACME_CMD --renew ${service} -d "$DOMAIN" --home /root/.acme.sh; then
            log_info "Certificate renewed successfully"
            nginx -s reload
        else
            log_error "Failed to renew certificate"
            exit 1
        fi
    else
        log_error "DOMAIN not set, cannot renew certificate"
        exit 1
    fi
else
    # 默认执行主函数
    main
fi



