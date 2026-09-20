import React from 'react';
import { Layout, Typography, Space, Divider, Tag, Grid } from 'antd';
import { GithubOutlined, SafetyCertificateOutlined, FileProtectOutlined } from '@ant-design/icons';

const { Footer } = Layout;
const { Text, Link } = Typography;

export const AppFooter: React.FC = () => {
  const screens = Grid.useBreakpoint();

  return (
    <Footer
      style={{
        background: '#0d1117',
        borderTop: '1px solid #21262d',
        padding: screens.xs ? '20px 16px' : '24px 32px',
        color: '#8b949e',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: screens.xs ? 'center' : 'space-between',
          gap: 16,
          textAlign: screens.xs ? 'center' : 'left',
        }}
      >
        <Space
          direction="horizontal"
          size="middle"
          align="center"
          wrap
          style={{ justifyContent: screens.xs ? 'center' : 'flex-start' }}
        >
          <SafetyCertificateOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <Text strong style={{ color: '#c9d1d9', fontSize: 14 }}>
            AWS Global Router
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            © {new Date().getFullYear()} Juhil Bhatt. All rights reserved.
          </Text>
        </Space>

        <Space
          direction="horizontal"
          size="middle"
          wrap
          style={{ justifyContent: screens.xs ? 'center' : 'flex-end' }}
          split={screens.xs ? undefined : <Divider type="vertical" style={{ borderColor: '#30363d' }} />}
        >
          <Link
            href="https://github.com/JuhilKBhatt/AWS-Global-Router"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#8b949e', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <GithubOutlined style={{ fontSize: 16 }} />
            <span>GitHub Repository</span>
          </Link>

          <Link
            href="https://github.com/JuhilKBhatt/AWS-Global-Router/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#8b949e', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <FileProtectOutlined style={{ fontSize: 16 }} />
            <Tag color="geekblue" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
              MIT License
            </Tag>
          </Link>
        </Space>
      </div>
    </Footer>
  );
};
