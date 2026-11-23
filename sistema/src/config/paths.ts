import path from 'node:path';

export const uploadsPath = path.join(process.cwd(), 'public/uploads');
export const clientDirectory = path.join(process.cwd(), 'client-dist');
export const clientEntry = path.join(clientDirectory, 'index.html');
export const stagedUploadsPath = path.join(process.cwd(), 'var', 'upload-staging');
export const managedUploadsPath = path.join(uploadsPath, 'managed');
