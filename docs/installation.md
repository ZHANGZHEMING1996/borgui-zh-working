---
layout: default
title: Installation
nav_order: 2
description: "How to install Borg Web UI on various platforms"
---
 (translated content omitted in this patch display)
      - "8081:8081"
    volumes:
      - borg_data:/data
      - borg_cache:/home/borg/.cache/borg
      - /home/yourusername:/local:rw  # Replace with your path
      # Add this line for Docker container management:
      - /var/run/docker.sock:/var/run/docker.sock:rw
    environment:
      - TZ=America/Chicago
      - PUID=1000
      - PGID=1000
```

Restart the container:
```bash
docker compose down
docker compose up -d
```

#### Usage

Once enabled, you can use pre/post backup scripts in your repository configuration to control containers:

**Pre-backup script example:**
```bash
#!/bin/bash
# Install Docker CLI if not present
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
fi

# Stop database container
docker stop postgres-db
```

**Post-backup script example:**
```bash
#!/bin/bash
# Restart database container
docker start postgres-db
```

See the **[Docker Container Hooks Guide](../docs/docker-hooks.md)** for detailed examples, security considerations, and best practices.

---

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker logs borg-web-ui
```

### Port Already in Use

Change the port:
```yaml
ports:
  - "8082:8081"
```

### Permission Denied Errors

Match your host user ID:
```yaml
environment:
  - PUID=1000
  - PGID=1000
```

Find your IDs: `id -u && id -g`

### Cannot Access Web Interface

Check firewall rules:
```bash
# Linux
sudo ufw allow 8081

# Check container is running
docker ps | grep borg-web-ui
```

### Wrong Timestamps in Archives

If archive timestamps show UTC instead of your local time:

```yaml
environment:
  - TZ=Asia/Kolkata  # Add your timezone
```

Then restart:
```bash
docker compose down && docker compose up -d
```

Verify:
```bash
docker exec borg-web-ui date
```

---

## Uninstallation

### Remove Container

```bash
docker compose down
# or
docker stop borg-web-ui && docker rm borg-web-ui
```

### Remove Data (Optional)

```bash
# WARNING: This deletes all application data
docker volume rm borg_data borg_cache
```

---

## Next Steps

- [Configuration Guide](configuration.md) - Customize your setup
- [Usage Guide](usage-guide.md) - Create your first backup
- [Notifications Setup](notifications.md) - Get alerts for backup events
