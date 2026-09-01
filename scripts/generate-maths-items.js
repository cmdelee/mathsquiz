#!/usr/bin/env node
"use strict";

// Generates a large batch of new maths "short" and "mcq" entry-test items
// from parameterised templates. Every answer is *computed* from the same
// numbers used in the prompt, never hand-typed, so correctness is
// guaranteed by construction rather than by manual checking. Run with
// `node scripts/generate-maths-items.js` — prints two JS array literals
// (short items, then mcq items) to stdout, which get spliced into
// entry-test.html's ADVENTURE_ITEMS / BEACON_ITEMS arrays by hand.
//
// Each template function is called many times with fresh random
// parameters. A Set of prompt text seen so far discards any exact repeat
// (belt and braces — the ranges are wide enough that collisions should be
// rare, but two dice rolls can still land the same by chance).

function randInt(min, max){ return min + Math.floor(Math.random() * (max - min + 1)); }
function choice(arr){ return arr[randInt(0, arr.length - 1)]; }
function money(n){ return n.toFixed(2); }
function pluralise(n, word, plural){ return n === 1 ? word : (plural || (word + "s")); }
function article(word){ return /^[aeiou]/i.test(word) ? "an" : "a"; }
function esc(s){ return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

var NAMES = [
  "Amara","Ben","Priya","Callum","Dev","Ella","Farah","George","Hana","Ibrahim",
  "Jess","Kwame","Leah","Marcus","Nadia","Oscar","Rosa","Sam","Talia","Umar",
  "Violet","Will","Yasmin","Zach","Aisha","Freya","Elliot","Daisy","Ravi","Chloe",
  "Mo","Ana","Lucas","Nia","Theo","Zara","Finn","Isla","Owen","Maya"
];
function name(){ return choice(NAMES); }
function pron(n){
  // Deterministic per-name pronoun so a given name is consistent within one
  // item at least (not that it matters across items).
  var feminine = ["Amara","Priya","Ella","Farah","Hana","Jess","Leah","Nadia","Rosa","Talia",
    "Violet","Yasmin","Aisha","Freya","Daisy","Ana","Nia","Zara","Isla","Maya","Chloe"];
  return feminine.indexOf(n) !== -1 ? "she" : "he";
}
function poss(n){ return pron(n) === "she" ? "her" : "his"; }

var seenPrompts = new Set();
function dedupe(item){
  if (seenPrompts.has(item.prompt)) return null;
  seenPrompts.add(item.prompt);
  return item;
}

// ---------------------------------------------------------------------
// SHORT-ANSWER TEMPLATES
// ---------------------------------------------------------------------

var SHORT_TEMPLATES = [];

// 1. Two items + change from a note
SHORT_TEMPLATES.push(function(){
  var items = ["book","magazine","toy car","board game","puzzle","umbrella","water bottle","notebook",
    "cushion","picture frame","plant pot","football","scarf","hat","kite","torch","lunchbox","calendar"];
  var n = name();
  var p1 = randInt(100, 900) / 100;
  var p2 = randInt(100, 900) / 100;
  var note = choice([10, 20, 50]);
  if (p1 + p2 >= note) return null;
  var change = note - p1 - p2;
  var item1 = choice(items);
  var item2 = choice(items.filter(function(x){ return x !== item1; }));
  var prompt = n + " buys " + article(item1) + " " + item1 + " for £" + money(p1) + " and " + article(item2) + " " + item2 +
    " for £" + money(p2) + " and pays with a £" + note + " note. How much change does " + pron(n) + " get?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[money(change), "£" + money(change)],
    hint:"Give your answer in pounds and pence, e.g. " + money(change)
  });
});

// 2. N items at the same price
SHORT_TEMPLATES.push(function(){
  var items = ["pencils","erasers","stickers","badges","postcards","balloons","key rings","bookmarks","marbles","buttons"];
  var n = name();
  var count = randInt(3, 12);
  var price = randInt(15, 250) / 100;
  var total = count * price;
  var prompt = n + " buys " + count + " " + choice(items) + " costing £" + money(price) + " each. What is the total cost?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[money(total), "£" + money(total)],
    hint:"Give your answer in pounds and pence, e.g. " + money(total)
  });
});

