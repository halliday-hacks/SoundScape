// SoundScape Pixel World Engine
// Draws a 50×25 tile pixel art biome that reacts to audio classification.
// Pass Classification updates via setClassification() — state lerps smoothly.

export interface Classification {
  birds: number;        // 0–1
  insects: number;      // 0–1
  rain: number;         // 0–1
  traffic: number;      // 0–1
  music: number;        // 0–1
  construction: number; // 0–1
  silence: number;      // 0–1
  biodiversityScore: number; // 0–100
  dominantClass: string;
}

// ---------------------------------------------------------------------------
// Colour utilities
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

// ---------------------------------------------------------------------------
// Colour palettes — 4 biodiversity tiers
// ---------------------------------------------------------------------------

interface Palette {
  skyTop: string;
  skyBottom: string;
  grass: string;
  grassDark: string;
  dirt: string;
  stone: string;
  leafA: string;
  leafB: string;
  leafC: string;
  trunk: string;
}

const P_LUSH: Palette = {
  skyTop: '#3A7EC8',    // bright mid-day blue
  skyBottom: '#8EC8F0', // soft horizon blue
  grass: '#6B7C3A',     // muted olive — not #4CAF50, more natural
  grassDark: '#4E5C28', // deeper olive
  dirt: '#9B7B52',      // warm sandy brown
  stone: '#8A9BAA',     // cool stone
  leafA: '#4A6B2A',     // deep olive foliage
  leafB: '#3A5520',     // darker olive
  leafC: '#5C7A35',     // olive highlight
  trunk: '#6B4423',     // warm brown trunk
};

const P_MODERATE: Palette = {
  skyTop: '#5B8FC0',    // slightly hazier blue
  skyBottom: '#A0C8E0', // pale hazy horizon
  grass: '#7A8A4A',     // dusty sage
  grassDark: '#5A6835', // deeper sage
  dirt: '#8B7050',      // warm earth
  stone: '#8A9CAA',     // grey stone
  leafA: '#5A6A35',     // muted sage leaf
  leafB: '#455228',     // dark sage
  leafC: '#6A7A40',     // sage highlight
  trunk: '#6B4423',     // brown trunk
};

const P_DEGRADED: Palette = {
  skyTop: '#8A9BAA',    // overcast grey sky
  skyBottom: '#B8C8D0', // pale grey horizon
  grass: '#8A7A5A',     // dry straw/dust
  grassDark: '#6A5C40', // darker dust
  dirt: '#8B6B48',      // dry cracked earth
  stone: '#7A8A90',     // worn stone
  leafA: '#7A7040',     // dying olive leaf
  leafB: '#5C5530',     // dry leaf
  leafC: '#8A7A48',     // dust highlight
  trunk: '#5C4030',     // dry trunk
};

const P_DEAD: Palette = {
  skyTop: '#6A7A84',    // ashen overcast sky
  skyBottom: '#9AAAB4', // pale ashen horizon
  grass: '#6A6050',     // ash/dust ground
  grassDark: '#504840', // dark ash
  dirt: '#604C3C',      // dark dry earth
  stone: '#686878',     // dark stone
  leafA: '#6A6050',     // dead leaf
  leafB: '#504840',     // dead dark leaf
  leafC: '#706858',     // dead highlight
  trunk: '#484038',     // dead trunk
};

function lerpPalette(a: Palette, b: Palette, t: number): Palette {
  const result = {} as Palette;
  for (const k of Object.keys(a) as (keyof Palette)[]) {
    result[k] = lerpColor(a[k], b[k], t);
  }
  return result;
}

function getPalette(bio: number): Palette {
  if (bio >= 70) return P_LUSH;
  if (bio >= 40) return lerpPalette(P_MODERATE, P_LUSH, (bio - 40) / 30);
  if (bio >= 10) return lerpPalette(P_DEGRADED, P_MODERATE, (bio - 10) / 30);
  return lerpPalette(P_DEAD, P_DEGRADED, bio / 10);
}

// ---------------------------------------------------------------------------
// World entity types
// ---------------------------------------------------------------------------

interface Tree {
  col: number;
  height: number;
  targetHeight: number;
  leafA: string;
  leafB: string;
  leafC: string;
}

