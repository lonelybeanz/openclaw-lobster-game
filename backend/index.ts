import app from './src/app.js';

export default {
  port: 13000,
  fetch: app.fetch,
  idleTimeout: 0, // 禁用空闲超时
};
