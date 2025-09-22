import express from 'express';
import { createServer } from 'vite';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

async function createViteServer() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  
  app.use(vite.ssrFixStacktrace);
  app.use(vite.middlewares);
  
  return vite;
}

async function startServer() {
  if (process.env.NODE_ENV === 'development') {
    await createViteServer();
  } else {
    app.use(express.static(path.resolve('../../dist/frontend')));
  }
  
  app.listen(PORT, () => {
    console.log(`✅ Express server running on port ${PORT}`);
    console.log(`🎮 Frontend: http://localhost:${PORT}`);
    console.log(`🐍 Flask backend: http://localhost:5001`);
  });
}

startServer().catch(console.error);