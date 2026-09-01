"use strict";

// Generates non-verbal reasoning (NVR) practice items for entry-test.html,
// in the general style of GL Assessment NVR papers: figure sequences
// ("what comes next?") and odd-one-out sets. Every question is built from
// plain geometric shapes rendered as small inline SVGs (shape type, size,
// rotation, solid-vs-outline shading) so correctness is guaranteed by
// construction, exactly like generate-maths-items.js — the "rule" that
// generates the correct answer is the same rule the description explains,
// there's no separate arithmetic to get wrong.
//
// Usage: node scripts/generate-nvr-items.js <out-file> <sequenceCount> <oddOneOutCount>

var fs = require("fs");

function rand(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr){
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function round(n){ return Math.round(n * 100) / 100; }
function normRot(d){ return ((d % 360) + 360) % 360; }

// ---------- Shape rendering ----------
var RADII = [16, 22, 28, 34, 40];
var ALL_SHAPES = ["circle", "triangle", "square", "pentagon", "hexagon", "star"];
var ROTATABLE = ["triangle", "square", "pentagon", "star"];
var SYMMETRY = { triangle: 120, square: 90, pentagon: 72, star: 72 };
var SHAPE_SIDES = { triangle: 3, square: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8 };

function polygonPoints(sides, radius){
  var pts = [];
  for (var i = 0; i < sides; i++){
    var angle = (-90 + i * (360 / sides)) * Math.PI / 180;
    pts.push(round(50 + radius * Math.cos(angle)) + "," + round(50 + radius * Math.sin(angle)));
  }
  return pts.join(" ");
}
function starPoints(spikes, outerR, innerR){
  var pts = [];
  var step = Math.PI / spikes;
  for (var i = 0; i < spikes * 2; i++){
    var r = i % 2 === 0 ? outerR : innerR;
    var angle = -Math.PI / 2 + i * step;
    pts.push(round(50 + r * Math.cos(angle)) + "," + round(50 + r * Math.sin(angle)));
  }
  return pts.join(" ");
}

// Sensible defaults so every attrs object is safe to render/key, whichever
// fields a given rule actually cares about.
function A(partial){
  return Object.assign({ shapeType: "circle", sides: null, radius: RADII[2], rotation: 0, fill: "solid" }, partial);
}

function shapeMarkup(attrs){
  var fillAttrs = attrs.fill === "solid"
    ? 'fill="currentColor" stroke="currentColor" stroke-width="2"'
    : 'fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  if (attrs.shapeType === "circle"){
    return '<circle cx="50" cy="50" r="' + attrs.radius + '" ' + fillAttrs + '/>';
  }
  if (attrs.shapeType === "star"){
    var starPts = starPoints(5, attrs.radius, attrs.radius * 0.42);
    return '<polygon points="' + starPts + '" ' + fillAttrs + ' transform="rotate(' + attrs.rotation + ' 50 50)"/>';
  }
  var sides = attrs.sides || SHAPE_SIDES[attrs.shapeType];
  var pts = polygonPoints(sides, attrs.radius);
  return '<polygon points="' + pts + '" ' + fillAttrs + ' transform="rotate(' + attrs.rotation + ' 50 50)"/>';
}
function svgFor(attrs){
  return '<svg viewBox="0 0 100 100" role="img" aria-hidden="true">' + shapeMarkup(attrs) + '</svg>';
}
function attrsKey(a){
  return [a.shapeType, a.sides || "", a.radius, a.rotation, a.fill].join("|");
}
function mutateAttrs(a){
  var pick = rand(0, 3);
  if (pick === 0) return A(Object.assign({}, a, { fill: a.fill === "solid" ? "outline" : "solid" }));
  if (pick === 1) return A(Object.assign({}, a, { rotation: normRot(a.rotation + choice([30, 45, 60, 90, 120])) }));
  if (pick === 2) return A(Object.assign({}, a, { radius: choice(RADII) }));
  return A(Object.assign({}, a, { shapeType: choice(ALL_SHAPES), sides: null }));
}

// ---------- Sequence ("what comes next?") rules ----------
// Each rule builds 4 known frames plus the correct 5th, then a handful of
// plausible-but-wrong candidates for the same slot (wrong direction, no
// change, one step too far, etc.) — finalizeSequence dedupes them and, if
// a rule's own candidates collide, pads out to 4 unique options with small
// attribute mutations of the correct answer.
function finalizeSequence(frames, correctAttrs, distractorCandidates, description){
  var options = [correctAttrs];
  var keys = {};
  keys[attrsKey(correctAttrs)] = true;
  distractorCandidates.forEach(function (d){
    if (options.length >= 4) return;
    var k = attrsKey(d);
    if (!keys[k]){ keys[k] = true; options.push(d); }
  });
  var guard = 0;
  while (options.length < 4 && guard < 50){
    guard++;
    var mutated = mutateAttrs(correctAttrs);
    var k = attrsKey(mutated);
    if (!keys[k]){ keys[k] = true; options.push(mutated); }
  }
  if (options.length < 4) return null;
  return {
    kind: "nvr", subject: "nvr", subKind: "sequence",
    prompt: choice(SEQUENCE_PROMPTS),
    framesSvg: frames.map(svgFor),
    options: options.map(svgFor),
    correct: 0,
    correctDescription: description
  };
}

