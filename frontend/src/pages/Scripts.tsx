import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import { Plus, Edit, Trash2, Play, FileCode, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import api from '../services/api'
import CodeEditor from '../components/CodeEditor'

interface Script {
  id: number
  name: string
  description: string | null
  file_path: string
  category: string
  timeout: number
  run_on: string
  usage_count: number
  is_template: boolean
  created_at: string
  updated_at: string
}

interface ScriptDetail extends Script {
  content: string
  repositories: Array<{
    id: number
    name: string
    hook_type: string
    enabled: boolean
  }>
  recent_executions: Array<{
    id: number
    repository_id: number | null
    status: string
    started_at: string | null
    exit_code: number | null
    execution_time: number | null
  }>
}

interface TestResult {
  success: boolean
  exit_code: number
  stdout: string
  stderr: string
  execution_time: number
}

export default function Scripts() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [editingScript, setEditingScript] = useState<ScriptDetail | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testingScript, setTestingScript] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content:
      '#!/bin/bash\n\necho "Script started"\n\n# Your script here\n\necho "Script completed"',
    timeout: 300,
    run_on: 'always',
    category: 'custom',
  })

  useEffect(() => {
    fetchScripts()
  }, [])

  const fetchScripts = async () => {
    try {
      const response = await api.get('/scripts')
      setScripts(response.data)
    } catch (error) {
      console.error('Failed to fetch scripts:', error)
      toast.error('Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingScript(null)
    setFormData({
      name: '',
      description: '',
      content:
        '#!/bin/bash\n\necho "Script started"\n\n# Your script here\n\necho "Script completed"',
      timeout: 300,
      run_on: 'always',
      category: 'custom',
    })
    setDialogOpen(true)
  }

  const handleEdit = async (script: Script) => {
    try {
      const response = await api.get(`/scripts/${script.id}`)
      const detail: ScriptDetail = response.data
      setEditingScript(detail)
      setFormData({
        name: detail.name,
        description: detail.description || '',
        content: detail.content,
        timeout: detail.timeout,
        run_on: detail.run_on,
        category: detail.category,
      })
      setDialogOpen(true)
    } catch (error) {
      console.error('Failed to fetch script details:', error)
      toast.error('Failed to load script details')
    }
  }

  const handleSave = async () => {
    try {
      if (editingScript) {
        // Update existing script
        await api.put(`/scripts/${editingScript.id}`, formData)
        toast.success('Script updated successfully')
      } else {
        // Create new script
        await api.post('/scripts', formData)
        toast.success('Script created successfully')
      }
      setDialogOpen(false)
      fetchScripts()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to save script:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onError = (error: any) => {
        toast.error(error.response?.data?.detail || 'Failed to save script')
      }
      onError(error)
    }
  }

  const handleDelete = async (script: Script) => {
    if (!confirm(`Are you sure you want to delete "${script.name}"?`)) {
      return
    }

    try {
      await api.delete(`/scripts/${script.id}`)
      toast.success('Script deleted successfully')
      fetchScripts()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to delete script:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onError = (error: any) => {
        toast.error(error.response?.data?.detail || 'Failed to delete script')
      }
      onError(error)
    }
  }

  const handleTest = async (script: Script) => {
    try {
      setTestingScript(true)
      setTestResult(null)
      setTestDialogOpen(true)

      const response = await api.post(`/scripts/${script.id}/test`)
      setTestResult(response.data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to test script:', error)
      toast.error('Failed to test script')
      setTestDialogOpen(false)
    } finally {
      setTestingScript(false)
    }
  }

  const getRunOnColor = (runOn: string) => {
    switch (runOn) {
      case 'success':
        return 'success'
      case 'failure':
        return 'error'
      case 'warning':
        return 'warning'
      case 'always':
        return 'info'
      default:
        return 'default'
    }
  }

  const getCategoryColor = (category: string) => {
    return category === 'template' ? 'secondary' : 'default'
  }

  if (loading) {
    return (
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}
        >
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            脚本库
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            可重用的备份钩子和维护脚本
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={handleCreate}
          sx={{ minWidth: 140 }}
        >
          新建脚本
        </Button>
      </Box>

      {/* Info Alert */}
      {scripts.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            尚未创建任何脚本。脚本可以分配给存储库，用于备份前和备份后的钩子，条件包括“失败时运行”或“始终运行”。
          </Typography>
        </Alert>
      )}

      {/* Scripts Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>名称</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>描述</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>类别</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>运行条件</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>超时时间</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>使用次数</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                操作
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scripts.map((script) => (
              <TableRow key={script.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileCode size={18} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {script.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                    {script.description || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={script.category}
                    size="small"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    color={getCategoryColor(script.category) as any}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={script.run_on}
                    size="small"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    color={getRunOnColor(script.run_on) as any}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Clock size={14} />
                    <Typography variant="body2">{script.timeout}s</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {script.usage_count} {script.usage_count === 1 ? 'place used' : 'places used'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="测试脚本">
                    <IconButton size="small" onClick={() => handleTest(script)} sx={{ mr: 0.5 }}>
                      <Play size={18} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑脚本">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(script)}
                      disabled={script.is_template}
                      sx={{ mr: 0.5 }}
                    >
                      <Edit size={18} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    title={
                      script.is_template
                        ? '无法删除模板'
                        : script.usage_count > 0
                          ? `脚本已在 ${script.usage_count} 个位置使用`
                          : '删除脚本'
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(script)}
                        disabled={script.is_template}
                        color="error"
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingScript ? '编辑脚本' : '创建脚本'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="名称"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              helperText="此脚本的唯一名称"
            />

            <TextField
              label="描述"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="此脚本的可选描述"
            />

            <FormControl fullWidth>
              <InputLabel>运行条件</InputLabel>
              <Select
                value={formData.run_on}
                label="运行条件"
                onChange={(e) => setFormData({ ...formData, run_on: e.target.value })}
              >
                <MenuItem value="success">成功 - 仅在备份成功后运行</MenuItem>
                <MenuItem value="failure">失败 - 仅在备份失败后运行</MenuItem>
                <MenuItem value="warning">警告 - 仅在备份有警告时运行</MenuItem>
                <MenuItem value="always">始终 - 无论结果如何都运行</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info">
              <strong>注意：</strong>“运行条件”仅适用于备份后的钩子。备份前的脚本始终在备份开始前运行。
            </Alert>

            <TextField
              label="超时时间 (秒)"
              type="number"
              value={formData.timeout}
              onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
              fullWidth
              inputProps={{ min: 30, max: 3600 }}
              helperText="最大执行时间 (30-3600 秒)"
            />

            <CodeEditor
              label="脚本内容"
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              height="300px"
              language="shell"
              helperText="Bash 脚本将作为钩子执行"
            />

            {editingScript && editingScript.usage_count > 0 && (
              <Alert severity="info">
                This script is used in {editingScript.usage_count}{' '}
                {editingScript.usage_count === 1 ? 'place' : 'places'}. Changes will affect all
                assignments.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name.trim()}>
            {editingScript ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Play size={20} />
            脚本测试结果
          </Box>
        </DialogTitle>
        <DialogContent>
          {testingScript ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Running script...</Typography>
            </Box>
          ) : testResult ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Status */}
              <Alert
                severity={testResult.success ? 'success' : 'error'}
                icon={testResult.success ? <CheckCircle /> : <XCircle />}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {testResult.success ? '脚本执行成功' : '脚本执行失败'}
                </Typography>
                <Typography variant="caption">
                  退出代码: {testResult.exit_code} | 执行时间: {testResult.execution_time.toFixed(2)}秒
                </Typography>
              </Alert>

              {/* Stdout */}
              {testResult.stdout && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    标准输出：
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: '#1e1e1e',
                      color: '#d4d4d4',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{testResult.stdout}</pre>
                  </Paper>
                </Box>
              )}

              {/* Stderr */}
              {testResult.stderr && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600, color: 'error.main' }}
                  >
                    标准错误：
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: '#1e1e1e',
                      color: '#f48771',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{testResult.stderr}</pre>
                  </Paper>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
