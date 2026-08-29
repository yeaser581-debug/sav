import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (payload.role !== 'client' && payload.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, messageId } = await params;
  const issueId = parseInt(id);

  try {
    const message = await prisma.issueMessage.findUnique({ where: { id: parseInt(messageId) } });
    if (!message || message.issueId !== issueId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Only the author can delete their own message.
    if (message.senderType !== payload.role.toUpperCase() || message.senderId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (message.mediaUrl) {
      try {
        await unlink(path.join(process.cwd(), 'public', message.mediaUrl));
      } catch {
        // File already gone — not fatal.
      }
    }

    await prisma.issueMessage.delete({ where: { id: message.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[MESSAGE DELETE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
