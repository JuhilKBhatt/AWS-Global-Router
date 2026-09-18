import React from 'react';
import { Card, Descriptions, Tag, Button, Space, Popconfirm, Typography } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { InstanceResponse } from '../api/vpnClient';

const { Text } = Typography;

interface StatusCardProps {
  instance: InstanceResponse;
  onOpenQR: () => void;
  onDestroy: () => void;
  isDestroying: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  instance,
  onOpenQR,
  onDestroy,
  isDestroying,
  onRefresh,
  isRefreshing,
}) => {
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
            INITIALIZING
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

  const isRunning = instance.state.toLowerCase() === 'running';

  return (
    <Card
      title={
        <Space>
          <CloudServerOutlined style={{ color: '#52c41a' }} />
          <span>Active VPN Endpoint</span>
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={<SyncOutlined spin={isRefreshing} />}
            onClick={onRefresh}
            disabled={isDestroying}
          >
            Refresh
          </Button>
          <Popconfirm
            title="Terminate VPN Instance"
            description="Are you sure you want to destroy this instance? Compute and IPv4 billing will cease immediately."
            onConfirm={onDestroy}
            okText="Yes, Destroy"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: isDestroying }}
          >
            <Button danger size="small" icon={<DeleteOutlined />} loading={isDestroying}>
              Destroy VPN
            </Button>
          </Popconfirm>
        </Space>
      }
      style={{ width: '100%', borderRadius: 12 }}
    >
      <Descriptions bordered size="small" column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
        <Descriptions.Item label="Instance ID">
          <code>{instance.instance_id}</code>
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          {getStatusTag(instance.state)}
        </Descriptions.Item>
        <Descriptions.Item label="AWS Region">
          <Tag color="blue">{instance.region}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Public IP">
          {instance.public_ip ? (
            <Text strong copyable>
              {instance.public_ip}
            </Text>
          ) : (
            <Text type="secondary">Allocating IPv4...</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Instance Type">
          {instance.instance_type || 't3.micro'}
        </Descriptions.Item>
        <Descriptions.Item label="Launch Time">
          {instance.launch_time ? new Date(instance.launch_time).toLocaleTimeString() : 'Just now'}
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          icon={<QrcodeOutlined />}
          onClick={onOpenQR}
          disabled={!isRunning}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          {isRunning ? 'Show WireGuard Pairing QR' : 'Waiting for Node to Boot...'}
        </Button>
      </div>
    </Card>
  );
};
