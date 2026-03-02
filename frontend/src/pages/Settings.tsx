import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  Box,
  Card,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material'
import { Users, Trash2, Plus, Edit, Key, AlertCircle, Moon, Sun } from 'lucide-react'
import { settingsAPI } from '../services/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'
import { availableThemes } from '../theme'
import NotificationsTab from '../components/NotificationsTab'
import PreferencesTab from '../components/PreferencesTab'
import PackagesTab from '../components/PackagesTab'
import ExportImportTab from '../components/ExportImportTab'
import LogManagementTab from '../components/LogManagementTab'
import CacheManagementTab from '../components/CacheManagementTab'
import MountsManagementTab from '../components/MountsManagementTab'
import SystemSettingsTab from '../components/SystemSettingsTab'
import BetaFeaturesTab from '../components/BetaFeaturesTab'
import Scripts from './Scripts'
import Activity from './Activity'
import { formatDateShort } from '../utils/dateUtils'
import DataTable, { Column, ActionButton } from '../components/DataTable'

interface UserType {
  id: number
  username: string
  email: string
  is_active: boolean
  is_admin: boolean
  created_at: string
  last_login: string | null
}

const Settings: React.FC = () => {
  const { user } = useAuth()
  const { mode, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const { tab } = useParams<{ tab?: string }>()

  // 根据用户角色获取标签顺序
  const getTabOrder = React.useCallback(() => {
    const baseTabs = ['账户', '外观', '偏好设置', '通知']
    if (user?.is_admin) {
      return [
        ...baseTabs,
        '系统',
        '测试功能',
        '缓存',
        '日志',
        '挂载点',
        '软件包',
        '脚本',
        '导入导出',
        '用户管理',
        '活动',
      ]
    }
    return [...baseTabs, '挂载点', '脚本', '导入导出', '活动']
  }, [user?.is_admin])

  // 从URL确定活动标签或默认为“账户”
  const getTabIndexFromPath = React.useCallback(
    (tabPath?: string): number => {
      if (!tabPath) return 0
      const tabOrder = getTabOrder()
      const index = tabOrder.indexOf(tabPath)
      return index >= 0 ? index : 0
    },
    [getTabOrder]
  )

  const [activeTab, setActiveTab] = useState(getTabIndexFromPath(tab))

  // 当URL更改时更新活动标签
  useEffect(() => {
    setActiveTab(getTabIndexFromPath(tab))
  }, [tab, getTabIndexFromPath])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserType | null>(null)
  const [changePasswordForm, setChangePasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  // 修改密码的变更（针对当前用户）
  const changePasswordMutation = useMutation({
    mutationFn: (passwordData: { current_password: string; new_password: string }) =>
      settingsAPI.changePassword(passwordData),
    onSuccess: () => {
      toast.success('Password changed successfully')
      setChangePasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password')
    },
  })

  // Users
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: settingsAPI.getUsers,
    enabled: user?.is_admin === true,
  })

  const createUserMutation = useMutation({
    mutationFn: settingsAPI.createUser,
    onSuccess: () => {
      toast.success('User created successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateUser(false)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    },
  })

  const updateUserMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: ({ userId, userData }: { userId: number; userData: any }) =>
      settingsAPI.updateUser(userId, userData),
    onSuccess: () => {
      toast.success('User updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: settingsAPI.deleteUser,
    onSuccess: () => {
      toast.success('User deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteConfirmUser(null)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete user')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      settingsAPI.resetUserPassword(userId, newPassword),
    onSuccess: () => {
      toast.success('Password reset successfully')
      setShowPasswordModal(false)
      setSelectedUserId(null)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reset password')
    },
  })

  // Form states
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    is_admin: false,
  })
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
  })

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    createUserMutation.mutate(userForm)
  }

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        userData: userForm,
      })
    }
  }

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedUserId) {
      resetPasswordMutation.mutate({
        userId: selectedUserId,
        newPassword: passwordForm.new_password,
      })
    }
  }

  const handleDeleteUser = () => {
    if (deleteConfirmUser) {
      deleteUserMutation.mutate(deleteConfirmUser.id)
    }
  }

  const openPasswordModal = (userId: number) => {
    setSelectedUserId(userId)
    setShowPasswordModal(true)
    setPasswordForm({ new_password: '' })
  }

  const openEditUser = (user: UserType) => {
    setEditingUser(user)
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      is_admin: user.is_admin,
    })
  }

  const openCreateUser = () => {
    setShowCreateUser(true)
    setUserForm({
      username: '',
      email: '',
      password: '',
      is_admin: false,
    })
  }

  // Column definitions for Users table
  const userColumns: Column<UserType>[] = [
    {
      id: 'user',
      label: 'User',
      render: (user) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {user.username}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (user) => (
        <Chip
          label={user.is_active ? 'Active' : 'Inactive'}
          color={user.is_active ? 'success' : 'error'}
          size="small"
        />
      ),
    },
    {
      id: 'role',
      label: 'Role',
      render: (user) => (
        <Chip
          label={user.is_admin ? 'Admin' : 'User'}
          color={user.is_admin ? 'secondary' : 'default'}
          size="small"
        />
      ),
    },
    {
      id: 'created_at',
      label: 'Created',
      render: (user) => <Typography variant="body2">{formatDateShort(user.created_at)}</Typography>,
    },
    {
      id: 'last_login',
      label: 'Last Login',
      render: (user) => (
        <Typography variant="body2" color="text.secondary">
          {formatDateShort(user.last_login)}
        </Typography>
      ),
    },
  ]

  // Action buttons for Users table
  const userActions: ActionButton<UserType>[] = [
    {
      icon: <Edit size={16} />,
      label: 'Edit User',
      onClick: openEditUser,
      color: 'primary',
      tooltip: 'Edit User',
    },
    {
      icon: <Key size={16} />,
      label: 'Reset Password',
      onClick: (user) => openPasswordModal(user.id),
      color: 'warning',
      tooltip: 'Reset Password',
    },
    {
      icon: <Trash2 size={16} />,
      label: 'Delete User',
      onClick: setDeleteConfirmUser,
      color: 'error',
      tooltip: 'Delete User',
    },
  ]

  return (
    <Box>
      {/* 根据活动标签动态渲染内容 */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h6">修改密码</Typography>
          {/* 修改密码表单内容 */}
        </Box>
      )}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6">外观设置</Typography>
          {/* 外观设置内容 */}
        </Box>
      )}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6">偏好设置</Typography>
          {/* 偏好设置内容 */}
        </Box>
      )}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6">通知设置</Typography>
          {/* 通知设置内容 */}
        </Box>
      )}
      {/* 添加其他标签的内容渲染逻辑 */}
    </Box>
  )
}

export default Settings