// 3. Splitting a bill equally
SHORT_TEMPLATES.push(function(){
  var occasions = ["pizza bill","taxi fare","bowling bill","cinema trip","birthday cake","minibus hire","picnic shop","escape room booking"];
  var friendsCount = randInt(2, 8);
  var perPerson = randInt(200, 1500) / 100;
  var total = perPerson * friendsCount;
  var prompt = friendsCount + " friends share a £" + money(total) + " " + choice(occasions) +
    " equally. How much does each person pay?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[money(perPerson), "£" + money(perPerson)],
    hint:"Give your answer in pounds and pence, e.g. " + money(perPerson)
  });
});

// 4. Saving over weeks/months
SHORT_TEMPLATES.push(function(){
  var n = name();
  var period = choice(["week","month"]);
  var amt = randInt(150, 1500) / 100;
  var count = randInt(4, 20);
  var total = amt * count;
  var prompt = n + " saves £" + money(amt) + " every " + period + ". How much has " + pron(n) +
    " saved after " + count + " " + pluralise(count, period) + "?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[money(total), "£" + money(total)],
    hint:"Give your answer in pounds and pence, e.g. " + money(total)
  });
});

// 5. Percentage discount / increase
SHORT_TEMPLATES.push(function(){
  var items = ["jacket","games console","bicycle","laptop","pair of trainers","tent","tablet","watch","sofa","microwave"];
  var price = randInt(20, 500);
  var pct = choice([5, 10, 15, 20, 25, 30, 40, 50]);
  var up = Math.random() < 0.5;
  var result = up ? price * (1 + pct / 100) : price * (1 - pct / 100);
  var prompt = "A " + choice(items) + " costs £" + price + ". It's " + (up ? "increased" : "reduced") +
    " by " + pct + "%" + (up ? " for a busy season" : " in a sale") + ". What is the new price?";
  var answers = [money(result), "£" + money(result)];
  if (Math.round(result * 100) === Math.round(result) * 100){
    // result is a whole number of pounds - also accept it without trailing .00
    answers.push(String(Math.round(result)));
  }
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers: answers,
    hint:"Give your answer in pounds and pence, e.g. " + money(result)
  });
});

// 6. Rounding large numbers
SHORT_TEMPLATES.push(function(){
  var num = randInt(100000, 9999999);
  var unit = choice([1000, 10000, 100000]);
  var rounded = Math.round(num / unit) * unit;
  var unitLabel = unit === 1000 ? "1,000" : unit === 10000 ? "10,000" : "100,000";
  var prompt = "Round " + num.toLocaleString("en-GB") + " to the nearest " + unitLabel + ".";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[String(rounded), rounded.toLocaleString("en-GB")]
  });
});

// 7. Place value (digits kept distinct so "the digit N" is unambiguous)
SHORT_TEMPLATES.push(function(){
  var digits = [1,2,3,4,5,6,7,8,9];
  var chosen = [];
  var len = randInt(6, 7);
  for (var i = 0; i < len; i++){
    var idx = randInt(0, digits.length - 1);
    chosen.push(digits[idx]);
    digits.splice(idx, 1);
  }
  var numStr = chosen.join("");
  var num = parseInt(numStr, 10);
  var pos = randInt(1, len - 2); // avoid the units digit, and avoid the leading digit, for a clean "value" question
  var digit = chosen[len - 1 - pos];
  var value = digit * Math.pow(10, pos);
  var prompt = "In the number " + num.toLocaleString("en-GB") + ", what is the value of the digit " + digit + "?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[String(value), value.toLocaleString("en-GB")]
  });
});