interface Flower {
  col: number;
  color: string;
  bloom: number;
  targetBloom: number;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  type: 'rain' | 'dust' | 'firefly';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GW = 50;
const GH = 25;
const T  = 16;
const GROUND = 17;
const CW = GW * T;   // 800
const CH = GH * T;   // 400

const LEAF_SETS = [
  ['#4A6B2A', '#3A5520', '#5C7A35'],
  ['#506030', '#3C4A22', '#617240'],
  ['#456028', '#34481E', '#587035'],
  ['#4E6832', '#3A5025', '#607840'],
] as const;

const FLOWER_COLORS  = ['#e83535', '#f5c518', '#8b35e8', '#ff69b4', '#FF6B6B', '#FFD700'];
const BUTTERFLY_COLORS = ['#FF6B6B', '#FFE66D', '#A8E6CF', '#ff69b4', '#87CEEB'];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class PixelWorldEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;
  private frame = 0;

  private trees: Tree[] = [];
  private flowers: Flower[] = [];
  private clouds: Cloud[] = [];
  private particles: Particle[] = [];

  private cur: Classification;
  private tgt: Classification;
  private bioScore: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width  = CW;
    canvas.height = CH;
    this.ctx = canvas.getContext('2d')!;

    const init: Classification = {
      birds: 0.35, insects: 0.25, rain: 0.1, traffic: 0,
      music: 0, construction: 0, silence: 0.3,
      biodiversityScore: 58, dominantClass: 'birds',
    };
    this.cur = { ...init };
    this.tgt = { ...init };
    this.bioScore = init.biodiversityScore;

