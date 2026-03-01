// app/api/sync/route.ts
// 服务端通过 Service Account 读写 Google Drive 中的 pftrack_data.json
// 
// 需要在 Vercel 环境变量中配置：
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  （服务账号邮箱）
//   GOOGLE_PRIVATE_KEY            （服务账号私钥，注意换行符用 \n 转义）
//   GOOGLE_DRIVE_FOLDER_ID        （共享给服务账号的Drive文件夹ID）

import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const FILE_NAME = 'pftrack_data.json';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('未配置 Google Service Account 环境变量');
  return new google.auth.JWT(email, undefined, key, SCOPES);
}

async function getDrive() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

async function findFile(drive: ReturnType<typeof google.drive>, folderId: string) {
  const res = await drive.files.list({
    q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files?.[0] ?? null;
}

// GET：读取云端数据
export async function GET() {
  try {
    const drive = await getDrive();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const file = await findFile(drive, folderId);

    if (!file || !file.id) {
      // 文件不存在，返回空（首次使用）
      return NextResponse.json({ exists: false, data: null });
    }

    const res = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );
    const data = JSON.parse(res.data as string);
    return NextResponse.json({ exists: true, data, fileId: file.id });
  } catch (err: any) {
    console.error('[sync GET]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST：写入云端数据
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const drive = await getDrive();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const content = JSON.stringify({ ...body, _syncedAt: new Date().toISOString() });

    const existingFile = await findFile(drive, folderId);

    const mediaBody = Readable.from([content]);
    const media = { mimeType: 'application/json', body: mediaBody };

    if (existingFile?.id) {
      // 更新已有文件
      await drive.files.update({
        fileId: existingFile.id,
        media,
      });
      return NextResponse.json({ ok: true, fileId: existingFile.id });
    } else {
      // 创建新文件
      const created = await drive.files.create({
        requestBody: { name: FILE_NAME, parents: [folderId] },
        media,
        fields: 'id',
      });
      return NextResponse.json({ ok: true, fileId: created.data.id });
    }
  } catch (err: any) {
    console.error('[sync POST]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
