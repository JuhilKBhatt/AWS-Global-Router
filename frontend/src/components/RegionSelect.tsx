import React, { useState } from 'react';
import { Card, Select, Input, Button, Form, Typography, Space, Tooltip } from 'antd';
import { GlobalOutlined, RocketOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Region, SpinUpRequest } from '../api/vpnClient';

const { Text } = Typography;

interface RegionSelectProps {
  regions: Region[];
  loadingRegions: boolean;
  isSpinningUp: boolean;
  onSpinUp: (request: SpinUpRequest) => void;
  disabled?: boolean;
}

export const RegionSelect: React.FC<RegionSelectProps> = ({
  regions,
  loadingRegions,
  isSpinningUp,
  onSpinUp,
  disabled = false,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('ap-southeast-2');
  const [allowedIps, setAllowedIps] = useState<string>('0.0.0.0/0');
  const [instanceType, setInstanceType] = useState<string>('t3.micro');

  const handleSubmit = () => {
    if (!selectedRegion) return;
    onSpinUp({
      region: selectedRegion,
      allowed_ips: allowedIps || '0.0.0.0/0',
      instance_type: instanceType || 't3.micro',
    });
  };

  return (
    <Card
      title={
        <Space>
          <GlobalOutlined style={{ color: '#1677ff' }} />
          <span>Provision Ephemeral VPN Endpoint</span>
        </Space>
      }
      bordered={false}
      style={{ width: '100%', borderRadius: 12 }}
    >
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Target AWS Region"
          required
          tooltip="Select the geographic region for the WireGuard gateway"
        >
          <Select
            showSearch
            placeholder="Select a region"
            value={selectedRegion}
            onChange={(val) => setSelectedRegion(val)}
            loading={loadingRegions}
            disabled={disabled || isSpinningUp}
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={regions.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.id})`,
            }))}
            size="large"
          />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <span>Split Tunnel Routing (AllowedIPs)</span>
              <Tooltip title="Specify 0.0.0.0/0 for full tunnel, or comma-separated CIDR subnets to only route targeted traffic through AWS.">
                <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
              </Tooltip>
            </Space>
          }
        >
          <Input
            value={allowedIps}
            onChange={(e) => setAllowedIps(e.target.value)}
            placeholder="0.0.0.0/0 or 10.0.0.0/16, 192.168.1.0/24"
            disabled={disabled || isSpinningUp}
            size="large"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Default <code>0.0.0.0/0</code> routes all traffic. Custom subnets preserve local Wi-Fi bandwidth.
          </Text>
        </Form.Item>

        <Form.Item label="Instance Type">
          <Select
            value={instanceType}
            onChange={(val) => setInstanceType(val)}
            disabled={disabled || isSpinningUp}
            options={[
              { value: 't3.micro', label: 't3.micro (x86_64 - 2 vCPU, 1 GiB RAM - Free Tier eligible)' },
              { value: 't4g.micro', label: 't4g.micro (Graviton ARM - 2 vCPU, 1 GiB RAM)' },
            ]}
          />
        </Form.Item>

        <Button
          type="primary"
          icon={<RocketOutlined />}
          htmlType="submit"
          loading={isSpinningUp}
          disabled={disabled || !selectedRegion}
          size="large"
          block
          style={{ height: 48, fontSize: 16, fontWeight: 600, marginTop: 8 }}
        >
          {isSpinningUp ? 'Bootstrapping EC2 & WireGuard...' : 'Spin Up WireGuard Endpoint'}
        </Button>
      </Form>
    </Card>
  );
};
