import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB per file
const ALLOWED_PREFIXES = ['image/', 'video/'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (payload.role !== 'agent') {
    return NextResponse.json({ error: 'Seul l\'agent assigné peut résoudre cette réclamation.' }, { status: 403 });
  }

  const { id } = await params;
  const issueId = parseInt(id);

  try {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    if (issue.agentId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (issue.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Cette réclamation ne peut pas être résolue dans son état actuel.' }, { status: 409 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const note = (formData.get('note') as string | null)?.trim() || null;

    const validFiles = files.filter(f => f && f.size > 0);
    if (validFiles.length === 0) {
      return NextResponse.json({ error: 'Au moins une photo ou vidéo justifiant la résolution est requise.' }, { status: 400 });
    }
    for (const file of validFiles) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `"${file.name}" dépasse la taille maximale (25 Mo).` }, { status: 413 });
      }
      if (!ALLOWED_PREFIXES.some(p => file.type.startsWith(p))) {
        return NextResponse.json({ error: `"${file.name}" doit être une photo ou une vidéo.` }, { status: 415 });
      }
    }

    const dir = path.join(process.cwd(), 'public', 'uploads', 'proof', String(issueId));
    await mkdir(dir, { recursive: true });

    const proofData = [];
    for (const file of validFiles) {
      const mediaType = file.type.startsWith('image/') ? 'PHOTO' : 'VIDEO';
      const rawExt = file.name.includes('.') ? file.name.split('.').pop()! : '';
      const ext = /^[a-zA-Z0-9]{1,8}$/.test(rawExt) ? rawExt.toLowerCase() : 'bin';
      const filename = `${randomUUID()}.${ext}`;
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(dir, filename), Buffer.from(bytes));

      proofData.push({
        issueId,
        uploadedById: payload.id,
        uploadedByType: 'AGENT' as const,
        url: `/uploads/proof/${issueId}/${filename}`,
        type: mediaType as 'PHOTO' | 'VIDEO',
        note,
      });
    }

    const [, updatedIssue] = await prisma.$transaction([
      prisma.resolutionProof.createMany({ data: proofData }),
      prisma.issue.update({
        where: { id: issueId },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: issue.clientId,
        userRole: 'client',
        title: `Intervention résolue (Réclamation #${issue.id})`,
        message: 'Votre agent a marqué cette réclamation comme résolue. Vérifiez les preuves et confirmez.',
        link: `/client/issues/${issue.id}`,
      },
    });

    return NextResponse.json({ success: true, issue: updatedIssue, targetUserIds: [issue.clientId] }, { status: 201 });
  } catch (err) {
    console.error('[RESOLVE ERROR]', err);
    return NextResponse.json({ error: 'Erreur serveur lors de la résolution.' }, { status: 500 });
  }
}
