/** Locale namespace for every string this plugin shows. */
export const NS = 'dshThreads'

export const zh = {
  'panel': '项目',
  'page.title': '项目',
  'page.subtitle': '一个项目 = 一个文件夹 + 一个主对话。主对话可以把任务派给讨论串。',
  'page.new': '新建项目',
  'page.search': '搜索项目…',
  'page.sort.activity': '最近活动',
  'page.sort.created': '创建时间',
  'page.sort.title': '名称',
  'page.empty': '还没有项目。新建一个，或者在左侧会话的"…"菜单里选"设为项目"。',
  'page.noMatch': '没有匹配的项目。',
  'page.loadFailed': '读取项目失败：{error}',
  'card.threads': '{count} 个讨论串',
  'card.running': '{count} 个运行中',
  'card.pin': '置顶',
  'card.unpin': '取消置顶',
  'card.remove': '移除项目',
  'remove.title': '移除项目「{title}」？',
  'remove.description': '只移除项目记录。主对话和讨论串会保留为普通会话。',
  'remove.confirm': '移除',
  'common.cancel': '取消',
  'common.close': '关闭',
  'new.title': '新建项目',
  'new.name': '项目名',
  'new.namePlaceholder': '例如：Vetoarc',
  'new.folder': '文件夹（工作区）',
  'new.noFolders': '还没有工作区。先在左侧"工作区"里添加一个文件夹。',
  'new.instructions': '项目说明（可选）',
  'new.instructionsPlaceholder': '会加进主对话和所有讨论串的系统提示，例如代码规范、回复语言。',
  'new.create': '创建并打开',
  'new.failed': '创建失败：{error}',
  'menu.makeProject': '设为项目',
  'time.justNow': '刚刚',
  'time.minutes': '{count} 分钟前',
  'time.hours': '{count} 小时前',
  'time.days': '{count} 天前',
  'tab.title': '讨论串',
  'tab.description': '主对话开出的讨论串',
}

export const en: typeof zh = {
  'panel': 'Projects',
  'page.title': 'Projects',
  'page.subtitle': 'A project is one folder and one main conversation. The main conversation can hand tasks to threads.',
  'page.new': 'New project',
  'page.search': 'Search projects…',
  'page.sort.activity': 'Recent activity',
  'page.sort.created': 'Date created',
  'page.sort.title': 'Name',
  'page.empty': 'No projects yet. Create one, or choose "Make project" in a conversation\'s "…" menu.',
  'page.noMatch': 'No matching projects.',
  'page.loadFailed': 'Could not load projects: {error}',
  'card.threads': '{count} threads',
  'card.running': '{count} running',
  'card.pin': 'Pin',
  'card.unpin': 'Unpin',
  'card.remove': 'Remove project',
  'remove.title': 'Remove project "{title}"?',
  'remove.description': 'Only the project record is removed. Its main conversation and threads stay as ordinary conversations.',
  'remove.confirm': 'Remove',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'new.title': 'New project',
  'new.name': 'Name',
  'new.namePlaceholder': 'e.g. Vetoarc',
  'new.folder': 'Folder (workspace)',
  'new.noFolders': 'No workspaces yet. Add a folder under Workspaces in the sidebar first.',
  'new.instructions': 'Project instructions (optional)',
  'new.instructionsPlaceholder': 'Added to the system prompt of the main conversation and every thread: conventions, reply language, …',
  'new.create': 'Create and open',
  'new.failed': 'Could not create the project: {error}',
  'menu.makeProject': 'Make project',
  'time.justNow': 'just now',
  'time.minutes': '{count} min ago',
  'time.hours': '{count} h ago',
  'time.days': '{count} d ago',
  'tab.title': 'Threads',
  'tab.description': 'Threads opened by the main conversation',
}

export type MessageKey = keyof typeof zh
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

/** Relative time like "3 天前", from an ISO timestamp. */
export function relativeTime(t: Translate, iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000)
  if (!Number.isFinite(minutes) || minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hours', { count: hours })
  return t('time.days', { count: Math.floor(hours / 24) })
}
