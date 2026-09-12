async function principalIsValid(prisma, user) {
  if (!user || !Number.isInteger(user.id)) return false;

  try {
    if (user.role === 'admin') {
      const admin = await prisma.admin.findUnique({ where: { id: user.id }, select: { isActive: true } });
      return admin != null && admin.isActive === true;
    }
    if (user.role === 'agent') {
      const agent = await prisma.agent.findUnique({ where: { id: user.id }, select: { deletedAt: true } });
      return agent != null && agent.deletedAt === null;
    }
    if (user.role === 'client') {
      const client = await prisma.client.findUnique({ where: { id: user.id }, select: { deletedAt: true } });
      return client != null && client.deletedAt === null;
    }
  } catch (err) {
    console.error('[SOCKET AUTH] principal check failed', err);
  }
  return false;
}

async function canAccessIssue(prisma, user, issueId) {
  if (!user || !Number.isInteger(issueId) || issueId <= 0) return false;
  if (user.role === 'admin') return true;

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { clientId: true, agentId: true, status: true },
  });
  if (!issue) return false;

  if (user.role === 'client') return issue.clientId === user.id;
  if (user.role === 'agent') return issue.agentId === user.id || issue.status === 'PENDING_AGENT';
  return false;
}

module.exports = { principalIsValid, canAccessIssue };