function ruleRotationStep(){
  var shapeType = choice(ROTATABLE);
  var symmetry = SYMMETRY[shapeType];
  var stepOptions = [30, 40, 45, 50, 60, 70, 80].filter(function (s){ return symmetry % s !== 0; });
  var step = choice(stepOptions) * choice([1, -1]);
  var start = rand(0, 11) * 30;
  var frames = [0, 1, 2, 3].map(function (i){
    return A({ shapeType: shapeType, radius: RADII[2], rotation: normRot(start + i * step), fill: "solid" });
  });
  var correct = A({ shapeType: shapeType, radius: RADII[2], rotation: normRot(start + 4 * step), fill: "solid" });
  var distractors = [
    A({ shapeType: shapeType, radius: RADII[2], rotation: normRot(start + 4 * -step), fill: "solid" }), // reversed direction
    A({ shapeType: shapeType, radius: RADII[2], rotation: frames[3].rotation, fill: "solid" }), // no further change
    A({ shapeType: shapeType, radius: RADII[2], rotation: normRot(start + 5 * step), fill: "solid" }) // one step too far
  ];
  var description = "The " + shapeType + " turns " + Math.abs(step) + "° " + (step > 0 ? "clockwise" : "anticlockwise") + " each time.";
  return finalizeSequence(frames, correct, distractors, description);
}

function ruleSizeStep(){
  var shapeType = choice(ALL_SHAPES);
  var dir = choice([1, -1]);
  var indices = dir === 1 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  var radii = indices.map(function (i){ return RADII[i]; });
  var frames = radii.slice(0, 4).map(function (r){ return A({ shapeType: shapeType, radius: r, rotation: 0, fill: "solid" }); });
  var correct = A({ shapeType: shapeType, radius: radii[4], rotation: 0, fill: "solid" });
  var distractors = shuffle(RADII.filter(function (r){ return r !== radii[4]; }))
    .slice(0, 3)
    .map(function (r){ return A({ shapeType: shapeType, radius: r, rotation: 0, fill: "solid" }); });
  var description = "The " + shapeType + " gets " + (dir === 1 ? "bigger" : "smaller") + " by the same amount each time.";
  return finalizeSequence(frames, correct, distractors, description);
}

function ruleSidesStep(){
  var dir = choice([1, -1]);
  var startSides = dir === 1 ? 3 : 8;
  var sidesSeq = [0, 1, 2, 3, 4].map(function (i){ return startSides + i * dir; });
  var frames = sidesSeq.slice(0, 4).map(function (s){ return A({ shapeType: "polygon", sides: s, radius: RADII[2], rotation: 0, fill: "solid" }); });
  var correct = A({ shapeType: "polygon", sides: sidesSeq[4], radius: RADII[2], rotation: 0, fill: "solid" });
  var distractorSides = [sidesSeq[3], startSides + 5 * dir, startSides]
    .filter(function (s){ return s >= 3 && s <= 8 && s !== sidesSeq[4]; });
  var distractors = distractorSides.map(function (s){ return A({ shapeType: "polygon", sides: s, radius: RADII[2], rotation: 0, fill: "solid" }); });
  distractors.push(A({ shapeType: "circle", radius: RADII[2], rotation: 0, fill: "solid" })); // filler: no sides at all
  var description = "The number of sides " + (dir === 1 ? "increases" : "decreases") + " by one each time.";
  return finalizeSequence(frames, correct, distractors, description);
}

function ruleFillAlternate(){
  var shapeType = choice(ALL_SHAPES);
  var startFill = choice(["solid", "outline"]);
  var otherFill = startFill === "solid" ? "outline" : "solid";
  var frames = [0, 1, 2, 3].map(function (i){
    return A({ shapeType: shapeType, radius: RADII[2], rotation: 0, fill: i % 2 === 0 ? startFill : otherFill });
  });
  var correct = A({ shapeType: shapeType, radius: RADII[2], rotation: 0, fill: startFill }); // slot 4 (even) matches slot 0
  var altShape = choice(ALL_SHAPES.filter(function (s){ return s !== shapeType; }));
  var distractors = [
    A({ shapeType: shapeType, radius: RADII[2], rotation: 0, fill: otherFill }),
    A({ shapeType: altShape, radius: RADII[2], rotation: 0, fill: startFill }),
    A({ shapeType: altShape, radius: RADII[2], rotation: 0, fill: otherFill })
  ];
  var description = "The shading alternates between solid and outline each time — " + startFill + " comes next.";
  return finalizeSequence(frames, correct, distractors, description);
}

