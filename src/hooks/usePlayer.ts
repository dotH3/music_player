// Subscribes a component to the audio player's events and re-renders it
// whenever one fires. Components then read fresh values off the `player`
// singleton during render (player.isPlaying, player.position, …).

import { useEffect, useReducer } from 'react';
import { player } from '../lib/player';
import type { PlayerEventName } from '../lib/player';

export function usePlayer(events: PlayerEventName[] = ['state', 'track']) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const key = events.join(',');

  useEffect(() => {
    const handler = () => force();
    const names = key.split(',') as PlayerEventName[];
    names.forEach((e) => player.addEventListener(e, handler));
    return () => names.forEach((e) => player.removeEventListener(e, handler));
  }, [key]);

  return player;
}
