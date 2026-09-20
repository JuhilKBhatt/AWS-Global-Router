import React, { useState } from 'react';
import { Modal, Typography, Button, Space, message, Tabs, Grid } from 'antd';
import { DownloadOutlined, CopyOutlined, QrcodeOutlined, FileTextOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';

const { Paragraph, Text } = Typography;

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  configText: string;
  region: string;
  instanceId?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  onClose,
  configText,
  region,
  instanceId,
}) => {
  const screens = Grid.useBreakpoint();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configText);
      setCopied(true);
      message.success('WireGuard configuration copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      message.error('Failed to copy to clipboard.');
    }
  };

  const handleDownload = () => {
    const fileName = instanceId ? `${instanceId}.conf` : `wg-aws-${region}.conf`;
    const element = document.createElement('a');
    const file = new Blob([configText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    message.success(`Downloaded ${fileName}`);
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <Space>
          <QrcodeOutlined style={{ color: '#52c41a' }} />
          <span>WireGuard Client Pairing</span>
        </Space>
      }
      footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy} block={screens.xs}>
          {copied ? 'Copied!' : 'Copy Config'}
        </Button>,
        <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownload} block={screens.xs}>
          Download .conf
        </Button>,
      ]}
      width={screens.xs ? '92%' : 560}
      centered
    >
      <Paragraph type="secondary" style={{ fontSize: screens.xs ? 12 : 14 }}>
        Scan the QR code directly inside the official WireGuard mobile app (iOS/Android), or
        download the configuration profile for desktop clients (macOS/Windows/Linux).
      </Paragraph>

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
                  padding: '16px 0',
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
                    value={configText || 'WG_EMPTY_CONFIG'}
                    size={screens.xs ? 180 : 240}
                    level="M"
                  />
                </div>
                <Text type="secondary" style={{ marginTop: 12, fontSize: 13 }}>
                  Point your WireGuard camera scanner at the code above
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
                  maxHeight: 280,
                  overflowY: 'auto',
                  background: '#0d1117',
                  color: '#58a6ff',
                  padding: 16,
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {configText}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