    this.initClouds();
    this.seedWorld();
  }

  private seedWorld() {
    const cols = [7, 18, 29];
    for (const col of cols) {
      const h = 3 + Math.random() * 2;
      const leaves = LEAF_SETS[Math.floor(Math.random() * LEAF_SETS.length)];
      this.trees.push({ col, height: h, targetHeight: h, leafA: leaves[0], leafB: leaves[1], leafC: leaves[2] });
    }
    for (let i = 0; i < 5; i++) {
      this.flowers.push({
        col: Math.floor(Math.random() * GW),
        color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)],
        bloom: 0.8 + Math.random() * 0.2,
        targetBloom: 1,
      });
    }
  }

  private initClouds() {
    this.clouds = [
      { x: 60,  y: 20, w: 88,  h: 28, speed: 0.14 },
      { x: 270, y: 45, w: 72,  h: 22, speed: 0.19 },
      { x: 480, y: 28, w: 105, h: 32, speed: 0.11 },
      { x: 680, y: 52, w: 78,  h: 26, speed: 0.17 },
    ];
  }

  setClassification(c: Classification) { this.tgt = { ...c }; }

  // ─── Update ────────────────────────────────────────────────────────────────

  private update() {
    const s = 0.018;
    const keys = ['birds','insects','rain','traffic','music','construction','silence','biodiversityScore'] as const;
    for (const k of keys) (this.cur[k] as number) = lerp(this.cur[k] as number, this.tgt[k] as number, s);
    this.cur.dominantClass = this.tgt.dominantClass;
    this.bioScore = lerp(this.bioScore, this.tgt.biodiversityScore, s);

    // Trees
    const wantTrees = Math.round(this.cur.birds * 8);
    const liveTrees = this.trees.filter(t => t.targetHeight > 0);
    while (liveTrees.length < wantTrees) {
      const used = new Set(this.trees.flatMap(t => [t.col-1, t.col, t.col+1, t.col+2]));
      let col = 0, tries = 0;
      do { col = 2 + Math.floor(Math.random() * (GW - 5)); tries++; } while (used.has(col) && tries < 60);
      const h = 3 + Math.floor(Math.random() * 3);
      const leaves = LEAF_SETS[Math.floor(Math.random() * LEAF_SETS.length)];
      const t: Tree = { col, height: 0, targetHeight: h, leafA: leaves[0], leafB: leaves[1], leafC: leaves[2] };
      this.trees.push(t); liveTrees.push(t);
    }
    const trafficKill = this.cur.traffic > 0.5 ? Math.floor((this.cur.traffic - 0.5) * liveTrees.length * 2) : 0;
    for (let i = Math.max(0, wantTrees - trafficKill); i < this.trees.length; i++) this.trees[i].targetHeight = 0;
    for (const t of this.trees) t.height = lerp(t.height, t.targetHeight, 0.025);
    this.trees = this.trees.filter(t => !(t.targetHeight === 0 && t.height < 0.12));

    // Flowers
    const wantFlowers = Math.round(this.cur.insects * 15);
    const liveFlowers = this.flowers.filter(f => f.targetBloom > 0);
    while (liveFlowers.length < wantFlowers) {
      const f: Flower = { col: Math.floor(Math.random() * GW), color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)], bloom: 0, targetBloom: 1 };
      this.flowers.push(f); liveFlowers.push(f);
    }
    for (let i = wantFlowers; i < liveFlowers.length; i++) liveFlowers[i].targetBloom = 0;
    for (const f of this.flowers) f.bloom = lerp(f.bloom, f.targetBloom, 0.04);
    this.flowers = this.flowers.filter(f => !(f.targetBloom === 0 && f.bloom < 0.05));

    // Particles
    if (this.cur.rain > 0.2) {
      for (let i = 0; i < Math.ceil(this.cur.rain * 7); i++)
        this.particles.push({ x: Math.random() * (CW + 40), y: 0, vx: -0.6, vy: 5 + Math.random() * 3, life: 1, type: 'rain' });
    }
    if (this.cur.traffic > 0.2 || this.cur.construction > 0.2) {
      for (let i = 0; i < Math.ceil(Math.max(this.cur.traffic, this.cur.construction) * 4); i++)
        this.particles.push({ x: Math.random() * CW, y: GROUND * T + Math.random() * 24, vx: (Math.random()-0.5)*1.2, vy: -0.3 - Math.random()*0.7, life: 1, type: 'dust' });
    }
    if (this.bioScore > 65 && this.cur.insects > 0.3 && this.frame % 9 === 0)
      this.particles.push({ x: 20 + Math.random()*(CW-40), y: (GROUND-5)*T + Math.random()*T*3, vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.3, life: 1, type: 'firefly' });

    const decay: Record<Particle['type'], number> = { rain: 0.055, dust: 0.014, firefly: 0.007 };
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.life -= decay[p.type]; }
    this.particles = this.particles.filter(p => p.life > 0 && p.y < CH && p.x > -10 && p.x < CW + 10);
    if (this.particles.length > 280) this.particles.splice(0, this.particles.length - 280);

    const windBoost = 1 + this.cur.rain * 2.5;
    for (const c of this.clouds) { c.x += c.speed * windBoost; if (c.x > CW + 130) c.x = -130; }
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────

  private draw() {
    const ctx = this.ctx;
    const p = getPalette(this.bioScore);

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND * T);
    skyGrad.addColorStop(0, p.skyTop);
    skyGrad.addColorStop(1, p.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CW, GROUND * T);

    if (this.cur.traffic > 0.25) {
      ctx.fillStyle = `rgba(50,50,50,${(this.cur.traffic - 0.25) * 0.55})`;
      ctx.fillRect(0, 0, CW, GROUND * T);
    }
    if (this.cur.silence > 0.55) {
      ctx.fillStyle = `rgba(160,190,210,${(this.cur.silence - 0.55) * 0.22})`;
      ctx.fillRect(0, 0, CW, GROUND * T);
    }

    // Clouds
    ctx.fillStyle = `rgba(255,255,255,${0.72 + this.cur.rain * 0.15})`;
    for (const c of this.clouds) this.drawCloud(c.x, c.y, c.w, c.h);

    // Rain
    ctx.fillStyle = 'rgba(120,160,220,0.6)';
    for (const pp of this.particles) {
      if (pp.type !== 'rain') continue;
      ctx.fillRect(pp.x, pp.y, 1, Math.round(4 * pp.life + 2));
    }

    // Underground
    ctx.fillStyle = p.stone;
    ctx.fillRect(0, (GROUND + 2) * T, CW, (GH - GROUND - 2) * T);
    ctx.fillStyle = p.dirt;
    ctx.fillRect(0, (GROUND + 1) * T, CW, T + 3);
    ctx.fillStyle = p.stone;
    for (let gx = 1; gx < GW; gx += 5) {
      ctx.fillRect(gx * T + 5, (GROUND + 1) * T + 5, 3, 3);
      ctx.fillRect(gx * T + 10, (GROUND + 2) * T + 8, 2, 2);
    }

    // Grass
    const grassNow = this.cur.traffic > 0.5 ? lerpColor(p.grass, '#3E2723', (this.cur.traffic - 0.5) * 2) : p.grass;
    ctx.fillStyle = grassNow;
    ctx.fillRect(0, GROUND * T, CW, T);
    ctx.fillStyle = p.grassDark;
    ctx.fillRect(0, (GROUND + 1) * T, CW, 3);
    for (let gx = 0; gx < GW; gx += 3) {
      ctx.fillRect(gx * T + 1, GROUND * T, 2, 4);
      ctx.fillRect(gx * T + T / 2, GROUND * T, 1, 3);
    }

    // Cracks
    const crackStrength = Math.max(this.cur.traffic, this.cur.construction);
    if (crackStrength > 0.35) {
      ctx.strokeStyle = `rgba(20,10,5,${(crackStrength - 0.35) * 0.7})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.floor(crackStrength * 14); i++) {
        const cx = ((i * 157 + 11) % (GW - 3)) * T + 4;
        ctx.beginPath();
        ctx.moveTo(cx, GROUND * T + 4);
        ctx.lineTo(cx + T * 0.35, GROUND * T + T * 0.65);
        ctx.lineTo(cx + T * 0.75, GROUND * T + T * 0.2);
        ctx.stroke();
      }
    }

    // Puddles
    if (this.cur.rain > 0.3) {
      ctx.fillStyle = `rgba(70,120,170,${(this.cur.rain - 0.3) * 0.55})`;
      for (let gx = 4; gx < GW - 4; gx += 10) ctx.fillRect(gx * T + 2, (GROUND + 1) * T - 3, T * 2, 3);
    }

    // Flowers
    for (const f of this.flowers) {
      if (f.bloom < 0.05) continue;
      const fx = f.col * T + T / 2;
      const fy = GROUND * T;
      const stemH = T * 0.72 * f.bloom;
      const hr = T * 0.32 * f.bloom;
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(fx - 1, fy - stemH, 2, stemH);
      ctx.fillStyle = f.color;
      ctx.fillRect(fx - hr, fy - stemH - hr * 0.4, hr * 2, hr * 0.5);
      ctx.fillRect(fx - hr * 0.4, fy - stemH - hr, hr * 0.5, hr * 2);
      ctx.fillStyle = '#FFF9C4';
      ctx.fillRect(fx - hr * 0.2, fy - stemH - hr * 0.2, hr * 0.4, hr * 0.4);
    }

    // Trees
    for (const tree of this.trees) {
      if (tree.height < 0.12) continue;
      const tx = tree.col * T;
      const groundY = GROUND * T;
      const trunkH = tree.height * T;
      const trunkW = Math.max(2, Math.round(T * 0.35));

      ctx.fillStyle = p.trunk;
      ctx.fillRect(Math.round(tx + T * 0.32), Math.round(groundY - trunkH), trunkW, Math.round(trunkH));
      ctx.fillStyle = lerpColor(p.trunk, '#ffffff', 0.18);
      ctx.fillRect(Math.round(tx + T * 0.32), Math.round(groundY - trunkH), 1, Math.round(trunkH * 0.75));

      if (tree.height > 1.0) {
        const leafTop = Math.round(groundY - trunkH - T * 1.9);
        const lw = Math.round(T * 2.8);
        ctx.fillStyle = tree.leafB;
        ctx.fillRect(Math.round(tx - T * 0.4), leafTop + T, lw + T, Math.round(T * 1.1));
        ctx.fillStyle = tree.leafA;
        ctx.fillRect(Math.round(tx - T * 0.2), leafTop + Math.round(T * 0.4), lw + Math.round(T * 0.4), Math.round(T * 0.9));
        ctx.fillRect(Math.round(tx + T * 0.1), leafTop + Math.round(T * 0.1), Math.round(lw * 0.85), Math.round(T * 0.7));
        ctx.fillRect(Math.round(tx + T * 0.35), leafTop, Math.round(lw * 0.55), Math.round(T * 0.55));
        ctx.fillStyle = tree.leafC;
        ctx.fillRect(Math.round(tx + T * 0.45), leafTop + Math.round(T * 0.05), Math.round(T * 0.55), Math.round(T * 0.3));
      }
    }

    // Birds
    if (this.cur.birds > 0.2) {
      const bCount = Math.ceil(this.cur.birds * 4);
      for (let b = 0; b < bCount; b++) {
        const bx = Math.round((this.frame * (0.55 + b * 0.28) + b * (CW / bCount)) % (CW + 60)) - 30;
        const by = Math.round((GROUND - 10 - b * 1.8) * T + Math.sin(this.frame * 0.04 + b * 1.2) * 7);
        this.drawBird(bx, by, Math.floor(this.frame / 10 + b * 3) % 2 === 0);
      }
    }

    // Butterflies
    if (this.cur.insects > 0.2) {
      const bfCount = Math.ceil(this.cur.insects * 4);
      for (let bf = 0; bf < bfCount; bf++) {
        const bfx = Math.round((80 + bf * (CW / bfCount) + Math.sin(this.frame * 0.022 + bf * 2.1) * 48) % CW);
        const bfy = Math.round((GROUND - 3.5) * T + Math.sin(this.frame * 0.038 + bf * 1.7) * 16);
        this.drawButterfly(bfx, bfy, Math.floor(this.frame / 7 + bf * 2) % 2, BUTTERFLY_COLORS[bf % BUTTERFLY_COLORS.length]);
      }
    }

    // Dust
    for (const pp of this.particles) {
      if (pp.type !== 'dust') continue;
      ctx.fillStyle = `rgba(139,94,60,${pp.life * 0.32})`;
      ctx.fillRect(Math.round(pp.x), Math.round(pp.y), Math.round(2 + pp.life * 2), Math.round(2 + pp.life * 2));
    }

    // Fireflies
    const ffPulse = (Math.sin(this.frame * 0.11) + 1) / 2;
    for (const pp of this.particles) {
      if (pp.type !== 'firefly') continue;
      const a = pp.life * ffPulse;
      ctx.fillStyle = `rgba(255,248,80,${a})`;
      ctx.fillRect(Math.round(pp.x), Math.round(pp.y), 2, 2);
      ctx.fillStyle = `rgba(255,255,150,${a * 0.28})`;
      ctx.fillRect(Math.round(pp.x) - 2, Math.round(pp.y) - 2, 6, 6);
    }
  }

  private drawCloud(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillRect(x, y + h * 0.42, w, h * 0.58);
    ctx.fillRect(x + w * 0.1,  y + h * 0.18, w * 0.65, h * 0.52);
    ctx.fillRect(x + w * 0.28, y,             w * 0.44, h * 0.42);
    ctx.fillRect(x + w * 0.68, y + h * 0.22,  w * 0.27, h * 0.38);
  }

  private drawBird(x: number, y: number, wingUp: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = '#222222';
    if (wingUp) {
      ctx.fillRect(x - 5, y,     4, 2);
      ctx.fillRect(x - 1, y - 2, 3, 2);
      ctx.fillRect(x + 2, y,     4, 2);
    } else {
      ctx.fillRect(x - 5, y + 2, 4, 2);
      ctx.fillRect(x - 1, y,     3, 2);
      ctx.fillRect(x + 2, y + 2, 4, 2);
    }
  }

  private drawButterfly(x: number, y: number, phase: number, color: string) {
    const ctx = this.ctx;
    if (phase === 0) {
      ctx.fillStyle = color;
      ctx.fillRect(x - 7, y - 3, 5, 7);
      ctx.fillRect(x + 2, y - 3, 5, 7);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x - 3, y - 2, 3, 5);
      ctx.fillRect(x,     y - 2, 3, 5);
    }
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 1, y - 4, 2, 8);
  }

  start() {
    const loop = () => { this.frame++; this.update(); this.draw(); this.rafId = requestAnimationFrame(loop); };
    this.rafId = requestAnimationFrame(loop);
  }
  stop()    { cancelAnimationFrame(this.rafId); }
  destroy() { this.stop(); }
}
