import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sshKeysAPI } from '../services/api'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Tooltip,
  InputAdornment,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import {
  Key,
  Copy,
  RefreshCw,
  Wifi,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import RemoteMachineCard from '../components/RemoteMachineCard'
import { useMatomo } from '../hooks/useMatomo'

interface StorageInfo {
  total: number
  total_formatted: string
  used: number
  used_formatted: string
  available: number
  available_formatted: string
  percent_used: number
  last_check?: string | null
}

interface SSHConnection {
  id: number
  ssh_key_id: number
  ssh_key_name: string
  host: string
  username: string
  port: number
  use_sftp_mode: boolean
  default_path?: string
  mount_point?: string
  status: string
  last_test?: string
  last_success?: string
  error_message?: string
  storage?: StorageInfo | null
  created_at: string
}

export default function SSHConnectionsSingleKey() {
  const queryClient = useQueryClient()
  const { track, EventCategory, EventAction } = useMatomo()

  // State
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [testConnectionDialogOpen, setTestConnectionDialogOpen] = useState(false)
  const [editConnectionDialogOpen, setEditConnectionDialogOpen] = useState(false)
  const [deleteConnectionDialogOpen, setDeleteConnectionDialogOpen] = useState(false)
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false)
  const [redeployKeyDialogOpen, setRedeployKeyDialogOpen] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<SSHConnection | null>(null)
  const [keyType, setKeyType] = useState('ed25519')
  const [redeployPassword, setRedeployPassword] = useState('')
  const [importForm, setImportForm] = useState({
    name: 'System SSH Key',
    private_key_path: '',
    public_key_path: '',
    description: 'Imported system SSH key for all remote connections',
  })
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    username: '',
    port: 22,
    password: '',
    use_sftp_mode: true,
    default_path: '',
    mount_point: '',
  })
  const [testConnectionForm, setTestConnectionForm] = useState({
    host: '',
    username: '',
    port: 22,
  })
  const [editConnectionForm, setEditConnectionForm] = useState({
    host: '',
    username: '',
    port: 22,
    use_sftp_mode: true,
    default_path: '',
    mount_point: '',
  })

  // Queries
  const { data: systemKeyData, isLoading: keyLoading } = useQuery({
    queryKey: ['system-ssh-key'],
    queryFn: sshKeysAPI.getSystemKey,
    refetchInterval: 30000,
  })

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ['ssh-connections'],
    queryFn: sshKeysAPI.getSSHConnections,
    refetchInterval: 30000,
  })

  const systemKey = systemKeyData?.data?.ssh_key
  const keyExists = systemKeyData?.data?.exists
  const connections: SSHConnection[] = connectionsData?.data?.connections || []

  // Statistics
  const stats = {
    totalConnections: connections.length,
    activeConnections: connections.filter((c) => c.status === 'connected').length,
    failedConnections: connections.filter((c) => c.status === 'failed').length,
  }

  // Mutations
  const generateKeyMutation = useMutation({
    mutationFn: (data: { name: string; key_type: string; description?: string }) =>
      sshKeysAPI.generateSSHKey(data),
    onSuccess: () => {
      toast.success('系统 SSH 密钥已生成！')
      queryClient.invalidateQueries({ queryKey: ['system-ssh-key'] })
      setGenerateDialogOpen(false)
      track(EventCategory.SSH, EventAction.CREATE, 'key')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to generate SSH key:', error)
      toast.error(error.response?.data?.detail || 'Failed to generate SSH key')
    },
  })

  const importKeyMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: any) => sshKeysAPI.importSSHKey(data),
    onSuccess: () => {
      toast.success('系统 SSH 密钥导入成功！')
      queryClient.invalidateQueries({ queryKey: ['system-ssh-key'] })
      setImportDialogOpen(false)
      setImportForm({
        name: 'System SSH Key',
        private_key_path: '',
        public_key_path: '',
        description: 'Imported system SSH key for all remote connections',
      })
      track(EventCategory.SSH, EventAction.UPLOAD, 'key')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to import SSH key:', error)
      toast.error(error.response?.data?.detail || '导入 SSH 密钥失败')
    },
  })

  const deployKeyMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: { keyId: number; connectionData: any }) =>
      sshKeysAPI.deploySSHKey(data.keyId, data.connectionData),
    onSuccess: () => {
      toast.success('SSH 密钥部署成功！')
      queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
      setDeployDialogOpen(false)
      setConnectionForm({
        host: '',
        username: '',
        port: 22,
        password: '',
        use_sftp_mode: true,
        default_path: '',
        mount_point: '',
      })
      track(EventCategory.SSH, EventAction.CREATE, 'connection')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to deploy SSH key:', error)
      toast.error(error.response?.data?.detail || '部署 SSH 密钥失败')
    },
  })

  const testConnectionMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: { keyId: number; connectionData: any }) =>
      sshKeysAPI.testSSHConnection(data.keyId, data.connectionData),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success('连接测试成功！')
        track(EventCategory.SSH, EventAction.CREATE, 'connection')
      } else {
        toast.error('连接测试失败')
      }
      queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to test connection:', error)
      toast.error(error.response?.data?.detail || '连接测试失败')
    },
  })

  const updateConnectionMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: { connectionId: number; connectionData: any }) =>
      sshKeysAPI.updateSSHConnection(data.connectionId, data.connectionData),
    onSuccess: async (_response, variables) => {
      toast.success('连接更新成功！正在测试连接...')
      setEditConnectionDialogOpen(false)
      setSelectedConnection(null)
      track(EventCategory.SSH, EventAction.EDIT, 'connection')

      // Automatically test the connection after update
      try {
        await sshKeysAPI.testExistingConnection(variables.connectionId)
        queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // Test failure is already shown in the connection status
        console.error('Failed to test connection:', error)
        queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to update connection:', error)
      toast.error(error.response?.data?.detail || '更新连接失败')
    },
  })

  const deleteConnectionMutation = useMutation({
    mutationFn: (connectionId: number) => sshKeysAPI.deleteSSHConnection(connectionId),
    onSuccess: () => {
      toast.success('连接删除成功！')
      queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
      setDeleteConnectionDialogOpen(false)
      setSelectedConnection(null)
      track(EventCategory.SSH, EventAction.DELETE, 'connection')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to delete connection:', error)
      toast.error(error.response?.data?.detail || '删除连接失败')
    },
  })

  const refreshStorageMutation = useMutation({
    mutationFn: (connectionId: number) => sshKeysAPI.refreshConnectionStorage(connectionId),
    onSuccess: () => {
      toast.success('存储信息已刷新！')
      queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
      track(EventCategory.SSH, EventAction.VIEW, 'storage')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to refresh storage:', error)
      toast.error(error.response?.data?.detail || '刷新存储信息失败')
    },
  })

  const testExistingConnectionMutation = useMutation({
    mutationFn: (connectionId: number) => sshKeysAPI.testExistingConnection(connectionId),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success('连接测试成功！')
      } else {
        toast.error(response.data.error || '连接测试失败')
      }
      queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
      track(EventCategory.SSH, EventAction.TEST, 'connection')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to test connection:', error)
      toast.error(error.response?.data?.detail || '测试连接失败')
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: number) => sshKeysAPI.deleteSSHKey(keyId),
    onSuccess: () => {
      toast.success('系统 SSH 密钥删除成功！')
      queryClient.invalidateQueries({ queryKey: ['system-ssh-key'] })
      queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
      setDeleteKeyDialogOpen(false)
      track(EventCategory.SSH, EventAction.DELETE, 'key')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to delete SSH key:', error)
      toast.error(error.response?.data?.detail || '删除 SSH 密钥失败')
    },
  })

  const redeployKeyMutation = useMutation({
    mutationFn: ({ connectionId, password }: { connectionId: number; password: string }) =>
      sshKeysAPI.redeployKeyToConnection(connectionId, password),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success('SSH 密钥部署成功！')
        queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
        setRedeployKeyDialogOpen(false)
        setRedeployPassword('')
        track(EventCategory.SSH, EventAction.START, 'deploy')
      } else {
        toast.error(response.data.error || '部署 SSH 密钥失败')
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Failed to redeploy SSH key:', error)
      toast.error(error.response?.data?.detail || '重新部署 SSH 密钥失败')
    },
  })

  // Auto-refresh storage for connections without storage info
  useEffect(() => {
    if (connections && connections.length > 0) {
      const connectionsWithoutStorage = connections.filter((conn) => !conn.storage)

      if (connectionsWithoutStorage.length > 0) {
        // Refresh storage for each connection without storage (silently)
        connectionsWithoutStorage.forEach((conn) => {
          sshKeysAPI.refreshConnectionStorage(conn.id).catch(() => {
            // Silently fail - will show "No storage info" in card
          })
        })

        // Invalidate query after delay to show updated data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })
        }, 2000)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections?.length])

  // Handlers
  const handleGenerateKey = () => {
    generateKeyMutation.mutate({
      name: 'System SSH Key',
      key_type: keyType,
      description: 'System SSH key for all remote connections',
    })
  }

  const handleImportKey = () => {
    importKeyMutation.mutate(importForm)
  }

  const handleCopyPublicKey = () => {
    if (systemKey?.public_key) {
      navigator.clipboard.writeText(systemKey.public_key)
      toast.success('Public key copied to clipboard!')
    }
  }

  const handleDeployKey = () => {
    if (!systemKey) return
    deployKeyMutation.mutate({
      keyId: systemKey.id,
      connectionData: connectionForm,
    })
  }

  const handleTestManualConnection = () => {
    if (!systemKey) return
    testConnectionMutation.mutate({
      keyId: systemKey.id,
      connectionData: testConnectionForm,
    })
    setTestConnectionDialogOpen(false)
    setTestConnectionForm({ host: '', username: '', port: 22 })
  }

  const handleEditConnection = (connection: SSHConnection) => {
    setSelectedConnection(connection)
    setEditConnectionForm({
      host: connection.host,
      username: connection.username,
      port: connection.port,
      use_sftp_mode: connection.use_sftp_mode,
      default_path: connection.default_path || '',
      mount_point: connection.mount_point || '',
    })
    setEditConnectionDialogOpen(true)
  }

  const handleUpdateConnection = () => {
    if (!selectedConnection) return
    updateConnectionMutation.mutate({
      connectionId: selectedConnection.id,
      connectionData: editConnectionForm,
    })
  }

  const handleDeleteConnection = (connection: SSHConnection) => {
    setSelectedConnection(connection)
    setDeleteConnectionDialogOpen(true)
  }

  const confirmDeleteConnection = () => {
    if (!selectedConnection) return
    deleteConnectionMutation.mutate(selectedConnection.id)
  }

  const handleTestConnection = (connection: SSHConnection) => {
    testExistingConnectionMutation.mutate(connection.id)
  }

  const handleDeployKeyToConnection = (connection: SSHConnection) => {
    setSelectedConnection(connection)
    setRedeployKeyDialogOpen(true)
  }

  const handleConfirmRedeployKey = () => {
    if (!selectedConnection || !redeployPassword) return
    redeployKeyMutation.mutate({
      connectionId: selectedConnection.id,
      password: redeployPassword,
    })
  }

  const handleDeleteKey = () => {
    if (!systemKey) return
    deleteKeyMutation.mutate(systemKey.id)
  }

  if (keyLoading || connectionsLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress size={60} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          远程主机
        </Typography>
        <Typography variant="body2" color="text.secondary">
          管理远程主机，支持存储监控和逻辑挂载点
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight={500}>
          单密钥系统
        </Typography>
        <Typography variant="caption">
          本系统对所有远程连接使用同一把 SSH 密钥。生成系统密钥后，可将其部署到多个远程服务器。
        </Typography>
      </Alert>

      {/* Statistics Cards */}
      {keyExists && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    bgcolor: 'primary.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <Wifi size={24} color="#ffffff" strokeWidth={1.5} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    总连接数
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {stats.totalConnections}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    bgcolor: 'success.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <CheckCircle size={24} color="#ffffff" strokeWidth={1.5} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    活跃
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {stats.activeConnections}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    bgcolor: 'error.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <XCircle size={24} color="#ffffff" strokeWidth={1.5} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    失败
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {stats.failedConnections}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* System SSH Key Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Key size={24} />
            <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
              系统 SSH 密钥
            </Typography>
            {keyExists && (
              <Chip label="已激活" color="success" size="small" icon={<CheckCircle size={14} />} />
            )}
          </Stack>

          {!keyExists ? (
            // No key exists - show generation UI
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                未找到系统 SSH 密钥。请生成新的或导入现有密钥以开始连接远程服务器。
              </Alert>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<Plus size={18} />}
                  onClick={() => setGenerateDialogOpen(true)}
                >
                  生成系统 SSH 密钥
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Key size={18} />}
                  onClick={() => setImportDialogOpen(true)}
                >
                  导入现有密钥
                </Button>
              </Stack>
            </Box>
          ) : (
            // Key exists - show key details
            <Box>
              <Stack spacing={2}>
                {/* Key Type */}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    密钥类型
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {systemKey?.key_type?.toUpperCase() || 'Unknown'}
                  </Typography>
                </Box>

                {/* Fingerprint */}
                {systemKey?.fingerprint && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      指纹
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        wordBreak: 'break-all',
                      }}
                    >
                      {systemKey.fingerprint}
                    </Typography>
                  </Box>
                )}

                {/* Public Key */}
                <Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 0.5 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      公钥
                    </Typography>
                    <Tooltip title="复制到剪贴板">
                      <IconButton size="small" onClick={handleCopyPublicKey} sx={{ ml: 1 }}>
                        <Copy size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Box
                    sx={{
                      bgcolor: 'background.default',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        wordBreak: 'break-all',
                        maxHeight: '100px',
                        overflow: 'auto',
                      }}
                    >
                      {systemKey?.public_key || 'N/A'}
                    </Typography>
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Tooltip title="使用密码自动部署 SSH 密钥">
                    <Button
                      variant="contained"
                      startIcon={<Plus size={18} />}
                      onClick={() => setDeployDialogOpen(true)}
                    >
                      部署到服务器
                    </Button>
                  </Tooltip>
                  <Tooltip title="为手动部署的 SSH 密钥添加连接">
                    <Button
                      variant="outlined"
                      startIcon={<Wifi size={18} />}
                      onClick={() => setTestConnectionDialogOpen(true)}
                    >
                      添加手动连接
                    </Button>
                  </Tooltip>
                  <Tooltip title="将公钥复制到剪贴板">
                    <Button
                      variant="outlined"
                      startIcon={<Copy size={18} />}
                      onClick={handleCopyPublicKey}
                    >
                      复制密钥
                    </Button>
                  </Tooltip>
                  <Tooltip title="删除系统 SSH 密钥（连接记录将保留）">
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Trash2 size={18} />}
                      onClick={() => setDeleteKeyDialogOpen(true)}
                    >
                      删除密钥
                    </Button>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Connections Table */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              远程连接
            </Typography>
            <Tooltip title="刷新连接">
              <IconButton
                size="small"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['ssh-connections'] })}
              >
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          </Stack>

          {!keyExists && connections.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              未配置 SSH 密钥。生成或导入密钥以测试这些连接。
            </Alert>
          )}

          {connections.length === 0 ? (
            <Alert severity="info">
              {keyExists
                ? '尚无连接。将您的 SSH 密钥部署到远程服务器以开始使用。'
                : '尚无连接。请先生成或导入 SSH 密钥，然后将其部署到远程服务器。'}
            </Alert>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                },
                gap: 3,
              }}
            >
              {connections.map((connection) => (
                <RemoteMachineCard
                  key={connection.id}
                  machine={connection}
                  onEdit={handleEditConnection}
                  onDelete={handleDeleteConnection}
                  onRefreshStorage={(machine) => refreshStorageMutation.mutate(machine.id)}
                  onTestConnection={handleTestConnection}
                  onDeployKey={handleDeployKeyToConnection}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Generate Key Dialog */}
      <Dialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>生成系统 SSH 密钥</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              这将为系统生成一对新的 SSH 密钥。每次仅允许存在一把系统密钥。
            </Alert>

            <FormControl fullWidth>
              <InputLabel>密钥类型</InputLabel>
              <Select value={keyType} label="密钥类型" onChange={(e) => setKeyType(e.target.value)}>
                <MenuItem value="ed25519">ED25519（推荐）</MenuItem>
                <MenuItem value="rsa">RSA</MenuItem>
                <MenuItem value="ecdsa">ECDSA</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleGenerateKey}
            disabled={generateKeyMutation.isPending}
          >
            {generateKeyMutation.isPending ? '生成中...' : '生成密钥'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Key Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>导入已有 SSH 密钥</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              从文件系统导入已有的 SSH 密钥（例如挂载的卷）。密钥将从指定路径读取并保存到数据库。
            </Alert>

            <TextField
              label="密钥名称"
              fullWidth
              value={importForm.name}
              onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
              placeholder="系统 SSH 密钥"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="私钥路径"
              fullWidth
              required
              value={importForm.private_key_path}
              onChange={(e) => setImportForm({ ...importForm, private_key_path: e.target.value })}
              placeholder="/home/borg/.ssh/id_ed25519 or /root/.ssh/id_rsa"
              helperText="私钥文件的绝对路径"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="公钥路径（可选）"
              fullWidth
              value={importForm.public_key_path}
              onChange={(e) => setImportForm({ ...importForm, public_key_path: e.target.value })}
              placeholder="Leave empty to auto-detect (adds .pub to private key path)"
              helperText="如果未提供，将尝试使用 {private_key_path}.pub"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="描述"
              fullWidth
              value={importForm.description}
              onChange={(e) => setImportForm({ ...importForm, description: e.target.value })}
              placeholder="导入的系统 SSH 密钥"
              InputLabelProps={{ shrink: true }}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleImportKey}
            disabled={importKeyMutation.isPending || !importForm.private_key_path}
          >
            {importKeyMutation.isPending ? '导入中...' : '导入密钥'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deploy Key Dialog */}
      <Dialog
        open={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>将 SSH 密钥部署到服务器</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="主机"
              fullWidth
              value={connectionForm.host}
              onChange={(e) => setConnectionForm({ ...connectionForm, host: e.target.value })}
              placeholder="192.168.1.100 或 example.com"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="用户名"
              fullWidth
              value={connectionForm.username}
              onChange={(e) => setConnectionForm({ ...connectionForm, username: e.target.value })}
              placeholder="root"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="端口"
              type="number"
              fullWidth
              value={connectionForm.port}
              onChange={(e) =>
                setConnectionForm({
                  ...connectionForm,
                  port: parseInt(e.target.value),
                })
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="密码"
              type="password"
              fullWidth
              value={connectionForm.password}
              onChange={(e) => setConnectionForm({ ...connectionForm, password: e.target.value })}
              placeholder="服务器密码（用于初始部署）"
              InputLabelProps={{ shrink: true }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="密码仅用于一次性部署密钥">
                      <AlertTriangle size={18} />
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={connectionForm.use_sftp_mode}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, use_sftp_mode: e.target.checked })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body2">在部署密钥时使用 SFTP 模式</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hetzner Storage Box 需要启用。对于 Synology NAS 或旧版 SSH 服务器请禁用。
                  </Typography>
                </Box>
              }
            />
            <TextField
              label="默认路径（可选）"
              fullWidth
              value={connectionForm.default_path}
              onChange={(e) =>
                setConnectionForm({ ...connectionForm, default_path: e.target.value })
              }
              placeholder="/home"
              helperText="SSH 文件浏览的起始目录（例如 Hetzner Storage Box 使用 /home）"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="挂载点（可选）"
              fullWidth
              value={connectionForm.mount_point}
              onChange={(e) =>
                setConnectionForm({ ...connectionForm, mount_point: e.target.value })
              }
              placeholder="hetzner 或 homeserver"
              helperText="此远程主机的友好名称（例如 hetzner、backup-server）"
              InputLabelProps={{ shrink: true }}
            />
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              密码用于将公钥部署到服务器的 authorized_keys 文件。部署完成后，将使用 SSH 密钥进行连接。
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeployKey}
            disabled={
              deployKeyMutation.isPending ||
              !connectionForm.host ||
              !connectionForm.username ||
              !connectionForm.password
            }
          >
            {deployKeyMutation.isPending ? '部署中...' : '部署密钥'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Manual Connection Dialog */}
      <Dialog
        open={testConnectionDialogOpen}
        onClose={() => setTestConnectionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>添加手动连接</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Before adding this connection:
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                1. Copy the public key from above
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                2. SSH into your server
              </Typography>
              <Typography variant="caption" component="div">
                3. Add it to{' '}
                <code style={{ background: '#e3f2fd', padding: '2px 4px', borderRadius: '2px' }}>
                  ~/.ssh/authorized_keys
                </code>
              </Typography>
            </Alert>

            <TextField
              label="Host"
              fullWidth
              value={testConnectionForm.host}
              onChange={(e) =>
                setTestConnectionForm({ ...testConnectionForm, host: e.target.value })
              }
              placeholder="192.168.1.100 or example.com"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Username"
              fullWidth
              value={testConnectionForm.username}
              onChange={(e) =>
                setTestConnectionForm({
                  ...testConnectionForm,
                  username: e.target.value,
                })
              }
              placeholder="root"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Port"
              type="number"
              fullWidth
              value={testConnectionForm.port}
              onChange={(e) =>
                setTestConnectionForm({
                  ...testConnectionForm,
                  port: parseInt(e.target.value),
                })
              }
              InputLabelProps={{ shrink: true }}
            />

            <Alert severity="success" sx={{ fontSize: '0.85rem' }}>
              This will test the connection and add it to your connections list if successful.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestConnectionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleTestManualConnection}
            disabled={
              testConnectionMutation.isPending ||
              !testConnectionForm.host ||
              !testConnectionForm.username
            }
          >
            {testConnectionMutation.isPending ? 'Testing...' : 'Test & Add Connection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Connection Dialog */}
      <Dialog
        open={editConnectionDialogOpen}
        onClose={() => {
          setEditConnectionDialogOpen(false)
          setSelectedConnection(null)
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>编辑 SSH 连接</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Host"
              fullWidth
              value={editConnectionForm.host}
              onChange={(e) =>
                setEditConnectionForm({
                  ...editConnectionForm,
                  host: e.target.value,
                })
              }
              placeholder="192.168.1.100 or example.com"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Username"
              fullWidth
              value={editConnectionForm.username}
              onChange={(e) =>
                setEditConnectionForm({
                  ...editConnectionForm,
                  username: e.target.value,
                })
              }
              placeholder="root"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Port"
              type="number"
              fullWidth
              value={editConnectionForm.port}
              onChange={(e) =>
                setEditConnectionForm({
                  ...editConnectionForm,
                  port: parseInt(e.target.value),
                })
              }
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editConnectionForm.use_sftp_mode}
                  onChange={(e) =>
                    setEditConnectionForm({
                      ...editConnectionForm,
                      use_sftp_mode: e.target.checked,
                    })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Use SFTP mode for key deployment</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Required by Hetzner Storage Box. Disable for Synology NAS or older SSH servers.
                  </Typography>
                </Box>
              }
            />
            <TextField
              label="Default Path (Optional)"
              fullWidth
              value={editConnectionForm.default_path}
              onChange={(e) =>
                setEditConnectionForm({
                  ...editConnectionForm,
                  default_path: e.target.value,
                })
              }
              placeholder="/home"
              helperText="Starting directory for SSH file browsing (e.g., /home for Hetzner Storage Box)"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Mount Point (Optional)"
              fullWidth
              value={editConnectionForm.mount_point}
              onChange={(e) =>
                setEditConnectionForm({
                  ...editConnectionForm,
                  mount_point: e.target.value,
                })
              }
              placeholder="hetzner or homeserver"
              helperText="Friendly name for this remote machine (e.g., hetzner, backup-server)"
              InputLabelProps={{ shrink: true }}
            />
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              Update the connection details. You may want to test the connection after updating.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditConnectionDialogOpen(false)
              setSelectedConnection(null)
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateConnection}
            disabled={
              updateConnectionMutation.isPending ||
              !editConnectionForm.host ||
              !editConnectionForm.username
            }
          >
            {updateConnectionMutation.isPending ? 'Updating...' : 'Update Connection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Connection Dialog */}
      <Dialog
        open={deleteConnectionDialogOpen}
        onClose={() => {
          setDeleteConnectionDialogOpen(false)
          setSelectedConnection(null)
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>删除 SSH 连接</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to delete this connection?
          </Alert>
          {selectedConnection && (
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Host:</strong> {selectedConnection.host}
              </Typography>
              <Typography variant="body2">
                <strong>Username:</strong> {selectedConnection.username}
              </Typography>
              <Typography variant="body2">
                <strong>Port:</strong> {selectedConnection.port}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteConnectionDialogOpen(false)
              setSelectedConnection(null)
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteConnection}
            disabled={deleteConnectionMutation.isPending}
          >
            {deleteConnectionMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Redeploy Key Dialog */}
      <Dialog
        open={redeployKeyDialogOpen}
        onClose={() => {
          setRedeployKeyDialogOpen(false)
          setSelectedConnection(null)
          setRedeployPassword('')
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>将 SSH 密钥部署到连接</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              This will deploy your current system SSH key to this connection. You'll need to
              provide the password to authenticate.
            </Alert>
            {selectedConnection && (
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Host:</strong> {selectedConnection.host}
                </Typography>
                <Typography variant="body2">
                  <strong>Username:</strong> {selectedConnection.username}
                </Typography>
                <Typography variant="body2">
                  <strong>Port:</strong> {selectedConnection.port}
                </Typography>
              </Box>
            )}
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={redeployPassword}
              onChange={(e) => setRedeployPassword(e.target.value)}
              placeholder="Enter SSH password"
              helperText="Password is used to deploy the public key to authorized_keys"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRedeployKeyDialogOpen(false)
              setSelectedConnection(null)
              setRedeployPassword('')
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmRedeployKey}
            disabled={redeployKeyMutation.isPending || !redeployPassword}
          >
            {redeployKeyMutation.isPending ? 'Deploying...' : 'Deploy Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete SSH Key Dialog */}
      <Dialog
        open={deleteKeyDialogOpen}
        onClose={() => setDeleteKeyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>删除系统 SSH 密钥</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning" sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Are you sure you want to delete this SSH key?
              </Typography>
            </Alert>

            {systemKey && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Key Name:</strong> {systemKey.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Key Type:</strong> {systemKey.key_type?.toUpperCase()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Active Connections:</strong> {connections.length}
                  </Typography>
                  {systemKey.fingerprint && (
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}
                    >
                      <strong>Fingerprint:</strong> {systemKey.fingerprint}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This action will:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Remove the SSH key from database and filesystem
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Mark {connections.length} connection(s) as failed
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Clear SSH key from any repositories using it
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Connection records will be preserved. Generate or import a new key, then deploy it
                to restore access.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteKeyDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteKey}
            disabled={deleteKeyMutation.isPending}
          >
            {deleteKeyMutation.isPending ? 'Deleting...' : 'Delete SSH Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
