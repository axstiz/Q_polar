# Mobile adaptation — идеи и план

## Главные проблемы

1. **SVG 2433×1520** — на экране 375px текст внутри SVG становится ~7px, блоки ~5px, нажать невозможно
2. **Hover-анимации** — `mouseenter`/`mouseleave` не работают на тач-устройствах
3. **552 КБ SVG** — тяжело для мобильных сетей
4. **Нет ни одного `@media`** — сайт не адаптирован под мобильные

---

## Стратегия A — заменить SVG на мобильную навигацию (рекомендуется)

На мобильных скрыть SVG-схему, показать список стихов с иерархией:

```
Intro
└─ Coal
   ├─ Settings → Blaze → Blue screen
   └─ Face id → tRace → Lastick
Collapse
```

Плюсы: отличный UX на телефоне, быстрая загрузка
Минусы: два разных UI

## Стратегия B — оставить SVG, доработать

- touch-события дублируют hover
- pinch-to-zoom / кнопка "+" для увеличения
- @media (pointer: coarse) переключение поведения
- prefers-reduced-motion

Очень сложно, UX на телефоне всё равно страдает.

## Стратегия C — гибрид: SVG + плавающая панель

SVG как обзорная карта + плавающее меню со списком стихов внизу.

---

## Анимации на мобильных (без наведения)

Детекция тач-устройства:

```js
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
```

На мобильных все `.animate`-классы добавляются сразу при загрузке страницы:

```js
if (isTouchDevice) {
  document.querySelectorAll(
    '.intro-dots, .coal-elements, .settings-effects, .blaze-flames, ' +
    '.blue-screen-effects, .face-id-effects, .trace-border-line, .trace-blood-drop'
  ).forEach(el => el.classList.add('animate'));
}
```

### Волновой эффект (cascading activation)

Вместо мгновенного всего — эффекты включаются по цепочке с задержкой, создавая волну по схеме:

```js
if (isTouchDevice) {
  const cascade = [
    { selector: '.intro-dots', delay: 0 },
    { selector: '.coal-elements', delay: 600 },
    { selector: '.settings-effects', delay: 1200 },
    { selector: '.blaze-flames', delay: 1800 },
    { selector: '.blue-screen-effects', delay: 2400 },
    { selector: '.face-id-effects', delay: 1200 },
    { selector: '.trace-border-line', delay: 1800 },
    { selector: '.trace-blood-drop', delay: 2400 },
  ];
  cascade.forEach(({ selector, delay }) => {
    setTimeout(() => {
      document.querySelectorAll(selector).forEach(el => el.classList.add('animate'));
    }, delay);
  });
}
```

### Нюансы по блокам

| Блок | Поведение на мобильных |
|---|---|
| **intro-dots** | Зациклены — отлично |
| **coal-elements** | Зациклены — отлично |
| **settings-effects** | Пульсируют — отлично |
| **blaze-flames** | Зациклены — отлично |
| **blue-screen-effects** | Трещины прорастают однократно, потом глитч — норм |
| **face-id-effects** | unlock через 1.5с. На мобильных: либо убрать задержку, либо зациклить scan без unlock |
| **trace-border-line** | Однократная обводка — норм |
| **trace-blood-drop** | Одноразовая анимация (1.2с и гаснет). На мобильных зациклить через `animation-iteration-count: infinite` |

---

## Что нужно будет сделать

1. Медиа-запросы (`@media (max-width: 768px)`, `(max-width: 480px)`)
2. Адаптировать PoemLayout — шрифты, паддинги, стрелки
3. Touch-события в FlowDiagram.astro
4. `prefers-reduced-motion` для производительности
5. Оптимизация SVG (удалить лишнее, упростить пути)
