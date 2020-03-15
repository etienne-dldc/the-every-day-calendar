import FontFaceObserver from 'fontfaceobserver';
import vectorizeText from 'vectorize-text';
import store from 'store';

const range = x => new Array(x).fill(null).map((v, i) => i);

const app = document.getElementById('app');
const resetButton = document.getElementById('reset-button');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function isLeapYear(year) {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

const now = new Date();
const daysInFeb = isLeapYear(now.getFullYear()) ? 29 : 28;

const monthsSizes = [31, daysInFeb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const monthsNames = [
  'jan',
  'fev',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec'
];

const getInitialState = () =>
  monthsSizes.map((count, mouthIndex) => range(count).map(day => false));

if (store.get('calendar') === undefined) {
  store.set('calendar', getInitialState());
}

let state = store.get('calendar');

function isOn(pos) {
  return state[pos.x][pos.y];
}

function toggle(pos) {
  state[pos.x][pos.y] = !state[pos.x][pos.y];
  store.set('calendar', state);
}

function resetData() {
  const sure = window.confirm('This will reset the app and cannot be undone, are you sure ?');
  if (sure) {
    state = getInitialState();
    store.set('calendar', state);
    events.render();
  }
}

let events = {
  onClick: () => {},
  render: () => {}
};

function run() {
  const pixelRatio = window.devicePixelRatio;
  const winWidth = window.innerWidth * pixelRatio;

  const padding = winWidth * 0.06;
  const monthsNameRatio = 0.6;

  const gridX = (winWidth - padding * 2) / 12;
  const gridY = gridX * 0.75;
  const montheNameHeight = gridX * monthsNameRatio;
  const bottomMargin = 100;
  const height = montheNameHeight + gridY * Math.max(...monthsSizes) + padding * 2 + bottomMargin;
  const width = winWidth;

  const hexaRadius = gridX * 0.35;
  const hexaRounded = 0.1;

  canvas.width = width / pixelRatio;
  canvas.height = height / pixelRatio;

  const grid = monthsSizes
    .map((count, mouthIndex) => range(count).map(day => ({ x: mouthIndex, y: day })))
    .reduce((acc, arr) => acc.concat(arr), []);

  const fontPathCache = {};

  function fontPathPoly(text, size, fontWeight) {
    if (fontPathCache[text]) {
      return fontPathCache[text];
    }

    const polygons = vectorizeText(String(text), {
      font: 'Source Sans Pro',
      polygons: true,
      size: size,
      lineHeight: size,
      textAlign: 'center',
      textBaseline: 'alphabetic',
      fontWeight: fontWeight
    });

    fontPathCache[text] = polygons;
    return fontPathCache[text];
  }

  function fontPath(x, y, text, size, fontWeight = 300) {
    let textPath = '';
    fontPathPoly(text, size, fontWeight).forEach(loops => {
      loops.forEach(points => {
        const reverse = points.slice().reverse();
        var start = reverse[0];
        textPath += ' M ' + (x + start[0]) + ' ' + (y + start[1]);
        for (var i = 1; i < reverse.length; ++i) {
          var p = reverse[i];
          textPath += ' L ' + (x + p[0]) + ' ' + (y + p[1]);
        }
        textPath += ' L ' + (x + start[0]) + ' ' + (y + start[1]);
      });
    });

    return new Path2D(textPath);
  }

  function hexagonePath(x, y, radius, angle, rounded, reverse = false) {
    // ctx.beginPath();
    const angleStepSize = ((reverse ? -1 : 1) * (2 * Math.PI)) / 6;
    const roundedVal = radius * rounded;

    const path = new Path2D();

    for (let step = 0; step <= 5; step++) {
      const stepAngle = angle + step * angleStepSize;
      const stepX = x + (radius - roundedVal) * Math.cos(stepAngle);
      const stepY = y + (radius - roundedVal) * Math.sin(stepAngle);
      const p1angle = stepAngle - Math.PI / 6;
      const p1x = stepX + roundedVal * Math.cos(p1angle);
      const p1y = stepY + roundedVal * Math.sin(p1angle);
      const p2x = stepX + roundedVal * (2 / Math.sqrt(3)) * Math.cos(stepAngle);
      const p2y = stepY + roundedVal * (2 / Math.sqrt(3)) * Math.sin(stepAngle);
      const p3angle = stepAngle + Math.PI / 6;
      const p3x = stepX + roundedVal * Math.cos(p3angle);
      const p3y = stepY + roundedVal * Math.sin(p3angle);
      const action = step === 0 ? 'moveTo' : 'lineTo';
      if (reverse) {
        path[action](p3x, p3y);
        path.quadraticCurveTo(p2x, p2y, p1x, p1y, roundedVal);
      } else {
        path[action](p1x, p1y);
        path.quadraticCurveTo(p2x, p2y, p3x, p3y, roundedVal);
      }
    }

    path.closePath();

    return path;
  }

  function getCoord(pos) {
    return {
      x: padding + gridX / 2 + pos.x * gridX,
      y: montheNameHeight + padding + gridY / 2 + pos.y * gridY
    };
  }

  function light(x, y, size, power) {
    const lightGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    lightGradient.addColorStop(0, `rgb(248, 255, 160, ${power})`);
    lightGradient.addColorStop(0.3, `rgb(248, 255, 160, ${power})`);
    lightGradient.addColorStop(0.4, `rgb(248, 255, 160, ${power * 0.5})`);
    lightGradient.addColorStop(1, 'rgb(248, 255, 160, 0)');

    ctx.fillStyle = lightGradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
  }

  function lights(size) {
    grid.forEach(pos => {
      const { x, y } = getCoord(pos);
      const posIsOn = isOn(pos); // || true;
      light(x, y, size, posIsOn ? 1 : 0.1);
    });

    // months lights
    monthsNames.forEach((month, index) => {
      const y = padding + montheNameHeight * 0.3;
      const x = padding + gridX / 2 + index * gridX;
      const monthIsOn = state[index].indexOf(true) >= 0;
      light(x, y, size, monthIsOn ? 1 : 0.3);
    });
  }

  function gold() {
    grid.forEach(pos => {
      const { x, y } = getCoord(pos);
      ctx.strokeStyle = 'rgb(185, 178, 128)';
      ctx.lineWidth = hexaRadius * 0.03;
      ctx.stroke(hexagonePath(x, y, hexaRadius * 0.93, Math.PI / 6, hexaRounded));
      ctx.stroke(hexagonePath(x, y, hexaRadius * 0.86, Math.PI / 6, hexaRounded));
      ctx.stroke(hexagonePath(x, y, hexaRadius * 0.79, Math.PI / 6, hexaRounded));
      const path = hexagonePath(x, y, hexaRadius * 0.74, Math.PI / 6, hexaRounded, true);
      const textSize = Math.round(hexaRadius * 1.2);
      path.addPath(fontPath(x, y + textSize * 1.3, pos.y + 1, textSize, 400));
      ctx.fillStyle = 'rgba(185, 178, 128, 0.8)';
      ctx.fill(path);
      const goldCircle = (x, y, size) => {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
      };
      if (pos.y !== 0) {
        ctx.fillStyle = 'rgb(185, 178, 128)';
        ctx.beginPath();
        goldCircle(x - gridX * 0.15, y - gridY * 0.5, hexaRadius * 0.12);
        goldCircle(x + gridX * 0.15, y - gridY * 0.5, hexaRadius * 0.12);

        goldCircle(x - gridX * 0.3, y - gridY * 0.5, hexaRadius * 0.04);
        goldCircle(x + gridX * 0.3, y - gridY * 0.5, hexaRadius * 0.04);

        goldCircle(x - gridX * 0.23, y - gridY * 0.6, hexaRadius * 0.06);
        goldCircle(x + gridX * 0.23, y - gridY * 0.6, hexaRadius * 0.06);

        goldCircle(x - gridX * 0.23, y - gridY * 0.4, hexaRadius * 0.06);
        goldCircle(x + gridX * 0.23, y - gridY * 0.4, hexaRadius * 0.06);
      }
    });
  }

  function plate() {
    const path = new Path2D();

    path.moveTo(0, 0);
    path.lineTo(0, height);
    path.lineTo(width, height);
    path.lineTo(width, 0);
    path.closePath();

    grid.forEach(pos => {
      const { x, y } = getCoord(pos);
      path.addPath(hexagonePath(x, y, hexaRadius, Math.PI / 6, hexaRounded));
    });

    monthsNames.forEach((month, index) => {
      const y = padding;
      const x = padding + gridX / 2 + index * gridX;
      path.addPath(
        fontPath(x, y + montheNameHeight * 1.4, month, Math.round(hexaRadius * 1.5), 300)
      );
    });

    ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
    ctx.fill(path, 'evenodd');
  }

  function neon() {
    grid.forEach(pos => {
      if (!isOn(pos)) {
        return;
      }
      const { x, y } = getCoord(pos);
      const path = hexagonePath(x, y, hexaRadius * 0.85, Math.PI / 6, hexaRounded);
      ctx.lineWidth = hexaRadius * 1.5;
      ctx.strokeStyle = 'rgba(249, 253, 206, 0.02)';
      ctx.stroke(path);
      ctx.lineWidth = hexaRadius * 1;
      ctx.strokeStyle = 'rgba(249, 253, 206, 0.02)';
      ctx.stroke(path);
      ctx.lineWidth = hexaRadius * 0.6;
      ctx.strokeStyle = 'rgba(249, 253, 206, 0.02)';
      ctx.stroke(path);
      ctx.lineWidth = hexaRadius * 0.3;
      ctx.strokeStyle = 'rgba(249, 253, 206, 0.3)';
      ctx.stroke(path);
      ctx.lineWidth = hexaRadius * 0.2;
      ctx.strokeStyle = 'rgba(249, 253, 206, 0.5)';
      ctx.stroke(path);
    });
  }

  function render() {
    ctx.save();
    ctx.scale(1 / pixelRatio, 1 / pixelRatio);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    lights(gridX * 0.9);
    plate();
    gold();
    neon();

    ctx.restore();
  }

  events.onClick = function(event) {
    const pX = event.offsetX * pixelRatio;
    const pY = event.offsetY * pixelRatio;
    const pos = grid.find(pos => {
      const { x, y } = getCoord(pos);
      const dist = Math.sqrt(Math.pow(Math.abs(pX - x), 2) + Math.pow(Math.abs(pY - y), 2));
      return dist < hexaRadius;
    });
    if (pos) {
      toggle(pos);
      render();
    }
  };

  events.render = render;

  Promise.all([
    new FontFaceObserver('Source Sans Pro', {
      weight: 300
    }).load(),
    new FontFaceObserver('Source Sans Pro', {
      weight: 400
    }).load()
  ])
    .then(function() {
      render();
    })
    .catch(function() {
      render();
    });
}

document.addEventListener('click', e => {
  events.onClick(e);
});

window.addEventListener('resize', () => {
  run();
});

resetButton.addEventListener('click', () => {
  resetData();
});

app.appendChild(canvas);

run();