// ---------- Odd-one-out rules ----------
function finalizeOdd(majorityOptions, oddAttrs, description){
  var options = [oddAttrs].concat(majorityOptions);
  return {
    kind: "nvr", subject: "nvr", subKind: "oddoneout",
    prompt: choice(ODD_PROMPTS),
    options: options.map(svgFor),
    correct: 0,
    correctDescription: description
  };
}

var SPREAD_ROTATIONS = [0, 60, 120, 180, 240, 300];

function ruleOddFill(){
  var shapeType = choice(ALL_SHAPES);
  var majorityFill = choice(["solid", "outline"]);
  var oddFill = majorityFill === "solid" ? "outline" : "solid";
  var radii = shuffle(RADII).slice(0, 4);
  var rotations = shuffle(SPREAD_ROTATIONS).slice(0, 4);
  var options = radii.map(function (r, i){ return A({ shapeType: shapeType, radius: r, rotation: rotations[i], fill: majorityFill }); });
  var odd = A({ shapeType: shapeType, radius: RADII[2], rotation: 30, fill: oddFill });
  var description = "Four are " + majorityFill + " — one is " + oddFill + ".";
  return finalizeOdd(options, odd, description);
}

function ruleOddShape(){
  var majorityShape = choice(ALL_SHAPES);
  var oddShape = choice(ALL_SHAPES.filter(function (s){ return s !== majorityShape; }));
  var radii = shuffle(RADII).slice(0, 4);
  var rotations = shuffle(SPREAD_ROTATIONS).slice(0, 4);
  var options = radii.map(function (r, i){ return A({ shapeType: majorityShape, radius: r, rotation: rotations[i], fill: "solid" }); });
  var odd = A({ shapeType: oddShape, radius: RADII[2], rotation: 30, fill: "solid" });
  var description = "Four are " + majorityShape + "s — one is a " + oddShape + ".";
  return finalizeOdd(options, odd, description);
}

function ruleOddSize(){
  var shapeType = choice(ALL_SHAPES);
  var majorityRadius = choice(RADII.slice(1, 4));
  var biggerOrSmaller = choice([RADII[0], RADII[4]]);
  var oddRadius = biggerOrSmaller === majorityRadius ? (biggerOrSmaller === RADII[0] ? RADII[4] : RADII[0]) : biggerOrSmaller;
  var rotations = shuffle(SPREAD_ROTATIONS).slice(0, 4);
  var options = rotations.map(function (rot){ return A({ shapeType: shapeType, radius: majorityRadius, rotation: rot, fill: "solid" }); });
  var odd = A({ shapeType: shapeType, radius: oddRadius, rotation: 30, fill: "solid" });
  var description = "Four are the same size — one is " + (oddRadius > majorityRadius ? "bigger" : "smaller") + ".";
  return finalizeOdd(options, odd, description);
}

var SEQUENCE_PROMPTS = [
  "Which figure comes next in the sequence?",
  "Look at the pattern. What comes next?",
  "Which shape continues the sequence?",
  "What's the next figure in the pattern?"
];
var ODD_PROMPTS = [
  "Which one does not belong?",
  "Which figure is the odd one out?",
  "Four of these share something in common — which is the odd one out?",
  "Spot the one that doesn't match the others."
];

var SEQUENCE_RULES = [ruleRotationStep, ruleSizeStep, ruleSidesStep, ruleFillAlternate];
var ODD_RULES = [ruleOddFill, ruleOddShape, ruleOddSize];

function generateN(rules, count){
  var items = [];
  var seen = {};
  var guard = 0;
  while (items.length < count && guard < count * 60){
    guard++;
    var item = choice(rules)();
    if (!item) continue;
    var fp = item.subKind + "|" + (item.framesSvg || []).join("") + "|" + item.options.join("");
    if (seen[fp]) continue;
    seen[fp] = true;
    items.push(item);
  }
  return items;
}

var outFile = process.argv[2] || "nvr-items.json";
var sequenceCount = parseInt(process.argv[3], 10) || 110;
var oddCount = parseInt(process.argv[4], 10) || 110;

var sequenceItems = generateN(SEQUENCE_RULES, sequenceCount);
var oddItems = generateN(ODD_RULES, oddCount);
var all = sequenceItems.concat(oddItems);

fs.writeFileSync(outFile, JSON.stringify(all));
console.error("Generated " + sequenceItems.length + " sequence + " + oddItems.length + " odd-one-out = " + all.length + " NVR items -> " + outFile);
