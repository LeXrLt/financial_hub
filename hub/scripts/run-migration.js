#!/usr/bin/env node
/**
 * 数据库迁移脚本
 * 加载 .env 并执行 SQL 迁移
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 加载 .env
const dotenvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
  console.log('Loaded .env from:', dotenvPath);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'migrations', migrationFile);
if (!fs.existsSync(sqlPath)) {
  console.error('Migration file not found:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const pool = new Pool({ connectionString });

pool.query(sql)
  .then(() => {
    console.log('Migration completed successfully:', migrationFile);
    pool.end();
  })
  .catch(err => {
    console.error('Migration failed:', err.message);
    pool.end();
    process.exit(1);
  });
