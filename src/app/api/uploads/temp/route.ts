import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_PREFIXES = ['image/', 'video/', 'audio/'];

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !file.size) {
      return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 25 Mo).' }, { status: 413 });
    }
    if (!ALLOWED_PREFIXES.some(p => file.type.startsWith(p))) {
      return NextResponse.json({ error: 'Type de fichier non supporté.' }, { status: 415 });
    }

    const id = randomUUID();
    const rawExt = file.name.includes('.') ? file.name.split('.').pop()! : '';
    const ext = /^[a-zA-Z0-9]{1,8}$/.test(rawExt) ? rawExt.toLowerCase() : 'bin';

    const dir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    await mkdir(dir, { recursive: true });

    const filename = `${id}.${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(dir, filename), Buffer.from(bytes));

    return NextResponse.json({
      id,
      url: `/uploads/temp/${filename}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }, { status: 201 });
  } catch (err) {
    console.error('[TEMP UPLOAD ERROR]', err);
    return NextResponse.json({ error: 'Erreur serveur lors du téléversement.' }, { status: 500 });
  }
}
