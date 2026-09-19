import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
  GlobalOutlined,
  DollarCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;
const { Text } = Typography;

export type PageKey = 'home' | 'costs' | 'settings';

interface SideNavBarProps {
  currentKey: PageKey;
  onSelectKey: (key: PageKey) => void;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export const SideNavBar: React.FC<SideNavBarProps> = ({
  currentKey,
  onSelectKey,
  collapsed,
  onCollapse,
}) => {
  const menuItems: MenuProps['items'] = [
    {
      key: 'home',
      icon: <GlobalOutlined style={{ fontSize: 18, color: '#1677ff' }} />,
      label: 'Home (AWS Global Router)',
    },
    {
      key: 'costs',
      icon: <DollarCircleOutlined style={{ fontSize: 18, color: '#52c41a' }} />,
      label: 'Costs & Analytics',
    },
    {
      key: 'settings',
      icon: <SettingOutlined style={{ fontSize: 18, color: '#fa8c16' }} />,
      label: 'Settings',
    },
  ];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      width={250}
      style={{
        background: '#161b22',
        borderRight: '1px solid #30363d',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(22, 119, 255, 0.4)',
            flexShrink: 0,
          }}
        >
          <ThunderboltOutlined style={{ fontSize: 20, color: '#ffffff' }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <Text strong style={{ color: '#f0f6fc', fontSize: 15, display: 'block' }}>
              Global Router
            </Text>
            <Text style={{ color: '#8b949e', fontSize: 11, display: 'block' }}>
              Ephemeral WireGuard
            </Text>
          </div>
        )}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[currentKey]}
        onClick={({ key }) => onSelectKey(key as PageKey)}
        items={menuItems}
        style={{
          background: 'transparent',
          borderRight: 'none',
          padding: '12px 8px',
          fontSize: 14,
        }}
      />
    </Sider>
  );
};
