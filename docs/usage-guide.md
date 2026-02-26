---
layout: default
title: Usage Guide
nav_order: 4
description: "How to create and manage backups"
---
 # 使用指南：创建备份

 本指南演示如何使用 Borg Web UI 创建备份。主要有两种备份方式：

 1. 本地备份（Local Backups）——备份到宿主机可访问的存储（USB、NAS 等）
 2. SSH/远程备份（SSH/Remote Backups）——通过 SSH 备份到远程服务器

 两者的工作流相同，差别在于：SSH 方式需要配置 SSH 密钥。

 ---

 ## 目录

 - [备份类型说明](#understanding-backup-types)
 - [先决条件](#prerequisites)
 - [方法 1：本地备份（适合入门）](#method-1-local-backups-recommended-for-beginners)
 - [方法 2：SSH/远程备份](#method-2-sshremote-backups)
 - [运行第一次备份](#running-your-first-backup)
 - [定时自动备份](#scheduling-automated-backups)
 - [从备份恢复](#restoring-from-backups)

 ---

 ## 备份类型说明

 ### 本地备份

 定义：将备份数据存储在宿主机可直接访问的存储上。

 适用场景：外接 USB、通过 NFS/CIFS 挂载的 NAS、额外硬盘、同机备份等。

 优点：配置简单（无需 SSH 密钥）、速度快（无网络开销）、可脱机使用、延迟低。

 缺点：无站外保护（主机故障时备份可能丢失）、需要物理存储。

 ---

 ### SSH/远程备份

 定义：通过 SSH 将备份存储到远程服务器。

 适用场景：远程 VPS/云主机、异地备份（如远程的 Raspberry Pi）、不支持 NFS 的存储服务器、企业环境等。

 优点：具有异地保护、无需挂载网络驱动、支持跨互联网备份、使用行业标准的安全协议。

 缺点：需要配置 SSH 密钥、通过互联网时速度较慢、需要远程服务器访问权限。

 ---

 ## 先决条件

 在创建备份前，请确保：

 1. Borg Web UI 正在运行（默认地址 `http://localhost:8081`）
 2. 已登录（默认账号：`admin` / `admin123`）
 3. 容器具有正确的权限（如有需要请设置 `PUID`/`PGID`，参见故障排查章节）

 ---

 ## 方法 1：本地备份（适合入门）

 ### 所需内容

 - 宿主机上的存储位置及其路径（例如 `/mnt/usb-drive`、`/mnt/nas`）

 ### 理解 `/local` 挂载

 关键点：容器会将宿主机路径挂载到容器内的 `/local`。

 默认情况下（开发示例）：宿主机 `/` → 容器 `/local`。

 示例转换：宿主机 `/home/user/backups` 在容器内为 `/local/home/user/backups`。

 可通过 `LOCAL_STORAGE_PATH` 环境变量进行自定义（参见配置文档）。

 ---

 ### 步骤 1：确保存储可写

 不需要手动创建仓库目录，Borg 在初始化时会自动创建所需目录。

 你需要确保：宿主机上的存储已挂载且容器用户对父目录具有写权限。

 常见父目录示例：`/mnt/usb-drive/`、`/mnt/nas/`、`/home/user/backups/`、macOS 的 `/Volumes/...`。

 如需修改权限（Linux）：
 ```bash
 sudo chown -R $(id -u):$(id -g) /mnt/usb-drive
 ls -la /mnt/usb-drive
 ```

 提示：保证 `docker-compose` 中的 `PUID`/`PGID` 与宿主用户一致以避免权限问题。

 ---

 ### 步骤 2：在 UI 中创建仓库

 仓库（repository）是 Borg 存放加密备份数据的地方。

 1. 打开侧边栏的 **Repositories**。
 2. 点击 **Create Repository**。
 3. 填写仓库信息：名称、容器内路径（必须以 `/local/` 前缀）、加密模式、口令（请妥善保存）。

 路径示例：宿主机 `/mnt/usb-drive/borg-backups/laptop` → 容器 `/local/mnt/usb-drive/borg-backups/laptop`。

 可选：配置压缩（推荐 `lz4` 或 `zstd,3`）。

 添加要备份的源路径（同样使用 `/local/...` 前缀）。

 点击 **Create Repository** 完成创建，页面会显示仓库状态（Active）。

 ---

 ### 步骤 3：运行第一次备份

 1. 打开侧边栏 **Backup**。
 2. 选择刚创建的仓库。
 3. 可选地添加排除规则（如 `.git`、`node_modules` 等）。
 4. 点击 **Start Backup**。

 实时查看：正在处理的文件、已处理文件数、原始/压缩/去重后大小、速度与预计剩余时间。

 完成后会显示处理统计、耗时与生成的归档名称。

 ---

 ### 安全地自定义挂载

 默认示例会把整个宿主机挂载到容器 `/local`，生产环境请仅挂载必要目录：

 ```yaml
 volumes:
   - /home/user/documents:/source:ro   # 备份源（只读）
   - /mnt/backup-drive:/destination:rw # 目标（读写）
 ```

 或使用环境变量：
 ```bash
 LOCAL_STORAGE_PATH=/home
 ```

 修改挂载后请在 UI 中使用相应的容器路径。

 ---

 ## 方法 2：SSH/远程备份

 ### 所需内容

 - 一台远程服务器（可通过 SSH 访问且已安装 Borg）
 - 备份目录的写权限
 - SSH 密钥对（可在 UI 中生成或导入）

 ### 步骤 1：生成或导入 SSH 密钥

 1. 打开侧边栏 **SSH Keys**。
 2. 点击 **Generate Key Pair**，填写名称与类型（推荐 `ed25519`）。
 3. 可下载私钥并妥善保存，拷贝公钥用于部署。

 ### 步骤 2：将公钥部署到远程服务器

 推荐使用 UI 的自动部署功能（填写主机、端口、用户名和一次性密码），或手动将公钥追加到远程服务器的 `~/.ssh/authorized_keys`。

 ### 步骤 3：测试连接

 在 SSH Keys 列表中使用 **Test Connection** 验证远程服务器可用。

 ### 步骤 4：确保远程服务器准备就绪

 需要：已安装 Borg，并对父目录有写权限；Borg 会在初始化时创建仓库目录。

touch ~/borg-backups/test && rm ~/borg-backups/test && echo "Permissions OK"

# Exit
exit
```

**Note:** You can skip creating directories - just ensure Borg is installed and you have write access to your home directory or wherever you plan to store repos.

---

### Step 5: Create SSH Repository in Borg Web UI

Now create a repository that uses SSH to store data remotely.

1. **Navigate to Repositories**
   Click **"Repositories"** in the sidebar

2. **Click "Create Repository"**

3. **Fill in Repository Details:**

   | Field | Example Value | Description |
   |-------|---------------|-------------|
   | **Repository Name** | `offsite-backup` | Friendly name |
   | **Repository Path** | `backupuser@192.168.1.100:borg-backups/myrepo` | SSH format: `user@host:path` |
   | **SSH Key** | `backup-server-key` | Select the key you created earlier |
   | **Encryption Mode** | `repokey-blake2` | Recommended |
   | **Passphrase** | `your-strong-password-456` | **Store safely!** |

   **SSH Path Format:**
   ```
   username@hostname:/absolute/path
   username@hostname:relative/path
   user@example.com:/home/user/backups/repo
   user@192.168.1.100:borg-backups/data
   ```

4. **Configure Compression** (Optional)
   - **Over Fast Network**: `lz4` (fast)
   - **Over Slow Network**: `zstd,3` (more compression = less data transferred)

5. **Add Source Paths**
   What to backup (same as local backups):
   ```
   /local/home/user/Documents
   /local/var/www/html
   /local/etc/nginx
   ```

6. **Click "Create Repository"**

7. **Success!**
   Repository is now active and ready for backups.

---

### Step 6: Run Your First SSH Backup

The process is **identical to local backups**:

1. **Navigate to Backup Tab**
2. **Select your SSH repository** (`offsite-backup`)
3. **Optional: Add exclude patterns**
4. **Click "Start Backup"**
5. **Watch real-time progress**

**Note:** SSH backups may be slower than local backups due to network speed, but Borg's deduplication minimizes data transfer after the first backup.

---

## Commonalities Between Local and SSH Backups

Both methods share the same workflow after repository creation:

### 1. **Backup Process** (Identical)
- Select repository
- Add exclude patterns
- Start backup
- Monitor progress
- View completion statistics

### 2. **Archive Management** (Identical)
- Browse backups in **Archives** tab
- View archive contents
- Restore files
- Delete old archives

### 3. **Scheduling** (Identical)
- Create scheduled jobs in **Schedule** tab
- Set cron expressions (daily, weekly, etc.)
- Monitor execution history

### 4. **Monitoring** (Identical)
- View backup history
- Download logs
- Check repository statistics

---

## Key Differences Summary

| Feature | Local Backups | SSH/Remote Backups |
|---------|---------------|-------------------|
| **Setup Complexity** | ⭐ Simple | ⭐⭐ Moderate (SSH key required) |
| **Speed** | 🚀 Fast | 🐌 Depends on network |
| **Off-site Protection** | ❌ No | ✅ Yes |
| **Storage** | Must be attached to host | Any SSH-accessible server |
| **Key Requirement** | ❌ None | ✅ SSH key needed |
| **Path Format** | `/local/path/to/repo` | `user@host:path/to/repo` |

---

## Running Your First Backup

Regardless of method (local or SSH), the backup process is the same:

### Using the Backup Tab (Manual Backup)

1. **Go to Backup Tab**
2. **Select Repository** from dropdown
3. **(Optional) Add Exclude Patterns:**
   ```
   **/.git
   **/node_modules
   **/__pycache__
   **/*.tmp
   **/*.log
   ```

4. **Click "Start Backup"**
5. **Monitor Progress:**
   - Current file being processed
   - Files processed
   - Original size vs compressed vs deduplicated
   - Backup speed and ETA

6. **Completion:**
   - View summary statistics
   - Download logs if needed

---

## Scheduling Automated Backups

Set up automated backups to run on a schedule:

### Step 1: Navigate to Schedule Tab

Click **"Schedule"** in the sidebar.

### Step 2: Create Scheduled Job

1. Click **"Create Job"**

2. Fill in details:

   | Field | Example | Description |
   |-------|---------|-------------|
   | **Job Name** | `Daily Documents Backup` | Descriptive name |
   | **Repository** | `my-laptop-backup` | Select your repository |
   | **Schedule** | `0 2 * * *` | Cron expression (2 AM daily) |
   | **Description** | `Backup documents every night` | Optional notes |
   | **Enabled** | ✅ | Start immediately |

3. **Use Preset Schedules:**
   Click the clock icon (⏰) to choose from presets:
   - Every 5 minutes
   - Every hour
   - Daily at 2 AM
   - Weekly on Sunday
   - Monthly on 1st

4. **Click "Create Job"**

### Step 3: Monitor Scheduled Jobs

- View **Next Run** time
- See **Last Run** status
- Check **Backup History** for execution logs

### Step 4: View Running Jobs

When a scheduled backup is running, you'll see it in the **"Running Scheduled Backups"** section with real-time progress.

---

## Restoring from Backups

### Step 1: Browse Archives

1. **Navigate to Archives Tab**
2. **Select Repository**
3. **View list of backups** (sorted by date)

### Step 2: Browse Archive Contents

1. Click **"Browse"** on any archive
2. Navigate through directories
3. Search for specific files

### Step 3: Extract Files

1. Select files/directories to restore
2. Click **"Extract Selected"**
3. Choose destination:
   - **Local**: `/local/home/user/restored-files`
   - **SSH**: Restore to remote server

4. Click **"Start Restore"**
5. Monitor progress

**🎉 Files restored!**

---

## Managing Job History

### Viewing Job History

All completed jobs (backups, restores, checks, compacts, prunes) are stored in the system and can be viewed in:

- **Backup Tab** - Recent backup jobs
- **Activity Tab** - All job types with filtering
- **Schedule Tab** - Execution history for scheduled jobs

Each job entry shows:
- Job ID and type
- Status (success, failed, cancelled)
- Start/end time and duration
- Log files (view or download)
- Error details (if failed)

### Deleting Job Entries (Admin Only)

{: .warning }
> **Admin Access Required:** Only administrator users can delete job entries. This feature is restricted to prevent accidental data loss.

**When to delete job entries:**
- Clean up test/failed backups
- Remove old job history
- Manage database size
- Remove sensitive log information

**What gets deleted:**
- ✅ Job entry from database
- ✅ Associated log files from disk
- ✅ All job metadata

{: .note }
> **Cannot be undone:** Deletion is permanent. Job history and logs cannot be recovered after deletion.

**How to delete a job:**

1. **Navigate to any job list** (Backup, Activity, or Schedule tab)
2. **Find the completed/failed job** you want to delete
3. **Click the trash icon (🗑️)** in the actions column
4. **Review the warning dialog**
5. **Click "Delete Permanently"** to confirm

**Restrictions:**
- ❌ Cannot delete running jobs - must cancel or wait for completion
- ❌ Cannot delete pending jobs - must cancel or wait for start
- ❌ Non-admin users cannot see delete button
- ❌ API returns 403 Forbidden if non-admin attempts deletion

**Example workflow:**
```
1. Admin user logs in
2. Goes to Activity tab
3. Filters for "Failed" jobs
4. Clicks trash icon on old failed job
5. Confirms deletion in dialog
6. Job removed from all lists
```

---

## Best Practices

### Security Considerations

1. **⚠️ Restrict Volume Mounts (Critical)** - Never use `/:/local:rw` in production. Mount only the specific directories you need:
   ```yaml
   volumes:
     # ✅ Recommended: Specific directories only
     - /home/user/documents:/local:ro          # Backup source (read-only)
     - /mnt/backup-drive:/local/backup:rw      # Backup destination (read-write)

     # ❌ NEVER in production:
     # - /:/local:rw  # Exposes entire filesystem - testing only!
   ```

2. **Use Read-Only Mounts for Sources** - Always mount backup sources as `:ro` to prevent accidental modifications or ransomware attacks

3. **Run as Non-Root User** - Set `PUID` and `PGID` to match your host user (not root) to avoid permission issues

4. **Audit Volume Mounts** - Before deploying to production, document and review every mounted directory

5. **Keep Software Updated** - Regularly update to the latest version for security patches and bug fixes

6. **Use Strong Passphrases** - Generate random passphrases (20+ characters) for both repository encryption and SSH keys

7. **Enable Notifications** - Configure alerts for backup failures and errors to catch issues early

8. **Test Restore Process** - Verify you can actually restore from backups before disaster strikes

See [Security Guide](security) for comprehensive security recommendations.

### For Local Backups

1. **Use external storage** - Don't backup to the same drive as your data
2. **Test restores regularly** - Backups are useless if you can't restore
3. **Consider off-site copies** - Add an SSH backup for critical data
4. **Monitor disk space** - Set up pruning/retention policies
5. **Restrict container access** - Mount only necessary directories (see Security Considerations above)

### For SSH Backups

1. **Use strong passphrases** - Both for SSH keys and repository encryption
2. **Keep SSH keys secure** - Download and store private keys safely
3. **Test connectivity first** - Use "Test Connection" before creating repositories
4. **Use compression** - Saves bandwidth over slow connections
5. **Dedicated backup user** - Create a separate SSH user on remote server

### General

1. **Never lose your passphrase** - Write it down, use a password manager
2. **Schedule backups during off-hours** - Reduces impact on system performance
3. **Use exclude patterns** - Don't backup cache, logs, or temporary files
4. **Monitor backup jobs** - Check logs regularly for errors
5. **Prune old archives** - Set retention policies to manage storage

---

## Troubleshooting

### Common Issues

#### "Permission denied" when creating repository

**Cause:** Docker user doesn't have write access to storage location.

**Solution:** Set `PUID`/`PGID` in docker-compose.yml:

```yaml
environment:
  - PUID=1000  # Your user ID (run: id -u)
  - PGID=1000  # Your group ID (run: id -g)
```

Restart container: `docker compose down && docker compose up -d`

---

#### SSH connection fails

**Causes:**
1. Public key not deployed correctly
2. Wrong hostname/port/username
3. Firewall blocking SSH
4. Remote server doesn't have Borg installed

**Solutions:**
1. Use **"Test Connection"** to diagnose
2. Verify `~/.ssh/authorized_keys` on remote server
3. Check firewall rules: `sudo ufw allow 22/tcp`
4. Install Borg: `sudo apt install borgbackup`

---

#### Backup is very slow

**For Local:**
- Check disk I/O performance
- Reduce compression level
- Exclude unnecessary files

**For SSH:**
- Use faster compression (`lz4` or `none`)
- Check network speed
- Consider initial backup over LAN, then move to remote location

---

#### "Repository not found" error

**Cause:** Path is incorrect or repository wasn't created successfully.

**Solution:**
1. Verify path format:
   - Local: `/local/mnt/usb-drive/backups/repo`
   - SSH: `user@host:backups/repo`

2. Check repository exists:
   ```bash
   # For local
   docker exec borg-web-ui ls -la /local/mnt/usb-drive/backups

   # For SSH
   ssh user@host ls -la ~/backups
   ```

3. Re-create repository if needed

---

## Next Steps

- **[Scheduling Guide](https://github.com/karanhudia/borg-ui#scheduling)** - Automate your backups
- **[Archives Browser](https://github.com/karanhudia/borg-ui#archive-browser)** - Browse and restore files
- **[API Documentation](http://localhost:8081/api/docs)** - Integrate with other tools
- **[Troubleshooting Guide](https://github.com/karanhudia/borg-ui#troubleshooting)** - Common issues

---

## Summary

### Local Backups in 3 Easy Steps:
1. **Ensure storage is accessible** (USB drive, NAS mount, etc.) with write permissions
2. **Create repository** in UI using `/local/path/to/repo` - Borg auto-creates the directory!
3. **Run backup** - no SSH key needed!

### SSH Backups in 6 Easy Steps:
1. **Generate SSH key** in UI (one click)
2. **Deploy public key** to remote server (automatic or manual)
3. **Test connection** (verify it works)
4. **Ensure Borg is installed** on remote server
5. **Create repository** in UI using `user@host:path` - Borg auto-creates the directory!
6. **Run backup**

**The difference?** Just the SSH key setup. Everything else is identical!

**Pro tip:** Borg automatically creates repository directories when you initialize them - no manual `mkdir` needed!

---

**Need Help?**
- 📖 [Full Documentation](https://karanhudia.github.io/borg-ui)
- 🐛 [Report Issues](https://github.com/karanhudia/borg-ui/issues)
- 💬 [GitHub Discussions](https://github.com/karanhudia/borg-ui/discussions)
