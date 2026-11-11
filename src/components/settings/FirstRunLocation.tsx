/** First-run location prompt: shown on location-dependent pages until the learner has chosen (or kept) a location. */
import { useState } from 'react';
import { useSettings } from '@/store/settings';
import { LocationDialog } from '@/modes/explore/LocationDialog';

let dismissedThisSession = false;

export function FirstRunLocation() {
  const observer = useSettings((s) => s.observer);
  const chosen = useSettings((s) => s.locationChosen);
  const setObserver = useSettings((s) => s.setObserver);
  const [dismissed, setDismissed] = useState(dismissedThisSession);
  if (chosen || dismissed) return null;
  return (
    <LocationDialog
      observer={observer}
      onSave={setObserver}
      onClose={() => {
        dismissedThisSession = true;
        setDismissed(true);
      }}
      firstRun={{
        title: 'Welcome to Starhop. Where are you observing from?',
        intro: 'The sky you can see depends on where you are: your latitude decides which stars rise, and your time zone sets the clock. Pick a place so the sky map, Tonight and the course are worked out for you. You can change it any time from the location button at the top.',
        keepLabel: `Keep ${observer.name}`,
        onKeep: () => setObserver(observer),
      }}
    />
  );
}