// 8. Mean of a list (chosen so the mean is a whole number)
SHORT_TEMPLATES.push(function(){
  var contexts = [
    ["A school recorded rainfall over {n} days (in mm)", "mm"],
    ["A shop's daily takings over {n} days (in pounds)", "pounds"],
    ["A runner's times for {n} training laps (in seconds)", "seconds"],
    ["The temperatures at midday over {n} days (in °C)", "°C"],
    ["A café counted its customers over {n} days", "customers"]
  ];
  var ctx = choice(contexts);
  var n = randInt(4, 7);
  var mean = randInt(10, 200);
  var values = [];
  var remaining = mean * n;
  for (var i = 0; i < n - 1; i++){
    var maxSpread = Math.min(remaining - (n - 1 - i), Math.floor(mean * 0.6));
    var delta = randInt(-maxSpread, maxSpread);
    var v = mean + delta;
    if (v < 1) v = 1;
    values.push(v);
    remaining -= v;
  }
  values.push(remaining);
  if (remaining < 1) return null;
  var label = ctx[0].replace("{n}", n);
  var prompt = label + ": " + values.join(", ") + ". What was the mean" +
    (ctx[1] === "pounds" ? " amount, in pounds" : "") + "?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[String(mean), mean + ".00"]
  });
});

function gcd(a, b){ return b === 0 ? a : gcd(b, a % b); }

// Shared thing/place/property scenarios for the "fraction of an amount"
// templates below - kept as matched tuples (rather than three independent
// choice() picks) so the sentence always makes sense, e.g. never "tickets
// are electric" or "chairs are ripe".
var FRACTION_SCENARIOS = [
  { thing:"plants", place:"garden centre", property:"flowering" },
  { thing:"runners", place:"race", property:"wearing blue vests" },
  { thing:"seats", place:"coach", property:"already booked" },
  { thing:"pupils", place:"school trip", property:"on the honours list" },
  { thing:"books", place:"library", property:"already borrowed" },
  { thing:"cars", place:"car park", property:"electric" },
  { thing:"sweets", place:"tuck shop", property:"already sold" },
  { thing:"tickets", place:"raffle", property:"winning" },
  { thing:"apples", place:"orchard", property:"ripe" },
  { thing:"chairs", place:"hall", property:"stacked" }
];

// 9. Fraction of an amount, given the part, find the whole
SHORT_TEMPLATES.push(function(){
  var s = choice(FRACTION_SCENARIOS);
  var denom = choice([3,4,5,6,7,8,9,10]);
  var numer = randInt(1, denom - 1);
  var g = gcd(numer, denom);
  var dispNumer = numer / g, dispDenom = denom / g;
  var whole = denom * randInt(2, 15);
  var part = (numer * whole) / denom;
  var prompt = dispNumer + "/" + dispDenom + " of the " + s.thing + " in " + article(s.place) + " " + s.place + " are " + s.property +
    ". " + part + " " + s.thing + " are " + s.property + ". How many " + s.thing + " are there in total?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[String(whole)]
  });
});

// 10. Ratio sharing
SHORT_TEMPLATES.push(function(){
  var mixtures = [
    { pair:"sand and cement", first:"sand", noun:"concrete mix", unit:"kg" },
    { pair:"orange juice and lemonade", first:"orange juice", noun:"fruit punch", unit:"litres" },
    { pair:"red paint and white paint", first:"red paint", noun:"pink paint mix", unit:"litres" },
    { pair:"flour and sugar", first:"flour", noun:"biscuit mix", unit:"grams" },
    { pair:"blue beads and yellow beads", first:"blue beads", noun:"bracelet mix", unit:null }
  ];
  var m = choice(mixtures);
  var a = randInt(2, 7);
  var b = randInt(2, 7);
  while (b === a) b = randInt(2, 7);
  var parts = a + b;
  var multiplier = randInt(4, 30);
  var total = parts * multiplier;
  var aAmount = a * multiplier;
  var totalPhrase = m.unit ? (total + " " + m.unit + " of the mixture is made") : (total + " beads are used in total");
  var askPhrase = m.unit ? ("how many " + m.unit + " of " + m.first + " are needed") : ("how many of them are " + m.first);
  var prompt = "A " + m.noun + " combines " + m.pair + " in the ratio " + a + ":" + b + ". If " + totalPhrase +
    ", " + askPhrase + "?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[String(aAmount)]
  });
});

