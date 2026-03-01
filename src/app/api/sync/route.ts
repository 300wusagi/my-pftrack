import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const KV_KEY = 'pftrack_data';

// fromEnv() 自动读取 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN
const redis = Redis.fromEnv();

export async function GET() {
  try {
    const data = await redis.get(KV_KEY);
    if (!data) {
      return NextResponse.json({ exists: false, data: null });
    }
    return NextResponse.json({ exists: true, data });
  } catch (err: any) {
    console.error('[sync GET]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = { ...body, _syncedAt: new Date().toISOString() };
    await redis.set(KV_KEY, payload);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync POST]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
