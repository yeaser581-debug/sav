import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { readdir, unlink } from 'fs/promises';
import path from 'path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }

  try {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const entries = await readdir(dir).catch(() => [] as string[]);
    const match = entries.find(f => f.startsWith(`${id}.`));
    if (match) {
      await unlink(path.join(dir, match));
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[TEMP DELETE ERROR]', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
