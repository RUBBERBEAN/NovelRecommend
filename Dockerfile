# 使用 Node.js 22 的轻量版 alpine 镜像
FROM node:22-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json（加快安装速度）
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有代码
COPY . .

# 暴露端口（Cloud Run 需要 8080）
EXPOSE 8080

# 启动 Webhook
CMD ["node", "index.js"]
