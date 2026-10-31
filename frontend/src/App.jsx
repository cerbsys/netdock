import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Server, Network, Search, Plus, 
  Trash2, Edit3, Save, X, RefreshCw, Download, Upload, AlertCircle,
  Activity, Layers
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
    if (o2 >= 16 && o2 <= 31) return null;
    return 'Private Class B addresses must stay between 172.16.x.x and 172.31.x.x.';
  }
  if (o1 === 192) {
    if (o2 === 168) return null;
    return `192.${o2}.x.x is a public address. Private Class C must use 192.168.x.x.`;
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
  const targetInt = ipToInt(ip);
  return (targetInt & info.mask) >>> 0 === info.networkInt;
}

export default function App() {
  const [hosts, setHosts] = useState([]);
  const [subnets, setSubnets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [search, setSearch] = useState('');
  const [selectedHostId, setSelectedHostId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isSubnetModalOpen, setIsSubnetModalOpen] = useState(false);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hostsRes, subnetsRes] = await Promise.all([
        fetch(`${API_BASE}/hosts`),
        fetch(`${API_BASE}/subnets`)
      ]);

      if (!hostsRes.ok || !subnetsRes.ok) throw new Error('Could not communicate with the database.');

      const [hostsData, subnetsData] = await Promise.all([
        hostsRes.json(),
        subnetsRes.json()
      ]);

      setHosts(Array.isArray(hostsData) ? hostsData : []);
      setSubnets(Array.isArray(subnetsData) ? subnetsData : []);

      if (Array.isArray(hostsData) && hostsData.length > 0 && !selectedHostId) {
        setSelectedHostId(hostsData[0].id);
        setEditedNotes(hostsData[0].notes || '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedHostId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeHost = useMemo(() => {
    return hosts.find(h => h.id === selectedHostId) || hosts[0] || null;
  }, [hosts, selectedHostId]);

  useEffect(() => {
    if (activeHost) {
      setEditedNotes(activeHost.notes || '');
      setIsEditingNotes(false);
    }
  }, [activeHost]);

  // Validation: Subnet
  const validateSubnetField = (field, value, allValues = newSubnet) => {
    const errs = { ...subnetErrors };

    if (field === 'name') {
      if (!value.trim() || value.trim().length < 2) {
        errs.name = 'Please enter a name with at least 2 characters.';
      } else {
        delete errs.name;
      }
    }

    if (field === 'cidr') {
      const clean = value.trim();
      if (!clean) {
        errs.cidr = 'Subnet range is required.';
      } else if (!CIDR_REGEX.test(clean)) {
        errs.cidr = 'Use standard CIDR notation like 192.168.1.0/24.';
      } else {
        const baseIp = clean.split('/')[0];
        const rfcErr = getRfc1918Error(baseIp);
        if (rfcErr) {
          errs.cidr = rfcErr;
        } else {
          delete errs.cidr;
          if (allValues.gateway) {
            validateSubnetField('gateway', allValues.gateway, allValues);
          }
        }
      }
    }

    if (field === 'vlan') {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 4094) {
        errs.vlan = 'VLAN ID must be a number between 1 and 4094.';
      } else {
        delete errs.vlan;
      }
    }

    if (field === 'gateway') {
      const clean = value.trim();
      if (!clean) {
        errs.gateway = 'Gateway IP is required.';
      } else {
        const rfcErr = getRfc1918Error(clean);
        if (rfcErr) {
          errs.gateway = rfcErr;
        } else if (allValues.cidr && CIDR_REGEX.test(allValues.cidr.trim())) {
          const subInfo = getSubnetInfo(allValues.cidr.trim());
          if (!isIpInCidr(clean, allValues.cidr.trim())) {
            errs.gateway = `Gateway must sit inside ${allValues.cidr.trim()}.`;
          } else if (subInfo && clean === subInfo.networkIp) {
            errs.gateway = 'Gateway cannot use the network base address (.0).';
          } else if (subInfo && clean === subInfo.broadcastIp) {
            errs.gateway = 'Gateway cannot use the broadcast address (.255).';
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

  // Host Validation
  const validateHostField = (field, value, allValues = newHost) => {
    const errs = { ...hostErrors };

    if (field === 'hostname') {
      const clean = value.trim();
      if (!clean) {
        errs.hostname = 'Hostname is required.';
      } else if (!HOSTNAME_REGEX.test(clean)) {
        errs.hostname = 'Use letters, numbers, and hyphens only.';
      } else {
        delete errs.hostname;
      }
    }

    if (field === 'ip') {
      const clean = value.trim();
      if (!clean) {
        errs.ip = 'IP address is required.';
      } else {
        const rfcErr = getRfc1918Error(clean);
        if (rfcErr) {
          errs.ip = rfcErr;
        } else if (hosts.some(h => h.ip === clean)) {
          const conflict = hosts.find(h => h.ip === clean);
          errs.ip = `Already in use by ${conflict.hostname}.`;
        } else {
          delete errs.ip;
          if (allValues.subnet_id) {
            const sub = subnets.find(s => s.id === allValues.subnet_id);
            if (sub) {
              const subInfo = getSubnetInfo(sub.cidr);
              if (!isIpInCidr(clean, sub.cidr)) {
                errs.ip = `IP must be within the ${sub.name} range (${sub.cidr}).`;
              } else if (subInfo && clean === subInfo.networkIp) {
                errs.ip = 'Cannot assign the network base address (.0).';
              } else if (subInfo && clean === subInfo.broadcastIp) {
                errs.ip = 'Cannot assign the broadcast address (.255).';
              }
            }
          }
        }
      }
    }

    if (field === 'mac') {
      const clean = value.trim();
      if (clean && !MAC_REGEX.test(clean)) {
        errs.mac = 'Format as xx:xx:xx:xx:xx:xx (or leave empty).';
      } else {
        delete errs.mac;
      }
    }

    if (field === 'subnet_id') {
      if (!value) {
        errs.subnet_id = 'Please assign a subnet.';
      } else {
        delete errs.subnet_id;
        if (allValues.ip && !getRfc1918Error(allValues.ip.trim())) {
          const sub = subnets.find(s => s.id === value);
          if (sub) {
            const subInfo = getSubnetInfo(sub.cidr);
            const cleanIp = allValues.ip.trim();
            if (!isIpInCidr(cleanIp, sub.cidr)) {
              errs.ip = `IP must be within the ${sub.name} range (${sub.cidr}).`;
            } else if (subInfo && cleanIp === subInfo.networkIp) {
              errs.ip = 'Cannot assign the network base address (.0).';
            } else if (subInfo && cleanIp === subInfo.broadcastIp) {
              errs.ip = 'Cannot assign the broadcast address (.255).';
            } else if (!hosts.some(h => h.ip === cleanIp)) {
              delete errs.ip;
            }
          }
        }
      }
    }

    setHostErrors(errs);
  };

  const isSubnetFormValid = useMemo(() => {
    const baseIp = newSubnet.cidr.trim().split('/')[0];
    const subInfo = getSubnetInfo(newSubnet.cidr.trim());
    const gw = newSubnet.gateway.trim();

    return (
      newSubnet.name.trim().length >= 2 &&
      CIDR_REGEX.test(newSubnet.cidr.trim()) &&
      !getRfc1918Error(baseIp) &&
      parseInt(newSubnet.vlan, 10) >= 1 &&
      parseInt(newSubnet.vlan, 10) <= 4094 &&
      !getRfc1918Error(gw) &&
      isIpInCidr(gw, newSubnet.cidr.trim()) &&
      subInfo && gw !== subInfo.networkIp && gw !== subInfo.broadcastIp &&
      Object.keys(subnetErrors).length === 0
    );
  }, [newSubnet, subnetErrors]);

  const isHostFormValid = useMemo(() => {
    const selectedSub = subnets.find(s => s.id === newHost.subnet_id);
    const subInfo = selectedSub ? getSubnetInfo(selectedSub.cidr) : null;
    const ip = newHost.ip.trim();
    const mac = newHost.mac.trim();

    const isMacValid = !mac || MAC_REGEX.test(mac);

    return (
      HOSTNAME_REGEX.test(newHost.hostname.trim()) &&
      !getRfc1918Error(ip) &&
      isMacValid &&
      Boolean(newHost.subnet_id) &&
      selectedSub && isIpInCidr(ip, selectedSub.cidr) &&
      subInfo && ip !== subInfo.networkIp && ip !== subInfo.broadcastIp &&
      !hosts.some(h => h.ip === ip) &&
      Object.keys(hostErrors).length === 0
    );
  }, [newHost, hostErrors, subnets, hosts]);

  const filteredHosts = useMemo(() => {
    const q = search.toLowerCase();
    return hosts.filter(h => 
      h.hostname?.toLowerCase().includes(q) ||
      h.ip?.includes(q) ||
      h.mac?.toLowerCase().includes(q) ||
      h.device_type?.toLowerCase().includes(q)
    );
  }, [hosts, search]);

  const stats = useMemo(() => {
    const total = hosts.length;
    const active = hosts.filter(h => h.status === 'active').length;
    const containers = hosts.filter(h => h.device_type === 'container').length;
    return { total, active, containers };
  }, [hosts]);

  const handleSaveNotes = async () => {
    if (!activeHost) return;
    try {
      const res = await fetch(`${API_BASE}/hosts/${activeHost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activeHost, notes: editedNotes })
      });
      if (!res.ok) throw new Error('Could not save notes.');
      const updated = await res.json();
      setHosts(prev => prev.map(h => h.id === updated.id ? updated : h));
      setIsEditingNotes(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteHost = async (hostId) => {
    if (!confirm(`Are you sure you want to remove host "${hostId}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/hosts/${hostId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete host.');
      setHosts(prev => prev.filter(h => h.id !== hostId));
      if (selectedHostId === hostId) {
        const remaining = hosts.filter(h => h.id !== hostId);
        setSelectedHostId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSubnet = async (subnet) => {
    const assigned = hosts.filter(h => h.subnet_id === subnet.id);
    if (assigned.length > 0) {
      alert(`Cannot delete "${subnet.name}". The following devices are still assigned to it:\n${assigned.map(h => h.hostname).join(', ')}\n\nPlease reassign or delete these devices first.`);
      return;
    }

    if (!confirm(`Delete subnet "${subnet.name}" (${subnet.cidr})?`)) return;

    try {
      const res = await fetch(`${API_BASE}/subnets/${subnet.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Could not delete subnet.');
      }
      setSubnets(prev => prev.filter(s => s.id !== subnet.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateHost = async (e) => {
    e.preventDefault();
    if (!isHostFormValid) return;

    try {
      const payload = {
        ...newHost,
        id: newHost.id.trim() || `host-${Date.now()}`,
        mac: newHost.mac.trim() || "",
        parent_id: newHost.parent_id.trim() || null
      };

      const res = await fetch(`${API_BASE}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Could not create host.');
      }
      const created = await res.json();
      setHosts(prev => [...prev, created]);
      setSelectedHostId(created.id);
      setIsHostModalOpen(false);
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
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSubnet = async (e) => {
    e.preventDefault();
    if (!isSubnetFormValid) return;

    try {
      const payload = {
        ...newSubnet,
        id: newSubnet.id.trim() || `sub-${Date.now()}`,
        vlan: parseInt(newSubnet.vlan, 10) || 0
      };

      const res = await fetch(`${API_BASE}/subnets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Could not create subnet.');
      }
      const created = await res.json();
      setSubnets(prev => [...prev, created]);
      setIsSubnetModalOpen(false);
      setNewSubnet({ id: '', name: '', cidr: '', vlan: '10', gateway: '' });
      setSubnetErrors({});
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await fetch(`${API_BASE}/export`);
      if (!res.ok) throw new Error('Could not generate backup file.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netdock_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Could not import backup.');
      alert('Inventory restored successfully.');
      fetchData();
    } catch (err) {
      alert(`Import error: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans select-none overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json" 
        className="hidden" 
      />

      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800/80 bg-[#0c0c10] flex flex-col justify-between">
        <div>
          {/* Header Brand */}
          <div className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-950/60 border border-emerald-800/70 rounded-lg shadow-inner">
                <Network className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-wide text-zinc-100 block">NetDock</span>
                <span className="text-[10px] text-zinc-500 font-mono tracking-tight">INFRASTRUCTURE</span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>

          {/* Navigation Links */}
          <div className="px-6 pt-5 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Navigation
          </div>
          <nav className="px-3 space-y-1">
            <button 
              onClick={() => setActiveTab('roster')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition text-left ${
                activeTab === 'roster' 
                  ? 'bg-zinc-800/80 text-white font-medium border-l-2 border-emerald-500' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <Server className="w-4 h-4 text-zinc-400" /> Host Roster
            </button>
            <button 
              onClick={() => setActiveTab('subnets')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition text-left ${
                activeTab === 'subnets' 
                  ? 'bg-zinc-800/80 text-white font-medium border-l-2 border-emerald-500' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-4 h-4 text-zinc-400" /> Subnets & VLANs
            </button>
            <button 
              onClick={() => setActiveTab('topology')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition text-left ${
                activeTab === 'topology' 
                  ? 'bg-zinc-800/80 text-white font-medium border-l-2 border-emerald-500' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-4 h-4 text-zinc-400" /> Network Map
            </button>
          </nav>

          {/* Backup & Tools */}
          <div className="px-6 pt-6 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Backups & Sync
          </div>
          <div className="px-3 space-y-1">
            <button 
              onClick={handleExportBackup}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-lg transition"
            >
              <Download className="w-4 h-4 text-zinc-500" /> Export Inventory Backup
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-lg transition"
            >
              <Upload className="w-4 h-4 text-zinc-500" /> Restore From Backup
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 text-xs text-zinc-500 flex justify-between items-center bg-[#0c0c10]">
          <span>SQLite Database</span>
          <button onClick={fetchData} title="Sync latest data" className="text-zinc-400 hover:text-zinc-200 p-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
        {/* Spacious, De-cluttered Top Bar */}
        <header className="h-16 border-b border-zinc-800/80 px-8 flex items-center justify-between bg-[#0d0d11]">
          {/* Metrics Area with Better Breathing Room */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/70 px-3 py-1.5 rounded-lg">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">Total</span>
              <span className="font-semibold text-zinc-100">{stats.total}</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/70 px-3 py-1.5 rounded-lg">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">Online</span>
              <span className="font-semibold text-emerald-400">{stats.active}</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/70 px-3 py-1.5 rounded-lg">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">Containers</span>
              <span className="font-semibold text-cyan-400">{stats.containers}</span>
            </div>
          </div>

          {/* Search Box and Primary Action Button with Generous Spacing */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search hosts, IPs, or types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition w-64 shadow-inner"
              />
            </div>
            
            {activeTab === 'subnets' ? (
              <button 
                onClick={() => setIsSubnetModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-medium px-4 py-2 text-xs rounded-lg transition flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Subnet
              </button>
            ) : (
              <button 
                onClick={() => setIsHostModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-medium px-4 py-2 text-xs rounded-lg transition flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Provision Host
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="bg-red-950/40 border-b border-red-800/80 px-8 py-2 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>Connection Warning: {error}</span>
          </div>
        )}

        <main className="flex-1 flex overflow-hidden">
          {/* TAB 1: ROSTER */}
          {activeTab === 'roster' && (
            <>
              {/* Host List */}
              <div className="flex-1 overflow-y-auto border-r border-zinc-800/80 p-8 space-y-4">
                <div>
                  <h1 className="text-lg font-semibold text-zinc-100">Host Roster</h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    All bare-metal servers, virtual machines, and container instances registered on your network.
                  </p>
                </div>

                {filteredHosts.length === 0 && !loading && (
                  <div className="text-xs text-zinc-500 p-8 border border-dashed border-zinc-800 rounded-lg text-center">
                    No matching hosts found. Click <span className="text-emerald-400 font-medium">Provision Host</span> above to register your first device.
                  </div>
                )}

                <div className="space-y-2 mt-2">
                  {filteredHosts.map(host => (
                    <div
                      key={host.id}
                      onClick={() => setSelectedHostId(host.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition ${
                        host.id === activeHost?.id 
                          ? 'border-emerald-500/80 bg-emerald-950/20' 
                          : 'border-zinc-800/80 bg-[#121217] hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-xs text-zinc-200 flex items-center gap-2">
                          <span>{host.hostname}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${host.status === 'active' ? 'bg-emerald-400' : 'bg-red-500'}`} />
                        </div>
                        <span className="text-xs font-mono text-emerald-400/90 font-medium">{host.ip}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-zinc-400">
                        <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] uppercase">
                          {host.device_type}
                        </span>
                        <span className="text-zinc-500">{host.mac || 'No MAC recorded'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Host Runbook Inspector */}
              <div className="w-[440px] bg-[#0c0c10] overflow-y-auto p-8 space-y-6">
                {activeHost ? (
                  <>
                    <div className="flex items-start justify-between border-b border-zinc-800/80 pb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-zinc-100">{activeHost.hostname}</h2>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">{activeHost.os}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full uppercase">
                          {activeHost.status}
                        </span>
                        <button 
                          onClick={() => handleDeleteHost(activeHost.id)}
                          className="p-1.5 hover:text-red-400 text-zinc-500 transition rounded hover:bg-zinc-800/50"
                          title="Delete Host"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 text-xs bg-zinc-900/60 p-4 rounded-lg border border-zinc-800/80 font-mono">
                      <div>
                        <span className="text-zinc-500 block text-[10px]">IP ADDRESS:</span>
                        <span className="text-emerald-400 font-semibold">{activeHost.ip}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">MAC ADDRESS:</span>
                        <span className="text-zinc-300">{activeHost.mac || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">ASSIGNED SUBNET:</span>
                        <span className="text-zinc-300 truncate block">
                          {subnets.find(s => s.id === activeHost.subnet_id)?.name || activeHost.subnet_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">HOST NODE:</span>
                        <span className="text-zinc-300">{activeHost.parent_id || 'Standalone'}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <div>
                          <span className="text-xs font-semibold text-zinc-200">Device Documentation</span>
                          <span className="text-[11px] text-zinc-500 block">Setup steps, port forwards, or configuration notes</span>
                        </div>
                        {!isEditingNotes ? (
                          <button 
                            onClick={() => setIsEditingNotes(true)}
                            className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                        ) : (
                          <div className="flex gap-2 text-xs">
                            <button onClick={handleSaveNotes} className="text-emerald-400 font-medium hover:underline">
                              Save
                            </button>
                            <button onClick={() => setIsEditingNotes(false)} className="text-zinc-500 hover:text-zinc-300">
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditingNotes ? (
                        <textarea
                          rows={8}
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          placeholder="Record open ports, container configurations, or maintenance schedules..."
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <div className="text-xs font-mono bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-800 text-zinc-300 whitespace-pre-wrap leading-relaxed min-h-[140px]">
                          {activeHost.notes || 'No documentation logged yet. Click Edit to record setup notes for this device.'}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-500">Select an asset from the roster to inspect details.</div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: SUBNETS */}
          {activeTab === 'subnets' && (
            <div className="p-8 space-y-5 flex-1 overflow-y-auto">
              <div className="border-b border-zinc-800/80 pb-4">
                <h1 className="text-lg font-semibold text-zinc-100">Subnets & VLAN Segments</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Private IPv4 address ranges configured across your home and lab networks.
                </p>
              </div>

              <div className="grid gap-3.5">
                {subnets.map(s => {
                  const assigned = hosts.filter(h => h.subnet_id === s.id).length;
                  return (
                    <div key={s.id} className="p-4 bg-[#121217] border border-zinc-800 rounded-lg transition hover:border-zinc-700">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm text-zinc-200">{s.name}</span>
                          <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full">
                            VLAN {s.vlan}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-emerald-400 font-medium">{s.cidr}</span>
                          <button
                            onClick={() => handleDeleteSubnet(s)}
                            className="p-1 text-zinc-500 hover:text-red-400 transition"
                            title="Delete Subnet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs font-mono text-zinc-400">
                        Default Gateway: <span className="text-zinc-200">{s.gateway}</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500 mt-2">
                        Assigned Hosts: <span className={assigned > 0 ? "text-zinc-200 font-semibold" : "text-zinc-600"}>{assigned}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TOPOLOGY */}
          {activeTab === 'topology' && (
            <div className="p-8 space-y-5 flex-1 overflow-y-auto">
              <div className="border-b border-zinc-800/80 pb-4">
                <h1 className="text-lg font-semibold text-zinc-100">Network Map & Structure</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Visual relationship between bare-metal servers and their child virtual machines or containers.
                </p>
              </div>

              <div className="space-y-3 font-mono">
                {hosts.filter(h => !h.parent_id).map(parent => (
                  <div key={parent.id} className="border border-zinc-800 bg-[#121217] p-4 rounded-lg">
                    <div className="flex items-center gap-2.5 font-medium text-xs text-emerald-400">
                      <Server className="w-4 h-4" />
                      <span>{parent.hostname}</span>
                      <span className="text-zinc-400 font-normal">[{parent.ip}] ({parent.device_type})</span>
                    </div>
                    <div className="ml-5 mt-3 border-l border-zinc-800 pl-4 space-y-2">
                      {hosts.filter(h => h.parent_id === parent.id).map(child => (
                        <div key={child.id} className="text-xs flex items-center gap-2 text-zinc-300">
                          <span className="text-zinc-600">↳</span>
                          <span className="text-zinc-200 font-medium">{child.hostname}</span>
                          <span className="text-zinc-500">[{child.ip}]</span>
                          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                            {child.device_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Subnet Modal */}
      {isSubnetModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#121217] border border-zinc-800 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-zinc-100">Add Subnet</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Configure a local network segment</p>
              </div>
              <button onClick={() => { setIsSubnetModalOpen(false); setSubnetErrors({}); }} className="text-zinc-500 hover:text-zinc-200 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubnet} className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Subnet Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Core Services" 
                  value={newSubnet.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSubnet(prev => ({ ...prev, name: val }));
                    validateSubnetField('name', val);
                  }}
                  className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none ${
                    subnetErrors.name ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                  }`}
                />
                {subnetErrors.name && <p className="text-[11px] text-red-400 mt-1 font-mono">{subnetErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Subnet Range (CIDR)</label>
                  <input 
                    type="text" 
                    placeholder="192.168.1.0/24" 
                    value={newSubnet.cidr}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = { ...newSubnet, cidr: val };
                      setNewSubnet(updated);
                      validateSubnetField('cidr', val, updated);
                    }}
                    className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none ${
                      subnetErrors.cidr ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                  {subnetErrors.cidr && <p className="text-[11px] text-red-400 mt-1 font-mono">{subnetErrors.cidr}</p>}
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">VLAN Tag</label>
                  <input 
                    type="number" 
                    placeholder="10" 
                    value={newSubnet.vlan}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewSubnet(prev => ({ ...prev, vlan: val }));
                      validateSubnetField('vlan', val);
                    }}
                    className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none ${
                      subnetErrors.vlan ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                  {subnetErrors.vlan && <p className="text-[11px] text-red-400 mt-1 font-mono">{subnetErrors.vlan}</p>}
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Default Gateway</label>
                <input 
                  type="text" 
                  placeholder="192.168.1.1" 
                  value={newSubnet.gateway}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...newSubnet, gateway: val };
                    setNewSubnet(updated);
                    validateSubnetField('gateway', val, updated);
                  }}
                  className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none ${
                    subnetErrors.gateway ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                  }`}
                />
                {subnetErrors.gateway && <p className="text-[11px] text-red-400 mt-1 font-mono">{subnetErrors.gateway}</p>}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => { setIsSubnetModalOpen(false); setSubnetErrors({}); }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!isSubnetFormValid}
                  className={`px-4 py-1.5 text-xs rounded-lg font-medium transition ${
                    isSubnetFormValid 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950' 
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Save Subnet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Host Modal */}
      {isHostModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#121217] border border-zinc-800 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-zinc-100">Provision Device</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Register a new device on the network</p>
              </div>
              <button onClick={() => { setIsHostModalOpen(false); setHostErrors({}); }} className="text-zinc-500 hover:text-zinc-200 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateHost} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Hostname</label>
                  <input 
                    type="text" 
                    placeholder="cerberus"
                    value={newHost.hostname}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHost(prev => ({ ...prev, hostname: val }));
                      validateHostField('hostname', val);
                    }}
                    className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none ${
                      hostErrors.hostname ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                  {hostErrors.hostname && <p className="text-[11px] text-red-400 mt-1 font-mono">{hostErrors.hostname}</p>}
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Device Type</label>
                  <select 
                    value={newHost.device_type}
                    onChange={(e) => setNewHost({ ...newHost, device_type: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="bare-metal">Bare Metal</option>
                    <option value="server">Server</option>
                    <option value="container">Container</option>
                    <option value="vm">Virtual Machine</option>
                    <option value="sbc">Single Board PC / Pi</option>
                    <option value="switch">Switch / Router</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">IP Address</label>
                  <input 
                    type="text" 
                    placeholder="192.168.1.5"
                    value={newHost.ip}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = { ...newHost, ip: val };
                      setNewHost(updated);
                      validateHostField('ip', val, updated);
                    }}
                    className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none ${
                      hostErrors.ip ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                  {hostErrors.ip && <p className="text-[11px] text-red-400 mt-1 font-mono">{hostErrors.ip}</p>}
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    MAC Address <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="bc:24:11:92:aa:01"
                    value={newHost.mac}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHost(prev => ({ ...prev, mac: val }));
                      validateHostField('mac', val);
                    }}
                    className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none ${
                      hostErrors.mac ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                  {hostErrors.mac && <p className="text-[11px] text-red-400 mt-1 font-mono">{hostErrors.mac}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Assigned Subnet</label>
                  <select 
                    value={newHost.subnet_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = { ...newHost, subnet_id: val };
                      setNewHost(updated);
                      validateHostField('subnet_id', val, updated);
                    }}
                    className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none ${
                      hostErrors.subnet_id ? 'border-red-500' : 'border-zinc-800'
                    }`}
                  >
                    <option value="">Choose a subnet...</option>
                    {subnets.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.cidr})</option>
                    ))}
                  </select>
                  {hostErrors.subnet_id && <p className="text-[11px] text-red-400 mt-1 font-mono">{hostErrors.subnet_id}</p>}
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Parent Host</label>
                  <select 
                    value={newHost.parent_id}
                    onChange={(e) => setNewHost({ ...newHost, parent_id: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="">None (Standalone)</option>
                    {hosts.map(h => (
                      <option key={h.id} value={h.id}>{h.hostname} ({h.ip})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Operating System</label>
                <input 
                  type="text" 
                  placeholder="Ubuntu 24.04 LTS"
                  value={newHost.os}
                  onChange={(e) => setNewHost({ ...newHost, os: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => { setIsHostModalOpen(false); setHostErrors({}); }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!isHostFormValid}
                  className={`px-4 py-1.5 text-xs rounded-lg font-medium transition ${
                    isHostFormValid 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950' 
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Save Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
