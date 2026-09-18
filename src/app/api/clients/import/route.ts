import { NextRequest, NextResponse } from 'next/server';
import { adminFrom, privateJson, unauthorized } from '@/lib/admin-guard';
import { ImportFileError, applyPlan, planFromRows, readSheet } from '@/lib/client-import-server';
import { LIMITS, checkLengths } from '@/lib/limits';

const DEFAULT_ZONE = 'Glorious Zenata';

/**
 * Two steps over the same file: "preview" says what would happen, "apply"
 * writes it. Nothing is stored between them, so the browser sends the file
 * twice and the preview can never drift from what gets written.
 */
export async function POST(req: NextRequest) {
  const admin = adminFrom(req);
  if (!admin) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Envoi illisible.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choisissez un fichier.' }, { status: 400 });
  }

  const mode = form.get('mode') === 'apply' ? 'apply' : 'preview';
  const zoneName = (form.get('zone') as string | null)?.trim() || DEFAULT_ZONE;

  const tooLong = checkLengths([['Le nom de la zone', zoneName, LIMITS.name]]);
  if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });

  try {
    const plan = await planFromRows(await readSheet(file));

    if (mode === 'preview') {
      return privateJson({
        mode,
        zone: zoneName,
        create: plan.create.length,
        update: plan.update.length,
        skipped: plan.skipped,
        errors: plan.errors,
        buildings: plan.buildings.map(b => b.label),
        // A short look at what will be written, so the admin can spot a
        // mis-read column before anything is written — updates included, or a
        // re-import would preview nothing at all.
        sample: [
          ...plan.create.map(c => ({ action: 'create' as const, client: c })),
          ...plan.update.map(c => ({ action: 'update' as const, client: c })),
        ].slice(0, 8).map(({ action, client }) => ({
          action,
          unitCode: client.unitCode, name: client.name, login: client.login,
          building: client.building.letter, floor: client.floor, phone: client.phone,
        })),
      });
    }

    if (plan.create.length === 0 && plan.update.length === 0) {
      return NextResponse.json({ error: 'Rien à importer dans ce fichier.' }, { status: 400 });
    }

    return privateJson({ mode, zone: zoneName, ...(await applyPlan(plan, zoneName)) });
  } catch (err) {
    if (err instanceof ImportFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[CLIENT IMPORT ERROR]', err);
    return NextResponse.json({ error: 'Import impossible. Vérifiez le fichier et réessayez.' }, { status: 500 });
  }
}
