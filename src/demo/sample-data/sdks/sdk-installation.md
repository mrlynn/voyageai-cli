# SDK Installation Guide

Step-by-step instructions for installing and configuring official SDKs for your preferred language.

## JavaScript / Node.js

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

```bash
npm install @saasplatform/sdk
```

Or with yarn:

```bash
yarn add @saasplatform/sdk
```

### Verification

```javascript
const SaaS = require('@saasplatform/sdk');
console.log(SaaS.version);  // Should print version number
```

## Python

### Prerequisites

- Python 3.8+
- pip or pipenv

### Installation

```bash
pip install saasplatform-sdk
```

Or with pipenv:

```bash
pipenv install saasplatform-sdk
```

### Verification

```bash
python -c "import saasplatform; print(saasplatform.__version__)"
```

## Java

### Prerequisites

- Java 11+
- Maven 3.6+ or Gradle 6+

### Maven Installation

Add to `pom.xml`:

```xml
<dependency>
  <groupId>com.saasplatform</groupId>
  <artifactId>sdk-java</artifactId>
  <version>2.0.0</version>
</dependency>
```

### Gradle Installation

Add to `build.gradle`:

```gradle
implementation 'com.saasplatform:sdk-java:2.0.0'
```

### Verification

```bash
mvn dependency:tree | grep saasplatform
```

## Go

### Prerequisites

- Go 1.18+
- Go modules enabled

### Installation

```bash
go get github.com/saasplatform/sdk-go@latest
```

### Verification

```bash
go list -m github.com/saasplatform/sdk-go
```

## Ruby

### Prerequisites

- Ruby 2.6+
- Bundler (for Rails projects)

### Installation

Add to `Gemfile`:

```ruby
gem 'saasplatform-sdk'
```

Then run:

```bash
bundle install
```

Or install directly:

```bash
gem install saasplatform-sdk
```

### Verification

```bash
gem list | grep saasplatform
```

## PHP

### Prerequisites

- PHP 7.4+
- Composer

### Installation

```bash
composer require saasplatform/sdk
```

### Verification

```bash
composer show saasplatform/sdk
```

## Multi-Language Project

For polyglot projects, install multiple SDKs:

**Setup:**

```bash
# JavaScript
npm install @saasplatform/sdk

# Python (in venv)
pip install saasplatform-sdk

# Ruby (in Gemfile)
# gem 'saasplatform-sdk'
```

## Updating SDKs

### Node.js

```bash
npm install @saasplatform/sdk@latest
```

Or update all packages:

```bash
npm update
```

### Python

```bash
pip install --upgrade saasplatform-sdk
```

### Java / Maven

```bash
mvn versions:use-latest-versions
```

### Go

```bash
go get -u github.com/saasplatform/sdk-go
```

### Ruby

```bash
bundle update saasplatform-sdk
```

### PHP / Composer

```bash
composer update saasplatform/sdk
```

## Troubleshooting Installation

### "Module not found"

Ensure you've installed in the correct directory. Check:

**Node.js:**

```bash
ls node_modules/@saasplatform/sdk
```

**Python:**

```bash
python -m pip show saasplatform-sdk
```

**Java:**

```bash
mvn dependency:tree
```

### Permission Errors

Use appropriate package manager with correct permissions:

**Linux/Mac:**

```bash
sudo npm install -g @saasplatform/sdk  # Global install
```

**Python:**

```bash
pip install --user saasplatform-sdk  # User-level install
```

### Conflicting Versions

Resolve version conflicts:

**Node.js:**

```bash
npm ls @saasplatform/sdk  # Show dependency tree
npm dedupe               # Remove duplicates
```

**Python:**

```bash
pip install saasplatform-sdk==2.0.0  # Pin to version
```

**Java / Maven:**

```bash
mvn dependency:resolve
mvn dependency:analyze
```

## Docker Installation

For containerized deployments:

### Node.js Dockerfile

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

### Python Dockerfile

```dockerfile
FROM python:3.10
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

### Java Dockerfile

```dockerfile
FROM openjdk:11
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY . .
RUN mvn package
CMD ["java", "-jar", "target/app.jar"]
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Install SDK
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Node SDK
        run: npm install @saasplatform/sdk
```

### GitLab CI

```yaml
install_sdk:
  image: node:18
  script:
    - npm install @saasplatform/sdk
```

### Jenkins

```groovy
stage('Install') {
  steps {
    sh 'npm install @saasplatform/sdk'
  }
}
```

## SDK Source Code

Official SDKs are open source:

- **JavaScript**: https://github.com/saasplatform/sdk-js
- **Python**: https://github.com/saasplatform/sdk-python
- **Java**: https://github.com/saasplatform/sdk-java
- **Go**: https://github.com/saasplatform/sdk-go
- **Ruby**: https://github.com/saasplatform/sdk-ruby
- **PHP**: https://github.com/saasplatform/sdk-php

## Getting Help

- Check [SDK Versioning](sdk-versioning.md) for compatibility info
- Read language-specific docs (e.g., [JavaScript SDK](javascript.md))
- Submit issues on GitHub
- Ask in community forums
