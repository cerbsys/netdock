import {
  Server,
  Network,
  Wifi,
  Shield,
  ShieldCheck,
  HardDrive,
  Database,
  Video,
  Camera,
  Printer,
  BatteryCharging,
  Monitor,
  Laptop,
  Cpu,
  Box,
  Layers,
  Activity,
  Radio,
  Phone,
  Smartphone,
  Lock,
  Thermometer,
  Zap,
  Globe,
  Cloud,
  Sliders,
  Terminal
} from 'lucide-react';

export const DEVICE_CATEGORIES = [
  {
    id: 'Network Infrastructure',
    label: 'Network Infrastructure',
    types: [
      'Router',
      'Core Switch',
      'Access Switch',
      'Layer 2 Switch',
      'Layer 3 Switch',
      'Firewall',
      'Wireless Access Point',
      'Wireless Controller',
      'Network Gateway',
      'Modem',
      'Load Balancer',
      'VPN Gateway'
    ]
  },
  {
    id: 'Servers and Computing',
    label: 'Servers and Computing',
    types: [
      'Physical Server',
      'Virtual Machine',
      'Hypervisor',
      'NAS',
      'SAN',
      'Workstation',
      'Desktop PC',
      'Laptop',
      'Mini PC',
      'Raspberry Pi / Single Board Computer',
      'Docker Host',
      'Proxmox Host',
      'Virtualization Host',
      'Container'
    ]
  },
  {
    id: 'Security and Surveillance',
    label: 'Security and Surveillance',
    types: [
      'NVR (Network Video Recorder)',
      'DVR (Digital Video Recorder)',
      'IP Camera',
      'Security Camera System',
      'Access Control Panel',
      'Door Controller',
      'Alarm System'
    ]
  },
  {
    id: 'Storage and Backup',
    label: 'Storage and Backup',
    types: [
      'Network Storage',
      'Backup Server',
      'Storage Array',
      'SAN Controller'
    ]
  },
  {
    id: 'Wireless and Communication',
    label: 'Wireless and Communication',
    types: [
      'Wireless Bridge',
      'Mesh Node',
      'Wireless Repeater',
      'VoIP Phone',
      'PBX / VoIP Server',
      'SIP Gateway',
      'Cellular Gateway'
    ]
  },
  {
    id: 'IoT and Smart Devices',
    label: 'IoT and Smart Devices',
    types: [
      'Smart Home Hub',
      'IoT Gateway',
      'Smart Device',
      'Printer',
      'UPS',
      'PDU',
      'Environmental Sensor',
      'Other IoT Device'
    ]
  },
  {
    id: 'Other',
    label: 'Other',
    types: [
      'Other Network Device',
      'Custom Device Type'
    ]
  }
];

export const CUSTOM_ICON_OPTIONS = [
  { id: 'Server', label: 'Server', icon: Server },
  { id: 'Network', label: 'Network / Switch', icon: Network },
  { id: 'Globe', label: 'Router / Gateway', icon: Globe },
  { id: 'Shield', label: 'Firewall / Security', icon: Shield },
  { id: 'Wifi', label: 'Wireless / AP', icon: Wifi },
  { id: 'Database', label: 'NAS / Storage', icon: Database },
  { id: 'HardDrive', label: 'Disk / Array', icon: HardDrive },
  { id: 'Video', label: 'NVR / Video', icon: Video },
  { id: 'Camera', label: 'IP Camera', icon: Camera },
  { id: 'Monitor', label: 'Workstation / Desktop', icon: Monitor },
  { id: 'Laptop', label: 'Laptop', icon: Laptop },
  { id: 'Cpu', label: 'Single Board / Mini PC', icon: Cpu },
  { id: 'Box', label: 'Container / Generic Box', icon: Box },
  { id: 'Printer', label: 'Printer', icon: Printer },
  { id: 'BatteryCharging', label: 'UPS / Battery', icon: BatteryCharging },
  { id: 'Zap', label: 'PDU / Power', icon: Zap },
  { id: 'Phone', label: 'VoIP / Telecom', icon: Phone },
  { id: 'Lock', label: 'Access Control / Door', icon: Lock },
  { id: 'Thermometer', label: 'Environmental Sensor', icon: Thermometer },
  { id: 'Radio', label: 'RF / Bridge', icon: Radio }
];

