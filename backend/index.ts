import app from './src/app';

export default {
  port: 13000,
  fetch: app.fetch,
  idleTimeout: 0, // 禁用空闲超时
};
