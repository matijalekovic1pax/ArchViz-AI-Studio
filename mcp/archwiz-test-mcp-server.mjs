#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

loadEnvFile(path.join(process.cwd(), '.env.archwiz-test-mcp'));
loadEnvFile(path.join(process.cwd(), '.env.local'));

const GENERATION_MODES = [
  'generate-text',
  'render-3d',
  'scene-compose',
  'render-cad',
  'masterplan',
  'visual-edit',
  'angle-change',
  'exploded',
  'section',
  'render-sketch',
  'multi-angle',
  'upscale',
  'img-to-cad',
  'video',
  'material-validation',
  'document-translate',
  'pdf-compression',
  'headshot',
];

const DEFAULT_APP_URL = process.env.ARCHWIZ_TEST_APP_URL || 'http://127.0.0.1:5173/';
const DEFAULT_DEBUG_PORT = Number(process.env.ARCHWIZ_TEST_REMOTE_DEBUGGING_PORT || 9322);
const DEFAULT_OUTPUT_DIR = process.env.ARCHWIZ_TEST_OUTPUT_DIR || path.join(os.tmpdir(), 'archwiz-test-mcp');

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function toolResult(payload) {
  return {
    content: [{ type: 'text', text: jsonText(payload) }],
  };
}

function toolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAppUrl(inputUrl = DEFAULT_APP_URL) {
  const url = new URL(inputUrl);
  if (!url.searchParams.has('archwizTest')) {
    url.searchParams.set('archwizTest', '1');
  }
  return url.toString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveOutputPath(filePath, fallbackName) {
  const outputPath = filePath
    ? path.resolve(process.cwd(), filePath)
    : path.join(DEFAULT_OUTPUT_DIR, fallbackName);
  ensureDir(path.dirname(outputPath));
  return outputPath;
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function fileToDataUrl(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File does not exist: ${absolutePath}`);
  }
  const bytes = fs.readFileSync(absolutePath);
  return {
    absolutePath,
    dataUrl: `data:${guessMimeType(absolutePath)};base64,${bytes.toString('base64')}`,
  };
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Current image is not a base64 data URL.');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function findBrowserExecutable() {
  const envPath = process.env.ARCHWIZ_TEST_BROWSER_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (match) return match;

  throw new Error(
    'No Chrome-compatible browser found. Set ARCHWIZ_TEST_BROWSER_PATH to a Chrome, Chromium, or Edge executable.'
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}: ${String(data).slice(0, 500)}`);
  }
  return data;
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = [];
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${this.wsUrl}`)), 10000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', (event) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${event.message || this.wsUrl}`));
      }, { once: true });
    });

    this.ws.addEventListener('message', (event) => this.handleMessage(event.data));
    this.ws.addEventListener('close', () => {
      for (const [id, pending] of this.pending.entries()) {
        pending.reject(new Error(`CDP connection closed before response ${id}.`));
      }
      this.pending.clear();
    });
  }

  handleMessage(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
    const message = JSON.parse(text);

    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message || 'CDP error'} ${message.error.data || ''}`.trim()));
      } else {
        pending.resolve(message.result || {});
      }
      return;
    }

    for (const waiter of [...this.eventWaiters]) {
      if (waiter.method !== message.method) continue;
      if (waiter.predicate && !waiter.predicate(message.params || {})) continue;
      this.eventWaiters = this.eventWaiters.filter((item) => item !== waiter);
      clearTimeout(waiter.timeout);
      waiter.resolve(message.params || {});
    }
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('CDP connection is not open.');
    }
    const id = this.nextId++;
    const payload = { id, method, params };
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify(payload));
    return promise;
  }

  waitForEvent(method, predicate, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const waiter = {
        method,
        predicate,
        resolve,
        timeout: setTimeout(() => {
          this.eventWaiters = this.eventWaiters.filter((item) => item !== waiter);
          reject(new Error(`Timed out waiting for CDP event ${method}.`));
        }, timeoutMs),
      };
      this.eventWaiters.push(waiter);
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

class ArchwizBrowserSession {
  constructor() {
    this.browserProcess = null;
    this.browserBaseUrl = null;
    this.pageClient = null;
    this.pageTarget = null;
    this.appUrl = null;
    this.viewport = { width: 1440, height: 1000 };
    this.lastBrowserExit = null;
    this.lastBrowserStderr = '';
  }

  async launch({ appUrl = DEFAULT_APP_URL, headless = false, viewportWidth = 1440, viewportHeight = 1000 } = {}) {
    this.appUrl = normalizeAppUrl(appUrl);
    this.viewport = { width: viewportWidth, height: viewportHeight };

    if (!this.browserBaseUrl) {
      const port = DEFAULT_DEBUG_PORT;
      this.browserBaseUrl = `http://127.0.0.1:${port}`;

      const version = await this.tryGetBrowserVersion();
      if (!version) {
        const executable = findBrowserExecutable();
        const profileDir = process.env.ARCHWIZ_TEST_BROWSER_PROFILE_DIR ||
          path.join(os.tmpdir(), `archwiz-test-mcp-profile-${port}`);
        ensureDir(profileDir);

        const args = [
          `--remote-debugging-port=${port}`,
          `--user-data-dir=${profileDir}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          `--window-size=${viewportWidth},${viewportHeight}`,
        ];
        if (headless) {
          args.push('--headless=new', '--disable-gpu');
        }

        this.lastBrowserExit = null;
        this.lastBrowserStderr = '';
        this.browserProcess = spawn(executable, args, {
          stdio: ['ignore', 'ignore', 'pipe'],
          detached: false,
        });
        this.browserProcess.stderr.on('data', (chunk) => {
          this.lastBrowserStderr = `${this.lastBrowserStderr}${chunk}`.slice(-4000);
          if (process.env.ARCHWIZ_TEST_DEBUG) {
            process.stderr.write(`[archwiz-test-browser] ${chunk}`);
          }
        });
        this.browserProcess.on('exit', (code, signal) => {
          this.lastBrowserExit = { code, signal };
          this.browserProcess = null;
          this.pageClient = null;
          this.pageTarget = null;
        });

        await this.waitForBrowser(15000);
      }
    }

    await this.openPage(this.appUrl);
    await this.setViewport(viewportWidth, viewportHeight);
    await this.waitForBridge(20000);
    return this.status();
  }

  async tryGetBrowserVersion() {
    if (!this.browserBaseUrl) return null;
    try {
      return await fetchJson(`${this.browserBaseUrl}/json/version`);
    } catch {
      return null;
    }
  }

  async waitForBrowser(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const version = await this.tryGetBrowserVersion();
      if (version) return version;
      if (this.lastBrowserExit) {
        const exit = this.lastBrowserExit;
        const stderr = this.lastBrowserStderr ? ` Stderr: ${this.lastBrowserStderr.trim().slice(0, 1200)}` : '';
        throw new Error(
          `Browser process exited before the debug endpoint became available (code=${exit.code}, signal=${exit.signal}).${stderr}`
        );
      }
      await delay(250);
    }
    throw new Error(`Timed out waiting for browser debug endpoint at ${this.browserBaseUrl}.`);
  }

  async createTarget(url) {
    const version = await this.tryGetBrowserVersion();
    if (!version?.webSocketDebuggerUrl) {
      throw new Error('Browser debug endpoint did not expose a webSocketDebuggerUrl.');
    }

    const browserClient = new CdpClient(version.webSocketDebuggerUrl);
    await browserClient.connect();
    try {
      const target = await browserClient.send('Target.createTarget', {
        url: 'about:blank',
      });
      await browserClient.send('Target.activateTarget', { targetId: target.targetId });
      const targets = await fetchJson(`${this.browserBaseUrl}/json/list`);
      const pageTarget = targets.find((item) => item.id === target.targetId);
      if (!pageTarget?.webSocketDebuggerUrl) {
        throw new Error('Created browser target did not expose a page WebSocket URL.');
      }
      return pageTarget;
    } finally {
      browserClient.close();
    }
  }

  async openPage(url) {
    if (this.pageClient) {
      await this.navigate(url);
      return;
    }

    this.pageTarget = await this.createTarget(url);
    this.pageClient = new CdpClient(this.pageTarget.webSocketDebuggerUrl);
    await this.pageClient.connect();
    await this.pageClient.send('Page.enable');
    await this.pageClient.send('DOM.enable');
    await this.pageClient.send('Runtime.enable');
    await this.navigate(url);
  }

  async navigate(url) {
    const loadWait = this.pageClient.waitForEvent('Page.loadEventFired', null, 20000).catch(() => null);
    await this.pageClient.send('Page.navigate', { url });
    await loadWait;
  }

  async setViewport(width, height) {
    this.viewport = { width, height };
    await this.pageClient.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async ensureReady() {
    if (!this.pageClient) {
      await this.launch();
    }
  }

  async evaluateFunction(fn, args = []) {
    await this.ensureReady();
    const expression = `(${fn.toString()})(...${JSON.stringify(args)})`;
    const result = await this.pageClient.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      const message = details.exception?.description || details.text || 'Runtime evaluation failed.';
      throw new Error(message);
    }
    return result.result?.value;
  }

  async waitForCondition(fn, args = [], timeoutMs = 15000, intervalMs = 250) {
    const start = Date.now();
    let lastError = null;
    while (Date.now() - start < timeoutMs) {
      try {
        const value = await this.evaluateFunction(fn, args);
        if (value) return value;
      } catch (error) {
        lastError = error;
      }
      await delay(intervalMs);
    }
    throw new Error(lastError?.message || 'Timed out waiting for page condition.');
  }

  async waitForBridge(timeoutMs = 15000) {
    return this.waitForCondition(() => {
      return Boolean(window.__ARCHWIZ_TEST_HOOKS__) && window.__ARCHWIZ_TEST_HOOKS__.version === 1;
    }, [], timeoutMs);
  }

  async getBridgeSnapshot() {
    await this.waitForBridge();
    return this.evaluateFunction(() => window.__ARCHWIZ_TEST_HOOKS__.getSnapshot());
  }

  async getBridgeState() {
    await this.waitForBridge();
    return this.evaluateFunction(() => window.__ARCHWIZ_TEST_HOOKS__.getState());
  }

  async getPrompt() {
    await this.waitForBridge();
    return this.evaluateFunction(() => window.__ARCHWIZ_TEST_HOOKS__.getPrompt());
  }

  async bridgeCall(method, ...args) {
    await this.waitForBridge();
    return this.evaluateFunction((methodName, callArgs) => {
      const hooks = window.__ARCHWIZ_TEST_HOOKS__;
      if (!hooks || typeof hooks[methodName] !== 'function') {
        throw new Error(`ArchWiz test hook is missing method ${methodName}.`);
      }
      return hooks[methodName](...callArgs);
    }, [method, args]);
  }

  async clickSelector(selector) {
    const point = await this.evaluateFunction((cssSelector) => {
      const candidates = Array.from(document.querySelectorAll(cssSelector));
      const element = candidates.find((item) => {
        const rect = item.getBoundingClientRect();
        const disabled = item.disabled || item.getAttribute('aria-disabled') === 'true';
        return !disabled && rect.width > 0 && rect.height > 0;
      });
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, [selector]);

    if (!point) {
      throw new Error(`No enabled visible element found for selector: ${selector}`);
    }

    await this.mouseClick(point.x, point.y);
    return point;
  }

  async mouseClick(x, y) {
    await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  async uploadToFileInput(files, selectorHint) {
    await this.ensureReady();
    const selector = await this.evaluateFunction((hint) => {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      for (const input of inputs) input.removeAttribute('data-archwiz-test-upload-target');

      const acceptsImage = (input) => String(input.accept || '').includes('image');
      const acceptsJson = (input) => String(input.accept || '').includes('json');
      let target = null;

      if (hint === 'prompt-reference') {
        target = inputs.find((input) => acceptsImage(input) && input.multiple);
      } else if (hint === 'source') {
        target = inputs.find((input) => acceptsImage(input) && !input.multiple);
      } else {
        target = inputs.find((input) => acceptsImage(input) && !input.multiple) ||
          inputs.find((input) => acceptsImage(input)) ||
          inputs.find((input) => !acceptsJson(input));
      }

      if (!target) return null;
      target.setAttribute('data-archwiz-test-upload-target', hint || 'auto');
      return `input[data-archwiz-test-upload-target="${hint || 'auto'}"]`;
    }, [selectorHint]);

    if (!selector) {
      throw new Error(`No file input found for upload target ${selectorHint}.`);
    }

    const root = await this.pageClient.send('DOM.getDocument', { depth: -1, pierce: true });
    const node = await this.pageClient.send('DOM.querySelector', {
      nodeId: root.root.nodeId,
      selector,
    });
    if (!node.nodeId) {
      throw new Error(`Could not resolve upload input selector ${selector}.`);
    }

    await this.pageClient.send('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files,
    });
  }

  async imageRect() {
    const rect = await this.evaluateFunction(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const image = images.find((item) => item.alt === 'Workspace' && item.complete && item.naturalWidth > 0) ||
        images.find((item) => item.src?.startsWith('data:image/') && item.complete && item.naturalWidth > 0);
      if (!image) return null;
      const rect = image.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
    });
    if (!rect) {
      throw new Error('No rendered workspace image found on the canvas.');
    }
    return rect;
  }

  async dispatchCanvasPath(points) {
    if (!Array.isArray(points) || points.length < 2) {
      throw new Error('At least two canvas points are required.');
    }
    const rect = await this.imageRect();
    const toScreen = (point) => ({
      x: rect.left + Math.max(0, Math.min(1, point.x)) * rect.width,
      y: rect.top + Math.max(0, Math.min(1, point.y)) * rect.height,
    });
    const first = toScreen(points[0]);
    await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...first });
    await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...first, button: 'left', clickCount: 1 });
    for (const point of points.slice(1)) {
      const screen = toScreen(point);
      await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...screen, button: 'left' });
      await delay(20);
    }
    const last = toScreen(points[points.length - 1]);
    await this.pageClient.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...last, button: 'left', clickCount: 1 });
    await delay(250);
    return { rect, points: points.length };
  }

  async waitForGenerationComplete(timeoutMs) {
    const start = Date.now();
    let lastSnapshot = null;
    while (Date.now() - start < timeoutMs) {
      lastSnapshot = await this.getBridgeSnapshot();
      if (!lastSnapshot?.isGenerating) {
        return lastSnapshot;
      }
      await delay(1000);
    }
    throw new Error(`Generation did not finish within ${timeoutMs}ms.`);
  }

  async captureScreenshot(filePath) {
    await this.ensureReady();
    const result = await this.pageClient.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const outputPath = resolveOutputPath(filePath, `archwiz-screenshot-${Date.now()}.png`);
    fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
    return outputPath;
  }

  async currentRender({ includeDataUrl = false, saveToPath = null } = {}) {
    const snapshot = await this.getBridgeSnapshot();
    const state = await this.getBridgeState();
    const dataUrl = state.uploadedImage;
    const payload = {
      mode: state.mode,
      prompt: state.prompt,
      progress: state.progress,
      isGenerating: state.isGenerating,
      image: snapshot.uploadedImage,
      sourceImage: snapshot.sourceImage,
      historyCount: Array.isArray(state.history) ? state.history.length : 0,
    };

    if (dataUrl && saveToPath !== false) {
      const { mimeType, buffer } = dataUrlToBuffer(dataUrl);
      const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
      const outputPath = resolveOutputPath(saveToPath, `archwiz-render-${Date.now()}.${ext}`);
      fs.writeFileSync(outputPath, buffer);
      payload.savedPath = outputPath;
      payload.mimeType = mimeType;
      payload.bytes = buffer.length;
    }

    if (includeDataUrl) {
      payload.dataUrl = dataUrl;
    }

    return payload;
  }

  status() {
    return {
      browserConnected: Boolean(this.browserBaseUrl),
      browserBaseUrl: this.browserBaseUrl,
      browserManagedByMcp: Boolean(this.browserProcess),
      pageConnected: Boolean(this.pageClient),
      pageTargetId: this.pageTarget?.id || null,
      appUrl: this.appUrl,
      viewport: this.viewport,
    };
  }

  async close() {
    if (this.pageClient) {
      this.pageClient.close();
      this.pageClient = null;
    }
    if (this.browserProcess) {
      this.browserProcess.kill();
      this.browserProcess = null;
    }
    this.browserBaseUrl = null;
    this.pageTarget = null;
  }
}

const session = new ArchwizBrowserSession();

const mcp = new McpServer({
  name: 'archwiz-test-automation',
  version: '1.0.0',
});

mcp.registerTool(
  'archwiz_test_healthcheck',
  {
    description: 'Report ArchWiz testing MCP status, browser connection status, and app bridge availability when connected.',
  },
  async () => {
    try {
      const payload = { ok: true, ...session.status() };
      if (session.pageClient) {
        payload.bridgeAvailable = await session.evaluateFunction(() => Boolean(window.__ARCHWIZ_TEST_HOOKS__)).catch(() => false);
      }
      return toolResult(payload);
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_launch_app',
  {
    description:
      'Launch or connect to a Chrome DevTools browser and open the ArchWiz app with the test bridge enabled.',
    inputSchema: {
      appUrl: z.string().url().optional(),
      headless: z.boolean().optional(),
      viewportWidth: z.number().int().min(320).max(4096).optional(),
      viewportHeight: z.number().int().min(320).max(4096).optional(),
    },
  },
  async (args) => {
    try {
      const status = await session.launch({
        appUrl: args.appUrl || DEFAULT_APP_URL,
        headless: args.headless === true,
        viewportWidth: args.viewportWidth || 1440,
        viewportHeight: args.viewportHeight || 1000,
      });
      return toolResult({ success: true, ...status });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_get_state',
  {
    description:
      'Get a sanitized ArchWiz app state snapshot including mode, settings, image metadata, generation status, and history.',
  },
  async () => {
    try {
      return toolResult({ success: true, snapshot: await session.getBridgeSnapshot() });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_get_prompt',
  {
    description: 'Read the structured prompt generated by the current ArchWiz state for prompt validation.',
  },
  async () => {
    try {
      return toolResult({ success: true, prompt: await session.getPrompt() });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_select_workflow',
  {
    description:
      'Switch the app to a workflow such as render-3d, visual-edit, scene-compose, upscale, or multi-angle.',
    inputSchema: {
      mode: z.enum(GENERATION_MODES),
    },
  },
  async (args) => {
    try {
      await session.bridgeCall('setMode', args.mode);
      await delay(200);
      return toolResult({ success: true, snapshot: await session.getBridgeSnapshot() });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_upload_image',
  {
    description:
      'Upload an image through the browser file input. Use target=source for canvas source images and prompt-reference for text-generation references.',
    inputSchema: {
      filePath: z.string(),
      target: z.enum(['source', 'prompt-reference', 'style-reference', 'background-reference']).optional(),
      setAsSource: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      const absolutePath = path.resolve(process.cwd(), args.filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File does not exist: ${absolutePath}`);
      }

      const target = args.target || 'source';
      if (target === 'style-reference' || target === 'background-reference') {
        const { dataUrl } = fileToDataUrl(absolutePath);
        const patch = target === 'style-reference'
          ? { styleReferenceImage: dataUrl, styleReferenceEnabled: true }
          : { backgroundReferenceImage: dataUrl, backgroundReferenceEnabled: true };
        await session.bridgeCall('applyWorkflowPatch', patch);
      } else {
        await session.uploadToFileInput([absolutePath], target);
        if (target === 'source' && args.setAsSource === false) {
          const state = await session.getBridgeState();
          await session.bridgeCall('setImageDataUrl', state.uploadedImage, { setAsSource: false });
        }
      }

      await delay(500);
      return toolResult({
        success: true,
        target,
        filePath: absolutePath,
        snapshot: await session.getBridgeSnapshot(),
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_set_prompt',
  {
    description: 'Set the user prompt that the next generation should use.',
    inputSchema: {
      prompt: z.string(),
      visualPrompt: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      await session.bridgeCall('setPrompt', args.prompt);
      if (args.visualPrompt) {
        await session.bridgeCall('applyWorkflowPatch', { visualPrompt: args.prompt });
      }
      await delay(150);
      return toolResult({ success: true, snapshot: await session.getBridgeSnapshot() });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_apply_settings',
  {
    description:
      'Apply testing settings to ArchWiz state before generation. Patches are deep-merged for workflow settings.',
    inputSchema: {
      workflow: z.record(z.string(), z.any()).optional(),
      output: z.record(z.string(), z.any()).optional(),
      geometry: z.record(z.string(), z.any()).optional(),
      camera: z.record(z.string(), z.any()).optional(),
      lighting: z.record(z.string(), z.any()).optional(),
      materials: z.record(z.string(), z.any()).optional(),
      context: z.record(z.string(), z.any()).optional(),
      prompt: z.string().optional(),
    },
  },
  async (args) => {
    try {
      await session.bridgeCall('applyStatePatch', {
        workflow: args.workflow,
        output: args.output,
        geometry: args.geometry,
        camera: args.camera,
        lighting: args.lighting,
        materials: args.materials,
        context: args.context,
        prompt: args.prompt,
      });
      await delay(200);
      return toolResult({ success: true, snapshot: await session.getBridgeSnapshot() });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_draw_visual_selection',
  {
    description:
      'Draw a visual-edit selection on the image using real browser mouse events. Coordinates are normalized 0..1 within the rendered image.',
    inputSchema: {
      selectionMode: z.enum(['rect', 'brush', 'lasso']).optional(),
      activeTool: z.enum(['select', 'material', 'lighting', 'object', 'sky', 'remove', 'replace', 'adjust', 'extend', 'background', 'people']).optional(),
      points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).min(2),
      brushSize: z.number().min(1).max(300).optional(),
      featherEnabled: z.boolean().optional(),
      featherAmount: z.number().min(0).max(100).optional(),
    },
  },
  async (args) => {
    try {
      await session.bridgeCall('setMode', 'visual-edit');
      const selectionMode = args.selectionMode || 'rect';
      await session.bridgeCall('applyWorkflowPatch', {
        activeTool: args.activeTool || 'select',
        visualSelection: {
          mode: selectionMode,
          brushSize: args.brushSize,
          featherEnabled: args.featherEnabled,
          featherAmount: args.featherAmount,
        },
      });
      await delay(300);
      const drawResult = await session.dispatchCanvasPath(args.points);
      return toolResult({
        success: true,
        drawResult,
        snapshot: await session.getBridgeSnapshot(),
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_click_canvas',
  {
    description:
      'Click a normalized point inside the current rendered image, useful for scene-compose placements and point-based tools.',
    inputSchema: {
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    },
  },
  async (args) => {
    try {
      const rect = await session.imageRect();
      const screen = {
        x: rect.left + args.x * rect.width,
        y: rect.top + args.y * rect.height,
      };
      await session.mouseClick(screen.x, screen.y);
      await delay(200);
      return toolResult({ success: true, rect, screen, snapshot: await session.getBridgeSnapshot() });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_generate',
  {
    description:
      'Click the app generate button and optionally wait until generation completes. This exercises the same browser flow as a user.',
    inputSchema: {
      waitForCompletion: z.boolean().optional(),
      timeoutMs: z.number().int().min(1000).max(900000).optional(),
      saveRenderToPath: z.string().optional(),
    },
  },
  async (args) => {
    try {
      await session.clickSelector('button[aria-label="generate-trigger"]');
      const waitForCompletion = args.waitForCompletion !== false;
      let snapshot = null;
      let render = null;
      if (waitForCompletion) {
        snapshot = await session.waitForGenerationComplete(args.timeoutMs || 180000);
        if (args.saveRenderToPath) {
          render = await session.currentRender({ saveToPath: args.saveRenderToPath });
        }
      } else {
        await delay(500);
        snapshot = await session.getBridgeSnapshot();
      }
      return toolResult({ success: true, snapshot, render });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_get_render',
  {
    description:
      'Read metadata for the current canvas render and optionally save the image data URL to disk for review.',
    inputSchema: {
      includeDataUrl: z.boolean().optional(),
      saveToPath: z.string().optional(),
      skipSave: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      const render = await session.currentRender({
        includeDataUrl: args.includeDataUrl === true,
        saveToPath: args.skipSave ? false : args.saveToPath || null,
      });
      return toolResult({ success: true, render });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_screenshot',
  {
    description: 'Capture the current browser viewport as a PNG screenshot for visual validation.',
    inputSchema: {
      saveToPath: z.string().optional(),
    },
  },
  async (args) => {
    try {
      const savedPath = await session.captureScreenshot(args.saveToPath || null);
      return toolResult({ success: true, savedPath });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_run_generation_scenario',
  {
    description:
      'Run a full test scenario: open workflow, upload source image, apply settings, set prompt, draw optional visual selection, generate, and save the result.',
    inputSchema: {
      mode: z.enum(GENERATION_MODES),
      imagePath: z.string().optional(),
      prompt: z.string().optional(),
      workflow: z.record(z.string(), z.any()).optional(),
      output: z.record(z.string(), z.any()).optional(),
      selection: z.object({
        selectionMode: z.enum(['rect', 'brush', 'lasso']).optional(),
        activeTool: z.enum(['select', 'material', 'lighting', 'object', 'sky', 'remove', 'replace', 'adjust', 'extend', 'background', 'people']).optional(),
        points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).min(2),
      }).optional(),
      waitForCompletion: z.boolean().optional(),
      timeoutMs: z.number().int().min(1000).max(900000).optional(),
      saveRenderToPath: z.string().optional(),
    },
  },
  async (args) => {
    try {
      await session.ensureReady();
      await session.bridgeCall('setMode', args.mode);
      await delay(250);

      if (args.imagePath) {
        const absolutePath = path.resolve(process.cwd(), args.imagePath);
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`File does not exist: ${absolutePath}`);
        }
        await session.uploadToFileInput([absolutePath], 'source');
        await delay(500);
      }

      if (args.workflow || args.output || args.prompt) {
        await session.bridgeCall('applyStatePatch', {
          workflow: args.workflow,
          output: args.output,
          prompt: args.prompt,
        });
        await delay(250);
      }

      if (args.selection) {
        await session.bridgeCall('setMode', 'visual-edit');
        await session.bridgeCall('applyWorkflowPatch', {
          activeTool: args.selection.activeTool || 'select',
          visualSelection: { mode: args.selection.selectionMode || 'rect' },
        });
        await delay(250);
        await session.dispatchCanvasPath(args.selection.points);
      }

      await session.clickSelector('button[aria-label="generate-trigger"]');
      const waitForCompletion = args.waitForCompletion !== false;
      let snapshot = null;
      let render = null;
      if (waitForCompletion) {
        snapshot = await session.waitForGenerationComplete(args.timeoutMs || 180000);
        render = await session.currentRender({ saveToPath: args.saveRenderToPath || null });
      } else {
        await delay(500);
        snapshot = await session.getBridgeSnapshot();
      }

      return toolResult({ success: true, snapshot, render });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'archwiz_reset_project',
  {
    description: 'Reset the ArchWiz app project state for a fresh test run.',
  },
  async () => {
    try {
      await session.bridgeCall('resetProject');
      await delay(250);
      return toolResult({ success: true, snapshot: await session.getBridgeSnapshot() });
    } catch (error) {
      return toolError(error);
    }
  }
);

process.on('exit', () => {
  if (session.browserProcess) {
    session.browserProcess.kill();
  }
});

const transport = new StdioServerTransport();
await mcp.connect(transport);
