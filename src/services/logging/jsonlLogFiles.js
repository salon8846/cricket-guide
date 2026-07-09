import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const LOG_ROOT_DIR = `${FileSystem.documentDirectory ?? ''}app-logs/`;

const isFileSystemAvailable = () => {
    return Platform.OS !== 'web' && typeof FileSystem.documentDirectory === 'string';
};

const toLine = (entry) => `${JSON.stringify(entry)}\n`;

const safeJsonParse = (value) => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const createSerializedTaskRunner = () => {
    let task = Promise.resolve();

    return (nextTask) => {
        task = task.then(nextTask, nextTask);
        return task;
    };
};

const ensureDirectory = async (directoryUri) => {
    if (!isFileSystemAvailable()) {
        return false;
    }

    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
    return true;
};

const fileExists = async (fileUri) => {
    if (!isFileSystemAvailable()) {
        return false;
    }

    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists === true;
};

const readFile = async (fileUri) => {
    if (!(await fileExists(fileUri))) {
        return '';
    }

    return await FileSystem.readAsStringAsync(fileUri);
};

const writeFile = async (fileUri, content, options = {}) => {
    await FileSystem.writeAsStringAsync(fileUri, content, options);
};

const deletePath = async (uri) => {
    if (!isFileSystemAvailable()) {
        return;
    }

    await FileSystem.deleteAsync(uri, { idempotent: true });
};

const rotateFile = async ({ directoryUri, fileName, maxBytes, rotatedFiles }) => {
    const fileUri = `${directoryUri}${fileName}`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info?.exists || Number(info.size ?? 0) <= maxBytes) {
        return;
    }

    for (let index = rotatedFiles; index >= 1; index -= 1) {
        const sourceUri = `${fileUri}.${index}`;
        const targetUri = `${fileUri}.${index + 1}`;

        if (index === rotatedFiles) {
            await deletePath(sourceUri);
            continue;
        }

        if (await fileExists(sourceUri)) {
            await FileSystem.moveAsync({ from: sourceUri, to: targetUri });
        }
    }

    await FileSystem.moveAsync({ from: fileUri, to: `${fileUri}.1` });
};

const readRotatedFiles = async ({ directoryUri, fileName, rotatedFiles }) => {
    const fileUris = [
        ...Array.from({ length: rotatedFiles }, (_, index) => `${directoryUri}${fileName}.${rotatedFiles - index}`),
        `${directoryUri}${fileName}`,
    ];

    const contents = await Promise.all(fileUris.map(readFile));
    return contents.filter(Boolean).join('');
};

const readJsonLines = (content) => {
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(safeJsonParse)
        .filter(Boolean);
};

const readDirectoryFileNames = async (directoryUri) => {
    if (!(await ensureDirectory(directoryUri))) {
        return [];
    }

    return await FileSystem.readDirectoryAsync(directoryUri);
};

export const clearLogDirectory = async (directoryName) => {
    const directoryUri = `${LOG_ROOT_DIR}${directoryName}/`;
    await deletePath(directoryUri);
    await ensureDirectory(directoryUri);
};

export const clearAllLogFiles = async () => {
    await deletePath(LOG_ROOT_DIR);
    await ensureDirectory(LOG_ROOT_DIR);
};

export const createRotatingJsonlFile = ({ directoryName, fileName, maxBytes, rotatedFiles }) => {
    const directoryUri = `${LOG_ROOT_DIR}${directoryName}/`;
    const fileUri = `${directoryUri}${fileName}`;
    const runTask = createSerializedTaskRunner();

    const append = (entry) => runTask(async () => {
        if (!(await ensureDirectory(directoryUri))) {
            return;
        }

        await rotateFile({ directoryUri, fileName, maxBytes, rotatedFiles });
        await writeFile(fileUri, toLine(entry), { append: true });
    });

    const readText = () => readRotatedFiles({ directoryUri, fileName, rotatedFiles });

    const readEntries = async (limit = 200) => {
        const entries = readJsonLines(await readText());
        return entries.slice(Math.max(entries.length - limit, 0));
    };

    const clear = () => runTask(() => clearLogDirectory(directoryName));

    return {
        append,
        readText,
        readEntries,
        clear,
    };
};

