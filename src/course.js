// The course behind the START portal: floating stud platforms over a slime
// pool north of the lobby. Hair gates block the way until you have grown
// enough hair; bounce pads launch you to the upper section; the gold finish
// pad awards a Win and sends you home. Touching the slime respawns you at
// the last checkpoint.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, TorusGeometry } from 'three'
import { makeCanvas, studMaterial, texture } from './lobby/paint.js'
import { label } from './lobby/labels.js'

const COURSE_Z = -44 // everything north of this is the course
const SLIME_Y = 0.6

// [x, top y, z, w, d, colour]
const PLATFORMS = [
  [0, 3, -70, 10, 10, '#2f7dff'], // start
  [0, 3, -79, 4, 4, '#ff4fb4'],
  [3.5, 3.6, -85, 3.5, 3.5, '#ffd21a'],
  [-0.5, 4.2, -91, 3.5, 3.5, '#45d16a'],
  [-4, 4.8, -97, 3, 3, '#2f7dff'],
  [0, 5, -105, 8, 6, '#ffffff'], // checkpoint 1
  [0, 5, -114, 4, 12, '#a8a4f2'], // bridge through gate 1
  [0, 5, -124, 4.5, 4.5, '#45d16a'], // bounce pad deck
  [0, 9.5, -132, 7, 5, '#ff4fb4'],
  [0, 9.5, -139.5, 1.4, 10, '#ffd21a'], // beam
  [4, 9.5, -144, 9.4, 1.4, '#ffd21a'], // beam
  [8, 9.5, -149, 1.4, 9, '#ffd21a'], // beam
  [6, 9.5, -157, 8, 6, '#ffffff'], // checkpoint 2
  [6, 9.5, -166, 4, 12, '#a8a4f2'], // bridge through gate 2
  [2, 10.1, -175, 3, 3, '#2f7dff'],
  [-2.5, 10.7, -179, 3, 3, '#ff4fb4'],
  [1, 11.3, -183.5, 3, 3, '#45d16a'],
  [0, 11.3, -190, 10, 7, '#ffcf1a'], // finish
]
const CHECKPOINTS = [
  { x: 0, y: 3.3, z: -68 },
  { x: 0, y: 5.3, z: -104 },
  { x: 6, y: 9.8, z: -156 },
]
// Hair gates: a wall of hair across a bridge; it drops once you have `need` hair.
const GATES = [
  { x: 0, y: 5, z: -112, w: 4.4, need: 10 },
  { x: 6, y: 9.5, z: -164, w: 4.4, need: 25 },
  { x: 0, y: 11.3, z: -186.4, w: 10.2, need: 45 },
]
const BOUNCE = { x: 0, y: 5, z: -124, r: 1.6, speed: 15.5 }
const FINISH = { x: 0, y: 11.3, z: -190.5, w: 9, d: 5 }

function paintSlime() {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2ec9e8'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 60; i++) {
    const x = (i * 97) % 256
    const y = (i * 61) % 256
    const r = 6 + ((i * 13) % 18)
    ctx.fillStyle = i % 3 ? 'rgba(200,255,255,0.35)' : 'rgba(10,120,170,0.3)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return texture(c, { repeat: [60, 30] })
}

