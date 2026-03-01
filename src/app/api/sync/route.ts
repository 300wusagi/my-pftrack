import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const FILE_NAME = 'pftrack_data.json';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('未配置 Google Service Account 环境变量');
  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

async function getDrive() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

async function findFile(drive: ReturnType<typeof google.drive>, driveId: string) {
  const res = await drive.files.list({
    q: `name='${FILE_NAME}' and '${driveId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    // 共享云端硬盘必须加这三个参数
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'drive',
    driveId,
  });
  return res.data.files?.[0] ?? null;
}

export async function GET() {
  try {
    const drive = await getDrive();
    const driveId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const file = await findFile(drive, driveId);

    if (!file?.id) {
      return NextResponse.json({ exists: false, data: null });
    }

    const res = await drive.files.get(
      { fileId: file.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'text' }
    );
    const data = JSON.parse(res.data as string);
    return NextResponse.json({ exists: true, data, fileId: file.id });
  } catch (err: any) {
    console.error('[sync GET]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const drive = await getDrive();
    const driveId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const content = JSON.stringify({ ...body, _syncedAt: new Date().toISOString() });

    const existingFile = await findFile(drive, driveId);
    const mediaBody = Readable.from([content]);
    const media = { mimeType: 'application/json', body: mediaBody };

    if (existingFile?.id) {
      await drive.files.update({
        fileId: existingFile.id,
        media,
        supportsAllDrives: true, // 共享云端硬盘必须加
      });
      return NextResponse.json({ ok: true, fileId: existingFile.id });
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: FILE_NAME,
          parents: [driveId],
        },
        media,
        fields: 'id',
        supportsAllDrives: true, // 共享云端硬盘必须加
      });
      return NextResponse.json({ ok: true, fileId: created.data.id });
    }
  } catch (err: any) {
    console.error('[sync POST]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
