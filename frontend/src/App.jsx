import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Server, Network, Search, Plus, 
  Trash2, Edit3, Save, X, RefreshCw, Download, Upload, AlertCircle,
  Activity, Layers, GripHorizontal
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
    return 'Private Class B must stay between 172.16.x.x and 172.31.x.x.';
  }
  if (o1 === 192) {
    if (o2 === 168) return null;
    return `192.${o2}.x.x is public. Private Class C must use 192.168.x.x.`;
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

// Draggable Modal with Lightened High-Contrast Theming
function DraggableModal({ title, onClose, widthClass = 'w-[540px]', children }) {
  const modalRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      const initialLeft = Math.max(20, Math.round((window.innerWidth - rect.width) / 2));
      const initialTop = Math.max(30, Math.round((window.innerHeight - rect.height) / 3));
      setPos({ x: initialLeft, y: initialTop });
    }
  }, []);

  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    setIsDragging(true);
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: pos.x,
      posY: pos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      
      const nextX = Math.max(10, Math.min(window.innerWidth - 100, dragStart.current.posX + dx));
      const nextY = Math.max(10, Math.min(window.innerHeight - 80, dragStart.current.posY + dy));
      
      setPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/75 pointer-events-auto backdrop-blur-[1px]" 
      />

      <div
        ref={modalRef}
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          position: 'fixed'
        }}
        className={`pointer-events-auto ${widthClass} bg-[#2d2d3a] border-2 border-[#717188] p-6 space-y-6 shadow-2xl select-text transition-shadow ${
          isDragging ? 'shadow-amber-500/40 ring-2 ring-amber-400 cursor-grabbing' : 'shadow-black/90'
        }`}
      >
        {/* Title Bar Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between border-b-2 border-[#525268] pb-3 cursor-grab active:cursor-grabbing select-none bg-[#373748] -mx-6 -mt-6 p-4 border-t-4 border-t-amber-400"
        >
          <div className="flex items-center gap-2.5">
            <GripHorizontal className="w-5 h-5 text-amber-400" />
            <h3 className="font-mono font-extrabold text-sm uppercase tracking-wider text-amber-300">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-950 bg-white hover:bg-amber-300 font-bold p-1 border-2 border-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-1">
          {children}
        </div>
      </div>
    </div>
  );
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

      if (!hostsRes.ok || !subnetsRes.ok) throw new Error('Could not communicate with database.');

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

  // Subnet Validation
  const validateSubnetField = (field, value, allValues = newSubnet) => {
    const errs = { ...subnetErrors };

    if (field === 'name') {
      if (!value.trim() || value.trim().length < 2) {
        errs.name = 'Subnet label required (2+ chars).';
      } else {
        delete errs.name;
      }
    }

    if (field === 'cidr') {
      const clean = value.trim();
      if (!clean) {
        errs.cidr = 'CIDR notation required.';
      } else if (!CIDR_REGEX.test(clean)) {
        errs.cidr = 'Format: 192.168.1.0/24';
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
        errs.vlan = 'VLAN range: 1 - 4094.';
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
            errs.gateway = `Must be inside ${allValues.cidr.trim()}.`;
          } else if (subInfo && clean === subInfo.networkIp) {
            errs.gateway = 'Cannot assign base network address (.0).';
          } else if (subInfo && clean === subInfo.broadcastIp) {
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

  // Host Validation
  const validateHostField = (field, value, allValues = newHost) => {
    const errs = { ...hostErrors };

    if (field === 'hostname') {
      const clean = value.trim();
      if (!clean) {
        errs.hostname = 'Hostname is required.';
      } else if (!HOSTNAME_REGEX.test(clean)) {
        errs.hostname = 'Letters, numbers, and hyphens only.';
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
                errs.ip = `IP must be within ${sub.name} (${sub.cidr}).`;
              } else if (subInfo && clean === subInfo.networkIp) {
                errs.ip = 'Cannot assign base network address (.0).';
              } else if (subInfo && clean === subInfo.broadcastIp) {
                errs.ip = 'Cannot assign broadcast address (.255).';
              }
            }
          }
        }
      }
    }

    if (field === 'mac') {
      const clean = value.trim();
      if (clean && !MAC_REGEX.test(clean)) {
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
        if (allValues.ip && !getRfc1918Error(allValues.ip.trim())) {
          const sub = subnets.find(s => s.id === value);
          if (sub) {
            const subInfo = getSubnetInfo(sub.cidr);
            const cleanIp = allValues.ip.trim();
            if (!isIpInCidr(cleanIp, sub.cidr)) {
              errs.ip = `IP must be within ${sub.name} (${sub.cidr}).`;
            } else if (subInfo && cleanIp === subInfo.networkIp) {
              errs.ip = 'Cannot assign base network address (.0).';
            } else if (subInfo && cleanIp === subInfo.broadcastIp) {
              errs.ip = 'Cannot assign broadcast address (.255).';
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
      alert(`Cannot delete "${subnet.name}". Assigned hosts exist:\n${assigned.map(h => h.hostname).join(', ')}`);
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
    <div className="flex h-screen bg-[#18181f] text-zinc-100 font-sans select-none overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json" 
        className="hidden" 
      />

      {/* Sidebar */}
      <aside className="w-64 border-r border-[#4b4b57] bg-[#1e1e26] flex flex-col justify-between">
        <div>
          {/* Header Brand */}
          <div className="h-16 border-b border-[#4b4b57] px-6 flex items-center justify-between bg-[#242430]">
            <div className="flex items-center gap-3">
              <div className="p-1.5 border border-amber-400 bg-[#2d2d3c] text-amber-300">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <span className="font-mono font-bold text-xs tracking-wider text-amber-400 uppercase block">NetDock</span>
                <span className="text-[10px] text-zinc-300 font-mono tracking-tight block">CONSOLE // V1.0</span>
              </div>
            </div>
            <span className="text-[10px] font-mono border border-amber-400 bg-amber-400/20 text-amber-300 px-2 py-0.5 uppercase tracking-widest font-bold">
              SYS_OK
            </span>
          </div>

          {/* Navigation Links */}
          <div className="px-6 pt-7 pb-2.5 text-xs font-mono text-amber-300 uppercase tracking-widest font-black">
            // TELEMETRY
          </div>
          <nav className="px-3 space-y-2.5">
            <button 
              onClick={() => setActiveTab('roster')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-mono uppercase tracking-wider text-left transition shadow-md cursor-pointer border-2 ${
                activeTab === 'roster' 
                  ? 'bg-amber-400 text-black font-black border-white ring-2 ring-amber-300' 
                  : 'bg-[#3e3e52] text-white hover:bg-[#4d4d65] hover:border-amber-400 border-[#6a6a84] font-extrabold'
              }`}
            >
              <Server className={`w-4 h-4 ${activeTab === 'roster' ? 'text-black' : 'text-amber-300'}`} /> 01_HOST_ROSTER
            </button>
            <button 
              onClick={() => setActiveTab('subnets')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-mono uppercase tracking-wider text-left transition shadow-md cursor-pointer border-2 ${
                activeTab === 'subnets' 
                  ? 'bg-amber-400 text-black font-black border-white ring-2 ring-amber-300' 
                  : 'bg-[#3e3e52] text-white hover:bg-[#4d4d65] hover:border-amber-400 border-[#6a6a84] font-extrabold'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'subnets' ? 'text-black' : 'text-amber-300'}`} /> 02_SUBNETS
            </button>
            <button 
              onClick={() => setActiveTab('topology')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-mono uppercase tracking-wider text-left transition shadow-md cursor-pointer border-2 ${
                activeTab === 'topology' 
                  ? 'bg-amber-400 text-black font-black border-white ring-2 ring-amber-300' 
                  : 'bg-[#3e3e52] text-white hover:bg-[#4d4d65] hover:border-amber-400 border-[#6a6a84] font-extrabold'
              }`}
            >
              <Activity className={`w-4 h-4 ${activeTab === 'topology' ? 'text-black' : 'text-amber-300'}`} /> 03_MAP
            </button>
          </nav>

          {/* Backup & Tools */}
          <div className="px-6 pt-8 pb-2.5 text-xs font-mono text-amber-300 uppercase tracking-widest font-black">
            // DATA_OPS
          </div>
          <div className="px-3 space-y-2.5">
            <button 
              onClick={handleExportBackup}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-left font-extrabold text-white bg-[#3e3e52] hover:bg-[#4d4d65] hover:text-amber-300 border-2 border-[#6a6a84] hover:border-amber-400 shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-300" /> DUMP_BACKUP
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-left font-extrabold text-white bg-[#3e3e52] hover:bg-[#4d4d65] hover:text-amber-300 border-2 border-[#6a6a84] hover:border-amber-400 shadow-md transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-300" /> RESTORE_BACKUP
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#4b4b57] text-xs font-mono text-zinc-200 flex justify-between items-center bg-[#242430]">
          <span className="font-semibold text-zinc-300">ENGINE: SQLITE_WAL</span>
          <button onClick={fetchData} title="Sync database" className="p-1.5 hover:text-amber-300 hover:bg-[#31313e] border border-[#4b4b57] transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main Console Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#18181f]">
        {/* Top Control Bar */}
        <header className="h-16 border-b border-[#4b4b57] px-8 flex items-center justify-between bg-[#22222b]">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="border border-[#4b4b57] bg-[#2a2a35] px-3.5 py-1.5 flex items-center gap-3 shadow-inner">
              <span className="text-zinc-300 uppercase tracking-wider text-[10px] font-bold">TOTAL:</span>
              <span className="font-bold text-white text-sm">{stats.total}</span>
            </div>
            <div className="border border-[#4b4b57] bg-[#2a2a35] px-3.5 py-1.5 flex items-center gap-3 shadow-inner">
              <span className="text-zinc-300 uppercase tracking-wider text-[10px] font-bold">ACTIVE:</span>
              <span className="font-bold text-amber-300 text-sm">{stats.active}</span>
            </div>
            <div className="border border-[#4b4b57] bg-[#2a2a35] px-3.5 py-1.5 flex items-center gap-3 shadow-inner">
              <span className="text-zinc-300 uppercase tracking-wider text-[10px] font-bold">CONTAINERS:</span>
              <span className="font-bold text-sky-300 text-sm">{stats.containers}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-amber-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="GREP HOST / IP / MAC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#181820] border-2 border-[#4b4b57] hover:border-zinc-400 focus:border-amber-400 pl-10 pr-4 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-400 focus:outline-none w-72 uppercase transition shadow-inner"
              />
            </div>
            
            {activeTab === 'subnets' ? (
              <button 
                onClick={() => setIsSubnetModalOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-zinc-950 font-mono font-bold px-4 py-2 text-xs transition flex items-center gap-2 border border-amber-300 uppercase tracking-wider shadow cursor-pointer"
              >
                <Plus className="w-4 h-4 text-zinc-950" /> NEW_SUBNET
              </button>
            ) : (
              <button 
                onClick={() => setIsHostModalOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-zinc-950 font-mono font-bold px-4 py-2 text-xs transition flex items-center gap-2 border border-amber-300 uppercase tracking-wider shadow cursor-pointer"
              >
                <Plus className="w-4 h-4 text-zinc-950" /> PROVISION_HOST
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="bg-red-950/80 border-b border-red-600 px-8 py-2 text-xs font-mono text-red-200 flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>[COMM_FAULT]: {error}</span>
          </div>
        )}

        <main className="flex-1 flex overflow-hidden">
          {/* TAB 1: ROSTER */}
          {activeTab === 'roster' && (
            <>
              <div className="flex-1 overflow-y-auto border-r border-[#4b4b57] p-8 space-y-4 bg-[#18181f]">
                <div className="border-b border-[#4b4b57] pb-3 flex justify-between items-end">
                  <div>
                    <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-amber-300">// REGISTERED_HOSTS [{filteredHosts.length}]</h1>
                    <p className="text-xs text-zinc-300 mt-1">
                      Managed bare-metal machines, hypervisors, and container instances.
                    </p>
                  </div>
                </div>

                {filteredHosts.length === 0 && !loading && (
                  <div className="text-xs font-mono text-zinc-200 p-8 border-2 border-dashed border-[#4b4b57] bg-[#22222b] text-center">
                    NO HOSTS REGISTERED. USE [PROVISION_HOST] TO ADD AN ASSET.
                  </div>
                )}

                <div className="space-y-3 mt-4">
                  {filteredHosts.map(host => (
                    <div
                      key={host.id}
                      onClick={() => setSelectedHostId(host.id)}
                      className={`p-4 border-2 transition cursor-pointer select-none ${
                        host.id === activeHost?.id 
                          ? 'border-amber-400 bg-[#2d2d3a] shadow-lg ring-2 ring-amber-400/40' 
                          : 'border-[#444452] bg-[#23232c] hover:border-amber-400 hover:bg-[#2b2b36]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-xs text-zinc-100 flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 ${host.status === 'active' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]' : 'bg-red-500'}`} />
                          <span className="font-bold tracking-wide text-sm">{host.hostname}</span>
                        </div>
                        <span className="text-xs font-mono text-amber-300 font-bold px-2.5 py-1 bg-[#1a1a22] border border-[#4b4b57]">
                          {host.ip}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-[11px] font-mono">
                        <span className="border border-[#555566] bg-[#2f2f3d] px-2 py-0.5 text-zinc-100 uppercase font-bold">
                          {host.device_type}
                        </span>
                        <span className="text-zinc-300 font-medium">{host.mac || 'NO_MAC'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Host Inspector Drawer */}
              <div className="w-[490px] bg-[#1e1e26] overflow-y-auto p-8 space-y-7 border-l border-[#4b4b57]">
                {activeHost ? (
                  <>
                    <div className="flex items-start justify-between border-b border-[#4b4b57] pb-4">
                      <div>
                        <h2 className="text-lg font-mono font-bold text-amber-300">&gt; {activeHost.hostname}</h2>
                        <p className="text-xs text-zinc-300 font-mono mt-0.5 font-medium">KERNEL: {activeHost.os}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono border-2 border-amber-400 bg-amber-400/20 text-amber-300 px-2 py-0.5 uppercase tracking-wider font-bold">
                          {activeHost.status}
                        </span>
                        <button 
                          onClick={() => handleDeleteHost(activeHost.id)}
                          className="p-1.5 text-zinc-300 hover:text-red-300 hover:bg-red-950/60 border border-[#4b4b57] hover:border-red-500 transition cursor-pointer"
                          title="Drop Host"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 text-xs font-mono">
                      <div className="border border-[#4b4b57] p-3.5 bg-[#252530]">
                        <span className="text-zinc-300 block text-[10px] uppercase font-bold tracking-wider">// IP_ADDRESS</span>
                        <span className="text-amber-300 font-bold text-sm mt-1 block">{activeHost.ip}</span>
                      </div>
                      <div className="border border-[#4b4b57] p-3.5 bg-[#252530]">
                        <span className="text-zinc-300 block text-[10px] uppercase font-bold tracking-wider">// MAC_ADDRESS</span>
                        <span className="text-zinc-100 text-xs mt-1 block font-medium">{activeHost.mac || 'N/A'}</span>
                      </div>
                      <div className="border border-[#4b4b57] p-3.5 bg-[#252530]">
                        <span className="text-zinc-300 block text-[10px] uppercase font-bold tracking-wider">// SUBNET</span>
                        <span className="text-zinc-100 text-xs mt-1 block truncate font-bold">
                          {subnets.find(s => s.id === activeHost.subnet_id)?.name || activeHost.subnet_id}
                        </span>
                      </div>
                      <div className="border border-[#4b4b57] p-3.5 bg-[#252530]">
                        <span className="text-zinc-300 block text-[10px] uppercase font-bold tracking-wider">// PARENT_HOST</span>
                        <span className="text-zinc-100 text-xs mt-1 block font-bold">{activeHost.parent_id || 'NONE'}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#4b4b57] pb-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                          // RUNBOOK_NOTES
                        </span>
                        {!isEditingNotes ? (
                          <button 
                            onClick={() => setIsEditingNotes(true)}
                            className="text-xs font-mono text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1.5 font-bold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> [EDIT]
                          </button>
                        ) : (
                          <div className="flex gap-3 text-xs font-mono">
                            <button onClick={handleSaveNotes} className="text-amber-300 font-bold hover:underline cursor-pointer">
                              [SAVE]
                            </button>
                            <button onClick={() => setIsEditingNotes(false)} className="text-zinc-300 hover:text-white cursor-pointer">
                              [CANCEL]
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditingNotes ? (
                        <textarea
                          rows={10}
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          placeholder="INPUT SYSTEM CONFIGURATION OR PORT MAPPINGS..."
                          className="w-full bg-[#181820] border-2 border-amber-400 p-3 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-300 leading-relaxed shadow-inner"
                        />
                      ) : (
                        <div className="text-xs font-mono bg-[#23232d] p-4 border border-[#4b4b57] text-zinc-100 whitespace-pre-wrap leading-relaxed min-h-[140px]">
                          {activeHost.notes || 'NO DOCUMENTATION RECORDED. CLICK [EDIT] TO ADD SYSTEM NOTES.'}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs font-mono text-zinc-300">SELECT A HOST TO INSPECT ATTRIBUTES.</div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: SUBNETS */}
          {activeTab === 'subnets' && (
            <div className="p-8 space-y-6 flex-1 overflow-y-auto bg-[#18181f]">
              <div className="border-b border-[#4b4b57] pb-4">
                <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-amber-300">// CONFIGURED_SUBNETS</h1>
                <p className="text-xs text-zinc-300 mt-1">
                  Private broadcast domains and network boundaries.
                </p>
              </div>

              <div className="grid gap-4">
                {subnets.map(s => {
                  const assigned = hosts.filter(h => h.subnet_id === s.id).length;
                  return (
                    <div key={s.id} className="p-5 bg-[#23232c] border-2 border-[#444452] hover:border-amber-400 hover:bg-[#2b2b36] transition">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-sm text-zinc-100">&gt; {s.name}</span>
                          <span className="text-[10px] font-mono border-2 border-sky-400 bg-sky-400/20 text-sky-200 px-2.5 py-0.5 uppercase font-bold">
                            VLAN_{s.vlan}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-amber-300 font-bold bg-[#1a1a22] px-2.5 py-1 border border-[#4b4b57]">{s.cidr}</span>
                          <button
                            onClick={() => handleDeleteSubnet(s)}
                            className="p-1.5 text-zinc-300 hover:text-red-300 hover:bg-red-950/60 border border-[#4b4b57] hover:border-red-500 transition cursor-pointer"
                            title="Drop Subnet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs font-mono text-zinc-200 mt-2">
                        GATEWAY: <span className="text-white font-bold">{s.gateway}</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-300 mt-1">
                        ALLOCATED_HOSTS: <span className={assigned > 0 ? "text-amber-300 font-bold" : "text-zinc-400"}>{assigned}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TOPOLOGY */}
          {activeTab === 'topology' && (
            <div className="p-8 space-y-6 flex-1 overflow-y-auto bg-[#18181f]">
              <div className="border-b border-[#4b4b57] pb-4">
                <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-amber-300">// TOPOLOGY_TREE</h1>
                <p className="text-xs text-zinc-300 mt-1">
                  Hierarchical structure of hypervisors, physical hosts, and containerized runtimes.
                </p>
              </div>

              <div className="space-y-4 font-mono">
                {hosts.filter(h => !h.parent_id).map(parent => (
                  <div key={parent.id} className="border-2 border-[#4b4b57] bg-[#23232c] p-5 shadow">
                    <div className="flex items-center gap-3 font-bold text-xs text-amber-300">
                      <Server className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-zinc-100">{parent.hostname}</span>
                      <span className="text-zinc-300 font-normal">[{parent.ip}] ({parent.device_type.toUpperCase()})</span>
                    </div>
                    <div className="ml-5 mt-4 border-l-2 border-[#555566] pl-4 space-y-2.5">
                      {hosts.filter(h => h.parent_id === parent.id).map(child => (
                        <div key={child.id} className="text-xs flex items-center gap-3 text-zinc-200">
                          <span className="text-amber-400 font-bold">|--</span>
                          <span className="font-bold text-zinc-100">{child.hostname}</span>
                          <span className="text-amber-300 font-semibold">[{child.ip}]</span>
                          <span className="text-[10px] border border-[#555566] bg-[#2e2e3a] px-1.5 py-0.5 text-zinc-200 uppercase font-bold">
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

      {/* High-Contrast Moveable Subnet Modal */}
      {isSubnetModalOpen && (
        <DraggableModal 
          title="// ALLOCATE_SUBNET" 
          onClose={() => { setIsSubnetModalOpen(false); setSubnetErrors({}); }}
          widthClass="w-[500px]"
        >
          <form onSubmit={handleCreateSubnet} className="space-y-5 text-xs font-mono">
            <div>
              <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                Subnet Label
              </label>
              <input 
                type="text" 
                placeholder="e.g. Core Services" 
                value={newSubnet.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewSubnet(prev => ({ ...prev, name: val }));
                  validateSubnetField('name', val);
                }}
                className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                  subnetErrors.name ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                }`}
              />
              {subnetErrors.name && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {subnetErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  CIDR Range
                </label>
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
                  className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                    subnetErrors.cidr ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                  }`}
                />
                {subnetErrors.cidr && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {subnetErrors.cidr}</p>}
              </div>
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  VLAN Tag
                </label>
                <input 
                  type="number" 
                  placeholder="10" 
                  value={newSubnet.vlan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSubnet(prev => ({ ...prev, vlan: val }));
                    validateSubnetField('vlan', val);
                  }}
                  className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                    subnetErrors.vlan ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                  }`}
                />
                {subnetErrors.vlan && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {subnetErrors.vlan}</p>}
              </div>
            </div>

            <div>
              <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                Default Gateway
              </label>
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
                className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                  subnetErrors.gateway ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                }`}
              />
              {subnetErrors.gateway && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {subnetErrors.gateway}</p>}
            </div>

            {/* Solid White Buttons with High Contrast */}
            <div className="flex justify-end gap-3 pt-5 border-t-2 border-[#525268]">
              <button 
                type="button" 
                onClick={() => { setIsSubnetModalOpen(false); setSubnetErrors({}); }}
                className="px-6 py-2.5 text-xs font-mono font-extrabold text-zinc-950 bg-white hover:bg-zinc-200 border-2 border-white uppercase transition cursor-pointer shadow-md"
              >
                [ABORT]
              </button>
              <button 
                type="submit" 
                disabled={!isSubnetFormValid}
                className={`px-6 py-2.5 text-xs font-mono font-extrabold uppercase tracking-wider transition border-2 cursor-pointer shadow-md ${
                  isSubnetFormValid 
                    ? 'bg-white hover:bg-amber-300 text-zinc-950 border-white ring-2 ring-amber-400' 
                    : 'bg-zinc-300 text-zinc-700 border-zinc-400 cursor-not-allowed'
                }`}
              >
                [COMMIT_SUBNET]
              </button>
            </div>
          </form>
        </DraggableModal>
      )}

      {/* High-Contrast Moveable Host Modal */}
      {isHostModalOpen && (
        <DraggableModal 
          title="// PROVISION_HOST" 
          onClose={() => { setIsHostModalOpen(false); setHostErrors({}); }}
          widthClass="w-[560px]"
        >
          <form onSubmit={handleCreateHost} className="space-y-5 text-xs font-mono">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  Hostname
                </label>
                <input 
                  type="text" 
                  placeholder="cerberus"
                  value={newHost.hostname}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewHost(prev => ({ ...prev, hostname: val }));
                    validateHostField('hostname', val);
                  }}
                  className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                    hostErrors.hostname ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                  }`}
                />
                {hostErrors.hostname && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {hostErrors.hostname}</p>}
              </div>
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  Device Class
                </label>
                <select 
                  value={newHost.device_type}
                  onChange={(e) => setNewHost({ ...newHost, device_type: e.target.value })}
                  className="w-full bg-[#3a3a4c] border-2 border-[#6c6c82] hover:border-amber-300 px-4 py-2.5 text-sm text-white font-extrabold focus:outline-none uppercase cursor-pointer shadow-inner"
                >
                  <option value="bare-metal" className="bg-[#292938] text-white py-1">BARE_METAL</option>
                  <option value="server" className="bg-[#292938] text-white py-1">SERVER</option>
                  <option value="container" className="bg-[#292938] text-white py-1">CONTAINER</option>
                  <option value="vm" className="bg-[#292938] text-white py-1">VIRTUAL_MACHINE</option>
                  <option value="sbc" className="bg-[#292938] text-white py-1">SBC_PI</option>
                  <option value="switch" className="bg-[#292938] text-white py-1">SWITCH_ROUTER</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  IPv4 Address
                </label>
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
                  className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                    hostErrors.ip ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                  }`}
                />
                {hostErrors.ip && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {hostErrors.ip}</p>}
              </div>
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  MAC Address <span className="text-amber-300 font-bold">(OPTIONAL)</span>
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
                  className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none transition shadow-inner ${
                    hostErrors.mac ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] focus:border-amber-300 focus:bg-[#434358]'
                  }`}
                />
                {hostErrors.mac && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {hostErrors.mac}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  Assigned Subnet
                </label>
                <select 
                  value={newHost.subnet_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...newHost, subnet_id: val };
                    setNewHost(updated);
                    validateHostField('subnet_id', val, updated);
                  }}
                  className={`w-full bg-[#3a3a4c] border-2 px-4 py-2.5 text-sm text-white font-extrabold focus:outline-none cursor-pointer shadow-inner ${
                    hostErrors.subnet_id ? 'border-red-400 bg-red-950/40' : 'border-[#6c6c82] hover:border-amber-300'
                  }`}
                >
                  <option value="" className="bg-[#292938] text-white py-1">SELECT_SUBNET...</option>
                  {subnets.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#292938] text-white py-1">{s.name} [{s.cidr}]</option>
                  ))}
                </select>
                {hostErrors.subnet_id && <p className="text-xs text-red-300 mt-1.5 font-bold">&gt; {hostErrors.subnet_id}</p>}
              </div>
              <div>
                <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                  Parent Host
                </label>
                <select 
                  value={newHost.parent_id}
                  onChange={(e) => setNewHost({ ...newHost, parent_id: e.target.value })}
                  className="w-full bg-[#3a3a4c] border-2 border-[#6c6c82] hover:border-amber-300 px-4 py-2.5 text-sm text-white font-extrabold focus:outline-none uppercase cursor-pointer shadow-inner"
                >
                  <option value="" className="bg-[#292938] text-white py-1">NONE (STANDALONE)</option>
                  {hosts.map(h => (
                    <option key={h.id} value={h.id} className="bg-[#292938] text-white py-1">{h.hostname} [{h.ip}]</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-white block mb-1.5 uppercase text-xs font-extrabold tracking-wider">
                Operating System
              </label>
              <input 
                type="text" 
                placeholder="Ubuntu 24.04 LTS"
                value={newHost.os}
                onChange={(e) => setNewHost({ ...newHost, os: e.target.value })}
                className="w-full bg-[#3a3a4c] border-2 border-[#6c6c82] px-4 py-2.5 text-sm text-white font-bold placeholder-zinc-300 focus:outline-none focus:border-amber-300 focus:bg-[#434358] shadow-inner"
              />
            </div>

            {/* Solid White Buttons with High Contrast */}
            <div className="flex justify-end gap-3 pt-5 border-t-2 border-[#525268]">
              <button 
                type="button" 
                onClick={() => { setIsHostModalOpen(false); setHostErrors({}); }}
                className="px-6 py-2.5 text-xs font-mono font-extrabold text-zinc-950 bg-white hover:bg-zinc-200 border-2 border-white uppercase transition cursor-pointer shadow-md"
              >
                [ABORT]
              </button>
              <button 
                type="submit" 
                disabled={!isHostFormValid}
                className={`px-6 py-2.5 text-xs font-mono font-extrabold uppercase tracking-wider transition border-2 cursor-pointer shadow-md ${
                  isHostFormValid 
                    ? 'bg-white hover:bg-amber-300 text-zinc-950 border-white ring-2 ring-amber-400' 
                    : 'bg-zinc-300 text-zinc-700 border-zinc-400 cursor-not-allowed'
                }`}
              >
                [COMMIT_HOST]
              </button>
            </div>
          </form>
        </DraggableModal>
      )}
    </div>
  );
}
