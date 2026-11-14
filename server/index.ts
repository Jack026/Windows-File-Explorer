import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { WindowsBridge } from './windows-bridge.js';
import { Scanner, formatBytes, getFileCategory } from './scanner.js';
import { StorageCache } from './cache.js';
import { ScanManager, ScanMode } from './scan-manager.js';
import { ScanHistoryEngine } from './scan-history.js';
import { AppDiscovery } from './applications/discovery.js';
import { AppFootprintAnalyzer } from './applications/footprint.js';
import { AppUninstaller } from './applications/uninstaller.js';
import {
  LargeFileFinder,
  EmptyFolderFinder,
  TempFileAnalyzer,
  FolderComparator,
  BatchRenameEngine,
  FileChecksumTool,
  StartupManager,
  DiskHardwareAnalyzer,
  RecycleBinManager,
  DevCleaner,
} from './utilities/index.js';
import {
  PathAutocomplete,
  AdvancedSearchEngine,
  FilePropertiesEngine,
  TransferManager,
  UndoManager,
} from './explorer-engine.js';
import { PermissionsEngine } from './permissions-engine.js';
import { SettingsEngine } from './settings-engine.js';
import { validateAndSanitizePath, isProtectedSystemPath } from './security.js';

const app = express();
const PORT = 3579;

app.use(cors());
app.use(express.json());

// Initialize persistent cache, scan history and settings on boot
StorageCache.init();
ScanHistoryEngine.init();
SettingsEngine.init();

