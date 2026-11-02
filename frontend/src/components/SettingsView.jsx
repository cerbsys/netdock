import React, { useState, useEffect, useMemo } from 'react';
import {
  Palette,
  ShieldCheck,
  Server,
  Info,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Lock,
  ExternalLink,
  Activity,
  Container,
  Terminal,
  Sliders
} from 'lucide-react';

export const ACCENT_PALETTES = {
  indigo: { label: 'Indigo', primary: '#6366f1', hover: '#4f46e5', soft: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.35)' },
  sky: { label: 'Sky Blue', primary: '#0284c7', hover: '#0369a1', soft: 'rgba(2, 132, 199, 0.14)', border: 'rgba(2, 132, 199, 0.35)' },
  emerald: { label: 'Emerald', primary: '#10b981', hover: '#059669', soft: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)' },
  amber: { label: 'Amber', primary: '#d97706', hover: '#b45309', soft: 'rgba(217, 119, 6, 0.14)', border: 'rgba(217, 119, 6, 0.35)' },
  rose: { label: 'Rose', primary: '#e11d48', hover: '#be123c', soft: 'rgba(225, 29, 72, 0.14)', border: 'rgba(225, 29, 72, 0.35)' },
  slate: { label: 'Slate', primary: '#475569', hover: '#334155', soft: 'rgba(100, 116, 139, 0.16)', border: 'rgba(100, 116, 139, 0.38)' }
};

export const DENSITY_PRESETS = {
  comfortable: {
     '--nd-canvas-pad': '28px 32px',
    '--nd-card-pad': '24px',
    '--nd-section-gap': '22px',
    '--nd-grid-gap': '18px',
    '--nd-row-py': '14px',
    '--nd-row-px': '18px',
    '--nd-nav-py': '10px',
    '--nd-nav-px': '12px',
    '--nd-nav-gap': '6px',
    '--nd-btn-py': '9px',
    '--nd-btn-px': '16px',
    '--nd-input-py': '10px',
    '--nd-input-px': '13px',
    '--nd-spec-py': '12px',
    '--nd-topbar-py': '14px',
    '--nd-font-table': '13.5px'
  },
  default: {
    '--nd-canvas-pad': '20px 24px',
    '--nd-card-pad': '18px',
    '--nd-section-gap': '16px',
    '--nd-grid-gap': '14px',
    '--nd-row-py': '10px',
    '--nd-row-px': '14px',
    '--nd-nav-py': '7px',
    '--nd-nav-px': '10px',
    '--nd-nav-gap': '3px',
    '--nd-btn-py': '7px',
    '--nd-btn-px': '12px',
    '--nd-input-py': '7px',
    '--nd-input-px': '11px',
    '--nd-spec-py': '8px',
    '--nd-topbar-py': '10px',
    '--nd-font-table': '12.5px'
  },
  compact: {
    '--nd-canvas-pad': '12px 14px',
    '--nd-card-pad': '12px',
    '--nd-section-gap': '10px',
    '--nd-grid-gap': '9px',
    '--nd-row-py': '5px',
    '--nd-row-px': '10px',
    '--nd-nav-py': '4px',
    '--nd-nav-px': '8px',
    '--nd-nav-gap': '2px',
    '--nd-btn-py': '5px',
    '--nd-btn-px': '9px',
    '--nd-input-py': '5px',
    '--nd-input-px': '8px',
    '--nd-spec-py': '5px',
    '--nd-topbar-py': '6px',
    '--nd-font-table': '12px'
  }
};

export const DEFAULT_APP_SETTINGS = {
  theme: 'dark',
  accent_color: 'indigo',
  density: 'default',
  container_log_limit: 250,
  log_refresh_interval: 5,
  container_sort_by: 'hostname',
  container_sort_order: 'asc',
  auto_refresh_interval: 0,
  confirm_destructive: true
};

