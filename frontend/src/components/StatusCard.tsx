import React, { useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Popconfirm,
  Typography,
  Tabs,
  Badge,
  Grid,
} from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  CloudServerOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { InstanceResponse, Region } from '../api/vpnClient';

const { Text, Paragraph } = Typography;

interface StatusCardProps {
  instances: InstanceResponse[];
  regions?: Region[];
  onOpenQR: (instance: InstanceResponse) => void;
  onDestroy: (instance: InstanceResponse) => void;
  destroyingId?: string | null;
  onStart?: (instance: InstanceResponse) => void;
  startingId?: string | null;
  onStop?: (instance: InstanceResponse) => void;
  stoppingId?: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  instances,
  regions = [],
  onOpenQR,
  onDestroy,
  destroyingId,
  onStart,
  startingId,
  onStop,
  stoppingId,
  onRefresh,
  isRefreshing,
}) => {

  const screens = Grid.useBreakpoint();
  const [activeTabKey, setActiveTabKey] = useState<string>('0');

  const getRegionName = (regionId: string) => {
    const found = regions.find((r) => r.id === regionId);
    return found ? found.name : regionId;
  };

  if (instances.length === 0) {
    return (
      <Card
        title={
          <Space>
            <CloudServerOutlined style={{ color: '#8c8c8c' }} />
            <span>Active VPN Endpoints (0)</span>
          </Space>
        }
        extra={<Tag color="default">IDLE / STANDBY</Tag>}
        bordered={false}
        style={{
          width: '100%',
          borderRadius: 12,
          background: '#161b22',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        bodyStyle={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '36px 24px',
          flex: 1,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(22, 119, 255, 0.08)',
            border: '1px dashed #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <CloudServerOutlined style={{ fontSize: 30, color: '#58a6ff' }} />
        </div>

        <Text strong style={{ color: '#f0f6fc', fontSize: 16, marginBottom: 8 }}>
          No Active Gateways
        </Text>
        <Paragraph
          type="secondary"
          style={{ textAlign: 'center', maxWidth: 360, fontSize: 13, marginBottom: 20 }}
        >
          Choose an AWS region on the left to dynamically bootstrap an on-demand WireGuard gateway.
          Multiple gateways can be active concurrently.
        </Paragraph>

        <div
          style={{
            background: '#0d1117',
            padding: '12px 16px',
            borderRadius: 8,
            width: '100%',
            maxWidth: 360,
            border: '1px solid #21262d',
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space size={6}>
                <SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: 13 }} />
                <Text style={{ fontSize: 12, color: '#8b949e' }}>Idle Spend</Text>
              </Space>
              <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                $0.00 / hr
              </Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space size={6}>
                <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 13 }} />
                <Text style={{ fontSize: 12, color: '#8b949e' }}>Cold Boot Time</Text>
              </Space>
              <Text style={{ fontSize: 12, color: '#c9d1d9', fontFamily: 'monospace' }}>
                ~60 seconds
              </Text>
            </div>
          </Space>
        </div>
      </Card>
    );
  }

  const getStatusTag = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            RUNNING
          </Tag>
        );
      case 'pending':
        return (
          <Tag icon={<SyncOutlined spin />} color="processing">
            BOOTSTRAPPING
          </Tag>
        );
      case 'stopped':
        return (
          <Tag icon={<PauseCircleOutlined />} color="warning">
            STANDBY (PAUSED)
          </Tag>
        );
      case 'stopping':
        return (
          <Tag icon={<SyncOutlined spin />} color="warning">
            PAUSING
          </Tag>
        );
      case 'shutting-down':
      case 'terminated':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            {state.toUpperCase()}
          </Tag>
        );
      default:
        return <Tag color="default">{state.toUpperCase()}</Tag>;
    }
  };

  const renderInstanceDetails = (inst: InstanceResponse) => {
    const isRunning = inst.state.toLowerCase() === 'running';
    const isStopped = inst.state.toLowerCase() === 'stopped';
    const isStopping = inst.state.toLowerCase() === 'stopping';
    const isBeingDestroyed = destroyingId === inst.instance_id;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div>
          <Descriptions
            bordered
            size="small"
            column={1}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Instance ID">
              <Space wrap size={6}>
                <Tag color="blue" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                  {getRegionName(inst.region)} ({inst.region})
                </Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getStatusTag(inst.state)}
            </Descriptions.Item>
            <Descriptions.Item label="AWS EC2 ID">
              <code style={{ color: '#8b949e', wordBreak: 'break-all' }}>{inst.instance_id}</code>
            </Descriptions.Item>
            <Descriptions.Item label="Public IPv4">
              {inst.public_ip ? (
                <Text strong copyable style={{ color: '#7ee787', wordBreak: 'break-all' }}>
                  {inst.public_ip}
                </Text>
              ) : (
                <Text type="secondary">
                  Allocating public IP...
                </Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Lifecycle">
              <Space size={6} wrap>
                <Tag color="cyan" icon={<PauseCircleOutlined />} style={{ margin: 0 }}>
                  Warm Standby
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Pause / Resume enabled
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Instance Type">
              {inst.instance_type || 't3.micro'}
            </Descriptions.Item>
            <Descriptions.Item label="Launch Time">
              {inst.launch_time ? new Date(inst.launch_time).toLocaleTimeString() : 'Just now'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            flexDirection: screens.xs ? 'column-reverse' : 'row',
            justifyContent: 'flex-end',
          }}
        >
          {/* Permanent Teardown */}
          <Popconfirm
            title="Terminate VPN Instance"
            description={`Destroy ${getRegionName(inst.region)} (${inst.region}) node? Compute charges will cease immediately.`}
            onConfirm={() => onDestroy(inst)}
            okText="Destroy"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: isBeingDestroyed }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={isBeingDestroyed}
              block={screens.xs}
              style={{ height: 42 }}
            >
              Destroy Node
            </Button>
          </Popconfirm>

          {/* Pause VPN Button when Running */}
          {isRunning && onStop && (
            <Button
              icon={<PauseCircleOutlined />}
              loading={stoppingId === inst.instance_id}
              onClick={() => onStop(inst)}
              block={screens.xs}
              style={{
                height: 42,
                background: '#d48806',
                borderColor: '#d48806',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              Pause VPN (Sleep)
            </Button>
          )}

          {/* While Stopping / Pausing */}
          {isStopping && (
            <Button
              icon={<SyncOutlined spin />}
              disabled
              block={screens.xs}
              style={{
                height: 42,
                background: '#21262d',
                borderColor: '#30363d',
                color: '#d48806',
                fontWeight: 600,
              }}
            >
              Pausing (Entering Standby)...
            </Button>
          )}

          {/* Start VPN Button when Stopped */}
          {isStopped && onStart && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={startingId === inst.instance_id}
              onClick={() => onStart(inst)}
              block={screens.xs}
              style={{
                height: 42,
                background: '#238636',
                borderColor: '#2ea043',
                fontWeight: 600,
              }}
            >
              Start VPN (Resume)
            </Button>
          )}

          <Button
            type="primary"
            icon={<QrcodeOutlined />}
            onClick={() => onOpenQR(inst)}
            disabled={!isRunning}
            block={screens.xs}
            style={{
              background: isRunning ? '#1677ff' : undefined,
              borderColor: isRunning ? '#1677ff' : undefined,
              height: 42,
              fontWeight: 600,
              flex: screens.xs ? undefined : 1,
            }}
          >
            {isRunning ? 'WireGuard Pairing' : isStopped ? 'Gateway Paused' : isStopping ? 'Entering Standby...' : 'Waiting for Boot...'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card
      title={
        <Space size={6}>
          <CloudServerOutlined style={{ color: '#52c41a' }} />
          <span>Active Endpoints ({instances.length})</span>
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<SyncOutlined spin={isRefreshing} />}
          onClick={onRefresh}
        >
          {screens.xs ? 'Refresh' : 'Refresh All'}
        </Button>
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
      bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {instances.length === 1 ? (
        renderInstanceDetails(instances[0])
      ) : (
        <Tabs
          activeKey={activeTabKey}
          onChange={(k) => setActiveTabKey(k)}
          type="card"
          items={instances.map((inst, index) => {
            const isRunning = inst.state.toLowerCase() === 'running';
            return {
              key: String(index),
              label: (
                <Space size={6}>
                  <Badge status={isRunning ? 'success' : 'processing'} />
                  <span>{getRegionName(inst.region)}</span>
                </Space>
              ),
              children: renderInstanceDetails(inst),
            };
          })}
        />
      )}
    </Card>
  );
};