// 11. Speed / distance / time
SHORT_TEMPLATES.push(function(){
  var vehicles = ["car","cyclist","train","coach","delivery van","ferry"];
  var variant = choice(["distance","time","speed"]);
  var speed = randInt(20, 90);
  var hours = choice([1,2,3,4,5,1.5,2.5]);
  var hoursWord = hours + (hours === 1 ? " hour" : " hours");
  var distance = speed * hours;
  var v = choice(vehicles);
  if (variant === "distance"){
    var prompt = "A " + v + " travels at " + speed + "mph for " + hoursWord + ". How far does it travel?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(distance)], hint:"Just the number of miles" });
  } else if (variant === "time"){
    var prompt2 = "A " + v + " travels " + distance + " miles at a steady " + speed + "mph. How many hours does the journey take?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt2, answers:[String(hours)], hint:"Just the number of hours" });
  } else {
    var prompt3 = "A " + v + " travels " + distance + " miles in " + hoursWord + " at a steady speed. What is its speed in mph?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt3, answers:[String(speed)], hint:"Just the number of mph" });
  }
});

// 12. Time duration (24-hour clock, no am/pm ambiguity)
SHORT_TEMPLATES.push(function(){
  var vehicles = ["train","ferry","coach","flight","bus"];
  var startH = randInt(5, 21);
  var startM = choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  var durH = randInt(0, 4);
  var durM = choice([0, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  if (durH === 0 && durM === 0) durM = 30;
  var totalStart = startH * 60 + startM;
  var totalDur = durH * 60 + durM;
  var arrive = (totalStart + totalDur) % (24 * 60);
  var arriveH = Math.floor(arrive / 60);
  var arriveM = arrive % 60;
  function pad(n){ return (n < 10 ? "0" : "") + n; }
  var durText = (durH ? durH + " hour" + (durH === 1 ? "" : "s") + (durM ? " " : "") : "") + (durM ? durM + " minutes" : "");
  var prompt = "A " + choice(vehicles) + " leaves at " + pad(startH) + ":" + pad(startM) + ". The journey takes " +
    durText + ". What time does it arrive?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[pad(arriveH) + ":" + pad(arriveM)],
    hint:"Use 24-hour time, e.g. 13:05"
  });
});

// 13. Perimeter / area of a rectangle
SHORT_TEMPLATES.push(function(){
  var places = ["garden","playground","field","car park","patio","pool","lawn","yard"];
  var l = randInt(4, 40);
  var w = randInt(3, 30);
  var variant = choice(["perimeter", "area"]);
  var place = choice(places);
  if (variant === "perimeter"){
    var perim = 2 * (l + w);
    var prompt = "A rectangular " + place + " is " + l + "m by " + w + "m. What is its perimeter in metres?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(perim)] });
  } else {
    var area = l * w;
    var prompt2 = "A rectangular " + place + " is " + l + "m by " + w + "m. What is its area in square metres?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt2, answers:[String(area)] });
  }
});

// 14. Volume of a cube
SHORT_TEMPLATES.push(function(){
  var unit = choice(["cm","m"]);
  var unitWord = unit === "cm" ? "centimetres" : "metres";
  var s = randInt(2, 25);
  var vol = s * s * s;
  var prompt = "A cube has sides of " + s + unit + ". What is its volume in cubic " + unitWord + "?";
  return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(vol)] });
});

// 15. Negative-number temperature change
SHORT_TEMPLATES.push(function(){
  var start = randInt(-25, -2);
  var delta = randInt(5, 40);
  var result = start + delta;
  var prompt = "The temperature overnight is " + start + "°C. By midday it has risen by " + delta +
    "°C. What is the temperature at midday?";
  return dedupe({
    kind:"short", subject:"maths", prompt: prompt,
    answers:[String(result) + "°C", String(result)]
  });
});

// 16. Division with remainder ("how many needed" — always rounds up)
SHORT_TEMPLATES.push(function(){
  var vehicles = [["minibus","minibuses","children"], ["coach","coaches","passengers"], ["boat","boats","campers"],
    ["lift","lifts","people"], ["table","tables","guests"]];
  var v = choice(vehicles);
  var cap = randInt(4, 60);
  var groups = randInt(2, 20);
  var total = cap * groups + randInt(1, cap - 1);
  var needed = Math.ceil(total / cap);
  var prompt = "Each " + v[0] + " holds " + cap + " " + v[2] + ". How many " + v[1] + " are needed for " +
    total + " " + v[2] + " on a trip?";
  return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(needed)] });
});

