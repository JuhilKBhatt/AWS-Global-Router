import React, { useState } from 'react';
import {
  Modal,
  Typography,
  Button,
  Space,
  message,
  Tabs,
  Grid,
  Tag,
  Input,
  Popconfirm,
} from 'antd';
import {
  DownloadOutlined,
  CopyOutlined,
  QrcodeOutlined,
  FileTextOutlined,
  PlusOutlined,
  MobileOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { DeviceItem } from '../api/vpnClient';

const { Paragraph, Text } = Typography;

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  configText: string;
  region: string;
  instanceId?: string;
  devices?: DeviceItem[];
  onAddDevice?: (name: string) => Promise<void>;
  onDeleteDevice?: (deviceId: string) => Promise<void>;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  onClose,
  configText,
  region,
  instanceId,
  devices = [],
  onAddDevice,
  onDeleteDevice,
}) => {
  const screens = Grid.useBreakpoint();
  const [copied, setCopied] = useState(false);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeDevice = devices && devices.length > 0 ? devices[selectedDeviceIndex] || devices[0] : null;
  const activeConfig = activeDevice?.client_config || configText;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeConfig);
      setCopied(true);
      message.success('WireGuard configuration copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      message.error('Failed to copy to clipboard.');
    }
  };

  const handleDownload = () => {
    const devName = activeDevice?.name ? activeDevice.name.toLowerCase().replace(/\s+/g, '-') : 'device';
    const fileName = `wg-${region || instanceId || 'peer'}-${devName}.conf`;
    const element = document.createElement('a');
    const file = new Blob([activeConfig], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    message.success(`Downloaded ${fileName}`);
  };

  const submitAddDevice = async () => {
    if (!newDeviceName.trim()) {
      message.warning('Please enter a device name.');
      return;
    }
    if (!onAddDevice) return;
    try {
      setAddingDevice(true);
      await onAddDevice(newDeviceName.trim());
      setNewDeviceName('');
      setShowAddForm(false);
      message.success('Device added successfully!');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Failed to add device.');
    } finally {
      setAddingDevice(false);
    }
  };

  const submitDeleteDevice = async (deviceId: string) => {
    if (!onDeleteDevice) return;
    try {
      setDeletingId(deviceId);
      await onDeleteDevice(deviceId);
      setSelectedDeviceIndex(0);
      message.success('Device removed.');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Failed to remove device.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <QrcodeOutlined style={{ color: '#52c41a' }} />
            <span>WireGuard Client Pairing</span>
          </Space>
          <Tag color="blue">
            {devices.length || 1} / 5 Devices Connected
          </Tag>
        </div>
      }
      footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy} block={screens.xs}>
          {copied ? 'Copied!' : 'Copy Config'}
        </Button>,
        <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownload} block={screens.xs}>
          Download .conf
        </Button>,
      ]}
      width={screens.xs ? '94%' : 600}
      centered
    >
      <Paragraph type="secondary" style={{ fontSize: screens.xs ? 12 : 13, marginBottom: 12 }}>
        Scan the QR code directly inside the official WireGuard app on your phone, or download the profile for PC/Mac.
        Each configured device has its own cryptographic keypair and can connect simultaneously.
      </Paragraph>

      {/* Multi-Device Selection Bar */}
      <div style={{ marginBottom: 16, background: '#161b22', padding: 12, borderRadius: 8, border: '1px solid #30363d' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <Text strong style={{ color: '#f0f6fc', fontSize: 13 }}>
            Registered Devices ({devices.length} of 5 max)
          </Text>
          {onAddDevice && devices.length < 5 && (
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ borderColor: '#58a6ff', color: '#58a6ff' }}
            >
              Add Device
            </Button>
          )}
        </div>

        {/* Add Device Inline Form */}
        {showAddForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, marginTop: 4 }}>
            <Input
              size="small"
              placeholder="e.g. Work MacBook, iPad Mini"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              onPressEnter={submitAddDevice}
            />
            <Button size="small" type="primary" loading={addingDevice} onClick={submitAddDevice}>
              Save
            </Button>
            <Button size="small" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        )}

        {/* Device Badges / Tabs */}
        {devices.length > 0 && (
          <Space wrap size={[6, 6]}>
            {devices.map((dev, idx) => {
              const isSelected = idx === selectedDeviceIndex;
              return (
                <div
                  key={dev.id}
                  onClick={() => setSelectedDeviceIndex(idx)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: isSelected ? '#1f6feb' : '#21262d',
                    border: `1px solid ${isSelected ? '#388bfd' : '#30363d'}`,
                    color: isSelected ? '#ffffff' : '#c9d1d9',
                    fontSize: 12,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <MobileOutlined />
                  <span>{dev.name}</span>
                  {dev.ip && <span style={{ opacity: 0.7, fontSize: 11 }}>({dev.ip})</span>}
                  {devices.length > 1 && onDeleteDevice && (
                    <Popconfirm
                      title="Remove device?"
                      description={`Revoke key for ${dev.name}?`}
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        submitDeleteDevice(dev.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      {deletingId === dev.id ? (
                        <span style={{ marginLeft: 4, fontSize: 11, color: '#f85149' }}>...</span>
                      ) : (
                        <DeleteOutlined
                          style={{ marginLeft: 4, color: '#f85149', cursor: 'pointer' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </Popconfirm>
                  )}
                </div>
              );
            })}
          </Space>
        )}
      </div>

      <Tabs
        defaultActiveKey="qr"
        items={[
          {
            key: 'qr',
            label: (
              <span>
                <QrcodeOutlined /> QR Code
              </span>
            ),
            children: (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 0',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    padding: 16,
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <QRCodeSVG
                    value={activeConfig || 'WG_EMPTY_CONFIG'}
                    size={screens.xs ? 180 : 230}
                    level="M"
                  />
                </div>
                <Text type="secondary" style={{ marginTop: 12, fontSize: 13 }}>
                  Point your WireGuard camera scanner at the code above for <strong>{activeDevice?.name || 'Device'}</strong>
                </Text>
              </div>
            ),
          },
          {
            key: 'conf',
            label: (
              <span>
                <FileTextOutlined /> Raw Profile
              </span>
            ),
            children: (
              <div
                style={{
                  maxHeight: 250,
                  overflowY: 'auto',
                  background: '#0d1117',
                  color: '#58a6ff',
                  padding: 14,
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {activeConfig}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

