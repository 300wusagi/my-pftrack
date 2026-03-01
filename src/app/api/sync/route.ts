import { NextResponse } from 'next/server';

const KV_KEY = 'pftrack_data';

// 通过 Vercel KV REST API 读写数据
// 无需安装额外包，直接用 fetch 调用
function getKVHeaders() {
  return {
    Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

const baseUrl = () => process.env.KV_REST_API_URL;

export async function GET() {
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json({ exists: false, data: null, error: 'KV未配置' });
    }

    const res = await fetch(`${baseUrl()}/get/${KV_KEY}`, {
      headers: getKVHeaders(),
    });

    const json = await res.json();

    if (!json.result) {
      return NextResponse.json({ exists: false, data: null });
    }

    // KV 存的是 JSON 字符串
    const data = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
    return NextResponse.json({ exists: true, data });
  } catch (err: any) {
    console.error('[sync GET]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json({ error: 'KV未配置' }, { status: 503 });
    }

    const body = await request.json();
    const content = JSON.stringify({ ...body, _syncedAt: new Date().toISOString() });

    const res = await fetch(`${baseUrl()}/set/${KV_KEY}`, {
      method: 'POST',
      headers: getKVHeaders(),
      body: JSON.stringify(content),
    });

    const json = await res.json();

    if (json.result === 'OK') {
      return NextResponse.json({ ok: true });
    } else {
      throw new Error(JSON.stringify(json));
    }
  } catch (err: any) {
    console.error('[sync POST]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
