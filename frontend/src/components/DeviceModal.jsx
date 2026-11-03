import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Check,
  Sliders,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  DEVICE_CATEGORIES,
  CUSTOM_ICON_OPTIONS,
  getDeviceIconComponent,
  getDynamicFieldsForDeviceType,
  shouldShowOsField,
  parseHostSpecs,
  formatDeviceTypeLabel,
  normalizeDeviceStatus
} from './deviceCatalog';

export default function DeviceModal({
  isOpen,
  onClose,
  initialDevice = null,
  subnets = [],
  hosts = [],
  customDeviceTypes = [],
  onSaveDevice,
  onCreateCustomType,
  onDeleteCustomType
}) {
  const isEditing = Boolean(initialDevice && initialDevice.id);

  const [form, setForm] = useState({
    id: '',
    name: '',
    device_category: 'Network Infrastructure',
    device_type: 'Router',
    manufacturer: '',
    model: '',
    ip: '',
    ipv6: '',
    mac: '',
    hostname: '',
    location: '',
    serial_number: '',
    firmware_version: '',
    os: '',
    status: 'online',
    subnet_id: '',
    parent_id: '',
    notes: ''
  });

  const [specs, setSpecs] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom Device Type Creator sub-panel state
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customTypeDraft, setCustomTypeDraft] = useState({
    name: '',
    category: 'Other',
    icon_name: 'Box',
    fields: [{ label: '', placeholder: '' }]
  });

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setShowCustomBuilder(false);

    if (initialDevice) {
      const formattedType = formatDeviceTypeLabel(initialDevice.device_type);
      setForm({
        id: initialDevice.id || '',
        name: initialDevice.name || initialDevice.hostname || '',
        device_category: initialDevice.device_category || 'Servers and Computing',
        device_type: formattedType,
        manufacturer: initialDevice.manufacturer || '',
        model: initialDevice.model || '',
        ip: initialDevice.ip || '',
        ipv6: initialDevice.ipv6 || '',
        mac: initialDevice.mac || '',
        hostname: initialDevice.hostname || initialDevice.name || '',
        location: initialDevice.location || '',
        serial_number: initialDevice.serial_number || '',
        firmware_version: initialDevice.firmware_version || '',
        os: initialDevice.os || '',
        status: normalizeDeviceStatus(initialDevice.status),
        subnet_id: initialDevice.subnet_id || (subnets[0]?.id || ''),
        parent_id: initialDevice.parent_id || '',
        notes: initialDevice.notes || ''
      });
      setSpecs(parseHostSpecs(initialDevice));
    } else {
      setForm({
        id: '',
        name: '',
        device_category: 'Network Infrastructure',
        device_type: 'Router',
        manufacturer: '',
        model: '',
        ip: '',
        ipv6: '',
        mac: '',
        hostname: '',
        location: '',
        serial_number: '',
        firmware_version: '',
        os: '',
        status: 'online',
        subnet_id: subnets[0]?.id || '',
        parent_id: '',
        notes: ''
      });
      setSpecs({});
    }
  }, [isOpen, initialDevice, subnets]);

  // Combine built-in categories with user-created Custom Device Types
  const categoriesWithCustom = useMemo(() => {
    return DEVICE_CATEGORIES.map((cat) => {
      const matchingCustom = (customDeviceTypes || [])
        .filter((c) => c.category === cat.id)
        .map((c) => c.name);
      return {
        ...cat,
        types: Array.from(new Set([...cat.types, ...matchingCustom]))
      };
    });
  }, [customDeviceTypes]);

  const availableTypesForCategory = useMemo(() => {
    const found = categoriesWithCustom.find((c) => c.id === form.device_category);
    if (!found) return ['Other Network Device'];
    if (form.device_type && !found.types.includes(form.device_type)) {
      return [...found.types, form.device_type];
    }
    return found.types;
  }, [categoriesWithCustom, form.device_category, form.device_type]);

  const dynamicSchema = useMemo(
    () => getDynamicFieldsForDeviceType(form.device_type, customDeviceTypes),
    [form.device_type, customDeviceTypes]
  );

  const SelectedIcon = useMemo(
    () => getDeviceIconComponent(form.device_type, customDeviceTypes),
    [form.device_type, customDeviceTypes]
  );

  if (!isOpen) return null;

  const handleCategoryChange = (newCat) => {
    const catObj = categoriesWithCustom.find((c) => c.id === newCat);
    const defaultType = catObj && catObj.types.length > 0 ? catObj.types[0] : 'Other Network Device';
    setForm((prev) => ({
      ...prev,
      device_category: newCat,
      device_type: defaultType
    }));
  };

  const handleSpecChange = (key, val) => {
    setSpecs((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Device Name is required.');
      return;
    }
    if (!form.device_type.trim()) {
      setFormError('Device Type is required.');
      return;
    }

    const cleanedSpecs = {};
    Object.entries(specs).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        cleanedSpecs[k] = String(v).trim();
      }
    });

    const payload = {
      ...form,
      name: form.name.trim(),
      hostname: (form.hostname || form.name).trim(),
      parent_id: form.parent_id || null,
      specs_json: JSON.stringify(cleanedSpecs)
    };

    setSubmitting(true);
    try {
      await onSaveDevice(payload, isEditing);
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save network device.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCustomTypeSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!customTypeDraft.name.trim()) {
      setFormError('Please provide a name for the custom device type.');
      return;
    }
    const validFields = customTypeDraft.fields
      .filter((f) => f.label && f.label.trim())
      .map((f) => ({
        key: f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: f.label.trim(),
        type: 'text',
        placeholder: (f.placeholder || '').trim()
      }));

    try {
      const created = await onCreateCustomType({
        id: '',
        name: customTypeDraft.name.trim(),
        category: customTypeDraft.category,
        icon_name: customTypeDraft.icon_name,
        fields_json: JSON.stringify(validFields)
      });
      setForm((prev) => ({
        ...prev,
        device_category: created.category,
        device_type: created.name
      }));
      setShowCustomBuilder(false);
      setCustomTypeDraft({
        name: '',
        category: 'Other',
        icon_name: 'Box',
        fields: [{ label: '', placeholder: '' }]
      });
    } catch (err) {
      setFormError(err.message || 'Failed to create custom device type.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: 'var(--nd-input-py, 8px) var(--nd-input-px, 11px)',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '7px',
    color: 'var(--text-primary)',
    fontSize: '12.5px',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '4px'
  };

  const sectionHeaderStyle = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--accent)',
    marginBottom: '10px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
          maxWidth: '760px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary)'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '15px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-elevated)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '7px',
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)'
              }}
            >
              <SelectedIcon size={16} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>
                {isEditing ? `Edit Network Device — ${form.name}` : 'Register Network Device'}
              </h2>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {form.device_category} · {form.device_type}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {formError && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '7px',
                backgroundColor: 'var(--status-rose-soft)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: 'var(--status-rose, #f43f5e)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={15} />
              <span>{formError}</span>
            </div>
          )}

          {/* Custom Device Type Creator Sub-View */}
          {showCustomBuilder ? (
            <form
              onSubmit={handleCreateCustomTypeSubmit}
              style={{
                padding: '16px',
                borderRadius: '9px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-strong)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>
                    Create Reusable Custom Device Type
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Define a custom equipment type, assign it to a category and icon, and specify optional custom fields.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomBuilder(false)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    fontSize: '11.5px',
                    cursor: 'pointer'
                  }}
                >
                  Back to Device Form
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Custom Type Name *</label>
                  <input
                    type="text"
                    required
                    value={customTypeDraft.name}
                    onChange={(e) => setCustomTypeDraft({ ...customTypeDraft, name: e.target.value })}
                    placeholder="e.g., KVM Console / Fiber Mux"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Category Assignment</label>
                  <select
                    value={customTypeDraft.category}
                    onChange={(e) => setCustomTypeDraft({ ...customTypeDraft, category: e.target.value })}
                    style={inputStyle}
                  >
                    {DEVICE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Device Icon</label>
                  <select
                    value={customTypeDraft.icon_name}
                    onChange={(e) => setCustomTypeDraft({ ...customTypeDraft, icon_name: e.target.value })}
                    style={inputStyle}
                  >
                    {CUSTOM_ICON_OPTIONS.map((ico) => (
                      <option key={ico.id} value={ico.id}>
                        {ico.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Optional Custom Fields</label>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomTypeDraft((prev) => ({
                        ...prev,
                        fields: [...prev.fields, { label: '', placeholder: '' }]
                      }))
                    }
                    style={{
                      fontSize: '11.5px',
                      padding: '4px 9px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--accent)',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Custom Field
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customTypeDraft.fields.map((fld, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Field Label (e.g., Optical Wavelength)"
                        value={fld.label}
                        onChange={(e) => {
                          const next = [...customTypeDraft.fields];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setCustomTypeDraft({ ...customTypeDraft, fields: next });
                        }}
                        style={inputStyle}
                      />
                      <input
                        type="text"
                        placeholder="Placeholder (e.g., 1310nm Single-Mode)"
                        value={fld.placeholder}
                        onChange={(e) => {
                          const next = [...customTypeDraft.fields];
                          next[idx] = { ...next[idx], placeholder: e.target.value };
                          setCustomTypeDraft({ ...customTypeDraft, fields: next });
                        }}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = customTypeDraft.fields.filter((_, i) => i !== idx);
                          setCustomTypeDraft({ ...customTypeDraft, fields: next });
                        }}
                        style={{
                          padding: '0 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {customDeviceTypes.length > 0 && (
                <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Saved Custom Device Types
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {customDeviceTypes.map((ct) => (
                      <span
                        key={ct.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <span>{ct.name} ({ct.category})</span>
                        <button
                          type="button"
                          onClick={() => onDeleteCustomType && onDeleteCustomType(ct.id)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: 'var(--status-rose, #f43f5e)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex'
                          }}
                          title="Delete custom type"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="submit"
                  className="nd-btn-primary"
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save & Select Custom Type
                </button>
              </div>
            </form>
          ) : (
            <form id="nd-device-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* SECTION 1: CLASSIFICATION & IDENTITY */}
              <div>
                <div style={sectionHeaderStyle}>
                  <span>1. Device Classification & Identity</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomBuilder(true)}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      padding: '3px 9px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Plus size={12} />
                    Manage Custom Device Types
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Device Category *</label>
                    <select
                      value={form.device_category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      style={inputStyle}
                    >
                      {categoriesWithCustom.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Specific Device Type *</label>
                    <select
                      value={form.device_type}
                      onChange={(e) => {
                        if (e.target.value === 'Custom Device Type') {
                          setShowCustomBuilder(true);
                        } else {
                          setForm({ ...form, device_type: e.target.value });
                        }
                      }}
                      style={inputStyle}
                    >
                      {availableTypesForCategory.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Operational Status *</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Device Name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g., Core-Aruba-SW01 or UDM-Pro"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Hostname / FQDN</label>
                    <input
                      type="text"
                      value={form.hostname}
                      onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                      placeholder="e.g., sw01.homelab.local"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Physical Location / Rack Unit</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g., Main Rack — 1U / Office Ceiling"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: NETWORK ADDRESSING & TOPOLOGY */}
              <div>
                <div style={sectionHeaderStyle}>
                  <span>2. Network Addressing & Topology</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>IPv4 Address</label>
                    <input
                      type="text"
                      value={form.ip}
                      onChange={(e) => setForm({ ...form, ip: e.target.value })}
                      placeholder="e.g., 192.168.1.1"
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>IPv6 Address (Optional)</label>
                    <input
                      type="text"
                      value={form.ipv6}
                      onChange={(e) => setForm({ ...form, ipv6: e.target.value })}
                      placeholder="e.g., fd00::10 or fe80::1"
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>MAC Address</label>
                    <input
                      type="text"
                      value={form.mac}
                      onChange={(e) => setForm({ ...form, mac: e.target.value })}
                      placeholder="e.g., AA:BB:CC:11:22:33"
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Assigned Subnet / VLAN</label>
                    <select
                      value={form.subnet_id}
                      onChange={(e) => setForm({ ...form, subnet_id: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Unassigned / External Network</option>
                      {subnets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.cidr}){s.vlan_id ? ` · VLAN ${s.vlan_id}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Upstream Parent Device / Hypervisor / Switch</label>
                    <select
                      value={form.parent_id || ''}
                      onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Root / Core Infrastructure Node (No Upstream Parent)</option>
                      {hosts
                        .filter((h) => h.id !== form.id)
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name || h.hostname} ({h.ip || 'No IP'} · {formatDeviceTypeLabel(h.device_type)})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: HARDWARE & SYSTEM METADATA */}
              <div>
                <div style={sectionHeaderStyle}>
                  <span>3. Hardware & Firmware Identification</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Manufacturer / Vendor</label>
                    <input
                      type="text"
                      value={form.manufacturer}
                      onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                      placeholder="e.g., Ubiquiti, Aruba, Cisco, Dell, Synology"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Hardware Model</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="e.g., UDM-Pro, 2930F, DS923+, R740"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Serial Number / Service Tag</label>
                    <input
                      type="text"
                      value={form.serial_number}
                      onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                      placeholder="e.g., SN-9482041"
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Firmware / OS Version</label>
                    <input
                      type="text"
                      value={form.firmware_version}
                      onChange={(e) => setForm({ ...form, firmware_version: e.target.value })}
                      placeholder="e.g., UniFi OS 4.0.6 / ArubaOS-Switch"
                      style={inputStyle}
                    />
                  </div>

                  {shouldShowOsField(form.device_type, form.device_category) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Operating System / Platform Distribution</label>
                      <input
                        type="text"
                        value={form.os}
                        onChange={(e) => setForm({ ...form, os: e.target.value })}
                        placeholder="e.g., Ubuntu 24.04 LTS, Windows Server 2022, Proxmox VE 8.2, RouterOS v7"
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: DYNAMIC DEVICE-SPECIFIC FIELDS */}
              {dynamicSchema && dynamicSchema.fields && dynamicSchema.fields.length > 0 && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '9px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ ...sectionHeaderStyle, marginBottom: '12px' }}>
                    <span>4. {dynamicSchema.sectionTitle} ({form.device_type})</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '12px' }}>
                    {dynamicSchema.fields.map((fld) => (
                      <div key={fld.key}>
                        <label style={labelStyle}>{fld.label}</label>
                        {fld.type === 'select' ? (
                          <select
                            value={specs[fld.key] || ''}
                            onChange={(e) => handleSpecChange(fld.key, e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">Select {fld.label}...</option>
                            {(fld.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={specs[fld.key] || ''}
                            onChange={(e) => handleSpecChange(fld.key, e.target.value)}
                            placeholder={fld.placeholder || ''}
                            style={inputStyle}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 5: DESCRIPTION & DOCUMENTATION */}
              <div>
                <label style={labelStyle}>Description / Operational Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Document port mappings, rack cabling, VLAN trunk assignments, maintenance windows, or role details..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {!showCustomBuilder && (
          <div
            style={{
              padding: '13px 20px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-elevated)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: '7px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="nd-device-form"
              disabled={submitting}
              className="nd-btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={14} />
              <span>{submitting ? 'Saving...' : isEditing ? 'Save Device Changes' : 'Register Device'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
