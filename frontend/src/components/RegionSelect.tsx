import React, { useState, useEffect } from 'react';
import { Card, Select, Input, Button, Form, Typography, Space, Tooltip } from 'antd';
import { GlobalOutlined, RocketOutlined, InfoCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Region, SpinUpRequest } from '../api/vpnClient';

const { Text } = Typography;

interface RegionSelectProps {
  regions: Region[];
  loadingRegions: boolean;
  isSpinningUp: boolean;
  onSpinUp: (request: SpinUpRequest) => void;
  disabled?: boolean;
  defaultRegion?: string;
  defaultAllowedIps?: string;
  defaultInstanceType?: string;
  defaultTtlMinutes?: number;
}

export const RegionSelect: React.FC<RegionSelectProps> = ({
  regions,
  loadingRegions,
  isSpinningUp,
  onSpinUp,
  disabled = false,
  defaultRegion = 'ap-southeast-2',
  defaultAllowedIps = '0.0.0.0/0',
  defaultInstanceType = 't3.micro',
  defaultTtlMinutes = 60,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>(defaultRegion);
  const [allowedIps, setAllowedIps] = useState<string>(defaultAllowedIps);
  const [instanceType, setInstanceType] = useState<string>(defaultInstanceType);
  const [ttlMinutes, setTtlMinutes] = useState<number>(defaultTtlMinutes);

  useEffect(() => {
    if (defaultRegion) setSelectedRegion(defaultRegion);
    if (defaultAllowedIps) setAllowedIps(defaultAllowedIps);
    if (defaultInstanceType) setInstanceType(defaultInstanceType);
    if (defaultTtlMinutes !== undefined) setTtlMinutes(defaultTtlMinutes);
  }, [defaultRegion, defaultAllowedIps, defaultInstanceType, defaultTtlMinutes]);

  const handleSubmit = () => {
    if (!selectedRegion) return;
    onSpinUp({
      region: selectedRegion,
      allowed_ips: allowedIps || '0.0.0.0/0',
      instance_type: instanceType || 't3.micro',
      ttl_minutes: ttlMinutes,
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
      style={{
        width: '100%',
        borderRadius: 12,
        background: '#161b22',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <Form
        layout="vertical"
        onFinish={handleSubmit}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div>
          <Form.Item
            label="Target AWS Region"
            required
            tooltip="Select the geographic region for the WireGuard gateway"
            style={{ marginBottom: 14 }}
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
            style={{ marginBottom: 14 }}
          >
            <Input
              value={allowedIps}
              onChange={(e) => setAllowedIps(e.target.value)}
              placeholder="0.0.0.0/0 or 10.0.0.0/16, 192.168.1.0/24"
              disabled={disabled || isSpinningUp}
              size="large"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Default <code>0.0.0.0/0</code> routes all traffic. Custom subnets preserve local Wi-Fi.
            </Text>
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <ClockCircleOutlined style={{ color: '#1677ff' }} />
                <span>Session TTL (Auto-Teardown)</span>
                <Tooltip title="The EC2 node automatically self-terminates when this timer elapses to eliminate orphan compute fees.">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 14 }}
          >
            <Select
              value={ttlMinutes}
              onChange={(val) => setTtlMinutes(val)}
              disabled={disabled || isSpinningUp}
              size="large"
              options={[
                { value: 15, label: '15 Minutes (Short testing)' },
                { value: 30, label: '30 Minutes' },
                { value: 60, label: '1 Hour (Recommended)' },
                { value: 120, label: '2 Hours' },
                { value: 180, label: '3 Hours' },
                { value: 240, label: '4 Hours' },
                { value: 0, label: 'Manual Teardown (No Auto-Shutdown)' },
              ]}
            />
          </Form.Item>

          <Form.Item label="EC2 Instance Type" style={{ marginBottom: 16 }}>
            <Select
              value={instanceType}
              onChange={(val) => setInstanceType(val)}
              disabled={disabled || isSpinningUp}
              size="large"
              options={[
                { value: 't3.micro', label: 't3.micro (x86_64 - 2 vCPU, 1 GiB RAM - Free Tier)' },
                { value: 't4g.micro', label: 't4g.micro (Graviton ARM - 2 vCPU, 1 GiB RAM)' },
              ]}
            />
          </Form.Item>
        </div>

        <Button
          type="primary"
          icon={<RocketOutlined />}
          htmlType="submit"
          loading={isSpinningUp}
          disabled={disabled || !selectedRegion}
          size="large"
          block
          style={{ height: 48, fontSize: 16, fontWeight: 600, marginTop: 10 }}
        >
          {isSpinningUp ? 'Bootstrapping EC2 & WireGuard...' : 'Spin Up WireGuard Endpoint'}
        </Button>
      </Form>
    </Card>
  );
};