export function resolveEffectiveTheme(themePref) {
  if (themePref === 'light') return 'light';
  if (themePref === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function applyAppearanceToDocument(rawSettings) {
  if (typeof document === 'undefined') return;
  const s = { ...DEFAULT_APP_SETTINGS, ...(rawSettings || {}) };
  const effectiveTheme = resolveEffectiveTheme(s.theme);
  const accent = ACCENT_PALETTES[s.accent_color] || ACCENT_PALETTES.indigo;
  const densityKey = DENSITY_PRESETS[s.density] ? s.density : 'default';
  const densityVars = DENSITY_PRESETS[densityKey];
  const isLight = effectiveTheme === 'light';

  const root = document.documentElement;
  root.setAttribute('data-theme', effectiveTheme);
  root.setAttribute('data-density', densityKey);
  root.style.colorScheme = effectiveTheme;

  const themeVars = isLight
    ? {
        '--bg-app': '#f1f5f9',
        '--bg-canvas': '#f1f5f9',
        '--bg-main': '#f8fafc',
        '--bg-sidebar': '#ffffff',
        '--bg-surface': '#ffffff',
        '--bg-panel': '#ffffff',
        '--bg-card': '#ffffff',
        '--bg-elevated': '#f8fafc',
        '--bg-input': '#ffffff',
        '--bg-hover': '#f1f5f9',
        '--bg-active': '#e2e8f0',
        '--border-subtle': '#e2e8f0',
        '--border-strong': '#cbd5e1',
        '--text-primary': '#0f172a',
        '--text-secondary': '#475569',
        '--text-muted': '#64748b',
        '--accent': accent.primary,
        '--accent-hover': accent.hover,
        '--accent-soft': accent.soft,
        '--accent-border': accent.border,
        '--status-emerald': '#059669',
        '--status-emerald-soft': 'rgba(16, 185, 129, 0.12)',
        '--status-rose': '#e11d48',
        '--status-rose-soft': 'rgba(244, 63, 94, 0.12)'
      }
    : {
        '--bg-app': '#0b0f17',
        '--bg-canvas': '#0b0f17',
        '--bg-main': '#0b0f17',
        '--bg-sidebar': '#0d131f',
        '--bg-surface': '#0f1522',
        '--bg-panel': '#0f1522',
        '--bg-card': '#0f1522',
        '--bg-elevated': '#151d2e',
        '--bg-input': '#090d16',
        '--bg-hover': '#161f30',
        '--bg-active': '#1e293b',
        '--border-subtle': 'rgba(148, 163, 184, 0.14)',
        '--border-strong': 'rgba(148, 163, 184, 0.26)',
        '--text-primary': '#f1f5f9',
        '--text-secondary': '#94a3b8',
        '--text-muted': '#64748b',
        '--accent': accent.primary,
        '--accent-hover': accent.hover,
        '--accent-soft': accent.soft,
        '--accent-border': accent.border,
        '--status-emerald': '#10b981',
        '--status-emerald-soft': 'rgba(16, 185, 129, 0.14)',
        '--status-rose': '#f43f5e',
        '--status-rose-soft': 'rgba(244, 63, 94, 0.14)'
      };

  Object.entries({ ...themeVars, ...densityVars }).forEach(([k, v]) =>
    root.style.setProperty(k, v)
  );

  let styleTag = document.getElementById('nd-dynamic-theme-rules');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'nd-dynamic-theme-rules';
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = `
    html, body, #root, .nd-app-shell {
      background-color: var(--bg-app) !important;
      color: var(--text-primary) !important;
    }
    .nd-sidebar,
    .nd-app-shell > aside:first-of-type {
      background-color: var(--bg-sidebar) !important;
      border-color: var(--border-subtle) !important;
      color: var(--text-primary) !important;
    }
    .nd-main-area,
    .nd-workspace-body,
    .nd-center-canvas {
      background-color: var(--bg-app) !important;
      color: var(--text-primary) !important;
    }
    .nd-topbar,
    .nd-main-area > header,
    .nd-app-shell header {
      background-color: var(--bg-surface) !important;
      border-color: var(--border-subtle) !important;
      color: var(--text-primary) !important;
    }
    .nd-right-inspector,
    .nd-workspace-body > aside {
      background-color: var(--bg-surface) !important;
      border-color: var(--border-subtle) !important;
      color: var(--text-primary) !important;
    }
    .nd-table-card,
    .nd-card,
    .nd-modal-card {
      background-color: var(--bg-surface) !important;
      border-color: var(--border-subtle) !important;
      color: var(--text-primary) !important;
      box-shadow: none !important;
    }
    .nd-data-table,
    table {
      color: var(--text-primary) !important;
    }
    .nd-data-table thead,
    .nd-data-table th,
    table thead,
    table th {
      background-color: var(--bg-elevated) !important;
      color: var(--text-secondary) !important;
      border-color: var(--border-subtle) !important;
    }
    .nd-data-table tbody tr,
    table tbody tr {
      background-color: var(--bg-surface) !important;
      border-color: var(--border-subtle) !important;
      color: var(--text-primary) !important;
    }
    .nd-data-table tbody tr:hover,
    table tbody tr:hover {
      background-color: var(--bg-hover) !important;
    }
    input:not([type="checkbox"]):not([type="radio"]),
    select,
    textarea,
    .nd-input,
    .nd-select {
      background-color: var(--bg-input) !important;
      color: var(--text-primary) !important;
      border-color: var(--border-subtle) !important;
    }
    input::placeholder,
    textarea::placeholder {
      color: var(--text-muted) !important;
    }
    input:focus,
    select:focus,
    textarea:focus {
      border-color: var(--accent) !important;
    }
    .nd-btn-primary {
      background-color: var(--accent) !important;
      border-color: var(--accent) !important;
      color: #ffffff !important;
      box-shadow: none !important;
    }
    .nd-btn-primary:hover {
      background-color: var(--accent-hover) !important;
    }

    /* --- Density Scaling Rules (Comfortable / Default / Compact) --- */
    .nd-center-canvas {
      padding: var(--nd-canvas-pad) !important;
    }
    .nd-app-shell nav {
      gap: var(--nd-nav-gap) !important;
    }
    .nd-app-shell nav button {
      padding-top: var(--nd-nav-py) !important;
      padding-bottom: var(--nd-nav-py) !important;
    }
    .nd-data-table th,
    .nd-data-table td,
    table th,
    table td {
      padding: var(--nd-row-py) var(--nd-row-px) !important;
      font-size: var(--nd-font-table) !important;
    }
    .nd-spec-row {
      padding-top: var(--nd-spec-py) !important;
      padding-bottom: var(--nd-spec-py) !important;
    }
    .nd-btn-primary,
    .nd-density-btn {
      padding: var(--nd-btn-py) var(--nd-btn-px) !important;
    }
    .nd-density-card {
      padding: var(--nd-card-pad) !important;
    }
    .nd-density-stack {
      gap: var(--nd-section-gap) !important;
    }
    .nd-density-grid {
      gap: var(--nd-grid-gap) !important;
    }
    .nd-density-input {
      padding: var(--nd-input-py) var(--nd-input-px) !important;
    }
  `;

  try {
    localStorage.setItem('netdock_cached_settings', JSON.stringify(s));
  } catch (_) {}
  window.__netdock_settings = s;
}

function evaluatePasswordStrength(pw) {
  if (!pw) return { score: 0, label: 'None', color: 'var(--text-muted)', checks: {} };
  const checks = {
    length: pw.length >= 8,
    mixedCase: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw)
  };
  const passed = Object.values(checks).filter(Boolean).length;
  if (pw.length < 6) {
    return { score: 1, label: 'Too short (min 6 chars)', color: '#f43f5e', checks };
  }
  const map = {
    0: { label: 'Weak', color: '#f43f5e' },
    1: { label: 'Fair', color: '#f59e0b' },
    2: { label: 'Good', color: '#0284c7' },
    3: { label: 'Strong', color: '#10b981' },
    4: { label: 'Very Strong', color: '#10b981' }
  };
  return { score: passed, ...map[passed], checks };
}

function formatUptime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${rem}s`);
  return parts.join(' ');
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(epochSeconds) {
  if (!epochSeconds) return '—';
  try {
    return new Date(Number(epochSeconds) * 1000).toLocaleString();
  } catch (_) {
    return '—';
  }
}

export default function SettingsView({
  appSettings,
  hosts = [],
  onUpdateSettings,
  onNotify
}) {
  const [activeSection, setActiveSection] = useState('appearance');
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_APP_SETTINGS, ...(appSettings || {}) }));
  const [savingSettings, setSavingSettings] = useState(false);

  // Account & Security state
  const [accountInfo, setAccountInfo] = useState({
    username: 'admin',
    created_at: 0,
    active_sessions: 1,
    hash_algorithm: 'PBKDF2-HMAC-SHA256 (100,000 iterations)'
  });
  const [credForm, setCredForm] = useState({
    new_username: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
    revoke_other_sessions: true
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const [savingCredentials, setSavingCredentials] = useState(false);

  // System Info state
  const [systemInfo, setSystemInfo] = useState(null);
  const [loadingSystem, setLoadingSystem] = useState(false);

  // Live Container Log Inspector state (in Docker Preferences)
  const containerHosts = useMemo(
    () => (hosts || []).filter((h) => h.device_type === 'container'),
    [hosts]
  );
  const [selectedContainer, setSelectedContainer] = useState('');
  const [containerLogs, setContainerLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    if (appSettings) {
      setDraft((prev) => ({ ...prev, ...appSettings }));
    }
  }, [appSettings]);

  useEffect(() => {
    if (!selectedContainer && containerHosts.length > 0) {
      setSelectedContainer(containerHosts[0].hostname);
    }
  }, [containerHosts, selectedContainer]);

  const fetchAccountAndSystem = async () => {
    setLoadingSystem(true);
    try {
      const [accRes, sysRes] = await Promise.all([
        fetch('/api/v1/account', { credentials: 'same-origin' }),
        fetch('/api/v1/system/info', { credentials: 'same-origin' })
      ]);
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccountInfo(accData);
        setCredForm((prev) => ({ ...prev, new_username: accData.username || '' }));
      }
      if (sysRes.ok) {
        setSystemInfo(await sysRes.json());
      }
    } catch (_) {
      // Ignore transient network errors
    } finally {
      setLoadingSystem(false);
    }
  };

  useEffect(() => {
    fetchAccountAndSystem();
  }, []);

  // Live uptime ticker while on General / System section
  useEffect(() => {
    if (activeSection !== 'system' || !systemInfo) return undefined;
    const timer = setInterval(() => {
      setSystemInfo((prev) =>
        prev ? { ...prev, uptime_seconds: (prev.uptime_seconds || 0) + 1 } : prev
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSection, Boolean(systemInfo)]);

  const fetchLogsForContainer = async (targetName, limitOverride) => {
    const name = targetName || selectedContainer;
    if (!name) return;
    setLoadingLogs(true);
    try {
      const tail = limitOverride || draft.container_log_limit || 250;
      const res = await fetch(
        `/api/v1/integrations/docker/logs/${encodeURIComponent(name)}?tail=${tail}`,
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch container logs');
      setContainerLogs(data.lines || []);
    } catch (err) {
      setContainerLogs([`[Error] ${err.message}`]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Auto-refresh container logs when on Docker Preferences tab and log_refresh_interval > 0
  useEffect(() => {
    if (activeSection !== 'docker' || !selectedContainer) return undefined;
    fetchLogsForContainer(selectedContainer, draft.container_log_limit);
    const refreshSec = Number(draft.log_refresh_interval || 0);
    if (!refreshSec || refreshSec <= 0) return undefined;
    const timer = setInterval(() => {
      fetchLogsForContainer(selectedContainer, draft.container_log_limit);
    }, refreshSec * 1000);
    return () => clearInterval(timer);
  }, [activeSection, selectedContainer, draft.container_log_limit, draft.log_refresh_interval]);

  const persistSettingPatch = async (patch, successMessage) => {
    const optimistic = { ...draft, ...patch };
    setDraft(optimistic);
    applyAppearanceToDocument(optimistic);
    if (onUpdateSettings) onUpdateSettings(optimistic);
    setSavingSettings(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update settings.');
      }
      setDraft(data);
      applyAppearanceToDocument(data);
      if (onUpdateSettings) onUpdateSettings(data);
      if (successMessage && onNotify) onNotify(successMessage, false);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to save settings.', true);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveDockerPrefs = (e) => {
    e.preventDefault();
    persistSettingPatch(
      {
        container_log_limit: Number(draft.container_log_limit),
        log_refresh_interval: Number(draft.log_refresh_interval),
        container_sort_by: draft.container_sort_by,
        container_sort_order: draft.container_sort_order,
        auto_refresh_interval: Number(draft.auto_refresh_interval),
        confirm_destructive: Boolean(draft.confirm_destructive)
      },
      'Docker preferences saved.'
    );
  };

  const executeCredentialUpdate = async () => {
    setConfirmModal(null);
    setSavingCredentials(true);
    try {
      const res = await fetch('/api/v1/account/credentials', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credForm)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update operator credentials.');
      }
      setAccountInfo((prev) => ({
        ...prev,
        username: data.username,
        active_sessions: data.active_sessions
      }));
      setCredForm((prev) => ({
        ...prev,
        new_username: data.username,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
      if (onNotify) {
        onNotify(`Credentials updated (${data.updated_fields.join(' & ')}).`, false);
      }
    } catch (err) {
      if (onNotify) onNotify(err.message, true);
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleCredentialFormSubmit = (e) => {
    e.preventDefault();
    if (!credForm.current_password) {
      if (onNotify) onNotify('Please enter your current operator password to authorize changes.', true);
      return;
    }
    const usernameChanged =
      credForm.new_username.trim() && credForm.new_username.trim() !== accountInfo.username;
    const passwordChanged = Boolean(credForm.new_password);

    if (!usernameChanged && !passwordChanged) {
      if (onNotify) onNotify('Modify your username or enter a new password before saving.', true);
      return;
    }
    if (passwordChanged) {
      if (credForm.new_password.length < 6) {
        if (onNotify) onNotify('New password must be at least 6 characters long.', true);
        return;
      }
      if (credForm.new_password !== credForm.confirm_password) {
        if (onNotify) onNotify('New password and password confirmation do not match.', true);
        return;
      }
    }

    setConfirmModal({
      title: 'Confirm Operator Credential Update',
      description: `You are about to update ${[
        usernameChanged ? `username to "${credForm.new_username.trim()}"` : null,
        passwordChanged ? 'your operator password' : null
      ]
        .filter(Boolean)
        .join(' and ')}. Are you sure you want to proceed?`,
      confirmLabel: 'Update Credentials',
      danger: false,
      onConfirm: executeCredentialUpdate
    });
  };

  const executeResetSettings = async () => {
    setConfirmModal(null);
    setSavingSettings(true);
    try {
      const res = await fetch('/api/v1/settings/reset', {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('Failed to reset settings.');
      const fresh = await res.json();
      setDraft(fresh);
      applyAppearanceToDocument(fresh);
      if (onUpdateSettings) onUpdateSettings(fresh);
      if (onNotify) onNotify('All settings restored to factory defaults.', false);
    } catch (err) {
      if (onNotify) onNotify(err.message, true);
    } finally {
      setSavingSettings(false);
    }
  };

  const executeRevokeSessions = async () => {
    setConfirmModal(null);
    try {
      const res = await fetch('/api/v1/account/sessions/revoke', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Failed to revoke other sessions.');
      setAccountInfo((prev) => ({ ...prev, active_sessions: data.active_sessions }));
      if (onNotify) {
        onNotify(`Revoked ${data.revoked_sessions} other active session(s).`, false);
      }
    } catch (err) {
      if (onNotify) onNotify(err.message, true);
    }
  };

  const pwStrength = useMemo(
    () => evaluatePasswordStrength(credForm.new_password),
    [credForm.new_password]
  );

  // Final 5-Section Settings Structure
  const categories = [
    {
      id: 'appearance',
      label: 'Appearance',
      subtitle: 'Theme, density & accent color',
      icon: Palette
    },
    {
      id: 'account',
      label: 'Account & Security',
      subtitle: 'Credentials & session control',
      icon: ShieldCheck
    },
    {
      id: 'docker',
      label: 'Docker Preferences',
      subtitle: 'Logs, sorting & auto-refresh',
      icon: Container
    },
    {
      id: 'system',
      label: 'General / System',
      subtitle: 'Uptime, API & runtime status',
      icon: Server
    },
    {
      id: 'about',
      label: 'About NetDock',
      subtitle: 'Version, repository & credits',
      icon: Info
    }
  ];

  const cardStyle = {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: 'var(--nd-card-pad, 18px)'
  };

  const inputStyle = {
    width: '100%',
    padding: 'var(--nd-input-py, 7px) var(--nd-input-px, 11px)',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '7px',
    color: 'var(--text-primary)',
    fontSize: '12.5px',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px'
  };

  const helpTextStyle = {
    fontSize: '11.5px',
    color: 'var(--text-secondary)',
    marginTop: '3px',
    lineHeight: 1.45
  };

  const primaryBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: 'var(--nd-btn-py, 7px) var(--nd-btn-px, 13px)',
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    border: '1px solid var(--accent)',
    borderRadius: '7px',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: 'pointer'
  };

  const secondaryBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: 'var(--nd-btn-py, 7px) var(--nd-btn-px, 12px)',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer'
  };

  return (
    <div className="nd-center-canvas" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: 'var(--nd-section-gap, 16px)'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Settings
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Manage appearance, operator credentials, Docker preferences, and system diagnostics.
            </p>
          </div>
          <span
            style={{
              fontSize: '11.5px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace'
            }}
          >
            NetDock v1.4.0
          </span>
        </div>

        {/* Category Navigation Tabs */}
        <div
          style={{
            ...cardStyle,
            padding: '8px',
            marginBottom: 'var(--nd-section-gap, 16px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
            gap: '6px'
          }}
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = activeSection === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveSection(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--nd-nav-py, 8px) var(--nd-nav-px, 11px)',
                  borderRadius: '7px',
                  border: active
                    ? '1px solid var(--accent-border, var(--border-strong))'
                    : '1px solid transparent',
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <Icon
                  size={16}
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    flexShrink: 0
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: active ? 600 : 500 }}>
                    {cat.label}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {cat.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Section Body */}
        <div
          className="nd-density-stack"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nd-section-gap, 16px)' }}
        >
          {/* 1. APPEARANCE */}
          {activeSection === 'appearance' && (
            <>
              {/* Theme Selection */}
              <div className="nd-density-card" style={cardStyle}>
                <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Theme Selection
                </h3>
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Choose how NetDock styles backgrounds, navigation, cards, tables, modals, and inputs across the entire application.
                </p>

                <div
                  className="nd-density-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 'var(--nd-grid-gap, 14px)'
                  }}
                >
                  {[
                    {
                      id: 'dark',
                      label: 'Dark',
                      desc: 'Deep slate background and dark elevated panels for low-light operations.',
                      icon: Moon,
                      swatchBg: '#0b0f17',
                      swatchSurface: '#0f1522',
                      swatchText: '#f1f5f9'
                    },
                    {
                      id: 'light',
                      label: 'Light',
                      desc: 'Crisp daylight surfaces, light navigation panels, and dark high-contrast text.',
                      icon: Sun,
                      swatchBg: '#f1f5f9',
                      swatchSurface: '#ffffff',
                      swatchText: '#0f172a'
                    },
                    {
                      id: 'system',
                      label: 'System',
                      desc: 'Automatically follows your operating system light or dark preference.',
                      icon: Monitor,
                      swatchBg: 'linear-gradient(135deg, #0b0f17 50%, #f1f5f9 50%)',
                      swatchSurface: '#1e293b',
                      swatchText: '#94a3b8'
                    }
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = draft.theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          persistSettingPatch({ theme: opt.id }, `Theme updated to ${opt.label}.`)
                        }
                        style={{
                          textAlign: 'left',
                          padding: 'var(--nd-card-pad, 14px)',
                          borderRadius: '9px',
                          backgroundColor: 'var(--bg-elevated)',
                          border: isSelected
                            ? '2px solid var(--accent)'
                            : '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div
                          style={{
                            height: '46px',
                            borderRadius: '6px',
                            background: opt.swatchBg,
                            border: '1px solid var(--border-strong)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 12px'
                          }}
                        >
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              backgroundColor: opt.swatchSurface,
                              border: '1px solid rgba(148, 163, 184, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Icon size={14} color={isSelected ? 'var(--accent)' : opt.swatchText} />
                          </span>
                          {isSelected && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--accent)',
                                color: '#ffffff'
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{opt.label}</div>
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              marginTop: '3px',
                              lineHeight: 1.4
                            }}
                          >
                            {opt.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interface Density (Comfortable, Default, Compact) */}
              <div className="nd-density-card" style={cardStyle}>
                <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Interface Density
                </h3>
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Control padding, table row height, card spacing, and button/input dimensions across NetDock.
                </p>

                <div
                  className="nd-density-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 'var(--nd-grid-gap, 14px)'
                  }}
                >
                  {[
                    {
                      id: 'comfortable',
                      label: 'Comfortable',
                      desc: 'More padding around elements, larger spacing between cards and rows, and generous button/input dimensions.'
                    },
                    {
                      id: 'default',
                      label: 'Default',
                      desc: 'Balanced spacing and sizing for the standard NetDock experience.'
                    },
                    {
                      id: 'compact',
                      label: 'Compact',
                      desc: 'Reduced padding, smaller table rows, and tighter card spacing to display more information at once.'
                    }
                  ].map((d) => {
                    const active = draft.density === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          persistSettingPatch(
                            { density: d.id },
                            `Interface density set to ${d.label}.`
                          )
                        }
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: 'var(--nd-card-pad, 14px)',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-elevated)',
                          border: active
                            ? '2px solid var(--accent)'
                            : '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{d.label}</span>
                          {active && <Check size={15} color="var(--accent)" />}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {d.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color */}
              <div className="nd-density-card" style={cardStyle}>
                <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Accent Color
                </h3>
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Select the highlight color used for primary buttons, active navigation tabs, and selection borders.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 'var(--nd-grid-gap, 10px)'
                  }}
                >
                  {Object.entries(ACCENT_PALETTES).map(([key, pal]) => {
                    const selected = draft.accent_color === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          persistSettingPatch(
                            { accent_color: key },
                            `Accent color set to ${pal.label}.`
                          )
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: 'var(--nd-btn-py, 8px) var(--nd-btn-px, 12px)',
                          borderRadius: '7px',
                          backgroundColor: 'var(--bg-elevated)',
                          border: selected
                            ? `2px solid ${pal.primary}`
                            : '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: selected ? 600 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        <span
                          style={{
                            width: '15px',
                            height: '15px',
                            borderRadius: '4px',
                            backgroundColor: pal.primary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {selected && <Check size={10} color="#ffffff" />}
                        </span>
                        <span className="nd-truncate">{pal.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 2. ACCOUNT & SECURITY */}
          {activeSection === 'account' && (
            <>
              <div className="nd-density-card" style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--accent-soft)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)'
                      }}
                    >
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)',
                          fontWeight: 600
                        }}
                      >
                        Authenticated Operator
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {accountInfo.username}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Created: {formatDate(accountInfo.created_at)} · KDF: {accountInfo.hash_algorithm}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {accountInfo.active_sessions} Active Session{accountInfo.active_sessions === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          title: 'Revoke All Other Sessions',
                          description:
                            'This will immediately sign out any other browsers or devices logged into NetDock while keeping your current session active.',
                          confirmLabel: 'Revoke Other Sessions',
                          danger: true,
                          onConfirm: executeRevokeSessions
                        })
                      }
                      style={secondaryBtnStyle}
                    >
                      <Lock size={13} />
                      Revoke Other Sessions
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCredentialFormSubmit} className="nd-density-card" style={cardStyle}>
                <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Change Username & Password
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Update your administrator login credentials. Entering your current password is required to authorize changes.
                </p>

                <div
                  className="nd-density-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--nd-grid-gap, 14px)',
                    marginBottom: '14px'
                  }}
                >
                  <div>
                    <label style={labelStyle}>Operator Username</label>
                    <input
                      type="text"
                      value={credForm.new_username}
                      onChange={(e) => setCredForm({ ...credForm, new_username: e.target.value })}
                      placeholder="admin"
                      autoComplete="username"
                      style={inputStyle}
                    />
                    <div style={helpTextStyle}>
                      3–32 characters (letters, numbers, underscores, hyphens, or periods).
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Current Operator Password (Required) *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={credForm.current_password}
                        onChange={(e) => setCredForm({ ...credForm, current_password: e.target.value })}
                        placeholder="Enter current password"
                        required
                        autoComplete="current-password"
                        style={{ ...inputStyle, paddingRight: '34px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex'
                        }}
                      >
                        {showPasswords.current ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="nd-density-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--nd-grid-gap, 14px)',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <label style={labelStyle}>New Operator Password (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPasswords.next ? 'text' : 'password'}
                        value={credForm.new_password}
                        onChange={(e) => setCredForm({ ...credForm, new_password: e.target.value })}
                        placeholder="Leave blank to keep current password"
                        autoComplete="new-password"
                        style={{ ...inputStyle, paddingRight: '34px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((p) => ({ ...p, next: !p.next }))}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex'
                        }}
                      >
                        {showPasswords.next ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {credForm.new_password && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Password strength:</span>
                          <span style={{ fontWeight: 600, color: pwStrength.color }}>{pwStrength.label}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                          {[1, 2, 3, 4].map((idx) => (
                            <div
                              key={idx}
                              style={{
                                height: '4px',
                                borderRadius: '2px',
                                backgroundColor:
                                  idx <= pwStrength.score ? pwStrength.color : 'var(--border-subtle)'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Confirm New Operator Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={credForm.confirm_password}
                        onChange={(e) => setCredForm({ ...credForm, confirm_password: e.target.value })}
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        style={{ ...inputStyle, paddingRight: '34px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex'
                        }}
                      >
                        {showPasswords.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '14px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={credForm.revoke_other_sessions}
                      onChange={(e) =>
                        setCredForm({ ...credForm, revoke_other_sessions: e.target.checked })
                      }
                    />
                    Invalidate all other sessions when updating credentials
                  </label>

                  <button type="submit" disabled={savingCredentials} style={primaryBtnStyle}>
                    <ShieldCheck size={14} />
                    {savingCredentials ? 'Updating...' : 'Save Credentials'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* 3. DOCKER PREFERENCES */}
          {activeSection === 'docker' && (
            <>
              <form onSubmit={handleSaveDockerPrefs} className="nd-density-card" style={cardStyle}>
                <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Docker & Container Preferences
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Configure container log tail limits, log refresh cadence, default container sorting, automatic status polling, and destructive action confirmation prompts.
                </p>

                <div
                  className="nd-density-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: 'var(--nd-grid-gap, 14px)',
                    marginBottom: '16px'
                  }}
                >
                  <div>
                    <label style={labelStyle}>Container Log Tail Limit</label>
                    <select
                      value={draft.container_log_limit}
                      onChange={(e) =>
                        setDraft({ ...draft, container_log_limit: Number(e.target.value) })
                      }
                      style={inputStyle}
                    >
                      <option value={50}>50 lines</option>
                      <option value={100}>100 lines</option>
                      <option value={250}>250 lines (Default)</option>
                      <option value={500}>500 lines</option>
                      <option value={1000}>1,000 lines</option>
                      <option value={2500}>2,500 lines</option>
                    </select>
                    <div style={helpTextStyle}>
                      Maximum number of recent log lines retrieved per container request.
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Log Refresh Interval</label>
                    <select
                      value={draft.log_refresh_interval}
                      onChange={(e) =>
                        setDraft({ ...draft, log_refresh_interval: Number(e.target.value) })
                      }
                      style={inputStyle}
                    >
                      <option value={0}>Manual Refresh Only (Off)</option>
                      <option value={2}>Every 2 seconds</option>
                      <option value={5}>Every 5 seconds (Default)</option>
                      <option value={10}>Every 10 seconds</option>
                      <option value={30}>Every 30 seconds</option>
                    </select>
                    <div style={helpTextStyle}>
                      How frequently live container logs stream updates from the Docker socket.
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Container & Host Sort Field</label>
                    <select
                      value={draft.container_sort_by}
                      onChange={(e) => setDraft({ ...draft, container_sort_by: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="hostname">Container / Host Name</option>
                      <option value="status">Runtime Status (Active First)</option>
                      <option value="ip">IPv4 Address</option>
                      <option value="device_type">Workload Type (Physical / Container)</option>
                    </select>
                    <div style={helpTextStyle}>
                      Primary attribute used to order containers and nodes in the inventory.
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Sort Direction</label>
                    <select
                      value={draft.container_sort_order}
                      onChange={(e) => setDraft({ ...draft, container_sort_order: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="asc">Ascending (A → Z / Low → High)</option>
                      <option value="desc">Descending (Z → A / High → Low)</option>
                    </select>
                    <div style={helpTextStyle}>
                      Sorting direction applied to the selected container sort field.
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Automatic Container Status Refresh</label>
                    <select
                      value={draft.auto_refresh_interval}
                      onChange={(e) =>
                        setDraft({ ...draft, auto_refresh_interval: Number(e.target.value) })
                      }
                      style={inputStyle}
                    >
                      <option value={0}>Disabled (Manual Refresh Only)</option>
                      <option value={15}>Every 15 seconds</option>
                      <option value={30}>Every 30 seconds</option>
                      <option value={60}>Every 60 seconds</option>
                      <option value={300}>Every 5 minutes</option>
                    </select>
                    <div style={helpTextStyle}>
                      Background polling interval for container and host status telemetry.
                    </div>
                  </div>
                </div>

                {/* Confirmation Prompts Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '16px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
                      Confirmation Prompts for Destructive Actions
                    </div>
                    <div style={helpTextStyle}>
                      Require explicit confirmation before deleting hosts/containers, removing subnets, or overwriting inventory records.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.confirm_destructive)}
                    onChange={(e) =>
                      setDraft({ ...draft, confirm_destructive: e.target.checked })
                    }
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                <div
                  style={{
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}
                >
                  <button type="submit" disabled={savingSettings} style={primaryBtnStyle}>
                    <Check size={14} />
                    {savingSettings ? 'Saving...' : 'Save Docker Preferences'}
                  </button>
                </div>
              </form>

              {/* Live Container Log Streamer honoring container_log_limit & log_refresh_interval */}
              <div className="nd-density-card" style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '12px'
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 600 }}>
                      Container Log Inspector
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Tail limit: {draft.container_log_limit} lines · Refresh:{' '}
                      {draft.log_refresh_interval
                        ? `Every ${draft.log_refresh_interval}s`
                        : 'Manual'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={selectedContainer}
                      onChange={(e) => setSelectedContainer(e.target.value)}
                      style={{ ...inputStyle, width: 'auto', minWidth: '180px' }}
                    >
                      {containerHosts.length === 0 ? (
                        <option value="">No synced containers</option>
                      ) : (
                        containerHosts.map((c) => (
                          <option key={c.id} value={c.hostname}>
                            {c.hostname} ({c.status})
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => fetchLogsForContainer(selectedContainer)}
                      disabled={!selectedContainer || loadingLogs}
                      style={secondaryBtnStyle}
                    >
                      <RefreshCw size={13} />
                      Refresh Logs
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '7px',
                    padding: '12px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '11.5px',
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)'
                  }}
                >
                  {containerHosts.length === 0 ? (
                    <div>Run "Sync Docker" from the sidebar to discover active containers and inspect logs.</div>
                  ) : containerLogs.length === 0 ? (
                    <div>{loadingLogs ? 'Loading container logs...' : 'No log output returned.'}</div>
                  ) : (
                    containerLogs.map((line, i) => (
                      <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* 4. GENERAL / SYSTEM (Read-Only Telemetry + Factory Reset) */}
          {activeSection === 'system' && (
            <div className="nd-density-card" style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '14px'
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                    General & System Information
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Read-only runtime status, process uptime, API health, and storage diagnostics.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={fetchAccountAndSystem}
                    disabled={loadingSystem}
                    style={secondaryBtnStyle}
                  >
                    <RefreshCw size={13} />
                    Refresh Status
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmModal({
                        title: 'Reset Settings to Factory Defaults',
                        description:
                          'Restore all appearance and Docker preferences to their default values? Your hosts, subnets, and operator credentials will not be modified.',
                        confirmLabel: 'Reset Defaults',
                        danger: true,
                        onConfirm: executeResetSettings
                      })
                    }
                    style={secondaryBtnStyle}
                  >
                    <RotateCcw size={13} />
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="nd-spec-list">
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Application Version</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    NetDock v{systemInfo?.app_version || '1.4.0'}
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Application Uptime</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    {systemInfo ? formatUptime(systemInfo.uptime_seconds) : '—'}
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Backend / API Status</span>
                  <div
                    className="nd-spec-value"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--status-emerald, #10b981)',
                      fontWeight: 600
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--status-emerald, #10b981)'
                      }}
                    />
                    Online & Healthy (HTTP 200)
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Docker Engine Socket</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    <span
                      style={{
                        color:
                          systemInfo?.docker_status === 'connected'
                            ? 'var(--status-emerald, #10b981)'
                            : 'var(--status-rose, #f43f5e)',
                        fontWeight: 600
                      }}
                    >
                      {systemInfo?.docker_status === 'connected' ? 'Connected' : 'Unreachable'}
                    </span>{' '}
                    ({systemInfo?.docker_socket_path || '/var/run/docker.sock'})
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">SQLite Database Storage</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    {systemInfo?.database_path || '/data/netdock.db'} (
                    {formatBytes(systemInfo?.database_size_bytes)})
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Runtime Environment</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    Python {systemInfo?.python_version || '3.11'} · {systemInfo?.os_platform || 'Linux'}
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Tracked Inventory Records</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    {systemInfo?.counts?.hosts ?? 0} Hosts ({systemInfo?.counts?.containers ?? 0}{' '}
                    Containers) · {systemInfo?.counts?.subnets ?? 0} Subnets
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. ABOUT NETDOCK */}
          {activeSection === 'about' && (
            <div className="nd-density-card" style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--accent-soft)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)'
                  }}
                >
                  <Activity size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>NetDock</h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--accent)'
                      }}
                    >
                      v1.4.0
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Self-Hosted Infrastructure & Docker Asset Inventory Platform
                  </div>
                </div>
              </div>

              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}
              >
                NetDock is a self-hosted network asset inventory and Docker management application built for homelab and production infrastructure visibility. It combines IPAM/VLAN subnet validation, hierarchical topology mapping, and direct Docker Engine UNIX socket discovery in a single containerized deployment.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  marginBottom: '16px'
                }}
              >
                <a
                  href="https://github.com/cerbsys/netdock"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...secondaryBtnStyle,
                    textDecoration: 'none',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>GitHub Repository (cerbsys/netdock)</span>
                  <ExternalLink size={13} />
                </a>

                <a
                  href="https://github.com/cerbsys/netdock/pkgs/container/netdock"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...secondaryBtnStyle,
                    textDecoration: 'none',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Container Registry (GHCR)</span>
                  <ExternalLink size={13} />
                </a>

              </div>

              <div className="nd-spec-list">
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Container Image</span>
                  <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                    ghcr.io/cerbsys/netdock:latest
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Architecture Stack</span>
                  <div className="nd-spec-value">
                    React 18 · Vite · FastAPI · SQLModel (SQLite) · Docker Engine API
                  </div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">License</span>
                  <div className="nd-spec-value">MIT Open Source License</div>
                </div>
                <div className="nd-spec-row">
                  <span className="nd-spec-label">Credits</span>
                  <div className="nd-spec-value">
                    Engineered and maintained by cerbsys.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="nd-modal-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: '10px',
              padding: '20px',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <AlertCircle size={18} color={confirmModal.danger ? '#e11d48' : 'var(--accent)'} />
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>
                {confirmModal.title}
              </h3>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {confirmModal.description}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                style={{
                  ...primaryBtnStyle,
                  backgroundColor: confirmModal.danger ? '#e11d48' : 'var(--accent)',
                  borderColor: confirmModal.danger ? '#e11d48' : 'var(--accent)'
                }}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
