// The new-player tutorial's step machine (tutorial.js draws it). Pure: it reads a snapshot of the
// game and returns the step to show, so it imports nothing. A step can move back as well as on
// (stepping off the treadmill returns to "walk onto it"), and a player who already has the progress
// a lesson teaches skips past it.
//
// Steps: 0 walk onto the treadmill, 1 run to the level goal, 2 walk out of the START portal,
// 3 cross the Lava Run to its Win pad, 4 come back to the Hub, 5 buy the starter hair style,
// 6 shoot the hair cable once. `c.done` (TUTORIAL.done) means finished.
//
// c: { onBelt, level, levelGoal, inHub, wins, hasStyle, shot, done }
export function nextStep(step, c) {
  if (step >= c.done) return step
  switch (step) {
    case 0:
    case 1:
      if (c.level >= c.levelGoal) return 2
      return c.onBelt ? 1 : 0
    case 2:
      if (c.hasStyle) return 6
      if (c.wins >= 1) return c.inHub ? 5 : 4
      return c.inHub ? 2 : 3
    case 3:
      if (c.wins >= 1) return c.inHub ? 5 : 4
      return c.inHub ? 2 : 3
    case 4:
      return c.inHub ? 5 : 4
    case 5:
      return c.hasStyle || c.wins < 1 ? 6 : 5
    case 6:
      return c.shot ? c.done : 6
    default:
      return step
  }
}
