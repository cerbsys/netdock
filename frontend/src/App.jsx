import SettingsView, { DEFAULT_APP_SETTINGS, applyAppearanceToDocument } from './components/SettingsView';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Network,
  Server,
  Layers,
  Activity,
  RefreshCw,
  Download,
  Upload,
  Search,
  Plus,
  Trash2,
  Edit3,
  AlertCircle,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Check,
  Copy,
  Menu,
  Cpu,
  HardDrive,
  ShieldCheck,
  ChevronRight,
  Settings
} from 'lucide-react';

const API_BASE = '/api/v1';

const IP_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const CIDR_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[12]?[0-9])$/;
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255
  ].join('.');
}

function getRfc1918Error(ipStr) {
  if (!IP_REGEX.test(ipStr)) return 'Enter a valid IPv4 address.';
  const parts = ipStr.split('.').map(Number);
  const o1 = parts[0];
  const o2 = parts[1];

  if (o1 === 10) return null;
  if (o1 === 172) {
    return o2 >= 16 && o2 <= 31
      ? null
      : 'Private Class B must stay between 172.16.x.x and 172.31.x.x.';
  }
  if (o1 === 192) {
    return o2 === 168
      ? null
      : `192.${o2}.x.x is public. Private Class C must use 192.168.x.x.`;
  }
  return 'Address must be in a private range: 10.x, 172.16-31.x, or 192.168.x.';
}

