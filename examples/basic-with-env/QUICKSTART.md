# Quickstart Guide - Basic with Environment

## 🚀 Setup

### 1. Install Dependencies
### 1.a start from scratch
```bash
cd examples/basic-with-env
npm init -y
npm i andb-core dotenv
```
### 1.b start from existing sample

```bash
cd examples/basic-with-env
cp package.innit.json package.json,
npm i
```

### 2. Configure Environment
Copy `env.example` to `.env`:
```bash
cp env.example .env
```

Edit `.env` with your info
 

### 3. Generate Scripts
```bash
node andb gen
```
### 4. Check your package.json, it will look like this
```json
{
  "name": "basic-with-env",
  "version": "1.0.0",
  "scripts": {
    "export:dev": "node andb export -f DEV && node andb export -p DEV && node andb export -t DEV && node andb export -tr DEV",
    "export:prod": "node andb export -f PROD && node andb export -p PROD && node andb export -t PROD && node andb export -tr PROD",
    "compare:prod": "npm run export:dev && npm run export:prod && node andb compare -r PROD",
    "migrate:prod": "npm run compare:prod && node andb migrate:new -f PROD && node andb migrate:update -f PROD",
    "dep:prod": "node andb dep -f PROD && node andb dep -p PROD && node andb dep -tr PROD",
    "generate:scripts": "node andb generate",
    "helper": "node andb helper"
  },
  "dependencies": {
    "andb-core": "^1.0.5",
    "dotenv": "^17.2.1"
  }
}
```

## Usage

### Compare Environments
```bash
# Compare all objects
npm run compare:prod:off

# Export specific environments
npm run export:dev    # Export DEV environment
npm run export:prod   # Export PROD environment
 
## 📊 Sample Output

``` bash
████▓▓▓▓▒▒▒▒░░░░ REPORT: DEV to PROD ░░░░▒▒▒▒▓▓▓▓████

  triggers: 
    new: 0
    deprecated: 0
    updated: 0
  

████▓▓▓▓▒▒▒▒░░░░ REPORT: DEV to PROD ░░░░▒▒▒▒▓▓▓▓████
```


### Directory Structure After Compare
```
db
├── DEV
│   ├── current-ddl
│   ├── functions
│   ├── procedures
│   ├── tables
│   └── triggers
└── PROD
    ├── current-ddl
    ├── functions
    ├── procedures
    ├── tables
    └── triggers

map-migrate
└── DEV-to-PROD
    └── dev_database
        └── triggers
```
