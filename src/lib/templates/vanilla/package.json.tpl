{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Voyage AI RAG application",
  "type": "commonjs",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "ingest": "node lib/ingest.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongodb": "^6.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "voyage-ai",
    "rag",
    "vector-search",
    "mongodb-atlas"
  ],
  "generated": {
    "by": "vai",
    "version": "{{vaiVersion}}",
    "model": "{{model}}",
    "at": "{{generatedAt}}"
  }
}