// 17. Algebra-lite: sum and difference
SHORT_TEMPLATES.push(function(){
  var smaller = randInt(10, 200);
  var larger = smaller + randInt(2, 100) * 2; // keep same parity as smaller for a whole-number split
  var sum = smaller + larger;
  var diff = larger - smaller;
  var askSmaller = Math.random() < 0.5;
  var prompt = "The sum of two numbers is " + sum + " and their difference is " + diff + ". What is the " +
    (askSmaller ? "smaller" : "larger") + " number?";
  return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(askSmaller ? smaller : larger)] });
});

// 18. Angles (straight line / triangle / quadrilateral)
SHORT_TEMPLATES.push(function(){
  var variant = choice(["line", "triangle", "quad"]);
  if (variant === "line"){
    var a = randInt(20, 160);
    var x = 180 - a;
    var prompt = "Two angles on a straight line are " + a + "° and x°. What is the value of x?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(x), x + "°"], hint:"Just the number of degrees" });
  } else if (variant === "triangle"){
    var a1 = randInt(30, 100);
    var b1 = randInt(20, 170 - a1 - 10);
    var c1 = 180 - a1 - b1;
    var prompt2 = "A triangle has angles of " + a1 + "° and " + b1 + "°. What is the size of the third angle?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt2, answers:[String(c1), c1 + "°"], hint:"Just the number of degrees" });
  } else {
    var a2 = randInt(50, 120);
    var b2 = randInt(50, 120);
    var c2 = randInt(50, 350 - a2 - b2 - 10);
    var d2 = 360 - a2 - b2 - c2;
    if (d2 < 10 || d2 > 170) return null;
    var prompt3 = "A quadrilateral has three angles of " + a2 + "°, " + b2 + "° and " + c2 +
      "°. What is the size of the fourth angle?";
    return dedupe({ kind:"short", subject:"maths", prompt: prompt3, answers:[String(d2), d2 + "°"], hint:"Just the number of degrees" });
  }
});

// 19. Multi-step stock in/out
SHORT_TEMPLATES.push(function(){
  var goods = ["tins of soup","boxes of nails","bags of flour","crates of milk","cartons of juice","reams of paper","bottles of water"];
  var places = ["shop A","the warehouse depot","branch 1","the export order","the local store"];
  var good = choice(goods);
  var start = randInt(20000, 99999);
  var a = randInt(1000, Math.floor(start * 0.4));
  var b = randInt(1000, Math.floor(start * 0.3));
  var left = start - a - b;
  if (left <= 0) return null;
  var place1 = choice(places);
  var place2 = choice(places.filter(function(p){ return p !== place1; }));
  var prompt = "A warehouse held " + start.toLocaleString("en-GB") + " " + good + ". It sent out " +
    a.toLocaleString("en-GB") + " to " + place1 + " and " + b.toLocaleString("en-GB") +
    " to " + place2 + ". How many " + good + " were left?";
  return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(left), left.toLocaleString("en-GB")] });
});

// 20. Rows × seats multiplication
SHORT_TEMPLATES.push(function(){
  var venues = ["stadium","theatre","cinema","concert hall","sports hall","lecture theatre"];
  var rows = randInt(15, 90);
  var perRow = randInt(10, 45);
  var total = rows * perRow;
  var prompt = "A " + choice(venues) + " has " + rows + " rows with " + perRow + " seats in each row. How many seats are there in total?";
  return dedupe({ kind:"short", subject:"maths", prompt: prompt, answers:[String(total), total.toLocaleString("en-GB")] });
});

// ---------------------------------------------------------------------
// MCQ TEMPLATES (need plausible wrong-answer distractors too)
// ---------------------------------------------------------------------

var MCQ_TEMPLATES = [];