export function buildCourse(scene, addCollider) {
  const g = new Group()
  g.name = 'course'
  scene.add(g)

  const slimeMap = paintSlime()
  const slime = new Mesh(
    new PlaneGeometry(400, 170),
    new MeshStandardMaterial({ map: slimeMap, roughness: 0.2, emissive: '#0fa8d0', emissiveIntensity: 0.3 }),
  )
  slime.rotation.x = -Math.PI / 2
  slime.position.set(0, SLIME_Y, -122)
  slime.receiveShadow = true
  g.add(slime)

  for (const [x, top, z, w, d, col] of PLATFORMS) {
    const h = 1
    const m = new Mesh(new BoxGeometry(w, h, d), studMaterial(col, Math.max(w, d), Math.min(w, d)))
    m.position.set(x, top - h / 2, z)
    m.castShadow = m.receiveShadow = true
    g.add(m)
    addCollider(x, z, w, d, top, 0, top - h)
    // Support column down into the slime.
    if (w >= 3 && d >= 3) {
      const col2 = new Mesh(new CylinderGeometry(0.35, 0.45, top - 1 - SLIME_Y + 0.2, 10), new MeshStandardMaterial({ color: '#7a8aa0', roughness: 0.7 }))
      col2.position.set(x, (top - 1 + SLIME_Y) / 2, z)
      g.add(col2)
    }
  }

  // Grand staircase from the lobby's START doorway up to the start platform (no teleport).
  const stairMat = studMaterial('#2f7dff', 6, 8)
  const STAIR_W = 8
  const STAIR_Z0 = -34.5
  for (let i = 1; i <= 6; i++) {
    const end = COURSE_Z - (i - 1) * 4.2
    const d = STAIR_Z0 - end
    const top = 0.5 * i
    const m = new Mesh(new BoxGeometry(STAIR_W, top, d), stairMat)
    m.position.set(0, top / 2, (STAIR_Z0 + end) / 2)
    m.castShadow = m.receiveShadow = true
    g.add(m)
    addCollider(0, (STAIR_Z0 + end) / 2, STAIR_W, d, top)
  }

  // Pale towers in the distance (what the portal window shows).
  const towerMat = new MeshStandardMaterial({ color: '#9fd0f7', roughness: 0.8, emissive: '#bfe4ff', emissiveIntensity: 0.25 })
  for (const [x, z, w, h] of [[-55, -95, 10, 30], [58, -115, 12, 36], [-62, -160, 11, 40], [50, -175, 9, 28], [-30, -205, 14, 34], [34, -200, 10, 24], [70, -70, 8, 20], [-72, -60, 8, 22]]) {
    const t = new Mesh(new BoxGeometry(w, h, w), towerMat)
    t.position.set(x, h / 2, z)
    g.add(t)
  }

  // Checkpoint flags.
  const flagPole = new MeshStandardMaterial({ color: '#ffffff' })
  const flagCloth = new MeshStandardMaterial({ color: '#ffcf1a', roughness: 0.6 })
  for (const cp of CHECKPOINTS.slice(1)) {
    const pole = new Mesh(new CylinderGeometry(0.08, 0.08, 3, 8), flagPole)
    pole.position.set(cp.x + 3, cp.y + 1.2, cp.z)
    g.add(pole)
    const cloth = new Mesh(new BoxGeometry(1.2, 0.7, 0.05), flagCloth)
    cloth.position.set(cp.x + 3.6, cp.y + 2.3, cp.z)
    g.add(cloth)
  }

  // Hair gates.
  const hairMat = new MeshStandardMaterial({ color: '#c8782a', roughness: 0.6 })
  const hairDark = new MeshStandardMaterial({ color: '#a45f1c', roughness: 0.6 })
  const gates = GATES.map((gate) => {
    const wall = new Group()
    wall.position.set(gate.x, gate.y, gate.z)
    g.add(wall)
    const strands = Math.round(gate.w / 0.55)
    for (let i = 0; i < strands; i++) {
      const s = new Mesh(new BoxGeometry(0.5, 4.2, 1.6), i % 2 ? hairDark : hairMat)
      s.position.set(-gate.w / 2 + 0.275 + i * (gate.w / strands), 2.1, Math.sin(i * 1.3) * 0.12)
      s.castShadow = true
      wall.add(s)
    }
    // Thick enough that a slow frame (dt clamped to 0.1 s) can't step through it.
    const box = addCollider(gate.x, gate.z, gate.w, 2, gate.y + 4.2, 0, gate.y)
    const sign = label(g, [{ text: `🔒 ${gate.need} Hair`, size: 0.8, fill: ['#fff27a', '#ffb000'] }, { text: 'to pass', size: 0.5, fill: '#ffffff' }], [gate.x, gate.y + 5.4, gate.z + 1.2], { unit: 1.1 })
    return { ...gate, wall, box, sign, open: false, drop: 0 }
  })

  // Bounce pad.
  const pad = new Mesh(new CylinderGeometry(BOUNCE.r, BOUNCE.r, 0.2, 24), new MeshStandardMaterial({ color: '#3cff7a', emissive: '#18d14a', emissiveIntensity: 0.6 }))
  pad.position.set(BOUNCE.x, BOUNCE.y + 0.1, BOUNCE.z)
  g.add(pad)
  label(g, [{ text: 'JUMP PAD', size: 0.5, fill: ['#d6ff6a', '#45e01e'] }], [BOUNCE.x, BOUNCE.y + 2.2, BOUNCE.z], { unit: 1 })

  // Finish: trophy ring.
  const ring = new Mesh(new TorusGeometry(2.2, 0.3, 12, 40), new MeshStandardMaterial({ color: '#ffd21a', emissive: '#ffb000', emissiveIntensity: 0.6 }))
  ring.position.set(FINISH.x, FINISH.y + 3, FINISH.z)
  g.add(ring)
  label(g, [{ text: 'FINISH', size: 1, fill: ['#fff27a', '#ffb000'] }, { text: '+1 Win', size: 0.6, fill: '#ffffff' }], [FINISH.x, FINISH.y + 6.2, FINISH.z], { unit: 1.4 })
  label(g, [{ text: 'Hair Escape', size: 0.9, fill: ['#ffffff', '#cfe8ff'] }, { text: 'Grow hair to open the gates!', size: 0.45, fill: ['#fff27a', '#ffb000'] }], [0, 7.4, -74], { unit: 1.3 })

  let checkpoint = 0
  let finishedAt = -1

  return {
    start: CHECKPOINTS[0],
    inCourse: (p) => p.z < COURSE_Z,
    checkpoint: () => CHECKPOINTS[checkpoint],
    reset() {
      checkpoint = 0
      finishedAt = -1
    },
    // Returns events for main.js: 'fell' | 'checkpoint' | 'finish' | 'bounce' | { gate } | null
    update(dt, time, p, hair) {
      slimeMap.offset.y += dt * 0.02
      ring.rotation.y = time * 1.5
      pad.material.emissiveIntensity = 0.5 + Math.sin(time * 6) * 0.25
      const events = []
      for (const gate of gates) {
        if (!gate.open && hair >= gate.need) {
          gate.open = true
          gate.box.off = true
          gate.sign.set([{ text: 'OPEN!', size: 0.8, fill: ['#d6ff6a', '#45e01e'] }])
        } else if (gate.open && hair < gate.need) {
          // Rebirth reset the hair: gates close again.
          gate.open = false
          gate.box.off = false
          gate.sign.set([{ text: `🔒 ${gate.need} Hair`, size: 0.8, fill: ['#fff27a', '#ffb000'] }, { text: 'to pass', size: 0.5, fill: '#ffffff' }])
        }
        gate.drop += ((gate.open ? 1 : 0) - gate.drop) * (1 - Math.exp(-4 * dt))
        gate.wall.position.y = gate.y - gate.drop * 4.4
        if (!gate.open && Math.abs(p.z - gate.z) < 2.5 && Math.abs(p.x - gate.x) < gate.w / 2 + 1) events.push({ gate })
      }
      if (p.z >= COURSE_Z) return events
      if (p.y < SLIME_Y + 0.2) events.push('fell')
      for (let i = checkpoint + 1; i < CHECKPOINTS.length; i++) {
        const cp = CHECKPOINTS[i]
        if (Math.abs(p.x - cp.x) < 4 && Math.abs(p.z - cp.z) < 3 && Math.abs(p.y - cp.y) < 1.2) {
          checkpoint = i
          events.push('checkpoint')
        }
      }
      if (Math.hypot(p.x - BOUNCE.x, p.z - BOUNCE.z) < BOUNCE.r && Math.abs(p.y - BOUNCE.y) < 0.3) events.push('bounce')
      if (finishedAt < 0 && Math.abs(p.x - FINISH.x) < FINISH.w / 2 && Math.abs(p.z - FINISH.z) < FINISH.d / 2 && Math.abs(p.y - FINISH.y) < 1) {
        finishedAt = time
        events.push('finish')
      }
      return events
    },
    BOUNCE,
  }
}