export const createSessionJsonlFileStore = ({ directoryName, filePrefix, currentSessionId, maxBytes, maxFiles }) => {
    const directoryUri = `${LOG_ROOT_DIR}${directoryName}/`;
    const currentFileName = `${filePrefix}-${currentSessionId}.log`;
    const currentFileUri = `${directoryUri}${currentFileName}`;
    const runTask = createSerializedTaskRunner();

    const listSessions = async () => {
        const fileNames = await readDirectoryFileNames(directoryUri);
        const sessions = await Promise.all(
            fileNames
                .filter((fileName) => fileName.startsWith(`${filePrefix}-`) && fileName.endsWith('.log'))
                .map(async (fileName) => {
                    const uri = `${directoryUri}${fileName}`;
                    const info = await FileSystem.getInfoAsync(uri);
                    return {
                        id: fileName.slice(filePrefix.length + 1, -4),
                        fileName,
                        uri,
                        size: Number(info?.size ?? 0),
                        modificationTime: Number(info?.modificationTime ?? 0),
                    };
                }),
        );

        return sessions
            .filter((session) => session.id)
            .sort((left, right) => right.fileName.localeCompare(left.fileName));
    };

    const pruneOldSessions = async () => {
        const sessions = await listSessions();
        const oldSessions = sessions.slice(maxFiles);
        await Promise.all(oldSessions.map((session) => deletePath(session.uri)));
    };

    const append = (entry) => runTask(async () => {
        if (!(await ensureDirectory(directoryUri))) {
            return;
        }

        const info = await FileSystem.getInfoAsync(currentFileUri).catch(() => null);
        if (info?.exists && Number(info.size ?? 0) > maxBytes) {
            return;
        }

        await writeFile(currentFileUri, toLine(entry), { append: true });
        await pruneOldSessions();
    });

    const readText = async (sessionId = currentSessionId) => {
        const fileUri = `${directoryUri}${filePrefix}-${sessionId}.log`;
        return await readFile(fileUri);
    };

    const readEntries = async (sessionId = currentSessionId, limit = 200) => {
        const entries = readJsonLines(await readText(sessionId));
        return entries.slice(Math.max(entries.length - limit, 0));
    };

    const deleteSession = (sessionId) => runTask(async () => {
        const fileUri = `${directoryUri}${filePrefix}-${sessionId}.log`;
        await deletePath(fileUri);
    });

    const clear = () => runTask(() => clearLogDirectory(directoryName));

    return {
        append,
        listSessions,
        readText,
        readEntries,
        deleteSession,
        clear,
        currentSessionId,
    };
};

export const createJsonlQueueFile = ({ directoryName, fileName, maxEntries }) => {
    const directoryUri = `${LOG_ROOT_DIR}${directoryName}/`;
    const fileUri = `${directoryUri}${fileName}`;
    const runTask = createSerializedTaskRunner();

    const readEntries = async () => {
        const content = await readFile(fileUri);
        return readJsonLines(content);
    };

    const replaceEntries = (entries) => runTask(async () => {
        if (!(await ensureDirectory(directoryUri))) {
            return;
        }

        await writeFile(fileUri, entries.map(toLine).join(''));
    });

    const append = (entry) => runTask(async () => {
        if (!(await ensureDirectory(directoryUri))) {
            return;
        }

        const entries = [...await readEntries(), entry].slice(-maxEntries);
        await writeFile(fileUri, entries.map(toLine).join(''));
    });

    const clear = () => replaceEntries([]);

    return {
        append,
        readEntries,
        replaceEntries,
        clear,
    };
};