const ICON_BY_NAME = Object.fromEntries(CUSTOM_ICON_OPTIONS.map((o) => [o.id, o.icon]));

export function getDeviceIconComponent(deviceType, customTypes = []) {
  const raw = (deviceType || '').trim();
  const lower = raw.toLowerCase();

  // Check if user defined a custom device type icon
  const customMatch = (customTypes || []).find(
    (c) => c.name.toLowerCase() === lower
  );
  if (customMatch && ICON_BY_NAME[customMatch.icon_name]) {
    return ICON_BY_NAME[customMatch.icon_name];
  }

  if (lower.includes('router') || lower.includes('gateway') || lower.includes('modem')) return Globe;
  if (lower.includes('switch') || lower.includes('load balancer')) return Network;
  if (lower.includes('firewall') || lower.includes('vpn')) return Shield;
  if (lower.includes('wireless') || lower.includes('access point') || lower.includes('mesh') || lower.includes('repeater')) return Wifi;
  if (lower.includes('nvr') || lower.includes('dvr')) return Video;
  if (lower.includes('camera')) return Camera;
  if (lower.includes('access control') || lower.includes('door') || lower.includes('alarm')) return Lock;
  if (lower.includes('nas') || lower.includes('san') || lower.includes('storage') || lower.includes('backup')) return Database;
  if (lower.includes('printer')) return Printer;
  if (lower.includes('ups')) return BatteryCharging;
  if (lower.includes('pdu')) return Zap;
  if (lower.includes('sensor')) return Thermometer;
  if (lower.includes('voip') || lower.includes('pbx') || lower.includes('sip') || lower.includes('phone')) return Phone;
  if (lower.includes('cellular')) return Smartphone;
  if (lower.includes('laptop')) return Laptop;
  if (lower.includes('workstation') || lower.includes('desktop')) return Monitor;
  if (lower.includes('raspberry') || lower.includes('mini pc') || lower.includes('iot') || lower.includes('smart')) return Cpu;
  if (lower === 'container' || lower.includes('docker')) return Box;
  if (lower.includes('hypervisor') || lower.includes('proxmox') || lower.includes('virtualization')) return Layers;
  return Server;
}

export function normalizeDeviceStatus(status) {
  const s = (status || '').toLowerCase();
  if (s === 'online' || s === 'active') return 'online';
  if (s === 'offline' || s === 'inactive') return 'offline';
  if (s === 'maintenance') return 'maintenance';
  return 'unknown';
}

export function getStatusBadgeMeta(status) {
  const norm = normalizeDeviceStatus(status);
  if (norm === 'online') {
    return {
      label: 'Online',
      color: 'var(--status-emerald, #10b981)',
      bg: 'var(--status-emerald-soft, rgba(16, 185, 129, 0.14))',
      border: 'rgba(16, 185, 129, 0.32)'
    };
  }
  if (norm === 'offline') {
    return {
      label: 'Offline',
      color: 'var(--status-rose, #f43f5e)',
      bg: 'var(--status-rose-soft, rgba(244, 63, 94, 0.14))',
      border: 'rgba(244, 63, 94, 0.32)'
    };
  }
  if (norm === 'maintenance') {
    return {
      label: 'Maintenance',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.34)'
    };
  }
  return {
    label: 'Unknown',
    color: 'var(--text-secondary)',
    bg: 'var(--bg-elevated)',
    border: 'var(--border-subtle)'
  };
}

export function formatDeviceTypeLabel(typeStr) {
  if (!typeStr) return 'Physical Server';
  if (typeStr === 'physical') return 'Physical Server';
  if (typeStr === 'vm') return 'Virtual Machine';
  if (typeStr === 'container') return 'Container';
  return typeStr;
}

