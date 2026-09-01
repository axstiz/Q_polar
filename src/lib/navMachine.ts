/**
 * StateMachine для навигации между стихами по кнопкам консоли
 */

type NodeId =
  | 'intro'
  | 'coal'
  | 'settings'
  | 'blaze'
  | 'blue_screen'
  | 'collapse'
  | 'face_id'
  | 'trace'
  | 'lastick'
  | 'klyatva-exo';

interface PrevMap {
  [key: string]: string[];
}

/** Граф "вперёд" — откуда в какие ноды можно перейти */
const graph: Record<string, string[]> = {
  intro: ['coal'],
  coal: ['settings', 'face_id'],
  settings: ['blaze'],
  blaze: ['klyatva-exo', 'blue_screen'],
  blue_screen: ['collapse'],
  face_id: ['trace'],
  trace: ['lastick'],
  lastick: ['collapse'],
  collapse: [],
  'klyatva-exo': [],
};

/** Обратный граф — из каких нод приходят в текущую */
const prevMapData: PrevMap = {
  intro: [],
  coal: ['intro'],
  settings: ['coal'],
  blaze: ['settings'],
  blue_screen: ['blaze'],
  collapse: ['blue_screen', 'lastick'],
  face_id: ['coal'],
  trace: ['face_id'],
  lastick: ['trace'],
  'klyatva-exo': ['blaze'],
};

export interface NavTransition {
  /** Следующая нода при нажатии стрелки вправо (по умолчанию) */
  right?: string | 'none';
  /** Предыдущая нода при нажатии стрелки влево (точнее, чем history stack) */
  left?: string | null;
  /** Куда идти при нажатии ↑ */
  up?: string | 'none';
  /** Куда идти при нажатии ↓ */
  down?: string | 'none';
}

// ─── Карта переходов ────────────────────────────────────────────────
// right/left — умная логика на основе prev; up/down — явная карта
const map: Record<NodeId, NavTransition> = {
  intro:  { up: 'none', down: 'none' },  // стартовая
  coal:   { up: 'settings', down: 'face_id', right: 'none' },
  settings: {
    down: 'face_id',
    left: null, // ← coal
  },
  blaze: {
    up: 'klyatva-exo',
    down: 'trace',
    left: null, // ← settings
  },
  blue_screen: {
    down: 'lastick',
    left: null, // ← blaze
  },
  collapse: {
    left: null, // ← зависит от branch
  },
  face_id: {
    up: 'settings',
    left: null, // ← coal
  },
  trace: {
    up: 'blaze',
    left: null, // ← face_id
  },
  lastick: {
    up: 'blue_screen',
    left: null, // ← trace
  },
  'klyatva-exo': {
    down: 'blaze', // «мостик» → продолжение верхнего трека
    left: null,    // Blaze
  },
};

const PREV_MAPS = graph;

export class NavigationMachine {
  private _current: NodeId = 'intro';
  private history: NodeId[] = [];
  private listeners: Set<(node: NodeId) => void> = new Set();

  constructor() {}

  get current(): NodeId { return this._current; }
  get canGoBack(): boolean { return this.history.length > 0 || !!this.prevOf(this._current); }

  // ── Переходы ────────────────────────────────────────────────────
  /** Нажать → (right) */
  right(): boolean {
    const target = this.targetFor('right');
    if (target) {
      this.pushHistory();
      this._current = target;
      this.notify();
      return true;
    }
    return false; // end node
  }

  /** Нажать ← (left) */
  left(): boolean {
    const target = this.targetFor('left');
    if (target) {
      this.history.push(this._current);
      this._current = target;
      this.notify();
      return true;
    }
    return false;
  }

  /** Нажать ↑ */
  up(): boolean {
    const target = this.targetFor('up');
    if (target) {
      this._current = target;
      this.notify();
      return true;
    }
    return false;
  }

  /** Нажать ↓ */
  down(): boolean {
    const target = this.targetFor('down');
    if (target) {
      this._current = target;
      this.notify();
      return true;
    }
    return false;
  }

  /** Можно ли перейти по направлению dir (не меняя состояние) */
  canMove(dir: 'up' | 'down' | 'left' | 'right'): boolean {
    return this.targetFor(dir) !== undefined;
  }

  /** Открыть текущий стих */
  open(): string {
    const rawBase = import.meta.env.BASE_URL ?? '';
    const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
    const slug = SLUGS[this._current] ?? this._current;
    window.location.href = `${base}/poems/${slug}`;
    return this._current;
  }

  /** Сброс к Intro */
  reset(): void {
    if (this._current === 'intro') return;
    this._current = 'intro';
    this.history = [];
    this.notify();
  }

  isEndNode(): boolean {
    return !graph[this._current]?.length;
  }

  // ── Подписка ────────────────────────────────────────────────────
  subscribe(fn: (node: NodeId) => void): () => void {
    this.listeners.add(fn);
    fn(this._current);
    return () => { this.listeners.delete(fn); };
  }

  // ── Внутренние ─────────────────────────────────────────────────
  private notify(): void {
    for (const l of this.listeners) l(this._current);
  }

  /** Чистая логика цели перехода (без мутаций состояния) */
  private targetFor(dir: 'up' | 'down' | 'left' | 'right'): NodeId | undefined {
    const node = map[this._current];
    if (dir === 'up') {
      return (node?.up !== undefined && node.up !== 'none') ? node.up as NodeId : undefined;
    }
    if (dir === 'down') {
      return (node?.down !== undefined && node.down !== 'none') ? node.down as NodeId : undefined;
    }
    if (dir === 'left') {
      return this.prevOf(this._current);
    }
    const rightTarget = node?.right !== undefined
      ? node.right
      : (OVERRIDE_RIGHT[this._current] ?? this.rightDefaultChild(this._current));
    return (rightTarget && rightTarget !== 'none') ? rightTarget as NodeId : undefined;
  }

  pushHistory(): void {
    this.history.push(this._current);
  }

  /** Определяет куда идёт right по умолчанию (учитывает историю) */
  private rightDefaultChild(id: NodeId): string | undefined {
    const children = graph[id];
    if (!children?.length) return undefined;
    if (children.length === 1) return children[0!];
    // Две ветки: пытаемся определить по предыдущей ноде
    const prev = this.prevOf(id);
    if (prev === 'face_id') return 'face_id';
    if (prev === 'trace') return 'trace';
    if (prev === 'klyatva-exo') return 'klyatva-exo';
    if (prev === 'lastick') return 'lastick';
    // По умолчанию — первый ребёнок (верхняя ветка)
    return children[0!];
  }

  /** Возвращает предыдущую ноду (из prev-карты) либо берёт из стека истории */
  private prevOf(id: NodeId): NodeId | undefined {
    // Сначала проверим стек — если мы попали сюда через правый ход
    if (this.history.length > 0) {
      const reversed = [...this.history].reverse();
      // Ищем ближайшую ноду в истории, которая имеет id как следующего ребёнка
      for (const h of reversed) {
        const nextIds = graph[h];
        if (nextIds && nextIds.includes(id)) {
          return h;
        }
      }
    }
    return prevMapData[id]?.[0] ?? undefined;
  }
}

// Переопределения для правой кнопки (где default не совпадает с первой дочерней нодой)
const OVERRIDE_RIGHT: Partial<Record<NodeId, string>> = {
  blaze: 'blue_screen', // blaze.firstChild = klyatva, but continuation is blue_screen
};

// Slug-имена страниц (файлы в src/pages/poems/)
const SLUGS: Partial<Record<NodeId, string>> = {
  blue_screen: 'blue-screen',
  face_id: 'face-id',
};
