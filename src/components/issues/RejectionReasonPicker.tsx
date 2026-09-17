'use client';

import { LIMITS } from '@/lib/limits';
import { cn } from '@/lib/utils';

/**
 * The reasons a claim is usually refused in property after-sales. Picking one
 * fills the box with a sentence the resident will read, which the agent or
 * admin can then adjust — it is a starting point, not a fixed list.
 */
export const REJECTION_REASONS: { label: string; text: string }[] = [
  {
    label: 'Hors garantie',
    text: 'La période de garantie couvrant ce type de désordre est échue, la réclamation ne peut donc pas être prise en charge au titre du SAV.',
  },
  {
    label: 'Entretien courant',
    text: 'Le désordre signalé relève de l’entretien courant du logement, qui incombe à l’occupant et non au promoteur.',
  },
  {
    label: 'Dommage d’usage',
    text: 'Le dommage constaté résulte d’un usage inadapté ou d’un choc postérieur à la livraison, et n’est pas couvert par la garantie.',
  },
  {
    label: 'Partie commune',
    text: 'Le désordre concerne une partie commune de la résidence : la demande doit être adressée au syndic de copropriété.',
  },
  {
    label: 'Modification du résident',
    text: 'Le désordre fait suite à des travaux ou modifications réalisés par le résident, ce qui exclut la prise en charge au titre de la garantie.',
  },
  {
    label: 'Doublon',
    text: 'Cette réclamation reprend un signalement déjà enregistré et suivi par nos équipes ; le traitement se poursuit sur le dossier initial.',
  },
  {
    label: 'Informations insuffisantes',
    text: 'Les éléments fournis ne permettent pas d’identifier le désordre. Merci de déposer une nouvelle réclamation avec des photos et une description précise.',
  },
  {
    label: 'Hors périmètre',
    text: 'La prestation demandée ne fait pas partie du périmètre couvert par le contrat de service après-vente.',
  },
];

/**
 * Suggested reasons above the box, plus the count of characters left once the
 * text gets long. Clicking a suggestion replaces the text, so a mis-click is
 * undone by picking another or editing freely.
 */
export function RejectionReasonPicker({ value, onPick, className }: {
  value: string;
  onPick: (text: string) => void;
  className?: string;
}) {
  const remaining = LIMITS.reason - value.length;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">Motifs fréquents :</span>
        {REJECTION_REASONS.map(reason => {
          const chosen = value.trim() === reason.text;
          return (
            <button
              key={reason.label}
              type="button"
              onClick={() => onPick(reason.text)}
              aria-pressed={chosen}
              title={reason.text}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                chosen
                  ? 'border-primary/30 bg-accent text-accent-foreground'
                  : 'border-border bg-muted/60 text-muted-foreground hover:border-input hover:text-foreground',
              )}
            >
              {reason.label}
            </button>
          );
        })}
      </div>
      {remaining < 200 && (
        <p className={cn('text-right text-[11px]', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {remaining} caractère{Math.abs(remaining) === 1 ? '' : 's'} restant{Math.abs(remaining) === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
