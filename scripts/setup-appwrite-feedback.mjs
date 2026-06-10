#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
};

loadEnvFile('.env.appwrite');
loadEnvFile('.env.local');

const inferEndpoint = (projectId) => {
  const regionMatch = String(projectId || '').match(/^([a-z]{3})-/);
  return regionMatch ? `https://${regionMatch[1]}.cloud.appwrite.io/v1` : 'https://cloud.appwrite.io/v1';
};

const endpoint = (process.env.APPWRITE_ENDPOINT || inferEndpoint(process.env.APPWRITE_PROJECT_ID)).replace(/\/+$/, '');
const projectId = process.env.APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';
const databaseId = process.env.APPWRITE_DATABASE_ID || 'archviz_reports';
const reportsCollectionId = process.env.APPWRITE_REPORTS_COLLECTION_ID || 'feedback_reports';
const activityCollectionId = process.env.APPWRITE_ACTIVITY_COLLECTION_ID || 'feedback_activity';
const adminsCollectionId = process.env.APPWRITE_ADMINS_COLLECTION_ID || 'feedback_admins';
const snapshotsBucketId = process.env.APPWRITE_SNAPSHOTS_BUCKET_ID || 'feedback_snapshots';
const adminEmail = process.env.APPWRITE_FEEDBACK_ADMIN_EMAIL || 'matija.lekovic@1pax.com';

if (!projectId || !apiKey) {
  console.error('Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.');
  console.error('Create .env.appwrite or export the variables before running this script.');
  process.exit(1);
}

const headers = {
  'X-Appwrite-Response-Format': '1.9.5',
  'X-Appwrite-Project': projectId,
  'X-Appwrite-Key': apiKey,
};