function buildOptions(correct, distractors, formatFn){
  var vals = [correct].concat(distractors);
  // de-dupe (a distractor formula can coincide with the correct value or
  // another distractor for some parameter combinations)
  var uniqueVals = [];
  vals.forEach(function(v){ if (uniqueVals.indexOf(v) === -1) uniqueVals.push(v); });
  if (uniqueVals.length < 4) return null;
  uniqueVals = uniqueVals.slice(0, 4);
  // shuffle
  for (var i = uniqueVals.length - 1; i > 0; i--){
    var j = randInt(0, i);
    var tmp = uniqueVals[i]; uniqueVals[i] = uniqueVals[j]; uniqueVals[j] = tmp;
  }
  var correctIdx = uniqueVals.indexOf(correct);
  return { options: uniqueVals.map(formatFn), correct: correctIdx };
}

// 1. Money: change from a note (buying 2-3 items)
MCQ_TEMPLATES.push(function(){
  var items = ["notebook","pen set","umbrella","water bottle","toy","board game","picture frame","football"];
  var n = name();
  var p1 = randInt(100, 800) / 100;
  var p2 = randInt(100, 800) / 100;
  var note = choice([10, 20, 50]);
  var total = p1 + p2;
  if (total >= note) return null;
  var correct = Math.round((note - total) * 100) / 100;
  var distractors = [
    Math.round((correct + 0.20) * 100) / 100,
    Math.round((correct - 0.20) * 100) / 100,
    Math.round((note - p1) * 100) / 100
  ];
  var built = buildOptions(correct, distractors, function(v){ return "£" + money(v); });
  if (!built) return null;
  var item1 = choice(items);
  var item2 = choice(items.filter(function(x){ return x !== item1; }));
  var prompt = n + " buys " + article(item1) + " " + item1 + " for £" + money(p1) + " and " + article(item2) + " " + item2 +
    " for £" + money(p2) + " and pays with a £" + note + " note. How much change does " +
    pron(n) + " get?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 2. Rounding to a stated place
MCQ_TEMPLATES.push(function(){
  var num = randInt(100000, 9999999);
  var unit = choice([1000, 10000, 100000]);
  var unitLabel = unit === 1000 ? "1,000" : unit === 10000 ? "10,000" : "100,000";
  var correct = Math.round(num / unit) * unit;
  var distractors = [correct - unit, correct + unit, correct + 2 * unit];
  var built = buildOptions(correct, distractors, function(v){ return v.toLocaleString("en-GB"); });
  if (!built) return null;
  var prompt = "Round " + num.toLocaleString("en-GB") + " to the nearest " + unitLabel + ".";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 3. Place value of a digit
MCQ_TEMPLATES.push(function(){
  var digits = [1,2,3,4,5,6,7,8,9];
  var chosen = [];
  var len = randInt(6, 7);
  for (var i = 0; i < len; i++){
    var idx = randInt(0, digits.length - 1);
    chosen.push(digits[idx]);
    digits.splice(idx, 1);
  }
  var num = parseInt(chosen.join(""), 10);
  var pos = randInt(1, len - 2);
  var digit = chosen[len - 1 - pos];
  var correct = digit * Math.pow(10, pos);
  var distractors = [digit, digit * Math.pow(10, pos - 1 >= 0 ? pos - 1 : 0), digit * Math.pow(10, pos + 1)];
  var built = buildOptions(correct, distractors, function(v){ return v.toLocaleString("en-GB"); });
  if (!built) return null;
  var prompt = "In the number " + num.toLocaleString("en-GB") + " what is the value of the digit " + digit + "?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 4. Mean of a short list
MCQ_TEMPLATES.push(function(){
  var subjects = ["In a test, {n} pupils scored", "Over {n} matches, a team scored", "A shop had {n} days with sales of"];
  var n = randInt(3, 5);
  var mean = randInt(10, 90);
  var values = [];
  var remaining = mean * n;
  for (var i = 0; i < n - 1; i++){
    var maxSpread = Math.min(remaining - (n - 1 - i), Math.floor(mean * 0.5));
    if (maxSpread < 1) maxSpread = 1;
    var v = mean + randInt(-maxSpread, maxSpread);
    if (v < 1) v = 1;
    values.push(v);
    remaining -= v;
  }
  values.push(remaining);
  if (remaining < 1) return null;
  var correct = mean;
  var distractors = [mean + 2, mean - 2, Math.round(values[0])];
  var built = buildOptions(correct, distractors, function(v){ return String(v); });
  if (!built) return null;
  var subj = choice(subjects).replace("{n}", n);
  var prompt = subj + " " + values.join(", ") + ". What is the mean?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 5. Fraction of an amount
MCQ_TEMPLATES.push(function(){
  var s = choice(FRACTION_SCENARIOS);
  var denom = choice([3,4,5,6,7,8]);
  var numer = randInt(1, denom - 1);
  var g = gcd(numer, denom);
  var dispNumer = numer / g, dispDenom = denom / g;
  var whole = denom * randInt(2, 12);
  var part = (numer * whole) / denom;
  var correct = whole;
  var distractors = [part * denom, whole + denom, whole - denom > 0 ? whole - denom : whole + denom * 2];
  var built = buildOptions(correct, distractors, function(v){ return String(v); });
  if (!built) return null;
  var prompt = dispNumer + "/" + dispDenom + " of the " + s.thing + " in " + article(s.place) + " " + s.place + " are " + s.property +
    ". " + part + " " + s.thing + " are " + s.property + ". How many " + s.thing + " are there altogether?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 6. Percentage discount
MCQ_TEMPLATES.push(function(){
  var items = ["jacket","bicycle","games console","laptop","pair of trainers","tent","watch"];
  var price = randInt(20, 400);
  var pct = choice([10, 20, 25, 30, 40, 50]);
  var correct = Math.round(price * (1 - pct / 100));
  var distractors = [
    Math.round(price * (pct / 100)),
    correct + Math.round(price * 0.05),
    correct - Math.round(price * 0.05)
  ];
  var built = buildOptions(correct, distractors, function(v){ return "£" + v; });
  if (!built) return null;
  var prompt = "A " + choice(items) + " costs £" + price + ". It's reduced by " + pct + "% in a sale. What is the sale price?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 7. Multiplication word problem (rows × seats / crates × cost etc)
MCQ_TEMPLATES.push(function(){
  var venues = ["stadium","theatre","cinema","sports hall","concert hall"];
  var rows = randInt(15, 80);
  var perRow = randInt(10, 40);
  var correct = rows * perRow;
  var distractors = [rows + perRow, correct + perRow, correct - rows];
  var built = buildOptions(correct, distractors, function(v){ return v.toLocaleString("en-GB"); });
  if (!built) return null;
  var prompt = "A " + choice(venues) + " has " + rows + " rows with " + perRow + " seats in each row. How many seats in total?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 8. Angles
MCQ_TEMPLATES.push(function(){
  var variant = choice(["line","triangle","quad"]);
  if (variant === "line"){
    var a = randInt(20, 160);
    var correct = 180 - a;
    var distractors = [a, 180 - a + 10, 180 - a - 10];
    var built = buildOptions(correct, distractors, function(v){ return v + "°"; });
    if (!built) return null;
    var prompt = "Two angles on a straight line are " + a + "° and x°. What is the value of x?";
    return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
  } else if (variant === "triangle"){
    var a1 = randInt(30, 100);
    var b1 = randInt(20, 170 - a1 - 10);
    var correct1 = 180 - a1 - b1;
    var distractors1 = [correct1 + 10, correct1 - 10, a1 + b1];
    var built1 = buildOptions(correct1, distractors1, function(v){ return v + "°"; });
    if (!built1) return null;
    var prompt1 = "A triangle has angles of " + a1 + "° and " + b1 + "°. What is the size of the third angle?";
    return dedupe({ kind:"mcq", subject:"maths", prompt: prompt1, options: built1.options, correct: built1.correct });
  } else {
    var a2 = randInt(50, 110);
    var b2 = randInt(50, 110);
    var c2 = randInt(50, 340 - a2 - b2 - 10);
    var correct2 = 360 - a2 - b2 - c2;
    if (correct2 < 10 || correct2 > 170) return null;
    var distractors2 = [correct2 + 10, correct2 - 10, a2];
    var built2 = buildOptions(correct2, distractors2, function(v){ return v + "°"; });
    if (!built2) return null;
    var prompt2 = "A quadrilateral has three angles of " + a2 + "°, " + b2 + "° and " + c2 + "°. What is the size of the fourth angle?";
    return dedupe({ kind:"mcq", subject:"maths", prompt: prompt2, options: built2.options, correct: built2.correct });
  }
});

// 9. Division with remainder ("how many needed")
MCQ_TEMPLATES.push(function(){
  var vehicles = [["minibus","minibuses","children"], ["coach","coaches","passengers"], ["boat","boats","campers"],
    ["table","tables","guests"]];
  var v = choice(vehicles);
  var cap = randInt(4, 50);
  var groups = randInt(2, 15);
  var total = cap * groups + randInt(1, cap - 1);
  var correct = Math.ceil(total / cap);
  var distractors = [correct - 1, correct + 1, correct + 2];
  var built = buildOptions(correct, distractors, function(v){ return String(v); });
  if (!built) return null;
  var prompt = "Each " + v[0] + " holds " + cap + " " + v[2] + ". How many " + v[1] + " are needed for " + total + " " + v[2] + "?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// 10. Savings over time
MCQ_TEMPLATES.push(function(){
  var n = name();
  var period = choice(["week","month"]);
  var amt = randInt(3, 25);
  var count = randInt(4, 16);
  var correct = amt * count;
  var distractors = [amt + count, correct + amt, correct - amt];
  var built = buildOptions(correct, distractors, function(v){ return "£" + v; });
  if (!built) return null;
  var prompt = n + " saves £" + amt + " every " + period + ". How much will " + pron(n) + " have saved after " +
    count + " " + pluralise(count, period) + "?";
  return dedupe({ kind:"mcq", subject:"maths", prompt: prompt, options: built.options, correct: built.correct });
});

// ---------------------------------------------------------------------
// Generation driver
// ---------------------------------------------------------------------

function generateMany(templates, targetCount){
  var out = [];
  var attempts = 0;
  var maxAttempts = targetCount * 40; // templates can return null (e.g. bad parameter combos); give plenty of headroom
  while (out.length < targetCount && attempts < maxAttempts){
    attempts++;
    var tmpl = choice(templates);
    var item = tmpl();
    if (item) out.push(item);
  }
  return out;
}

function itemToJs(item){
  if (item.kind === "short"){
    var answersJs = item.answers.map(function(a){ return '"' + esc(a) + '"'; }).join(",");
    var hintJs = item.hint ? (', hint:"' + esc(item.hint) + '"') : "";
    return '{ kind:"short", subject:"maths",\n  prompt:"' + esc(item.prompt) + '",\n  answers:[' + answersJs + ']' + hintJs + ' },';
  } else {
    var optionsJs = item.options.map(function(o){ return '"' + esc(o) + '"'; }).join(", ");
    return '{ kind:"mcq", subject:"maths", prompt:"' + esc(item.prompt) + '",\n    options:[' + optionsJs + '], correct:' + item.correct + ' },';
  }
}

var SHORT_TARGET = parseInt(process.argv[2], 10) || 1800;
var MCQ_TARGET = parseInt(process.argv[3], 10) || 1400;

var shortItems = generateMany(SHORT_TEMPLATES, SHORT_TARGET);
var mcqItems = generateMany(MCQ_TEMPLATES, MCQ_TARGET);

process.stderr.write("Generated " + shortItems.length + " short items (target " + SHORT_TARGET + ")\n");
process.stderr.write("Generated " + mcqItems.length + " mcq items (target " + MCQ_TARGET + ")\n");

var fs = require("fs");
fs.writeFileSync("generated-short.txt", shortItems.map(itemToJs).join("\n") + "\n");
fs.writeFileSync("generated-mcq.txt", mcqItems.map(itemToJs).join("\n") + "\n");
fs.writeFileSync("generated-sample.json", JSON.stringify({ short: shortItems.slice(0, 20), mcq: mcqItems.slice(0, 20) }, null, 2));
process.stderr.write("Wrote generated-short.txt, generated-mcq.txt, generated-sample.json\n");
