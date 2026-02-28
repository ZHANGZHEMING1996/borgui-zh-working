# borgui-zh-working

## 打包 Docker 镜像

1. 确保已安装 Docker。
2. 在项目根目录下运行以下命令以构建 Docker 镜像：

   ```bash
   docker build -t borgui-zh-working .
   ```

## 运行 Docker 容器

1. 使用以下命令运行容器：

   ```bash
   docker run -d -p 8000:8000 --name borgui-container borgui-zh-working
   ```

   - `-d` 表示后台运行容器。
   - `-p 8000:8000` 将容器的 8000 端口映射到主机的 8000 端口。
   - `--name borgui-container` 为容器指定名称。

2. 打开浏览器并访问 `http://localhost:8000` 查看项目。

## 启动项目（开发模式）

1. 确保已安装 Python 和 Node.js。
2. 创建并激活虚拟环境：

   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows 上使用 venv\Scripts\activate
   ```

3. 安装 Python 依赖：

   ```bash
   pip install -r requirements.txt
   ```

4. 安装前端依赖：

   ```bash
   cd frontend
   npm install
   ```

5. 启动后端服务：

   ```bash
   uvicorn app.main:app --reload
   ```

6. 启动前端服务：

   ```bash
   npm run dev
   ```

7. 打开浏览器并访问 `http://localhost:3000` 查看项目。

