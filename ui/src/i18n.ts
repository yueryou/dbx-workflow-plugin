import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      common: {
        appName: 'Workflow Manage',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        create: 'Create',
        edit: 'Edit',
        actions: 'Actions',
        loading: 'Loading...',
        confirm: 'Confirm',
        close: 'Close',
      },
      nav: {
        workflows: 'Workflows',
        executions: 'Executions',
        settings: 'Settings',
      },
      workflow: {
        title: 'Workflows',
        newName: 'New Workflow',
        name: 'Name',
        description: 'Description',
        tags: 'Tags',
        nodes: 'Nodes',
        created: 'Created',
        updated: 'Updated',
        version: 'Version',
        empty: 'No workflows yet. Create one to get started.',
        deleteConfirm: 'Are you sure you want to delete this workflow?',
      },
      execution: {
        title: 'Executions',
        status: 'Status',
        started: 'Started',
        finished: 'Finished',
        trigger: 'Trigger',
        empty: 'No executions yet.',
      },
      status: {
        pending: 'Pending',
        running: 'Running',
        paused: 'Paused',
        completed: 'Completed',
        failed: 'Failed',
        canceled: 'Canceled',
        timeout: 'Timeout',
      },
    },
  },
  'zh-CN': {
    translation: {
      common: {
        appName: 'Workflow Manage',
        save: '保存',
        cancel: '取消',
        delete: '删除',
        create: '创建',
        edit: '编辑',
        actions: '操作',
        loading: '加载中...',
        confirm: '确认',
        close: '关闭',
      },
      nav: {
        workflows: '工作流',
        executions: '执行记录',
        settings: '设置',
      },
      workflow: {
        title: '工作流',
        newName: '新建工作流',
        name: '名称',
        description: '描述',
        tags: '标签',
        nodes: '节点数',
        created: '创建时间',
        updated: '更新时间',
        version: '版本',
        empty: '暂无工作流，点击创建开始。',
        deleteConfirm: '确定要删除此工作流吗？',
      },
      execution: {
        title: '执行记录',
        status: '状态',
        started: '开始时间',
        finished: '结束时间',
        trigger: '触发方式',
        empty: '暂无执行记录。',
      },
      status: {
        pending: '等待中',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
        canceled: '已取消',
        timeout: '超时',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: window.dbxPlugin?.locale?.startsWith('zh') ? 'zh-CN' : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