function getSubnetInfo(cidr) {
  if (!CIDR_REGEX.test(cidr)) return null;
  const [ipStr, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const ipIntVal = ipToInt(ipStr);
  const networkInt = (ipIntVal & mask) >>> 0;
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0;
  return {
    prefix,
    networkIp: intToIp(networkInt),
    broadcastIp: intToIp(broadcastInt),
    networkInt,
    broadcastInt,
    mask
  };
}

function isIpInCidr(ip, cidr) {
  const info = getSubnetInfo(cidr);
  if (!info || !IP_REGEX.test(ip)) return false;
  return ((ipToInt(ip) & info.mask) >>> 0) === info.networkInt;
}

function ModalDialog({ title, subtitle, onClose, maxWidth = '480px', children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex'
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function LoggedOutLoginScreen() {
  return (
    <div
      style={{
        backgroundColor: '#0b0f17',
        color: '#f1f5f9',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1.5rem',
        WebkitFontSmoothing: 'antialiased'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: '#0f1522',
          border: '1px solid rgba(148, 163, 184, 0.14)',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'rgba(99, 102, 241, 0.14)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a5b4fc'
            }}
          >
            <Network size={16} />
          </div>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#f8fafc' }}>NetDock</span>
        </div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.375rem' }}>
          Sign in to NetDock
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Enter your operator credentials to access the infrastructure inventory.
        </p>
        <form method="POST" action="/auth/login">
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="username"
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="admin"
              required
              autoFocus
              autoComplete="username"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                backgroundColor: '#090d16',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '7px',
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Operator key
            </label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                backgroundColor: '#090d16',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '7px',
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '7px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);

  const handleLogout = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    window.__netdock_logging_out = true;

    // 1. Immediately switch React render to the Login screen (no empty dashboard flash!)
    setIsLoggingOut(true);
    setIsAuthenticated(false);

    // 2. Purge client storage and replace browser history entry
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    document.cookie = 'netdock_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    try {
      window.history.replaceState({ loggedOut: true }, 'NetDock — Sign In', '/auth/login');
      document.title = 'NetDock — Sign In';
    } catch (_) {}

    // 3. Await backend session invalidation & cookie deletion
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store'
      });
    } catch (_) {
      // Ignore network/expired errors; client is already on the login screen
    } finally {
      // Clear cached state after the dashboard has already unmounted
      setHosts([]);
      setSubnets([]);
      setSelectedHostId(null);
    }
  }, []);

  useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (window.__netdock_logging_out && url.includes('/api/')) {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const res = await origFetch(...args);
      if (url.includes('/api/') && !url.includes('/auth/') && res.status === 401) {
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          window.__netdock_logging_out = true;
          setIsLoggingOut(true);
          setIsAuthenticated(false);
          try {
            window.history.replaceState({ loggedOut: true }, 'NetDock — Sign In', '/auth/login');
          } catch (_) {}
        }
      }
      return res;
    };

    const handlePopState = () => {
      if (window.__netdock_logging_out) {
        setIsAuthenticated(false);
        try {
          window.history.replaceState({ loggedOut: true }, 'NetDock — Sign In', '/auth/login');
        } catch (_) {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.fetch = origFetch;
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [hosts, setHosts] = useState([]);
  const [subnets, setSubnets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedHostId, setSelectedHostId] = useState(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('netdock_sidebar_collapsed') === 'true'
  );
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('netdock_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [appSettings, setAppSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('netdock_cached_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        applyAppearanceToDocument(parsed);
        return { ...DEFAULT_APP_SETTINGS, ...parsed };
      }
    } catch (_) {}
    return DEFAULT_APP_SETTINGS;
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const cached = localStorage.getItem('netdock_cached_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.default_tab && ['roster', 'subnets', 'topology'].includes(parsed.default_tab)) {
          return parsed.default_tab;
        }
      }
    } catch (_) {}
    return 'roster';
  });

  useEffect(() => {
    applyAppearanceToDocument(appSettings);
    if (appSettings.theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => applyAppearanceToDocument(appSettings);
      if (mq.addEventListener) mq.addEventListener('change', listener);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', listener);
      };
    }
    return undefined;
  }, [appSettings]);

  useEffect(() => {
    fetch('/api/v1/settings', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAppSettings(data);
          applyAppearanceToDocument(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const intervalSec = Number(appSettings?.auto_refresh_interval || 0);
    if (!intervalSec || intervalSec <= 0) return undefined;
    const timer = setInterval(() => {
      if (!window.__netdock_logging_out && typeof fetchData === 'function') {
        fetchData();
      }
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [appSettings?.auto_refresh_interval]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [syncingDocker, setSyncingDocker] = useState(false);

  const [showHostModal, setShowHostModal] = useState(false);
  const [showSubnetModal, setShowSubnetModal] = useState(false);
  const fileInputRef = useRef(null);

  const [newHost, setNewHost] = useState({
    id: '',
    hostname: '',
    ip: '',
    mac: '',
    os: 'Ubuntu 24.04 LTS',
    status: 'active',
    device_type: 'server',
    subnet_id: '',
    parent_id: '',
    notes: ''
  });

  const [newSubnet, setNewSubnet] = useState({
    id: '',
    name: '',
    cidr: '',
    vlan: '10',
    gateway: ''
  });

  const [hostErrors, setHostErrors] = useState({});
  const [subnetErrors, setSubnetErrors] = useState({});

  const showToast = useCallback((msg) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hostsRes, subnetsRes] = await Promise.all([
        fetch(`${API_BASE}/hosts`, { credentials: 'include' }),
        fetch(`${API_BASE}/subnets`, { credentials: 'include' })
      ]);

      if (hostsRes.status === 401 || subnetsRes.status === 401) {
        if (!window.__netdock_logging_out) {
          window.location.href = '/';
        }
        return;
      }

      if (!hostsRes.ok || !subnetsRes.ok) {
        throw new Error('Could not communicate with database.');
      }

      const [hostsData, subnetsData] = await Promise.all([
        hostsRes.json(),
        subnetsRes.json()
      ]);

      const validHosts = Array.isArray(hostsData) ? hostsData : [];
      const validSubnets = Array.isArray(subnetsData) ? subnetsData : [];

      setHosts(validHosts);
      setSubnets(validSubnets);

      if (validHosts.length > 0 && !selectedHostId) {
        setSelectedHostId(validHosts[0].id);
        setNotesDraft(validHosts[0].notes || '');
      }
    } catch (err) {
      if (!window.__netdock_logging_out) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedHostId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedHost = useMemo(
    () => hosts.find((h) => h.id === selectedHostId) || hosts[0] || null,
    [hosts, selectedHostId]
  );

  useEffect(() => {
    if (selectedHost) {
      setNotesDraft(selectedHost.notes || '');
      setEditingNotes(false);
    }
  }, [selectedHost]);

  const handleDockerSync = async () => {
    setSyncingDocker(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/docker/sync`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Docker socket sync failed.');
      }
      const data = await res.json();
      showToast(`Synchronized ${data.synced_count} of ${data.total_discovered} containers.`);
      fetchData();
    } catch (err) {
      setError(`Sync Fault: ${err.message}`);
    } finally {
      setSyncingDocker(false);
    }
  };

  const validateSubnetField = (field, value, currentSubnet = newSubnet) => {
    const errs = { ...subnetErrors };
    if (field === 'name') {
      if (!value.trim() || value.trim().length < 2) {
        errs.name = 'Subnet label required (2+ chars).';
      } else {
        delete errs.name;
      }
    }
    if (field === 'cidr') {
      const trimmed = value.trim();
      if (!trimmed) {
        errs.cidr = 'CIDR notation required.';
      } else if (!CIDR_REGEX.test(trimmed)) {
        errs.cidr = 'Format: 192.168.1.0/24';
      } else {
        const baseIp = trimmed.split('/')[0];
        const rfcErr = getRfc1918Error(baseIp);
        if (rfcErr) {
          errs.cidr = rfcErr;
        } else {
          delete errs.cidr;
          if (currentSubnet.gateway) {
            validateSubnetField('gateway', currentSubnet.gateway, currentSubnet);
          }
        }
      }
    }
    if (field === 'vlan') {
      const v = parseInt(value, 10);
      if (isNaN(v) || v < 1 || v > 4094) {
        errs.vlan = 'VLAN range: 1 - 4094.';
      } else {
        delete errs.vlan;
      }
    }
    if (field === 'gateway') {
      const trimmed = value.trim();
      if (!trimmed) {
        errs.gateway = 'Gateway IP is required.';
      } else {
        const rfcErr = getRfc1918Error(trimmed);
        if (rfcErr) {
          errs.gateway = rfcErr;
        } else if (currentSubnet.cidr && CIDR_REGEX.test(currentSubnet.cidr.trim())) {
          const info = getSubnetInfo(currentSubnet.cidr.trim());
          if (!isIpInCidr(trimmed, currentSubnet.cidr.trim())) {
            errs.gateway = `Must be inside ${currentSubnet.cidr.trim()}.`;
          } else if (info && trimmed === info.networkIp) {
            errs.gateway = 'Cannot assign base network address (.0).';
          } else if (info && trimmed === info.broadcastIp) {
            errs.gateway = 'Cannot assign broadcast address (.255).';
          } else {
            delete errs.gateway;
          }
        } else {
          delete errs.gateway;
        }
      }
    }
    setSubnetErrors(errs);
  };

  const validateHostField = (field, value, currentHost = newHost) => {
    const errs = { ...hostErrors };
    if (field === 'hostname') {
      const trimmed = value.trim();
      if (!trimmed) {
        errs.hostname = 'Hostname is required.';
      } else if (!HOSTNAME_REGEX.test(trimmed)) {
        errs.hostname = 'Letters, numbers, and hyphens only.';
      } else {
        delete errs.hostname;
      }
    }
    if (field === 'ip') {
      const trimmed = value.trim();
      if (!trimmed) {
        errs.ip = 'IP address is required.';
      } else {
        const rfcErr = getRfc1918Error(trimmed);
        if (rfcErr) {
          errs.ip = rfcErr;
        } else if (hosts.some((h) => h.ip === trimmed)) {
          const existing = hosts.find((h) => h.ip === trimmed);
          errs.ip = `Already in use by ${existing.hostname}.`;
        } else {
          delete errs.ip;
          if (currentHost.subnet_id) {
            const sub = subnets.find((s) => s.id === currentHost.subnet_id);
            if (sub) {
              const info = getSubnetInfo(sub.cidr);
              if (!isIpInCidr(trimmed, sub.cidr)) {
                errs.ip = `IP must be within ${sub.name} (${sub.cidr}).`;
              } else if (info && trimmed === info.networkIp) {
                errs.ip = 'Cannot assign base network address (.0).';
              } else if (info && trimmed === info.broadcastIp) {
                errs.ip = 'Cannot assign broadcast address (.255).';
              }
            }
          }
        }
      }
    }
    if (field === 'mac') {
      const trimmed = value.trim();
      if (trimmed && !MAC_REGEX.test(trimmed)) {
        errs.mac = 'Format: xx:xx:xx:xx:xx:xx (or empty)';
      } else {
        delete errs.mac;
      }
    }
    if (field === 'subnet_id') {
      if (!value) {
        errs.subnet_id = 'Please assign a subnet.';
      } else {
        delete errs.subnet_id;
        if (currentHost.ip && !getRfc1918Error(currentHost.ip.trim())) {
          const sub = subnets.find((s) => s.id === value);
          if (sub) {
            const info = getSubnetInfo(sub.cidr);
            const ipTrim = currentHost.ip.trim();
            if (!isIpInCidr(ipTrim, sub.cidr)) {
              errs.ip = `IP must be within ${sub.name} (${sub.cidr}).`;
            } else if (info && ipTrim === info.networkIp) {
              errs.ip = 'Cannot assign base network address (.0).';
            } else if (info && ipTrim === info.broadcastIp) {
              errs.ip = 'Cannot assign broadcast address (.255).';
            } else if (!hosts.some((h) => h.ip === ipTrim)) {
              delete errs.ip;
            }
          }
        }
      }
    }
    setHostErrors(errs);
  };

  const isSubnetValid = useMemo(() => {
    const baseIp = newSubnet.cidr.trim().split('/')[0];
    const info = getSubnetInfo(newSubnet.cidr.trim());
    const gw = newSubnet.gateway.trim();
    const vlanNum = parseInt(newSubnet.vlan, 10);
    return (
      newSubnet.name.trim().length >= 2 &&
      CIDR_REGEX.test(newSubnet.cidr.trim()) &&
      !getRfc1918Error(baseIp) &&
      vlanNum >= 1 &&
      vlanNum <= 4094 &&
      !getRfc1918Error(gw) &&
      isIpInCidr(gw, newSubnet.cidr.trim()) &&
      info &&
      gw !== info.networkIp &&
      gw !== info.broadcastIp &&
      Object.keys(subnetErrors).length === 0
    );
  }, [newSubnet, subnetErrors]);

  const isHostValid = useMemo(() => {
    const sub = subnets.find((s) => s.id === newHost.subnet_id);
    const info = sub ? getSubnetInfo(sub.cidr) : null;
    const ipTrim = newHost.ip.trim();
    const macTrim = newHost.mac.trim();
    const macOk = !macTrim || MAC_REGEX.test(macTrim);
    return (
      HOSTNAME_REGEX.test(newHost.hostname.trim()) &&
      !getRfc1918Error(ipTrim) &&
      macOk &&
      !!newHost.subnet_id &&
      sub &&
      isIpInCidr(ipTrim, sub.cidr) &&
      info &&
      ipTrim !== info.networkIp &&
      ipTrim !== info.broadcastIp &&
      !hosts.some((h) => h.ip === ipTrim) &&
      Object.keys(hostErrors).length === 0
    );
  }, [newHost, hostErrors, subnets, hosts]);

  const filteredHosts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return hosts.filter(
      (h) =>
        !q ||
        h.hostname?.toLowerCase().includes(q) ||
        h.ip?.includes(q) ||
        h.mac?.toLowerCase().includes(q) ||
        h.device_type?.toLowerCase().includes(q) ||
        h.os?.toLowerCase().includes(q)
    );
  }, [hosts, searchQuery]);

  const physicalHosts = useMemo(
    () =>
      filteredHosts.filter((h) =>
        ['bare-metal', 'server', 'switch', 'sbc'].includes((h.device_type || '').toLowerCase())
      ),
    [filteredHosts]
  );

  const virtualHosts = useMemo(
    () =>
      filteredHosts.filter(
        (h) =>
          !['bare-metal', 'server', 'switch', 'sbc'].includes((h.device_type || '').toLowerCase())
      ),
    [filteredHosts]
  );

  const stats = useMemo(
    () => ({
      total: hosts.length,
      active: hosts.filter((h) => h.status === 'active').length,
      containers: hosts.filter((h) => h.device_type === 'container').length
    }),
    [hosts]
  );

  const handleSaveNotes = async () => {
    if (!selectedHost) return;
    try {
      const res = await fetch(`${API_BASE}/hosts/${selectedHost.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, notes: notesDraft })
      });
      if (!res.ok) throw new Error('Could not save notes.');
      const updated = await res.json();
      setHosts((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      setEditingNotes(false);
      showToast('Runbook notes updated.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteHost = async (id) => {
    const target = hosts.find((h) => h.id === id);
    const label = target ? target.hostname : id;
    if (!confirm(`Remove host "${label}" from inventory?`)) return;
    try {
      const res = await fetch(`${API_BASE}/hosts/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Could not delete host.');
      setHosts((prev) => prev.filter((h) => h.id !== id));
      if (selectedHostId === id) {
        const remaining = hosts.filter((h) => h.id !== id);
        setSelectedHostId(remaining.length > 0 ? remaining[0].id : null);
      }
      showToast(`Removed ${label}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSubnet = async (sub) => {
    const assigned = hosts.filter((h) => h.subnet_id === sub.id);
    if (assigned.length > 0) {
      alert(
        `Cannot delete "${sub.name}". Assigned hosts exist:\n${assigned
          .map((h) => h.hostname)
          .join(', ')}`
      );
      return;
    }
    if (!confirm(`Delete subnet "${sub.name}" (${sub.cidr})?`)) return;
    try {
      const res = await fetch(`${API_BASE}/subnets/${sub.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Could not delete subnet.');
      }
      setSubnets((prev) => prev.filter((s) => s.id !== sub.id));
      showToast(`Deleted subnet ${sub.name}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/export`, { credentials: 'include' });
      if (!res.ok) throw new Error('Could not generate backup file.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netdock_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported.');
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedSubnet = useMemo(
    () => subnets.find((s) => s.id === selectedHost?.subnet_id) || null,
    [subnets, selectedHost]
  );

  const selectedParent = useMemo(
    () => hosts.find((h) => h.id === selectedHost?.parent_id) || null,
    [hosts, selectedHost]
  );

  const hostedChildrenCount = useMemo(
    () => (selectedHost ? hosts.filter((h) => h.parent_id === selectedHost.id).length : 0),
    [hosts, selectedHost]
  );

  const renderHostSection = (title, subtitle, groupHosts, emptyMessage) => (
    <div style={{ marginBottom: '28px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em'
            }}
          >
            {title}
          </h2>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-text)'
            }}
          >
            {groupHosts.length}
          </span>
        </div>
        {subtitle && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {groupHosts.length === 0 ? (
        <div
          style={{
            padding: '28px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: '10px',
            color: 'var(--text-muted)',
            fontSize: '12.5px'
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="nd-table-card">
          <div className="nd-host-grid-header">
            <div>Host / Node</div>
            <div>Type</div>
            <div className="nd-col-subnet">Subnet</div>
            <div className="nd-col-mac">MAC Address</div>
            <div style={{ textAlign: 'right' }}>IPv4 Address</div>
          </div>

          {groupHosts.map((host) => {
            const isSelected = host.id === selectedHost?.id;
            const sub = subnets.find((s) => s.id === host.subnet_id);
            const isActive = host.status === 'active';

            return (
              <div
                key={host.id}
                onClick={() => {
                  setSelectedHostId(host.id);
                  setMobileInspectorOpen(true);
                }}
                className={`nd-host-grid-row ${isSelected ? 'is-selected' : ''}`}
              >
                {/* Column 1: Status + Hostname + OS */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span
                    title={isActive ? 'Active' : 'Offline'}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: isActive ? 'var(--status-emerald)' : 'var(--status-rose)',
                      boxShadow: isActive
                        ? '0 0 0 3px rgba(16, 185, 129, 0.15)'
                        : '0 0 0 3px rgba(244, 63, 94, 0.15)'
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="nd-truncate"
                      title={host.hostname}
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: isSelected ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      {host.hostname}
                    </div>
                    {host.os && (
                      <div
                        className="nd-truncate"
                        title={host.os}
                        style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}
                      >
                        {host.os}
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Device Type Badge */}
                <div style={{ minWidth: 0 }}>
                  <span
                    className="nd-truncate"
                    style={{
                      display: 'inline-block',
                      maxWidth: '100%',
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(148, 163, 184, 0.08)',
                      border: '1px solid rgba(148, 163, 184, 0.12)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {host.device_type}
                  </span>
                </div>

                {/* Column 3: Subnet */}
                <div className="nd-col-subnet nd-truncate" title={sub ? `${sub.name} (${sub.cidr})` : ''}>
                  {sub ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {sub.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>

                {/* Column 4: MAC Address */}
                <div className="nd-col-mac nd-truncate" title={host.mac || 'No MAC recorded'}>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontFamily: 'monospace',
                      color: host.mac ? 'var(--text-secondary)' : 'var(--text-muted)'
                    }}
                  >
                    {host.mac || '—'}
                  </span>
                </div>

                {/* Column 5: IPv4 Address */}
                <div style={{ textAlign: 'right', minWidth: 0 }}>
                  <span
                    title={host.ip}
                    style={{
                      fontSize: '12.5px',
                      fontFamily: 'monospace',
                      fontWeight: 500,
                      color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'rgba(9, 13, 20, 0.55)',
                      border: `1px solid ${
                        isSelected ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-subtle)'
                      }`,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      display: 'inline-block',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {host.ip}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isAuthenticated || isLoggingOut) {
    return <LoggedOutLoginScreen />;
  }

  return (
    <div className="nd-app-shell">
      <input
        type="file"
        ref={fileInputRef}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const res = await fetch(`${API_BASE}/import`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Could not import backup.');
            showToast('Inventory backup restored successfully.');
            fetchData();
          } catch (err) {
            setError(`Import error: ${err.message}`);
          } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 25
          }}
        />
      )}

      {/* LEFT PANEL: Navigation Sidebar */}
      <aside
        className={`nd-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${
          mobileSidebarOpen ? 'is-mobile-open' : ''
        }`}
      >
        <div>
          {/* Brand Header */}
          <div
            style={{
              height: '60px',
              padding: sidebarCollapsed ? '0 12px' : '0 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-soft)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Network size={16} />
              </div>
              {!sidebarCollapsed && (
                <div style={{ minWidth: 0 }}>
                  <div
                    className="nd-truncate"
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    NetDock
                  </div>
                  <div
                    className="nd-truncate"
                    style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    Infrastructure
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse sidebar"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  padding: '5px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexShrink: 0
                }}
              >
                <PanelLeftClose size={15} />
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand sidebar"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <PanelLeftOpen size={15} />
              </button>
            </div>
          )}

          {/* Primary Navigation */}
          <div style={{ padding: '16px 10px 8px' }}>
            {!sidebarCollapsed && (
              <div
                style={{
                  padding: '0 10px 8px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)'
                }}
              >
                Inventory
              </div>
            )}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {[
                { id: 'roster', label: 'Hosts & Nodes', icon: Server, count: hosts.length },
                { id: 'subnets', label: 'Subnets & VLANs', icon: Layers, count: subnets.length },
                { id: 'topology', label: 'Topology Tree', icon: Activity },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                      padding: sidebarCollapsed ? '9px 0' : '8px 10px',
                      borderRadius: '7px',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease, color 0.12s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Icon
                        size={15}
                        style={{
                          color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                          flexShrink: 0
                        }}
                      />
                      {!sidebarCollapsed && <span className="nd-truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && item.count !== undefined && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          backgroundColor: isActive
                            ? 'rgba(99, 102, 241, 0.24)'
                            : 'rgba(148, 163, 184, 0.08)',
                          color: isActive ? 'var(--accent-text)' : 'var(--text-muted)'
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Operations */}
          <div style={{ padding: '16px 10px 8px' }}>
            {!sidebarCollapsed && (
              <div
                style={{
                  padding: '0 10px 8px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)'
                }}
              >
                Operations
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button
                type="button"
                onClick={handleDockerSync}
                disabled={syncingDocker}
                title={sidebarCollapsed ? 'Sync Docker Containers' : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  padding: sidebarCollapsed ? '9px 0' : '8px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  cursor: syncingDocker ? 'wait' : 'pointer'
                }}
              >
                <RefreshCw
                  size={15}
                  className={syncingDocker ? 'animate-spin' : ''}
                  style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                />
                {!sidebarCollapsed && (
                  <span className="nd-truncate">
                    {syncingDocker ? 'Syncing Docker...' : 'Sync Docker'}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleExport}
                title={sidebarCollapsed ? 'Export JSON Backup' : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  padding: sidebarCollapsed ? '9px 0' : '8px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                <Download size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {!sidebarCollapsed && <span className="nd-truncate">Export JSON</span>}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={sidebarCollapsed ? 'Import JSON Backup' : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  padding: sidebarCollapsed ? '9px 0' : '8px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                <Upload size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {!sidebarCollapsed && <span className="nd-truncate">Import JSON</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: '12px 10px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: sidebarCollapsed ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              padding: sidebarCollapsed ? '7px' : '7px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: 0
            }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {!sidebarCollapsed && <span className="nd-truncate">Sign out</span>}
          </button>

          <button
            type="button"
            onClick={() => fetchData()}
            title="Refresh telemetry"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </aside>

      {/* CENTER + RIGHT AREA */}
      <div className="nd-main-wrapper">
        {/* Workspace Header */}
        <header className="nd-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <Menu size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <h1
                className="nd-truncate"
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em'
                }}
              >
                {activeTab === 'roster'
                  ? 'Hosts & Workloads'
                  : activeTab === 'subnets'
                  ? 'Subnets & VLANs'
                  : activeTab === 'settings'
                  ? 'System Settings'
                  : 'Network Topology'}
              </h1>

              {/* Telemetry Summary Badges */}
              <div
                className="hidden lg:flex"
                style={{
                  alignItems: 'center',
                  gap: '10px',
                  paddingLeft: '12px',
                  borderLeft: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                <span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {stats.total}
                  </strong>{' '}
                  Total
                </span>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-emerald)'
                    }}
                  />
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {stats.active}
                  </strong>{' '}
                  Active
                </span>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {stats.containers}
                  </strong>{' '}
                  Containers
                </span>
              </div>
            </div>
          </div>

          {/* Search, Filter & Primary Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {notice && (
              <div
                className="hidden xl:flex"
                style={{
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--status-emerald-soft)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#6ee7b7'
                }}
              >
                <Check size={13} />
                <span>{notice}</span>
              </div>
            )}

            {activeTab === 'roster' && (
              <>
                {/* Category Filter Segmented Control */}
                <div
                  className="hidden sm:flex"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '7px',
                    padding: '2px'
                  }}
                >
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'physical', label: 'Physical' },
                    { id: 'virtual', label: 'Virtual' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id)}
                      style={{
                        border: 'none',
                        padding: '4px 9px',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        backgroundColor:
                          categoryFilter === tab.id ? 'var(--bg-elevated)' : 'transparent',
                        color:
                          categoryFilter === tab.id
                            ? 'var(--text-primary)'
                            : 'var(--text-muted)'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search host, IP, MAC..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="nd-input"
                    style={{
                      paddingLeft: '30px',
                      paddingRight: searchQuery ? '26px' : '10px',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      width: '200px'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex'
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === 'settings' ? null : activeTab === 'subnets' ? (
              <button
                type="button"
                onClick={() => setShowSubnetModal(true)}
                className="nd-btn-primary"
              >
                <Plus size={15} />
                <span>New Subnet</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!newHost.subnet_id && subnets.length > 0) {
                    setNewHost((prev) => ({ ...prev, subnet_id: subnets[0].id }));
                  }
                  setShowHostModal(true);
                }}
                className="nd-btn-primary"
              >
                <Plus size={15} />
                <span>Add Host</span>
              </button>
            )}
          </div>
        </header>

        {error && (
          <div
            style={{
              backgroundColor: 'var(--status-rose-soft)',
              borderBottom: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '9px 24px',
              fontSize: '12.5px',
              color: '#fda4af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span className="nd-break-words">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fda4af',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* THREE-PANEL BODY: Center Workspace + Right Details Panel */}
        <main className="nd-workspace-body">
          {activeTab === 'roster' && (
            <>
              {/* CENTER PANEL: Host & Container List */}
              <div className="nd-center-canvas">
                {filteredHosts.length === 0 && !loading ? (
                  <div
                    style={{
                      maxWidth: '460px',
                      margin: '48px auto',
                      padding: '36px 24px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px dashed var(--border-strong)',
                      borderRadius: '12px'
                    }}
                  >
                    <Server
                      size={28}
                      style={{ color: 'var(--accent-text)', margin: '0 auto 12px' }}
                    />
                    <h3
                      style={{
                        margin: '0 0 6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}
                    >
                      No matching hosts found
                    </h3>
                    <p
                      style={{
                        margin: '0 0 18px',
                        fontSize: '12.5px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5
                      }}
                    >
                      Provision a physical or virtual host manually, or synchronize active
                      containers from the local Docker socket.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowHostModal(true)}
                        className="nd-btn-primary"
                      >
                        <Plus size={14} />
                        <span>Add Host</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDockerSync}
                        className="nd-btn-secondary"
                      >
                        <RefreshCw size={14} />
                        <span>Sync Docker</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(categoryFilter === 'all' || categoryFilter === 'physical') &&
                      renderHostSection(
                        'Physical Infrastructure',
                        'Bare-metal servers, switches, and SBC appliances',
                        physicalHosts,
                        'No physical hardware registered.'
                      )}

                    {(categoryFilter === 'all' || categoryFilter === 'virtual') &&
                      renderHostSection(
                        'Virtual Workloads & Containers',
                        'Docker containers and virtual machines',
                        virtualHosts,
                        'No virtual workloads or containers recorded.'
                      )}
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Host Details Inspector */}
              <aside
                className={`nd-inspector-panel ${
                  !mobileInspectorOpen ? 'is-hidden-mobile' : ''
                }`}
              >
                {selectedHost ? (
                  <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {/* 1. Overview Header */}
                    <div
                      style={{
                        paddingBottom: '16px',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '6px',
                              flexWrap: 'wrap'
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                backgroundColor:
                                  selectedHost.status === 'active'
                                    ? 'var(--status-emerald-soft)'
                                    : 'var(--status-rose-soft)',
                                color:
                                  selectedHost.status === 'active' ? '#34d399' : '#fb7185'
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor:
                                    selectedHost.status === 'active'
                                      ? 'var(--status-emerald)'
                                      : 'var(--status-rose)'
                                }}
                              />
                              {selectedHost.status}
                            </span>

                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                textTransform: 'capitalize',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                backgroundColor: 'var(--accent-soft)',
                                color: 'var(--accent-text)'
                              }}
                            >
                              {selectedHost.device_type}
                            </span>
                          </div>

                          <h2
                            className="nd-break-words"
                            style={{
                              margin: 0,
                              fontSize: '17px',
                              fontWeight: 600,
                              color: '#ffffff',
                              lineHeight: 1.3
                            }}
                          >
                            {selectedHost.hostname}
                          </h2>
                          <p
                            className="nd-break-words"
                            style={{
                              margin: '4px 0 0',
                              fontSize: '12px',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            {selectedHost.os || 'Linux System'}
                          </p>
                        </div>

                        {/* Close button on tablet/mobile overlay */}
                        <button
                          type="button"
                          onClick={() => setMobileInspectorOpen(false)}
                          className="xl:hidden"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            padding: '5px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          title="Close inspector"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    {/* 2. Network & System Specifications */}
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-muted)',
                          marginBottom: '8px'
                        }}
                      >
                        Network & Specifications
                      </div>

                      <div className="nd-spec-list">
                        <div className="nd-spec-row">
                          <span className="nd-spec-label">IPv4 Address</span>
                          <div className="nd-spec-value">
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {selectedHost.ip}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selectedHost.ip, 'ip')}
                              title="Copy IP"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color:
                                  copiedField === 'ip'
                                    ? 'var(--status-emerald)'
                                    : 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                flexShrink: 0
                              }}
                            >
                              {copiedField === 'ip' ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>

                        <div className="nd-spec-row">
                          <span className="nd-spec-label">MAC Address</span>
                          <div className="nd-spec-value">
                            <span
                              style={{
                                fontFamily: 'monospace',
                                color: selectedHost.mac
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)'
                              }}
                            >
                              {selectedHost.mac || 'Not recorded'}
                            </span>
                            {selectedHost.mac && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(selectedHost.mac, 'mac')}
                                title="Copy MAC"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color:
                                    copiedField === 'mac'
                                      ? 'var(--status-emerald)'
                                      : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  flexShrink: 0
                                }}
                              >
                                {copiedField === 'mac' ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="nd-spec-row">
                          <span className="nd-spec-label">Device Class</span>
                          <div className="nd-spec-value" style={{ textTransform: 'capitalize' }}>
                            {selectedHost.device_type}
                          </div>
                        </div>

                        <div className="nd-spec-row">
                          <span className="nd-spec-label">OS / Kernel</span>
                          <div className="nd-spec-value">
                            {selectedHost.os || 'Linux'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Subnet & Hierarchy Information */}
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-muted)',
                          marginBottom: '8px'
                        }}
                      >
                        Subnet & Topology
                      </div>

                      <div className="nd-spec-list">
                        <div className="nd-spec-row">
                          <span className="nd-spec-label">Subnet</span>
                          <div className="nd-spec-value">
                            {selectedSubnet ? selectedSubnet.name : selectedHost.subnet_id || '—'}
                          </div>
                        </div>

                        {selectedSubnet && (
                          <>
                            <div className="nd-spec-row">
                              <span className="nd-spec-label">CIDR / VLAN</span>
                              <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                                {selectedSubnet.cidr} · VLAN {selectedSubnet.vlan}
                              </div>
                            </div>
                            <div className="nd-spec-row">
                              <span className="nd-spec-label">Gateway</span>
                              <div className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                                {selectedSubnet.gateway}
                              </div>
                            </div>
                          </>
                        )}

                        <div className="nd-spec-row">
                          <span className="nd-spec-label">Parent Node</span>
                          <div className="nd-spec-value">
                            {selectedParent ? (
                              <button
                                type="button"
                                onClick={() => setSelectedHostId(selectedParent.id)}
                                style={{
                                  background: 'var(--accent-soft)',
                                  border: '1px solid rgba(99, 102, 241, 0.3)',
                                  color: 'var(--accent-text)',
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {selectedParent.hostname}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Standalone Node
                              </span>
                            )}
                          </div>
                        </div>

                        {hostedChildrenCount > 0 && (
                          <div className="nd-spec-row">
                            <span className="nd-spec-label">Child Workloads</span>
                            <div className="nd-spec-value">
                              <span style={{ fontFamily: 'monospace', color: 'var(--accent-text)' }}>
                                {hostedChildrenCount} hosted
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. Runbook & Notes */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--text-muted)'
                          }}
                        >
                          Runbook & Notes
                        </span>

                        {editingNotes ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingNotes(false)}
                              className="nd-btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveNotes}
                              className="nd-btn-primary"
                              style={{ padding: '3px 10px', fontSize: '11.5px' }}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingNotes(true)}
                            className="nd-btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>

                      {editingNotes ? (
                        <textarea
                          rows={7}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Document exposed ports, reverse proxy routes, or maintenance steps..."
                          className="nd-input"
                          style={{
                            fontFamily: 'monospace',
                            lineHeight: 1.55,
                            resize: 'vertical'
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => setEditingNotes(true)}
                          className="nd-break-words"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            fontSize: '12px',
                            fontFamily: selectedHost.notes ? 'monospace' : 'inherit',
                            color: selectedHost.notes
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.55,
                            minHeight: '104px',
                            cursor: 'text'
                          }}
                        >
                          {selectedHost.notes ||
                            'No runbook notes recorded. Click Edit to document ports, services, or configuration details.'}
                        </div>
                      )}
                    </div>

                    {/* 5. Available Actions */}
                    <div
                      style={{
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteHost(selectedHost.id)}
                        className="nd-btn-danger"
                        style={{ width: '100%' }}
                      >
                        <Trash2 size={14} />
                        <span>Remove Host from Inventory</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '12.5px'
                    }}
                  >
                    Select a host or container from the list to inspect its specifications.
                  </div>
                )}
              </aside>
            </>
          )}

          {/* SUBNETS VIEW */}
          {activeTab === 'subnets' && (
            <div className="nd-center-canvas">
              <div style={{ maxWidth: '960px' }}>
                <div style={{ marginBottom: '18px' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    Configured Broadcast Domains
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Private RFC1918 networks, default router gateways, and VLAN boundaries.
                  </p>
                </div>

                {subnets.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 24px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: '10px',
                      color: 'var(--text-muted)',
                      fontSize: '12.5px'
                    }}
                  >
                    No subnets configured. Click "New Subnet" to allocate a private network range.
                  </div>
                ) : (
                  <div className="nd-table-card">
                    {subnets.map((sub, idx) => {
                      const allocatedCount = hosts.filter((h) => h.subnet_id === sub.id).length;
                      return (
                        <div
                          key={sub.id}
                          style={{
                            padding: '16px 20px',
                            borderBottom:
                              idx === subnets.length - 1
                                ? 'none'
                                : '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span
                                className="nd-break-words"
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)'
                                }}
                              >
                                {sub.name}
                              </span>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  backgroundColor: 'var(--accent-soft)',
                                  color: 'var(--accent-text)'
                                }}
                              >
                                VLAN {sub.vlan}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                marginTop: '6px',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                flexWrap: 'wrap'
                              }}
                            >
                              <span>
                                Gateway:{' '}
                                <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                  {sub.gateway}
                                </strong>
                              </span>
                              <span>·</span>
                              <span>
                                Allocated Hosts:{' '}
                                <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                  {allocatedCount}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontFamily: 'monospace',
                                fontWeight: 500,
                                padding: '4px 10px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)'
                              }}
                            >
                              {sub.cidr}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubnet(sub)}
                              className="nd-btn-danger"
                              style={{ padding: '6px 8px' }}
                              title="Delete Subnet"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <SettingsView
              appSettings={appSettings}
              hosts={hosts}
              onUpdateSettings={(updated) => {
                setAppSettings(updated);
                applyAppearanceToDocument(updated);
              }}
              onNotify={(msg, isErr) => {
                if (isErr) {
                  setError(msg);
                } else {
                  setNotice(msg);
                  setTimeout(() => setNotice(null), 4000);
                }
              }}
              onRefreshData={fetchData}
            />
          )}

          {/* TOPOLOGY VIEW */}
          {activeTab === 'topology' && (
            <div className="nd-center-canvas">
              <div style={{ maxWidth: '960px' }}>
                <div style={{ marginBottom: '18px' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    Infrastructure Hierarchy
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Relationship between physical hypervisors and hosted virtual workloads or containers.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {hosts
                    .filter((h) => !h.parent_id)
                    .map((parent) => {
                      const children = hosts.filter((c) => c.parent_id === parent.id);
                      return (
                        <div key={parent.id} className="nd-table-card" style={{ padding: '16px 20px' }}>
                          <div
                            onClick={() => {
                              setSelectedHostId(parent.id);
                              setActiveTab('roster');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              cursor: 'pointer',
                              flexWrap: 'wrap'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '7px',
                                  backgroundColor: 'var(--accent-soft)',
                                  color: 'var(--accent-text)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                <Server size={15} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span
                                    className="nd-break-words"
                                    style={{
                                      fontSize: '13.5px',
                                      fontWeight: 600,
                                      color: 'var(--text-primary)'
                                    }}
                                  >
                                    {parent.hostname}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      textTransform: 'capitalize',
                                      padding: '1px 7px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                                      color: 'var(--text-secondary)'
                                    }}
                                  >
                                    {parent.device_type}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              {children.length > 0 && (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                  {children.length} {children.length === 1 ? 'workload' : 'workloads'}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontFamily: 'monospace',
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                  backgroundColor: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-primary)'
                                }}
                              >
                                {parent.ip}
                              </span>
                            </div>
                          </div>

                          {children.length > 0 && (
                            <div
                              style={{
                                marginTop: '14px',
                                marginLeft: '13px',
                                paddingLeft: '16px',
                                borderLeft: '2px solid var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}
                            >
                              {children.map((child) => (
                                <div
                                  key={child.id}
                                  onClick={() => {
                                    setSelectedHostId(child.id);
                                    setActiveTab('roster');
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    padding: '8px 12px',
                                    borderRadius: '7px',
                                    backgroundColor: 'rgba(9, 13, 20, 0.45)',
                                    border: '1px solid var(--border-subtle)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                    <span
                                      style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        backgroundColor:
                                          child.status === 'active'
                                            ? 'var(--status-emerald)'
                                            : 'var(--status-rose)'
                                      }}
                                    />
                                    <span
                                      className="nd-truncate"
                                      title={child.hostname}
                                      style={{
                                        fontSize: '12.5px',
                                        fontWeight: 500,
                                        color: 'var(--text-primary)'
                                      }}
                                    >
                                      {child.hostname}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        color: 'var(--text-muted)',
                                        textTransform: 'capitalize',
                                        flexShrink: 0
                                      }}
                                    >
                                      {child.device_type}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontFamily: 'monospace',
                                      color: 'var(--text-secondary)',
                                      flexShrink: 0
                                    }}
                                  >
                                    {child.ip}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Create Subnet */}
      {showSubnetModal && (
        <ModalDialog
          title="Create New Subnet"
          subtitle="Define a private RFC1918 broadcast domain, VLAN ID, and router gateway."
          onClose={() => {
            setShowSubnetModal(false);
            setSubnetErrors({});
          }}
          maxWidth="460px"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!isSubnetValid) return;
              try {
                const payload = {
                  ...newSubnet,
                  id: newSubnet.id.trim() || `sub-${Date.now()}`,
                  vlan: parseInt(newSubnet.vlan, 10) || 0
                };
                const res = await fetch(`${API_BASE}/subnets`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (!res.ok) {
                  const errData = await res.json();
                  throw new Error(errData.detail || 'Could not create subnet.');
                }
                const created = await res.json();
                setSubnets((prev) => [...prev, created]);
                setShowSubnetModal(false);
                setNewSubnet({ id: '', name: '', cidr: '', vlan: '10', gateway: '' });
                setSubnetErrors({});
                showToast(`Created subnet ${created.name}.`);
              } catch (err) {
                setError(err.message);
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}
              >
                Subnet Name
              </label>
              <input
                type="text"
                placeholder="e.g. Core Infrastructure"
                value={newSubnet.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewSubnet((prev) => ({ ...prev, name: val }));
                  validateSubnetField('name', val);
                }}
                className={`nd-input ${subnetErrors.name ? 'has-error' : ''}`}
              />
              {subnetErrors.name && (
                <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                  {subnetErrors.name}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  CIDR Block
                </label>
                <input
                  type="text"
                  placeholder="192.168.1.0/24"
                  value={newSubnet.cidr}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = { ...newSubnet, cidr: val };
                    setNewSubnet(next);
                    validateSubnetField('cidr', val, next);
                  }}
                  className={`nd-input ${subnetErrors.cidr ? 'has-error' : ''}`}
                  style={{ fontFamily: 'monospace' }}
                />
                {subnetErrors.cidr && (
                  <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                    {subnetErrors.cidr}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  VLAN ID
                </label>
                <input
                  type="number"
                  placeholder="10"
                  value={newSubnet.vlan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSubnet((prev) => ({ ...prev, vlan: val }));
                    validateSubnetField('vlan', val);
                  }}
                  className={`nd-input ${subnetErrors.vlan ? 'has-error' : ''}`}
                  style={{ fontFamily: 'monospace' }}
                />
                {subnetErrors.vlan && (
                  <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                    {subnetErrors.vlan}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}
              >
                Default Gateway
              </label>
              <input
                type="text"
                placeholder="192.168.1.1"
                value={newSubnet.gateway}
                onChange={(e) => {
                  const val = e.target.value;
                  const next = { ...newSubnet, gateway: val };
                  setNewSubnet(next);
                  validateSubnetField('gateway', val, next);
                }}
                className={`nd-input ${subnetErrors.gateway ? 'has-error' : ''}`}
                style={{ fontFamily: 'monospace' }}
              />
              {subnetErrors.gateway && (
                <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                  {subnetErrors.gateway}
                </p>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowSubnetModal(false);
                  setSubnetErrors({});
                }}
                className="nd-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={!isSubnetValid} className="nd-btn-primary">
                Create Subnet
              </button>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* MODAL: Add Host */}
      {showHostModal && (
        <ModalDialog
          title="Provision New Host"
          subtitle="Register a physical server, appliance, virtual machine, or container."
          onClose={() => {
            setShowHostModal(false);
            setHostErrors({});
          }}
          maxWidth="520px"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!isHostValid) return;
              try {
                const payload = {
                  ...newHost,
                  id: newHost.id.trim() || `host-${Date.now()}`,
                  mac: newHost.mac.trim() || '',
                  parent_id: newHost.parent_id.trim() || null
                };
                const res = await fetch(`${API_BASE}/hosts`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (!res.ok) {
                  const errData = await res.json();
                  throw new Error(errData.detail || 'Could not create host.');
                }
                const created = await res.json();
                setHosts((prev) => [...prev, created]);
                setSelectedHostId(created.id);
                setShowHostModal(false);
                setNewHost({
                  id: '',
                  hostname: '',
                  ip: '',
                  mac: '',
                  os: 'Ubuntu 24.04 LTS',
                  status: 'active',
                  device_type: 'server',
                  subnet_id: subnets[0]?.id || '',
                  parent_id: '',
                  notes: ''
                });
                setHostErrors({});
                showToast(`Provisioned ${created.hostname}.`);
              } catch (err) {
                setError(err.message);
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  Hostname
                </label>
                <input
                  type="text"
                  placeholder="cerberus"
                  value={newHost.hostname}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewHost((prev) => ({ ...prev, hostname: val }));
                    validateHostField('hostname', val);
                  }}
                  className={`nd-input ${hostErrors.hostname ? 'has-error' : ''}`}
                />
                {hostErrors.hostname && (
                  <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                    {hostErrors.hostname}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  Device Type
                </label>
                <select
                  value={newHost.device_type}
                  onChange={(e) => setNewHost({ ...newHost, device_type: e.target.value })}
                  className="nd-input"
                >
                  <option value="bare-metal">Bare Metal</option>
                  <option value="server">Server</option>
                  <option value="container">Container</option>
                  <option value="vm">Virtual Machine</option>
                  <option value="sbc">SBC / Raspberry Pi</option>
                  <option value="switch">Switch / Router</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  IPv4 Address
                </label>
                <input
                  type="text"
                  placeholder="192.168.1.5"
                  value={newHost.ip}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = { ...newHost, ip: val };
                    setNewHost(next);
                    validateHostField('ip', val, next);
                  }}
                  className={`nd-input ${hostErrors.ip ? 'has-error' : ''}`}
                  style={{ fontFamily: 'monospace' }}
                />
                {hostErrors.ip && (
                  <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                    {hostErrors.ip}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  MAC Address <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="bc:24:11:92:aa:01"
                  value={newHost.mac}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewHost((prev) => ({ ...prev, mac: val }));
                    validateHostField('mac', val);
                  }}
                  className={`nd-input ${hostErrors.mac ? 'has-error' : ''}`}
                  style={{ fontFamily: 'monospace' }}
                />
                {hostErrors.mac && (
                  <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                    {hostErrors.mac}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  Assigned Subnet
                </label>
                <select
                  value={newHost.subnet_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = { ...newHost, subnet_id: val };
                    setNewHost(next);
                    validateHostField('subnet_id', val, next);
                  }}
                  className={`nd-input ${hostErrors.subnet_id ? 'has-error' : ''}`}
                >
                  <option value="">Select subnet...</option>
                  {subnets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.cidr})
                    </option>
                  ))}
                </select>
                {hostErrors.subnet_id && (
                  <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: '#fb7185' }}>
                    {hostErrors.subnet_id}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}
                >
                  Parent Host
                </label>
                <select
                  value={newHost.parent_id}
                  onChange={(e) => setNewHost({ ...newHost, parent_id: e.target.value })}
                  className="nd-input"
                >
                  <option value="">Standalone (None)</option>
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.hostname} ({h.ip})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}
              >
                Operating System
              </label>
              <input
                type="text"
                placeholder="Ubuntu 24.04 LTS"
                value={newHost.os}
                onChange={(e) => setNewHost({ ...newHost, os: e.target.value })}
                className="nd-input"
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowHostModal(false);
                  setHostErrors({});
                }}
                className="nd-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={!isHostValid} className="nd-btn-primary">
                Add Host
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
