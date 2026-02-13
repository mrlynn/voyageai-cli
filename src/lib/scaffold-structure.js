'use strict';

/**
 * Project structure definitions for each target.
 * Maps template names to output paths within the project.
 * 
 * Separated from scaffold.js to avoid @clack/prompts dependency
 * when loaded from Electron.
 */
const PROJECT_STRUCTURE = {
  vanilla: {
    files: [
      { template: 'package.json', output: 'package.json' },
      { template: 'env.example', output: '.env.example' },
      { template: 'README.md', output: 'README.md' },
      { template: 'server.js', output: 'server.js' },
      { template: 'client.js', output: 'lib/client.js' },
      { template: 'connection.js', output: 'lib/connection.js' },
      { template: 'retrieval.js', output: 'lib/retrieval.js' },
      { template: 'ingest.js', output: 'lib/ingest.js' },
      { template: 'search-api.js', output: 'lib/search-api.js' },
    ],
    description: 'Node.js + Express API server',
    postInstall: 'npm install',
    startCommand: 'npm start',
  },
  
  nextjs: {
    files: [
      { template: 'package.json', output: 'package.json' },
      { template: 'env.example', output: '.env.example' },
      { template: 'README.md', output: 'README.md' },
      { template: 'layout.jsx', output: 'app/layout.jsx' },
      { template: 'page-home.jsx', output: 'app/page.jsx' },
      { template: 'page-search.jsx', output: 'app/search/page.jsx' },
      { template: 'route-search.js', output: 'app/api/search/route.js' },
      { template: 'route-ingest.js', output: 'app/api/ingest/route.js' },
      { template: 'lib-voyage.js', output: 'lib/voyage.js' },
      { template: 'lib-mongo.js', output: 'lib/mongodb.js' },
      { template: 'theme.js', output: 'lib/theme.js' },
      { template: 'theme-registry.jsx', output: 'components/ThemeRegistry.jsx' },
      { template: 'navbar.jsx', output: 'components/Navbar.jsx' },
      { template: 'footer.jsx', output: 'components/Footer.jsx' },
      { template: 'favicon.svg', output: 'public/favicon.svg' },
    ],
    binaryFiles: [
      { source: 'vai-logo-256.png', output: 'public/vai-logo.png' },
    ],
    extraFiles: [
      {
        output: 'next.config.js',
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
};
module.exports = nextConfig;
`,
      },
      {
        output: '.gitignore',
        content: `node_modules/
.next/
.env
.env.local
`,
      },
      {
        output: 'jsconfig.json',
        content: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
`,
      },
    ],
    description: 'Next.js + Material UI application',
    postInstall: 'npm install',
    startCommand: 'npm run dev',
  },
  
  python: {
    files: [
      { template: 'requirements.txt', output: 'requirements.txt' },
      { template: 'env.example', output: '.env.example' },
      { template: 'README.md', output: 'README.md' },
      { template: 'app.py', output: 'app.py' },
      { template: 'voyage_client.py', output: 'voyage_client.py' },
      { template: 'mongo_client.py', output: 'mongo_client.py' },
      { template: 'chunker.py', output: 'chunker.py' },
    ],
    extraFiles: [
      {
        output: '.gitignore',
        content: `venv/
__pycache__/
*.pyc
.env
`,
      },
    ],
    description: 'Python + Flask API server',
    postInstall: 'pip install -r requirements.txt',
    startCommand: 'python app.py',
  },
};

module.exports = { PROJECT_STRUCTURE };
