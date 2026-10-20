// The new-player tutorial's step machine (tutorial.js draws it). Pure: it reads a snapshot of the
// game and returns the step to show, so it imports nothing. A step can move back as well as on
// (stepping off the treadmill returns to "walk onto it"), and a player who already has the progress
// a lesson teaches skips past it.
//
// Steps: 0 walk onto the treadmill, 1 run to the level goal, 2 walk out of the START portal,
// 3 swing on the hair over the lava and land on a slab, 4 reach the Lava Run's Win pad, 5 come back
// to the Hub, 6 buy the starter hair style. `c.done` (TUTORIAL.done) means finished.
//
// c: { onBelt, level, levelGoal, inHub, wins, hasStyle, crossed, done }
export function nextStep(step, c) {
  if (step >= c.done) return step
  switch (step) {
    case 0:
    case 1:
      if (c.level >= c.levelGoal) return 2
      return c.onBelt ? 1 : 0
    case 2:
      return c.inHub ? 2 : 3
    case 3:
      if (c.crossed) return 4 // rode the hair and is standing on a slab again
      return c.inHub ? 2 : 3
    case 4:
      if (c.wins >= 1) return c.inHub ? 6 : 5
      return 4 // a fall back to the Hub keeps the goal: the trail leads the way back out
    case 5:
      return c.inHub ? 6 : 5
    case 6:
      return c.hasStyle || c.wins < 1 ? c.done : 6
    default:
      return step
  }
}
