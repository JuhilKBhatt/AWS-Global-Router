import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorBgContainer: '#1c2128',
          colorBgElevated: '#22272e',
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
