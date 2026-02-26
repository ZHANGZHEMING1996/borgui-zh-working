import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入翻译文件
import common from './locales/zh-CN/common.json';
import login from './locales/zh-CN/login.json';
import dashboard from './locales/zh-CN/dashboard.json';
import repositories from './locales/zh-CN/repositories.json';
import backup from './locales/zh-CN/backup.json';
import archives from './locales/zh-CN/archives.json';
import restore from './locales/zh-CN/restore.json';
import schedule from './locales/zh-CN/schedule.json';
import settings from './locales/zh-CN/settings.json';
import scripts from './locales/zh-CN/scripts.json';
import activity from './locales/zh-CN/activity.json';
import navigation from './locales/zh-CN/navigation.json';
import sshConnections from './locales/zh-CN/ssh_connections.json';

// 资源文件
const resources = {
  'zh-CN': {
    common,
    login,
    dashboard,
    repositories,
    backup,
    archives,
    restore,
    schedule,
    settings,
    scripts,
    activity,
    navigation,
    sshConnections,
  },
  en: {
    common: {},
    login: {},
    dashboard: {},
    repositories: {},
    backup: {},
    archives: {},
    restore: {},
    schedule: {},
    settings: {},
    scripts: {},
    activity: {},
    navigation: {},
    sshConnections: {},
  },
};

i18n
  .use(LanguageDetector) // 自动检测语言
  .use(initReactI18next) // 将i18n实例传递给react-i18next
  .init({
    resources,
    lng: 'zh-CN', // 默认语言
    fallbackLng: 'en', // 回退语言
    debug: true, // 开发环境设为true，生产环境设为false
    
    interpolation: {
      escapeValue: false, // react已经安全化了
    },
    
    ns: ['common', 'login', 'dashboard', 'repositories', 'backup', 'archives', 'restore', 'schedule', 'settings', 'scripts', 'activity', 'navigation', 'sshConnections'], // 命名空间
    defaultNS: 'common',
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;