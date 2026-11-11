/** One multiple-choice question with immediate feedback. Shared by lessons and quizzes. */
import { useMemo, useState } from 'react';
import type { Mcq } from '@/content/schema';
import { RichText } from './index';

export interface McqQuestionProps {
  question: Mcq;
  /** Called once, when the learner picks an answer */
  onAnswer?: (correct: boolean, choiceIndex: number) => void;
  /** Shuffle choice order (stable for the life of the component). Default true. */
  shuffle?: boolean;
  /** Small label above the prompt, e.g. "Question 3 of 10" */
  label?: string;
}

export function McqQuestion({ question, onAnswer, shuffle = true, label }: McqQuestionProps) {
  const order = useMemo(() => {
    const idx = question.choices.map((_, i) => i);
    if (shuffle) for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, question.prompt]);
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked != null;
  return (
    <div className="mcq">
      {label && <div className="mcq-label dim">{label}</div>}
      <p className="mcq-prompt">
        <RichText text={question.prompt} />
      </p>
      <div className="mcq-choices">
        {order.map((ci) => {
          const state = !answered ? '' : ci === question.answerIndex ? ' is-correct' : ci === picked ? ' is-wrong' : ' is-muted';
          return (
            <button
              key={ci}
              type="button"
              className={`mcq-choice${state}`}
              disabled={answered}
              onClick={() => {
                setPicked(ci);
                onAnswer?.(ci === question.answerIndex, ci);
              }}
            >
              {question.choices[ci]}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`mcq-feedback ${picked === question.answerIndex ? 'is-correct' : 'is-wrong'}`} role="status">
          <strong>{picked === question.answerIndex ? 'Correct.' : 'Not quite.'}</strong> <RichText text={question.explanation} />
        </p>
      )}
    </div>
  );
}