export function shouldShowOsField(deviceType, category) {
  const t = (deviceType || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (c === 'servers and computing') return true;
  if (
    t.includes('router') ||
    t.includes('firewall') ||
    t.includes('switch') ||
    t.includes('gateway') ||
    t.includes('nvr') ||
    t.includes('pbx') ||
    t.includes('backup') ||
    t.includes('storage')
  ) {
    return true;
  }
  return false;
}

/**
 * Returns the dynamic device-specific field definitions for the selected deviceType.
 */
export function getDynamicFieldsForDeviceType(deviceType, customTypes = []) {
  const raw = (deviceType || '').trim();
  const lower = raw.toLowerCase();

  // 1. Check Custom Device Types first
  const customMatch = (customTypes || []).find(
    (c) => c.name.toLowerCase() === lower
  );
  if (customMatch) {
    try {
      const parsed = JSON.parse(customMatch.fields_json || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          sectionTitle: `${customMatch.name} Specifications`,
          fields: parsed.map((f) => ({
            key: f.key || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            label: f.label,
            type: f.type || 'text',
            placeholder: f.placeholder || '',
            options: f.options || []
          }))
        };
      }
    } catch (_) {}
  }

  // 2. Switches
  if (lower.includes('switch')) {
    return {
      sectionTitle: 'Switch Port & Layer Specifications',
      fields: [
        { key: 'port_count', label: 'Number of Ports', type: 'select', options: ['5', '8', '16', '24', '48', '96'] },
        { key: 'management_type', label: 'Management Type', type: 'select', options: ['Managed', 'Smart Managed', 'Unmanaged'] },
        { key: 'switching_layer', label: 'Switching Layer', type: 'select', options: ['Layer 2', 'Layer 2+ (Static Routing)', 'Layer 3 (Full Routing)'] },
        { key: 'poe_support', label: 'PoE Support', type: 'select', options: ['None', 'PoE (802.3af)', 'PoE+ (802.3at)', 'PoE++ (802.3bt)'] },
        { key: 'poe_budget', label: 'PoE Power Budget (W)', type: 'text', placeholder: 'e.g., 400W' },
        { key: 'vlan_support', label: 'VLAN 802.1Q Support', type: 'select', options: ['Supported', 'Not Supported'] },
        { key: 'uplink_ports', label: 'Uplink Interfaces', type: 'text', placeholder: 'e.g., 4x 10G SFP+' }
      ]
    };
  }

  // 3. Routers, Firewalls, Gateways, VPN & Load Balancers
  if (
    lower.includes('router') ||
    lower.includes('firewall') ||
    lower.includes('gateway') ||
    lower.includes('load balancer') ||
    lower.includes('modem')
  ) {
    return {
      sectionTitle: 'Routing, WAN/LAN & Security Capabilities',
      fields: [
        { key: 'wan_ip', label: 'WAN / Public IP', type: 'text', placeholder: 'e.g., 203.0.113.10 or DHCP' },
        { key: 'lan_ip', label: 'Primary LAN Gateway IP', type: 'text', placeholder: 'e.g., 192.168.1.1' },
        { key: 'wan_interfaces', label: 'WAN Interfaces Count', type: 'select', options: ['1', '2 (Dual WAN)', '3', '4+'] },
        { key: 'lan_interfaces', label: 'LAN / Routed Ports', type: 'text', placeholder: 'e.g., 8x 1GbE + 2x 10G SFP+' },
        { key: 'vpn_support', label: 'VPN Capabilities', type: 'text', placeholder: 'e.g., WireGuard, IPsec, OpenVPN' },
        { key: 'firewall_capabilities', label: 'Firewall / Inspection Mode', type: 'select', options: ['Stateful Packet Inspection', 'NGFW + IDS/IPS', 'ACL / Basic NAT', 'Passthrough / Bridge'] },
        { key: 'routing_protocols', label: 'Routing Protocols', type: 'text', placeholder: 'e.g., Static, OSPF, BGP, VLAN Routing' }
      ]
    };
  }

  // 4. Wireless Access Points, Controllers, Bridges & Mesh
  if (
    lower.includes('wireless') ||
    lower.includes('access point') ||
    lower.includes('mesh') ||
    lower.includes('repeater')
  ) {
    return {
      sectionTitle: 'Wireless Radio & SSID Configuration',
      fields: [
        { key: 'wifi_standards', label: 'Wi-Fi Standard', type: 'select', options: ['Wi-Fi 7 (802.11be)', 'Wi-Fi 6E (802.11ax 6GHz)', 'Wi-Fi 6 (802.11ax)', 'Wi-Fi 5 (802.11ac)', '802.11n / Legacy'] },
        { key: 'supported_bands', label: 'Supported Frequency Bands', type: 'select', options: ['2.4 GHz + 5 GHz + 6 GHz', '2.4 GHz + 5 GHz (Dual Band)', '5 GHz Point-to-Point', '2.4 GHz Only'] },
        { key: 'ssids', label: 'Broadcasted SSIDs', type: 'text', placeholder: 'e.g., Corp-WiFi, Homelab-IoT, Guest' },
        { key: 'controller', label: 'Managing Controller', type: 'text', placeholder: 'e.g., UniFi Network (192.168.1.1) / Standalone' },
        { key: 'mesh_capable', label: 'Wireless Mesh Support', type: 'select', options: ['Enabled', 'Supported (Wired Uplink Active)', 'Not Supported'] },
        { key: 'poe_requirements', label: 'Power / PoE Requirement', type: 'select', options: ['802.3af PoE', '802.3at PoE+', '802.3bt PoE++', 'Passive PoE', 'DC / AC Adapter'] }
      ]
    };
  }

  // 5. NVRs, DVRs & Surveillance Cameras
  if (
    lower.includes('nvr') ||
    lower.includes('dvr') ||
    lower.includes('camera')
  ) {
    return {
      sectionTitle: 'Surveillance & Video Recording Specifications',
      fields: [
        { key: 'camera_channels', label: 'Max Camera Channels', type: 'text', placeholder: 'e.g., 16 Channels (or 1 for standalone camera)' },
        { key: 'connected_cameras', label: 'Connected Camera Count', type: 'text', placeholder: 'e.g., 8' },
        { key: 'storage_capacity', label: 'Recording Storage Capacity', type: 'text', placeholder: 'e.g., 16 TB (2x 8TB Surveillance HDD)' },
        { key: 'camera_protocols', label: 'Supported Video Protocols', type: 'text', placeholder: 'e.g., ONVIF, RTSP, H.265' },
        { key: 'resolution_fps', label: 'Stream Resolution / FPS', type: 'text', placeholder: 'e.g., 4K (3840x2160) @ 30fps' },
        { key: 'retention_days', label: 'Retention Window', type: 'text', placeholder: 'e.g., 30 Days Continuous' }
      ]
    };
  }

  // 6. NAS, SAN & Storage Arrays
  if (
    lower.includes('nas') ||
    lower.includes('san') ||
    lower.includes('storage') ||
    lower.includes('backup')
  ) {
    return {
      sectionTitle: 'Storage Array & Protocol Specifications',
      fields: [
        { key: 'total_storage_capacity', label: 'Total Usable / Raw Capacity', type: 'text', placeholder: 'e.g., 48 TB Raw / 32 TB Usable' },
        { key: 'drive_count', label: 'Installed Drives / Bays', type: 'text', placeholder: 'e.g., 6 of 8 Bays Populated (4x HDD, 2x NVMe)' },
        { key: 'raid_configuration', label: 'RAID / Pool Topology', type: 'select', options: ['ZFS RAIDZ1', 'ZFS RAIDZ2', 'RAID 1', 'RAID 5', 'RAID 6', 'RAID 10', 'SHR / Unraid', 'JBOD / Single'] },
        { key: 'storage_protocols', label: 'Shared Storage Protocols', type: 'text', placeholder: 'e.g., SMB, NFSv4, iSCSI, S3' },
        { key: 'filesystem', label: 'File System', type: 'select', options: ['ZFS', 'Btrfs', 'EXT4', 'XFS', 'VMFS', 'NTFS / ReFS'] }
      ]
    };
  }

  // 7. Servers, VMs, Hypervisors, Workstations, SBCs & Containers
  if (
    lower.includes('server') ||
    lower.includes('virtual') ||
    lower.includes('hypervisor') ||
    lower.includes('proxmox') ||
    lower.includes('docker') ||
    lower.includes('workstation') ||
    lower.includes('desktop') ||
    lower.includes('laptop') ||
    lower.includes('mini pc') ||
    lower.includes('raspberry') ||
    lower === 'container' ||
    lower === 'physical' ||
    lower === 'vm'
  ) {
    return {
      sectionTitle: 'Compute, Virtualization & Workload Specifications',
      fields: [
        { key: 'cpu', label: 'CPU / Processor', type: 'text', placeholder: 'e.g., Intel Xeon / Core i7 / ARM Cortex-A76 (8 vCPU)' },
        { key: 'ram', label: 'Memory (RAM)', type: 'text', placeholder: 'e.g., 32 GB DDR5 ECC' },
        { key: 'storage', label: 'Local Disk / Storage', type: 'text', placeholder: 'e.g., 1 TB NVMe RAID1' },
        { key: 'virtualization_platform', label: 'Virtualization / Runtime Platform', type: 'select', options: ['Bare Metal', 'Proxmox VE', 'Docker Engine', 'VMware ESXi', 'KVM / QEMU', 'Microsoft Hyper-V', 'LXC Container'] },
        { key: 'docker_support', label: 'Docker Support', type: 'select', options: ['Disabled', 'Docker Engine Host', 'Docker Swarm / Compose', 'Container Workload'] }
      ]
    };
  }

  // 8. UPS & PDUs
  if (lower.includes('ups') || lower.includes('pdu')) {
    return {
      sectionTitle: 'Power Protection & Distribution Specifications',
      fields: [
        { key: 'power_capacity', label: 'Rated Capacity (VA / Watts)', type: 'text', placeholder: 'e.g., 1500VA / 1000W' },
        { key: 'battery_runtime', label: 'Estimated Runtime', type: 'text', placeholder: 'e.g., 42 mins @ 250W load' },
        { key: 'outlet_count', label: 'Total / Switched Outlets', type: 'text', placeholder: 'e.g., 8 NEMA 5-15R (4 Surge + 4 Battery)' },
        { key: 'management_interface', label: 'Telemetry Protocol', type: 'text', placeholder: 'e.g., NUT Server, SNMPv3, APC SmartConnect' }
      ]
    };
  }

  // 9. Fallback for Printers, VoIP, Access Control & IoT
  return {
    sectionTitle: 'Device-Specific Attributes',
    fields: [
      { key: 'connectivity_type', label: 'Interface / Connectivity', type: 'select', options: ['1GbE Ethernet', 'Fast Ethernet (100M)', 'Wi-Fi', 'Zigbee / Z-Wave / Thread', 'PoE Ethernet'] },
      { key: 'management_protocol', label: 'Management / Control Protocol', type: 'text', placeholder: 'e.g., HTTPS Web UI, SNMP, MQTT, SIP, IPP' },
      { key: 'power_source', label: 'Power Source', type: 'text', placeholder: 'e.g., 802.3af PoE, AC 120V, 12V DC' }
    ]
  };
}

export function parseHostSpecs(host) {
  if (!host || !host.specs_json) return {};
  if (typeof host.specs_json === 'object') return host.specs_json;
  try {
    const parsed = JSON.parse(host.specs_json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}