// API: Drives and quick access folders
app.get('/api/drives', async (req, res) => {
  try {
    const drives = await WindowsBridge.getDrives();
    const quickDirs = WindowsBridge.getUserDirectories();
    res.json({ drives, quickDirs, userHome: os.homedir() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Directory listing with instant cached folder sizes
app.get('/api/directory', async (req, res) => {
  try {
    const requestedPath = (req.query.path as string) || os.homedir();
    const listing = await Scanner.listDirectory(requestedPath);

    // Populate sizes from cache if available
    for (const item of listing.items) {
      if (item.isDirectory) {
        const cached = StorageCache.get(item.path);
        if (cached) {
          item.size = cached.size;
          item.formattedSize = cached.formattedSize;
          item.fileCount = cached.fileCount;
          item.folderCount = cached.folderCount;
          listing.totalSize += cached.size;
        }
      }
    }

    res.json(listing);
  } catch (err: any) {
    res.status(500).json({ error: err.message, path: req.query.path });
  }
});

// API: Server-Sent Events (SSE) for asynchronous subfolder sizes
app.get(['/api/folder-sizes', '/api/folder-sizes/stream'], async (req, res) => {
  const requestedPath = req.query.path as string;
  if (!requestedPath) {
    res.status(400).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const abortSignal = { isAborted: false };
  req.on('close', () => {
    abortSignal.isAborted = true;
  });

  try {
    let accumulatedFolderBytes = 0;
    await Scanner.computeSubfolderSizes(
      requestedPath,
      (info) => {
        if (!abortSignal.isAborted) {
          accumulatedFolderBytes += info.size;
          StorageCache.set(info.folderPath, {
            size: info.size,
            formattedSize: info.formattedSize,
            fileCount: info.fileCount,
            folderCount: info.folderCount,
          });
          res.write(`data: ${JSON.stringify({ type: 'progress', ...info })}\n\n`);
        }
      },
      abortSignal
    );

    if (!abortSignal.isAborted) {
      res.write(`data: ${JSON.stringify({ type: 'done', totalComputed: accumulatedFolderBytes })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    if (!abortSignal.isAborted) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});

// API: Live Storage Scan with Lifecycle (Start, Stream, Pause, Resume, Cancel)
app.get('/api/scan/start', async (req, res) => {
  const requestedPath = (req.query.path as string) || os.homedir();
  const mode = ((req.query.mode as string) || 'standard') as ScanMode;
  const scanId = (req.query.scanId as string) || `scan_${Date.now()}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const session = ScanManager.createSession(scanId, requestedPath, mode);

  req.on('close', () => {
    ScanManager.cancel(scanId);
  });

  session.on('progress', (progress) => {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  });

  try {
    await session.run();
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

app.post('/api/scan/pause', (req, res) => {
  const { scanId } = req.body;
  const ok = ScanManager.pause(scanId);
  res.json({ success: ok });
});

app.post('/api/scan/resume', (req, res) => {
  const { scanId } = req.body;
  const ok = ScanManager.resume(scanId);
  res.json({ success: ok });
});

app.post('/api/scan/cancel', (req, res) => {
  const { scanId } = req.body;
  const ok = ScanManager.cancel(scanId);
  res.json({ success: ok });
});

// API: Storage X-Ray endpoint
app.get('/api/storage-xray', async (req, res) => {
  const requestedPath = (req.query.path as string) || os.homedir();
  const maxDepth = parseInt((req.query.depth as string) || '5', 10);
  try {
    const report = await Scanner.scanStorageXRay(requestedPath, maxDepth);
    ScanHistoryEngine.recordScan(report, maxDepth <= 3 ? 'quick' : 'standard').catch(() => {});
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Phase 2: Storage History & Cache APIs
// ==========================================
app.get('/api/scan-history', async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const history = await ScanHistoryEngine.getAll(limit);
    res.json({ history, count: history.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan-history/by-path', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || '';
    const history = await ScanHistoryEngine.getByPath(targetPath);
    res.json({ history, count: history.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan-history/compare', async (req, res) => {
  try {
    const idA = req.query.idA as string;
    const idB = req.query.idB as string;
    if (!idA || !idB) {
      res.status(400).json({ error: 'idA and idB are required parameters' });
      return;
    }
    const comparison = await ScanHistoryEngine.compare(idA, idB);
    if (!comparison) {
      res.status(404).json({ error: 'One or both scan history records not found' });
      return;
    }
    res.json(comparison);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/scan-history/:id', async (req, res) => {
  try {
    const success = await ScanHistoryEngine.deleteById(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scan-history/clear', async (req, res) => {
  try {
    const success = await ScanHistoryEngine.clearAll();
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cache/stats', (req, res) => {
  const stats = StorageCache.getStats();
  res.json(stats);
});

app.post('/api/cache/clear', async (req, res) => {
  try {
    await StorageCache.clear();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/large-files', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || os.homedir();
    const minSize = parseInt((req.query.minSize as string) || String(50 * 1024 * 1024), 10);
    const category = (req.query.category as string) || 'all';
    const staleOnly = req.query.staleOnly === 'true';
    const limit = parseInt((req.query.limit as string) || '250', 10);

    const files = await LargeFileFinder.findLargeFiles(targetPath, minSize, category, staleOnly, limit);
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

    res.json({
      files,
      count: files.length,
      totalBytes,
      formattedTotalBytes: formatBytes(totalBytes),
      path: targetPath,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Duplicate File Finder
app.get('/api/duplicates', async (req, res) => {
  try {
    const requestedPath = (req.query.path as string) || os.homedir();
    const duplicates = await Scanner.findDuplicates(requestedPath);
    res.json({ duplicates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Search
app.get('/api/search', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || os.homedir();
    const query = ((req.query.query as string) || '').toLowerCase().trim();
    const filter = (req.query.filter as string) || 'all';

    if (!query) {
      res.json({ results: [] });
      return;
    }

    const results: any[] = [];
    const queue = [targetPath];
    let count = 0;

    while (queue.length > 0 && count < 250) {
      const curr = queue.shift()!;
      try {
        const entries = await fs.readdir(curr, { withFileTypes: true });
        for (const entry of entries) {
          const itemPath = path.join(curr, entry.name);
          const isDir = entry.isDirectory();
          const category = getFileCategory(entry.name, isDir);

          const matchesQuery = entry.name.toLowerCase().includes(query);
          const matchesCategory = filter === 'all' || category === filter;

          if (matchesQuery && matchesCategory) {
            count++;
            const stat = await fs.stat(itemPath).catch(() => null);
            results.push({
              id: itemPath,
              name: entry.name,
              path: itemPath,
              isDirectory: isDir,
              isFile: entry.isFile(),
              size: stat?.size || 0,
              formattedSize: stat?.size ? formatBytes(stat.size) : undefined,
              category,
              modifiedAt: stat?.mtime.toISOString(),
            });
          }

          if (isDir && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            queue.push(itemPath);
          }
        }
      } catch {}
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Autocomplete directory path suggestions
app.get('/api/path-autocomplete', async (req, res) => {
  try {
    const prefix = (req.query.prefix as string) || (req.query.query as string) || '';
    const suggestions = await PathAutocomplete.getSuggestions(prefix);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Advanced Deep Search with Wildcards, Size, Type & Date Filters
app.post('/api/search/deep', async (req, res) => {
  try {
    const { rootPath, query, maxResults } = req.body;
    const results = await AdvancedSearchEngine.deepSearch(
      rootPath || os.homedir(),
      query || '',
      maxResults || 250
    );
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: File Actions with Conflict Resolution and Cache Invalidation
app.post('/api/file-action', async (req, res) => {
  const { action, source, destination, newName } = req.body;
  const conflict = req.body.conflict || req.body.conflictPolicy || 'replace';

  if (!action || !source) {
    res.status(400).json({ error: 'Action and source are required' });
    return;
  }

  try {
    switch (action) {
      case 'open': {
        const ok = WindowsBridge.openInDefaultApp(source);
        res.json({ success: ok });
        break;
      }
      case 'reveal': {
        const ok = WindowsBridge.revealInExplorer(source);
        res.json({ success: ok });
        break;
      }
      case 'openTerminal': {
        const ok = WindowsBridge.openInTerminal(source);
        res.json({ success: ok });
        break;
      }
      case 'openVSCode': {
        const ok = WindowsBridge.openInVSCode(source);
        res.json({ success: ok });
        break;
      }
      case 'delete':
      case 'trash': {
        await WindowsBridge.moveToRecycleBin(source);
        StorageCache.invalidate(source);
        UndoManager.record({
          type: 'createFile', // Reversing trash will move it back or notify
          description: `Deleted '${path.basename(source)}'`,
          originalPath: source,
          targetPath: source,
        });
        res.json({ success: true, trashed: source });
        break;
      }
      case 'rename': {
        if (!newName) {
          res.status(400).json({ error: 'newName is required for rename' });
          return;
        }
        const dir = path.dirname(source);
        const newPath = path.join(dir, newName);
        await fs.rename(source, newPath);
        StorageCache.invalidate(source);
        StorageCache.invalidate(newPath);
        UndoManager.record({
          type: 'rename',
          description: `Renamed '${path.basename(source)}' to '${newName}'`,
          originalPath: source,
          targetPath: newPath,
        });
        res.json({ success: true, oldPath: source, newPath });
        break;
      }
      case 'createFolder': {
        let target: string;
        if (fsSync.existsSync(source) && fsSync.statSync(source).isDirectory()) {
          const folderName = newName || 'New Folder';
          target = path.join(source, folderName);
          let counter = 1;
          while (fsSync.existsSync(target)) {
            target = path.join(source, `${folderName} (${counter++})`);
          }
        } else {
          target = source;
        }
        await fs.mkdir(target, { recursive: true });
        StorageCache.invalidate(path.dirname(target));
        UndoManager.record({
          type: 'createFolder',
          description: `Created folder '${path.basename(target)}'`,
          originalPath: '',
          targetPath: target,
        });
        res.json({ success: true, createdPath: target });
        break;
      }
      case 'createFile': {
        let target: string;
        if (fsSync.existsSync(source) && fsSync.statSync(source).isDirectory()) {
          const fileName = newName || 'New Text Document.txt';
          target = path.join(source, fileName);
          let counter = 1;
          while (fsSync.existsSync(target)) {
            const parsed = path.parse(fileName);
            target = path.join(source, `${parsed.name} (${counter++})${parsed.ext}`);
          }
        } else {
          target = source;
          await fs.mkdir(path.dirname(target), { recursive: true });
        }
        await fs.writeFile(target, '', 'utf8');
        StorageCache.invalidate(path.dirname(target));
        UndoManager.record({
          type: 'createFile',
          description: `Created file '${path.basename(target)}'`,
          originalPath: '',
          targetPath: target,
        });
        res.json({ success: true, createdPath: target });
        break;
      }
      case 'duplicate': {
        const parsed = path.parse(source);
        const parentDir = path.dirname(source);
        let counter = 1;
        let destPath = path.join(parentDir, `${parsed.name} (Copy)${parsed.ext}`);
        while (fsSync.existsSync(destPath)) {
          destPath = path.join(parentDir, `${parsed.name} (Copy ${++counter})${parsed.ext}`);
        }
        await fs.cp(source, destPath, { recursive: true });
        StorageCache.invalidate(parentDir);
        UndoManager.record({
          type: 'copy',
          description: `Duplicated '${path.basename(source)}'`,
          originalPath: source,
          targetPath: destPath,
        });
        res.json({ success: true, source, destination: destPath, createdPath: destPath });
        break;
      }
      case 'copy': {
        if (!destination) {
          res.status(400).json({ error: 'Destination is required' });
          return;
        }
        const base = path.basename(source);
        let destPath: string;
        if (fsSync.existsSync(destination) && fsSync.statSync(destination).isDirectory()) {
          destPath = path.join(destination, base);
        } else {
          destPath = destination;
        }

        if (fsSync.existsSync(destPath)) {
          if (conflict === 'skip') {
            res.json({ success: true, skipped: true, source, destination: destPath });
            return;
          } else if (conflict === 'rename') {
            const parsed = path.parse(destPath);
            const parentDir = path.dirname(destPath);
            let counter = 1;
            while (fsSync.existsSync(destPath)) {
              destPath = path.join(parentDir, `${parsed.name} (Copy ${counter++})${parsed.ext}`);
            }
          }
        }

        const task = TransferManager.createTask('copy', `Copy ${base}`, source, destPath);
        try {
          await fs.cp(source, destPath, { recursive: true, force: conflict === 'replace' });
          StorageCache.invalidate(path.dirname(destPath));
          UndoManager.record({
            type: 'copy',
            description: `Copied '${base}' to '${path.dirname(destPath)}'`,
            originalPath: source,
            targetPath: destPath,
          });
          TransferManager.completeTask(task.id, true);
          res.json({ success: true, source, destination: destPath });
        } catch (err: any) {
          TransferManager.completeTask(task.id, false, err.message);
          throw err;
        }
        break;
      }
      case 'move': {
        if (!destination) {
          res.status(400).json({ error: 'Destination is required' });
          return;
        }
        const base = path.basename(source);
        let destPath: string;
        if (fsSync.existsSync(destination) && fsSync.statSync(destination).isDirectory()) {
          destPath = path.join(destination, base);
        } else {
          destPath = destination;
        }

        if (fsSync.existsSync(destPath)) {
          if (conflict === 'skip') {
            res.json({ success: true, skipped: true, source, destination: destPath });
            return;
          } else if (conflict === 'rename') {
            const parsed = path.parse(destPath);
            const parentDir = path.dirname(destPath);
            let counter = 1;
            while (fsSync.existsSync(destPath)) {
              destPath = path.join(parentDir, `${parsed.name} (Moved ${counter++})${parsed.ext}`);
            }
          }
        }

        const task = TransferManager.createTask('move', `Move ${base}`, source, destPath);
        try {
          await fs.rename(source, destPath);
          StorageCache.invalidate(source);
          StorageCache.invalidate(path.dirname(destPath));
          UndoManager.record({
            type: 'move',
            description: `Moved '${base}' to '${path.dirname(destPath)}'`,
            originalPath: source,
            targetPath: destPath,
          });
          TransferManager.completeTask(task.id, true);
          res.json({ success: true, source, destination: destPath });
        } catch (err: any) {
          TransferManager.completeTask(task.id, false, err.message);
          throw err;
        }
        break;
      }
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Detailed File Properties (Win32 Attributes, Size on Disk, Hashes)
app.get('/api/file-properties', async (req, res) => {
  try {
    const targetPath = req.query.path as string;
    const computeHashes = req.query.hashes === 'true' || req.query.computeHashes === 'true';
    if (!targetPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const properties = await FilePropertiesEngine.getProperties(targetPath, computeHashes);
    res.json(properties);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Modify Win32 Attributes (ReadOnly, Hidden)
app.post('/api/set-attributes', async (req, res) => {
  try {
    const { path: targetPath, readOnly, hidden } = req.body;
    if (!targetPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const success = await FilePropertiesEngine.setAttributes(targetPath, { readOnly, hidden });
    const updated = await FilePropertiesEngine.getProperties(targetPath, false);
    res.json({ success, attributes: updated.attributes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Global Activity Center & Transfers
app.get('/api/transfers', (req, res) => {
  res.json({ tasks: TransferManager.getAll() });
});

app.post('/api/transfers/cancel', (req, res) => {
  const { id } = req.body;
  const success = TransferManager.cancel(id);
  res.json({ success });
});

app.post('/api/transfers/clear', (req, res) => {
  TransferManager.clearCompleted();
  res.json({ success: true });
});

// API: Undo / Redo System for File Operations
app.post('/api/undo', async (req, res) => {
  const result = await UndoManager.undo();
  res.json(result);
});

app.post('/api/redo', async (req, res) => {
  const result = await UndoManager.redo();
  res.json(result);
});

// API: Live Preview & Media Streaming (with HTTP 206 Partial Content Range support)
app.get('/api/preview', async (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).send('File path required');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      res.status(400).send('Target is not a file');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    if (
      req.query.mode === 'text' ||
      [
        '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go',
        '.html', '.css', '.yaml', '.yml', '.xml', '.log', '.sh', '.bat', '.cmd', '.ps1',
        '.sql', '.toml', '.env'
      ].includes(ext)
    ) {
      if (stats.size > 5 * 1024 * 1024) {
        const buffer = Buffer.alloc(256 * 1024);
        const fd = await fs.open(filePath, 'r');
        const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0);
        await fd.close();
        const text = buffer.subarray(0, bytesRead).toString('utf8');
        res.json({
          isTruncated: true,
          totalLines: text.split('\n').length,
          content: text,
          extension: ext.replace('.', ''),
          size: stats.size,
        });
        return;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      res.json({
        isTruncated: false,
        totalLines: lines.length,
        content: lines.slice(0, 500).join('\n'),
        extension: ext.replace('.', ''),
        size: stats.size,
      });
      return;
    }

    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;
      const file = fsSync.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
      });
      fsSync.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// ==========================================
// Applications API
// ==========================================
app.get('/api/apps', async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const apps = await AppDiscovery.getInstalledApplications(refresh);
    res.json({ apps, total: apps.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/apps/:id/footprint', async (req, res) => {
  try {
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === req.params.id);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const breakdown = await AppFootprintAnalyzer.measureApplicationFootprint(appItem);
    res.json(breakdown);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/apps/:id/tree', async (req, res) => {
  try {
    const depth = parseInt((req.query.depth as string) || '4', 10);
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === req.params.id);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const tree = await AppFootprintAnalyzer.getApplicationFileTree(appItem, depth);
    res.json({ tree });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/apps/:id/largest-files', async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === req.params.id);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const largestFiles = await AppFootprintAnalyzer.getApplicationLargestFiles(appItem, limit);
    res.json({ largestFiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/uninstall/prepare', async (req, res) => {
  try {
    const { appId } = req.body;
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === appId);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const plan = await AppUninstaller.prepareUninstallPlan(appItem);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/uninstall/execute', async (req, res) => {
  try {
    const { appId, useQuiet = false } = req.body;
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === appId);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const result = await AppUninstaller.executeOfficialUninstall(appItem, useQuiet);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/uninstall/leftovers', async (req, res) => {
  try {
    const { appId, preLocations = [] } = req.body;
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === appId);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const leftovers = await AppUninstaller.scanForLeftovers(appItem, preLocations);
    res.json({ leftovers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/uninstall/clean', async (req, res) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates)) {
      res.status(400).json({ error: 'Candidates must be an array' });
      return;
    }
    const report = await AppUninstaller.cleanApprovedLeftovers(candidates);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/:id/launch', async (req, res) => {
  try {
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === req.params.id);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const result = await AppDiscovery.launchApp(appItem);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/:id/open-location', async (req, res) => {
  try {
    const apps = await AppDiscovery.getInstalledApplications();
    const appItem = apps.find((a) => a.id === req.params.id);
    if (!appItem) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const result = await AppDiscovery.openLocation(appItem);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/apps/compare', async (req, res) => {
  try {
    const { appA, appB } = req.query;
    if (!appA || !appB) {
      res.status(400).json({ error: 'Parameters appA and appB are required' });
      return;
    }
    const apps = await AppDiscovery.getInstalledApplications();
    const itemA = apps.find((a) => a.id === appA);
    const itemB = apps.find((a) => a.id === appB);
    if (!itemA || !itemB) {
      res.status(404).json({ error: 'One or both applications could not be found' });
      return;
    }
    const comparison = await AppFootprintAnalyzer.compareApplications(itemA, itemB);
    res.json(comparison);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/apps/export', async (req, res) => {
  try {
    const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
    const apps = await AppDiscovery.getInstalledApplications();
    const content = AppDiscovery.exportApps(apps, format);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="installed-applications.json"');
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="installed-applications.csv"');
    }
    res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Utilities API
// ==========================================
app.get('/api/utils/large-files', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || os.homedir();
    const minSize = parseInt((req.query.minSize as string) || String(100 * 1024 * 1024), 10);
    const files = await LargeFileFinder.findLargeFiles(targetPath, minSize);
    res.json({ files, count: files.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utils/empty-folders', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || os.homedir();
    const folders = await EmptyFolderFinder.findEmptyFolders(targetPath);
    res.json({ folders, count: folders.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utils/empty-folders/clean', async (req, res) => {
  try {
    const { paths } = req.body;
    const cleaned = await EmptyFolderFinder.cleanEmptyFolders(paths || []);
    res.json({ success: true, cleanedCount: cleaned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utils/temp-files', async (req, res) => {
  try {
    const result = await TempFileAnalyzer.scanTempFiles();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utils/temp-files/clean', async (req, res) => {
  try {
    const { dirPath } = req.body;
    const result = await TempFileAnalyzer.cleanTempCategory(dirPath);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utils/compare-folders', async (req, res) => {
  try {
    const pathA = req.query.pathA as string;
    const pathB = req.query.pathB as string;
    if (!pathA || !pathB) {
      res.status(400).json({ error: 'pathA and pathB are required' });
      return;
    }
    const result = await FolderComparator.compareFolders(pathA, pathB);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utils/batch-rename/preview', (req, res) => {
  try {
    const { filePaths, rule } = req.body;
    const previews = BatchRenameEngine.previewRename(filePaths || [], rule);
    res.json({ previews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utils/batch-rename/apply', async (req, res) => {
  try {
    const { previews } = req.body;
    const result = await BatchRenameEngine.applyRename(previews || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utils/checksum', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const checksums = await FileChecksumTool.computeChecksums(filePath);
    res.json(checksums);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utils/startup', async (req, res) => {
  try {
    const items = await StartupManager.getStartupItems();
    res.json({ items, count: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utils/startup/toggle', async (req, res) => {
  try {
    const { item, enable } = req.body;
    const ok = await StartupManager.toggleStartupItem(item, enable);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utils/disks-info', async (req, res) => {
  try {
    const disks = await DiskHardwareAnalyzer.getDisksInfo();
    res.json({ disks, count: disks.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Recycle Bin Manager APIs (Phase 4 Section 14)
// ==========================================
app.get(['/api/recycle-bin', '/api/utils/recycle-bin'], async (req, res) => {
  try {
    const result = await RecycleBinManager.getItems();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/recycle-bin/restore', '/api/utils/recycle-bin/restore'], async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const result = await RecycleBinManager.restoreItem(name);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/recycle-bin/empty', '/api/utils/recycle-bin/empty'], async (req, res) => {
  try {
    const result = await RecycleBinManager.emptyRecycleBin();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Advanced Development Cache Cleaner APIs (Phase 4 Section 12)
// ==========================================
app.get(['/api/dev-cleaner', '/api/utils/dev-cleaner'], async (req, res) => {
  try {
    const searchRoot = (req.query.path as string) || (req.query.searchRoot as string) || os.homedir();
    const maxResults = parseInt((req.query.maxResults as string) || '100', 10);
    const result = await DevCleaner.scanDevCaches(searchRoot, maxResults);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/dev-cleaner/clean', '/api/utils/dev-cleaner/clean'], async (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: 'paths array is required' });
      return;
    }
    const result = await DevCleaner.cleanDevItems(paths);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Phase 5: Permissions & Access Analyzer APIs (Section 21)
// ==========================================
app.get('/api/permissions', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || (req.query.targetPath as string);
    if (!targetPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const report = await PermissionsEngine.getPermissions(targetPath);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/permissions/export', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || (req.query.targetPath as string);
    const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
    if (!targetPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const report = await PermissionsEngine.getPermissions(targetPath);
    const content = PermissionsEngine.exportReport(report, format);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="permissions-report.json"');
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="permissions-report.csv"');
    }
    res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Phase 5: Enhanced Windows Startup Manager APIs (Section 20)
// ==========================================
app.get(['/api/startup/export', '/api/utils/startup/export'], async (req, res) => {
  try {
    const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
    const items = await StartupManager.getStartupItems();
    const content = StartupManager.exportStartup(items, format);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="startup-inventory.json"');
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="startup-inventory.csv"');
    }
    res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/startup/open-location', '/api/utils/startup/open-location'], async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    if (!itemPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const ok = await WindowsBridge.openInExplorer(itemPath);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Phase 5: Drive Read Benchmark API (Section 5)
// ==========================================
app.post(['/api/drives/benchmark', '/api/utils/drives/benchmark'], async (req, res) => {
  try {
    const drivePath = (req.body?.drivePath as string) || (req.query?.path as string) || 'C:\\';
    const result = await DiskHardwareAnalyzer.benchmarkDrive(drivePath);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Phase 5: Global Settings and Preferences APIs (Section 27)
// ==========================================
app.get('/api/settings', (req, res) => {
  try {
    const settings = SettingsEngine.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const updates = req.body;
    const settings = await SettingsEngine.updateSettings(updates);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/reset', async (req, res) => {
  try {
    const settings = await SettingsEngine.resetSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/clear-cache', async (req, res) => {
  try {
    await StorageCache.clear();
    await ScanHistoryEngine.clearAll();
    res.json({ success: true, message: 'Persistent storage cache and scan history cleared.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Smart Explorer Bridge] Real Windows Filesystem API listening at http://127.0.0.1:${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[Smart Explorer Bridge] Port ${PORT} already active. Reusing instance.`);
  } else {
    console.error('Server error:', err);
  }
});

export default app;