const request = async (path, options = {}) => {
  const init = { ...options, headers: { ...headers, ...(options.headers || {}) } };
  if (init.body && typeof init.body === 'string') init.headers['Content-Type'] = 'application/json';
  const response = await fetch(`${endpoint}${path}`, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || text || response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const exists = async (path) => {
  try {
    return await request(path);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

const waitForResource = async (path, label) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const resource = await exists(path);
    const status = resource?.status;
    if (!status || status === 'available') return resource;
    if (status === 'failed') throw new Error(`${label} failed: ${resource?.error || 'unknown error'}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become available in time.`);
};

const createIfMissing = async (label, getPath, createPath, body) => {
  const current = await exists(getPath);
  if (current) {
    console.log(`✓ ${label} exists`);
    return current;
  }
  console.log(`+ Creating ${label}`);
  return request(createPath, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

const attributePath = (collectionId, key) =>
  `/databases/${databaseId}/collections/${collectionId}/attributes/${encodeURIComponent(key)}`;

const createAttribute = async (collectionId, spec) => {
  const current = await exists(attributePath(collectionId, spec.key));
  if (current) {
    console.log(`✓ ${collectionId}.${spec.key} attribute exists`);
    return current;
  }

  const { type, ...body } = spec;
  console.log(`+ Creating ${collectionId}.${spec.key} attribute`);
  await request(`/databases/${databaseId}/collections/${collectionId}/attributes/${type}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return waitForResource(attributePath(collectionId, spec.key), `${collectionId}.${spec.key}`);
};

const createIndex = async (collectionId, key, attributes, orders = []) => {
  const path = `/databases/${databaseId}/collections/${collectionId}/indexes/${encodeURIComponent(key)}`;
  const current = await exists(path);
  if (current) {
    console.log(`✓ ${collectionId}.${key} index exists`);
    return current;
  }
  console.log(`+ Creating ${collectionId}.${key} index`);
  await request(`/databases/${databaseId}/collections/${collectionId}/indexes`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      type: 'key',
      attributes,
      orders,
    }),
  });
  return waitForResource(path, `${collectionId}.${key}`);
};

const stringAttr = (key, size, required = false) => ({ type: 'string', key, size, required, array: false, encrypt: false });
const textAttr = (key, required = false) => ({ type: 'text', key, required, array: false, encrypt: false });
const datetimeAttr = (key, required = false) => ({ type: 'datetime', key, required, array: false });
const emailAttr = (key, required = false) => ({ type: 'email', key, required, array: false });
const intAttr = (key, required = false) => ({ type: 'integer', key, required, array: false });
const boolAttr = (key, required = false) => ({ type: 'boolean', key, required, array: false });
const enumAttr = (key, elements, required = false) => ({ type: 'enum', key, elements, required, array: false });

const statusValues = ['new', 'triaged', 'in_progress', 'resolved', 'closed'];
const priorityValues = ['low', 'normal', 'high', 'urgent'];
const categoryValues = ['bug', 'quality', 'ux', 'performance', 'feature_request', 'other'];
const activityKindValues = ['created', 'comment', 'status_changed', 'priority_changed', 'system'];

await createIfMissing('database', `/databases/${databaseId}`, '/databases', {
  databaseId,
  name: 'ArchViz Feedback Reports',
  enabled: true,
});

await createIfMissing(
  'reports collection',
  `/databases/${databaseId}/collections/${reportsCollectionId}`,
  `/databases/${databaseId}/collections`,
  {
    collectionId: reportsCollectionId,
    name: 'Feedback Reports',
    permissions: [],
    documentSecurity: false,
    enabled: true,
  }
);

await createIfMissing(
  'activity collection',
  `/databases/${databaseId}/collections/${activityCollectionId}`,
  `/databases/${databaseId}/collections`,
  {
    collectionId: activityCollectionId,
    name: 'Feedback Activity',
    permissions: [],
    documentSecurity: false,
    enabled: true,
  }
);

await createIfMissing(
  'admins collection',
  `/databases/${databaseId}/collections/${adminsCollectionId}`,
  `/databases/${databaseId}/collections`,
  {
    collectionId: adminsCollectionId,
    name: 'Feedback Admins',
    permissions: [],
    documentSecurity: false,
    enabled: true,
  }
);

await createIfMissing('snapshot bucket', `/storage/buckets/${snapshotsBucketId}`, '/storage/buckets', {
  bucketId: snapshotsBucketId,
  name: 'Feedback Snapshots',
  permissions: [],
  fileSecurity: false,
  enabled: true,
  maximumFileSize: 50_000_000,
  allowedFileExtensions: ['json'],
  compression: 'gzip',
  encryption: true,
  antivirus: true,
  transformations: false,
});

const reportAttributes = [
  datetimeAttr('created_at', true),
  datetimeAttr('updated_at', true),
  datetimeAttr('last_activity_at', true),
  emailAttr('reporter_email', true),
  stringAttr('reporter_name', 200),
  textAttr('reporter_picture'),
  enumAttr('status', statusValues, true),
  enumAttr('priority', priorityValues, true),
  enumAttr('category', categoryValues, true),
  stringAttr('title', 200, true),
  textAttr('description', true),
  textAttr('reproduction_steps'),
  textAttr('expected_behavior'),
  stringAttr('mode', 64),
  stringAttr('app_version', 128),
  textAttr('user_agent'),
  stringAttr('project_name', 200),
  intAttr('history_count', true),
  intAttr('snapshot_version', true),
  stringAttr('snapshot_hash', 128, true),
  intAttr('snapshot_size_bytes', true),
  textAttr('snapshot_json'),
  stringAttr('snapshot_storage_path', 240),
  datetimeAttr('resolved_at'),
  emailAttr('resolved_by'),
  textAttr('metadata_json'),
];

const activityAttributes = [
  intAttr('activity_id', true),
  stringAttr('report_id', 36, true),
  datetimeAttr('created_at', true),
  emailAttr('actor_email', true),
  stringAttr('actor_name', 200),
  enumAttr('kind', activityKindValues, true),
  textAttr('message', true),
  enumAttr('from_status', statusValues),
  enumAttr('to_status', statusValues),
  enumAttr('from_priority', priorityValues),
  enumAttr('to_priority', priorityValues),
  textAttr('metadata_json'),
];

const adminAttributes = [
  emailAttr('email', true),
  boolAttr('is_active', true),
  datetimeAttr('created_at', true),
  stringAttr('created_by', 120),
  textAttr('notes'),
];

for (const spec of reportAttributes) await createAttribute(reportsCollectionId, spec);
for (const spec of activityAttributes) await createAttribute(activityCollectionId, spec);
for (const spec of adminAttributes) await createAttribute(adminsCollectionId, spec);

await createIndex(reportsCollectionId, 'created_at_desc', ['created_at'], ['DESC']);
await createIndex(reportsCollectionId, 'status_idx', ['status']);
await createIndex(reportsCollectionId, 'priority_idx', ['priority']);
await createIndex(reportsCollectionId, 'category_idx', ['category']);
await createIndex(reportsCollectionId, 'mode_idx', ['mode']);
await createIndex(reportsCollectionId, 'reporter_email_idx', ['reporter_email']);
await createIndex(activityCollectionId, 'report_created_idx', ['report_id', 'created_at'], ['ASC', 'ASC']);
await createIndex(adminsCollectionId, 'email_active_idx', ['email', 'is_active'], ['ASC', 'ASC']);

const adminDocumentId = `admin_${crypto.createHash('sha1').update(adminEmail.toLowerCase()).digest('hex').slice(0, 30)}`;
const adminQuery = new URLSearchParams();
adminQuery.append('queries[0]', JSON.stringify({ method: 'equal', attribute: 'email', values: [adminEmail] }));
adminQuery.append('queries[1]', JSON.stringify({ method: 'limit', values: [1] }));
const existingAdmins = await request(
  `/databases/${databaseId}/collections/${adminsCollectionId}/documents?${adminQuery.toString()}`
);

if (Array.isArray(existingAdmins?.documents) && existingAdmins.documents.length > 0) {
  console.log(`✓ Admin ${adminEmail} exists`);
} else {
  console.log(`+ Seeding admin ${adminEmail}`);
  await request(`/databases/${databaseId}/collections/${adminsCollectionId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: adminDocumentId,
      data: {
        email: adminEmail,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: 'setup-appwrite-feedback',
        notes: 'Initial feedback admin',
      },
    }),
  });
}

console.log('Appwrite feedback backend is ready.');
