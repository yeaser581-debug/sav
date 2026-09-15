import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendPush } from '@/lib/push';
import { decideResolution, MAX_REASON_LENGTH } from '@/lib/issue-workflow';
import {
  parseIssueId,
  StaleIssueError,
  STALE_ISSUE_MESSAGE,
  toSnapshot,
  whereStillMatches,
} from '@/lib/issue-workflow-server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_PREFIXES = ['image/', 'video/'];

async function removeFiles(paths: string[]) {
  await Promise.all(paths.map(p => unlink(p).catch(() => {})));
}

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
  const issueId = parseIssueId(id);
  if (issueId === null) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

  const written: string[] = [];
  let committed = false;

  try {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const now = new Date();
    const decision = decideResolution({ role: 'agent', id: payload.id }, toSnapshot(issue), now);
    if (decision.outcome === 'refuse') {
      return NextResponse.json({ error: decision.message }, { status: decision.httpStatus });
    }
    if (decision.outcome !== 'apply') {
      return NextResponse.json({ error: 'Cette réclamation ne peut pas être résolue dans son état actuel.' }, { status: 409 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: 'Envoyez les preuves sous forme de fichiers.' }, { status: 400 });
    }

    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    const rawNote = formData.get('note');
    const note = typeof rawNote === 'string' ? rawNote.trim() || null : null;
    if (note && note.length > MAX_REASON_LENGTH) {
      return NextResponse.json({ error: `La note ne peut pas dépasser ${MAX_REASON_LENGTH} caractères.` }, { status: 400 });
    }

    const validFiles = files.filter(f => f.size > 0);
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

    const proofData: Prisma.ResolutionProofCreateManyInput[] = [];
    for (const file of validFiles) {
      const mediaType = file.type.startsWith('image/') ? 'PHOTO' : 'VIDEO';
      const rawExt = file.name.includes('.') ? file.name.split('.').pop()! : '';
      const ext = /^[a-zA-Z0-9]{1,8}$/.test(rawExt) ? rawExt.toLowerCase() : 'bin';
      const filename = `${randomUUID()}.${ext}`;
      const fullPath = path.join(dir, filename);
      const bytes = await file.arrayBuffer();
      await writeFile(fullPath, Buffer.from(bytes));
      written.push(fullPath);

      proofData.push({
        issueId,
        uploadedById: payload.id,
        uploadedByType: 'AGENT' as const,
        url: `/uploads/proof/${issueId}/${filename}`,
        type: mediaType as 'PHOTO' | 'VIDEO',
        note,
      });
    }

    let updatedIssue;
    try {
      updatedIssue = await prisma.$transaction(async tx => {
        const { count } = await tx.issue.updateMany({
          where: whereStillMatches(issueId, decision.expect),
          data: decision.data,
        });
        if (count !== 1) throw new StaleIssueError();
        await tx.resolutionProof.createMany({ data: proofData });
        return tx.issue.findUniqueOrThrow({ where: { id: issueId } });
      });
      committed = true;
    } catch (err) {
      await removeFiles(written);
      if (err instanceof StaleIssueError) {
        return NextResponse.json({ error: STALE_ISSUE_MESSAGE }, { status: 409 });
      }
      throw err;
    }

    await prisma.notification.create({
      data: {
        userId: issue.clientId,
        userRole: 'client',
        title: `Intervention résolue (Réclamation #${issue.id})`,
        message: 'Votre agent a marqué cette réclamation comme résolue. Vérifiez les preuves et confirmez.',
        link: `/client/issues/${issue.id}`,
      },
    });

    await sendPush(issue.clientId, 'client', {
      title: `Intervention résolue (Réclamation #${issue.id})`,
      body: 'Votre agent a marqué cette réclamation comme résolue. Vérifiez les preuves et confirmez.',
      link: `/client/issues/${issue.id}`,
      tag: `issue-${issue.id}`,
    });

    return NextResponse.json({ success: true, issue: updatedIssue, targetUserIds: [issue.clientId] }, { status: 201 });
  } catch (err) {
    if (!committed) await removeFiles(written);
    console.error('[RESOLVE ERROR]', err);
    return NextResponse.json({ error: 'Erreur serveur lors de la résolution.' }, { status: 500 });
  }
}
