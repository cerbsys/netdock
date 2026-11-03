import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import {
  getDeviceIconComponent,
  getStatusBadgeMeta,
  formatDeviceTypeLabel,
  getDynamicFieldsForDeviceType,
  parseHostSpecs
} from './deviceCatalog';

export default function DeviceInspector({
  device,
  subnets = [],
  hosts = [],
  customDeviceTypes = [],
  onEditDevice,
  onDeleteDevice,
  onSaveNotes,
  onCloseMobile
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    setEditingNotes(false);
    setNotesDraft(device?.notes || '');
  }, [device?.id, device?.notes]);

  const specs = useMemo(() => parseHostSpecs(device), [device]);
  const dynamicSchema = useMemo(
    () => (device ? getDynamicFieldsForDeviceType(device.device_type, customDeviceTypes) : null),
    [device, customDeviceTypes]
  );

  if (!device) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12.5px'
        }}
      >
        Select any network device, server, switch, access point, or workload from the inventory to inspect its full specifications.
      </div>
    );
  }

  const DeviceIcon = getDeviceIconComponent(device.device_type, customDeviceTypes);
  const statusMeta = getStatusBadgeMeta(device.status);
  const assignedSubnet = subnets.find((s) => s.id === device.subnet_id);
  const parentDevice = hosts.find((h) => h.id === device.parent_id);
  const downstreamCount = hosts.filter((h) => h.parent_id === device.id).length;

  const copyText = (val, key) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1600);
  };

  // Build populated device-specific entries
  const populatedSpecificRows = [];
  const handledKeys = new Set();
  if (dynamicSchema && dynamicSchema.fields) {
    dynamicSchema.fields.forEach((f) => {
      handledKeys.add(f.key);
      if (specs[f.key] !== undefined && specs[f.key] !== '') {
        populatedSpecificRows.push({ label: f.label, value: specs[f.key] });
      }
    });
  }
  Object.entries(specs).forEach(([k, v]) => {
    if (!handledKeys.has(k) && v !== undefined && v !== '') {
      const prettyLabel = k
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      populatedSpecificRows.push({ label: prettyLabel, value: String(v) });
    }
  });

  const hasHardwareInfo = Boolean(
    device.manufacturer ||
      device.model ||
      device.serial_number ||
      device.firmware_version ||
      device.os
  );

  const sectionLabelStyle = {
    fontSize: '10.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    marginBottom: '8px'
  };

  const actionBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 9px',
    borderRadius: '6px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: '11.5px',
    fontWeight: 500,
    cursor: 'pointer'
  };

  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* HEADER & QUICK ACTIONS */}
      <div
        style={{
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                flexShrink: 0
              }}
            >
              <DeviceIcon size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                <h2
                  className="nd-truncate"
                  style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  {device.name || device.hostname}
                </h2>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    backgroundColor: statusMeta.bg,
                    border: `1px solid ${statusMeta.border}`,
                    color: statusMeta.color
                  }}
                >
                  {statusMeta.label}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {device.device_category || 'Servers and Computing'} · {formatDeviceTypeLabel(device.device_type)}
              </div>
            </div>
          </div>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Supported Quick Actions Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {device.ip && (
            <button
              type="button"
              onClick={() => copyText(device.ip, 'ip')}
              style={actionBtnStyle}
              title="Copy IPv4 Address"
            >
              {copiedField === 'ip' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedField === 'ip' ? 'Copied IP' : 'Copy IP'}</span>
            </button>
          )}

          {device.mac && (
            <button
              type="button"
              onClick={() => copyText(device.mac, 'mac')}
              style={actionBtnStyle}
              title="Copy MAC Address"
            >
              {copiedField === 'mac' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedField === 'mac' ? 'Copied MAC' : 'Copy MAC'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditDevice && onEditDevice(device)}
            style={actionBtnStyle}
          >
            <Edit3 size={12} />
            <span>Edit Device</span>
          </button>

          <button
            type="button"
            onClick={() => onDeleteDevice && onDeleteDevice(device)}
            style={{
              ...actionBtnStyle,
              color: 'var(--status-rose, #f43f5e)',
              borderColor: 'rgba(244, 63, 94, 0.28)'
            }}
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* 1. OVERVIEW SECTION */}
      <div>
        <div style={sectionLabelStyle}>Overview</div>
        <div className="nd-spec-list">
          <div className="nd-spec-row">
            <span className="nd-spec-label">Device Name</span>
            <span className="nd-spec-value">{device.name || device.hostname}</span>
          </div>
          <div className="nd-spec-row">
            <span className="nd-spec-label">Category</span>
            <span className="nd-spec-value">{device.device_category || 'Servers and Computing'}</span>
          </div>
          <div className="nd-spec-row">
            <span className="nd-spec-label">Device Type</span>
            <span className="nd-spec-value">{formatDeviceTypeLabel(device.device_type)}</span>
          </div>
          {device.location && (
            <div className="nd-spec-row">
              <span className="nd-spec-label">Location</span>
              <span className="nd-spec-value">{device.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. NETWORK INFORMATION */}
      <div>
        <div style={sectionLabelStyle}>Network Information</div>
        <div className="nd-spec-list">
          <div className="nd-spec-row">
            <span className="nd-spec-label">IPv4 Address</span>
            <span className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
              {device.ip || 'Unassigned'}
            </span>
          </div>
          {device.ipv6 && (
            <div className="nd-spec-row">
              <span className="nd-spec-label">IPv6 Address</span>
              <span className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                {device.ipv6}
              </span>
            </div>
          )}
          <div className="nd-spec-row">
            <span className="nd-spec-label">MAC Address</span>
            <span className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
              {device.mac || '—'}
            </span>
          </div>
          <div className="nd-spec-row">
            <span className="nd-spec-label">Hostname / FQDN</span>
            <span className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
              {device.hostname || device.name}
            </span>
          </div>
          <div className="nd-spec-row">
            <span className="nd-spec-label">Subnet / VLAN</span>
            <span className="nd-spec-value">
              {assignedSubnet
                ? `${assignedSubnet.name} (${assignedSubnet.cidr})${
                    assignedSubnet.vlan_id ? ` · VLAN ${assignedSubnet.vlan_id}` : ''
                  }`
                : 'Unassigned'}
            </span>
          </div>
          <div className="nd-spec-row">
            <span className="nd-spec-label">Upstream Parent</span>
            <span className="nd-spec-value">
              {parentDevice ? `${parentDevice.name || parentDevice.hostname} (${parentDevice.ip})` : 'Root / Core Node'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. HARDWARE & SYSTEM INFORMATION */}
      {hasHardwareInfo && (
        <div>
          <div style={sectionLabelStyle}>Hardware & System Information</div>
          <div className="nd-spec-list">
            {device.manufacturer && (
              <div className="nd-spec-row">
                <span className="nd-spec-label">Manufacturer</span>
                <span className="nd-spec-value">{device.manufacturer}</span>
              </div>
            )}
            {device.model && (
              <div className="nd-spec-row">
                <span className="nd-spec-label">Model</span>
                <span className="nd-spec-value">{device.model}</span>
              </div>
            )}
            {device.serial_number && (
              <div className="nd-spec-row">
                <span className="nd-spec-label">Serial Number</span>
                <span className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                  {device.serial_number}
                </span>
              </div>
            )}
            {device.firmware_version && (
              <div className="nd-spec-row">
                <span className="nd-spec-label">Firmware Version</span>
                <span className="nd-spec-value">{device.firmware_version}</span>
              </div>
            )}
            {device.os && (
              <div className="nd-spec-row">
                <span className="nd-spec-label">Operating System</span>
                <span className="nd-spec-value">{device.os}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. DEVICE-SPECIFIC INFORMATION */}
      {populatedSpecificRows.length > 0 && (
        <div>
          <div style={sectionLabelStyle}>
            {dynamicSchema?.sectionTitle || 'Device-Specific Information'}
          </div>
          <div className="nd-spec-list">
            {populatedSpecificRows.map((row, idx) => (
              <div key={idx} className="nd-spec-row">
                <span className="nd-spec-label">{row.label}</span>
                <span className="nd-spec-value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MONITORING / HEALTH */}
      <div>
        <div style={sectionLabelStyle}>Monitoring & Health</div>
        <div className="nd-spec-list">
          <div className="nd-spec-row">
            <span className="nd-spec-label">Operational State</span>
            <span className="nd-spec-value" style={{ color: statusMeta.color, fontWeight: 600 }}>
              {statusMeta.label}
            </span>
          </div>
          {assignedSubnet?.gateway && (
            <div className="nd-spec-row">
              <span className="nd-spec-label">Default Gateway</span>
              <span className="nd-spec-value" style={{ fontFamily: 'monospace' }}>
                {assignedSubnet.gateway}
              </span>
            </div>
          )}
          <div className="nd-spec-row">
            <span className="nd-spec-label">Downstream Dependents</span>
            <span className="nd-spec-value">
              {downstreamCount} linked device{downstreamCount === 1 ? '' : 's'} / workload{downstreamCount === 1 ? '' : 's'}
            </span>
          </div>
          {device.updated_at > 0 && (
            <div className="nd-spec-row">
              <span className="nd-spec-label">Last Updated</span>
              <span className="nd-spec-value">
                {new Date(device.updated_at * 1000).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 6. NOTES & DOCUMENTATION */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ ...sectionLabelStyle, marginBottom: 0 }}>Notes & Documentation</span>
          {!editingNotes ? (
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Edit Notes
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingNotes(false);
                  setNotesDraft(device.notes || '');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11.5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveNotes(device, notesDraft);
                  setEditingNotes(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>

        {editingNotes ? (
          <textarea
            rows={4}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: '7px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              lineHeight: 1.5
            }}
          />
        ) : (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '7px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              color: device.notes ? 'var(--text-primary)' : 'var(--text-muted)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap'
            }}
          >
            {device.notes || 'No operational notes or documentation recorded for this device.'}
          </div>
        )}
      </div>
    </div>
  );
}
