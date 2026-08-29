import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import type { Issue } from '@prisma/client';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_PREFIXES = ['image/', 'video/', 'audio/'];

async function notifyForMessage(issue: Issue, role: 'client' | 'admin', preview: string) {
  const targetUserIds: number[] = [];

  if (role === 'client') {
    const admins = await prisma.admin.findMany({ select: { id: true } });
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        userRole: 'admin',
        title: `Message d'un résident (Réclamation #${issue.id})`,
        message: preview,
        link: `/admin/issues/${issue.id}`,
      })),
    });
    targetUserIds.push(...admins.map(a => a.id));
  } else {
    await prisma.notification.create({
      data: { userId: issue.clientId, userRole: 'client', title: `Message de l'administration (#${issue.id})`, message: preview, link: `/client/issues/${issue.id}` },
    });
    targetUserIds.push(issue.clientId);
  }

  return targetUserIds;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (payload.role !== 'client' && payload.role !== 'admin') {
    return NextResponse.json({ error: 'La messagerie est réservée au résident et à l\'administration.' }, { status: 403 });
  }

  const { id } = await params;
  const issueId = parseInt(id);

  try {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    if (payload.role === 'client' && issue.clientId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    const role = payload.role as 'client' | 'admin';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const caption = (formData.get('content') as string | null)?.trim() || '';

      if (!file || !file.size) {
        return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Fichier trop volumineux (max 25 Mo).' }, { status: 413 });
      }
      if (!ALLOWED_PREFIXES.some(p => file.type.startsWith(p))) {
        return NextResponse.json({ error: 'Type de fichier non supporté.' }, { status: 415 });
      }

      const mediaType = file.type.startsWith('image/') ? 'PHOTO'
        : file.type.startsWith('video/') ? 'VIDEO'
        : 'AUDIO';

      const rawExt = file.name.includes('.') ? file.name.split('.').pop()! : '';
      const ext = /^[a-zA-Z0-9]{1,8}$/.test(rawExt) ? rawExt.toLowerCase() : 'bin';
      const filename = `${randomUUID()}.${ext}`;

      const dir = path.join(process.cwd(), 'public', 'uploads', 'messages', String(issueId));
      await mkdir(dir, { recursive: true });
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(dir, filename), Buffer.from(bytes));

      const message = await prisma.issueMessage.create({
        data: {
          issueId,
          senderType: role.toUpperCase() as 'CLIENT' | 'ADMIN',
          senderId: payload.id,
          message: caption,
          mediaUrl: `/uploads/messages/${issueId}/${filename}`,
          mediaType,
        },
      });

      const preview = mediaType === 'PHOTO' ? '📷 Photo' : mediaType === 'VIDEO' ? '🎥 Vidéo' : '🎤 Message vocal';
      const targetUserIds = await notifyForMessage(issue, role, preview);

      return NextResponse.json({ success: true, message, targetUserIds }, { status: 201 });
    }

    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const message = await prisma.issueMessage.create({
      data: {
        issueId,
        senderType: role.toUpperCase() as 'CLIENT' | 'ADMIN',
        senderId: payload.id,
        message: content.trim(),
      },
    });

    const targetUserIds = await notifyForMessage(issue, role, content.trim().slice(0, 50) + '...');

    return NextResponse.json({ success: true, message, targetUserIds }, { status: 201 });
  } catch (err) {
    console.error('[MESSAGE CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
