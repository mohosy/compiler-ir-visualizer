const exprInput = document.getElementById("exprInput");
const compileBtn = document.getElementById("compileBtn");
const optBtn = document.getElementById("optBtn");

const nodeCount = document.getElementById("nodeCount");
const irCount = document.getElementById("irCount");
const optCount = document.getElementById("optCount");

const astCanvas = document.getElementById("astCanvas");
const actx = astCanvas.getContext("2d");
const irOut = document.getElementById("irOut");
const optOut = document.getElementById("optOut");

let ast = null;
let ir = [];
let optimized = [];

function tokenize(src) {
  const tokens = src.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/]/g);
  return tokens || [];
}

function precedence(op) {
  if (op === "+" || op === "-") return 1;
  if (op === "*" || op === "/") return 2;
  return 0;
}

function toRPN(tokens) {
  const out = [];
  const ops = [];

  tokens.forEach((t) => {
    if (/^[A-Za-z_]|^\d/.test(t)) {
      out.push(t);
      return;
    }

    if (t === "(") {
      ops.push(t);
      return;
    }

    if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        out.push(ops.pop());
      }
      ops.pop();
      return;
    }

    while (ops.length && precedence(ops[ops.length - 1]) >= precedence(t)) {
      out.push(ops.pop());
    }
    ops.push(t);
  });

  while (ops.length) out.push(ops.pop());
  return out;
}

function buildAST(rpn) {
  const stack = [];
  rpn.forEach((t) => {
    if (/^[A-Za-z_]|^\d/.test(t)) {
      stack.push({ type: "literal", value: t, left: null, right: null });
      return;
    }

    const right = stack.pop();
    const left = stack.pop();
    stack.push({ type: "op", value: t, left, right });
  });
  return stack[0] || null;
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

function emitIR(node, out, tempRef) {
  if (!node) return null;
  if (node.type === "literal") return node.value;

  const left = emitIR(node.left, out, tempRef);
  const right = emitIR(node.right, out, tempRef);

  const temp = `t${tempRef.value++}`;
  out.push(`${temp} = ${left} ${node.value} ${right}`);
  return temp;
}

function optimizeIR(lines) {
  const constants = {};
  const out = [];

  lines.forEach((line) => {
    const m = line.match(/^(t\d+) = (\S+) ([+\-*/]) (\S+)$/);
    if (!m) {
      out.push(line);
      return;
    }

    const [, dst, a, op, b] = m;
    const av = constants[a] ?? (isFinite(Number(a)) ? Number(a) : null);
    const bv = constants[b] ?? (isFinite(Number(b)) ? Number(b) : null);

    if (av != null && bv != null) {
      let result = 0;
      if (op === "+") result = av + bv;
      if (op === "-") result = av - bv;
      if (op === "*") result = av * bv;
      if (op === "/") result = bv === 0 ? Infinity : av / bv;
      constants[dst] = result;
      out.push(`${dst} = ${result}`);
    } else {
      out.push(line);
    }
  });

  return out;
}

function layoutTree(node, depth = 0, indexRef = { value: 0 }, arr = []) {
  if (!node) return arr;
  layoutTree(node.left, depth + 1, indexRef, arr);
  arr.push({ node, depth, xIndex: indexRef.value++ });
  layoutTree(node.right, depth + 1, indexRef, arr);
  return arr;
}

function drawAST(root) {
  const w = astCanvas.width;
  const h = astCanvas.height;
  actx.clearRect(0, 0, w, h);
  actx.fillStyle = "#170f0b";
  actx.fillRect(0, 0, w, h);

  if (!root) return;

  const layout = layoutTree(root);
  const maxDepth = Math.max(...layout.map((n) => n.depth), 1);
  const maxIndex = Math.max(...layout.map((n) => n.xIndex), 1);

  const positioned = layout.map((entry) => ({
    ...entry,
    x: 40 + (entry.xIndex / Math.max(1, maxIndex)) * (w - 80),
    y: 30 + (entry.depth / Math.max(1, maxDepth)) * (h - 70),
  }));

  const posMap = new Map(positioned.map((p) => [p.node, p]));

  positioned.forEach((p) => {
    if (p.node.left) {
      const q = posMap.get(p.node.left);
      actx.strokeStyle = "rgba(255,200,170,0.3)";
      actx.beginPath();
      actx.moveTo(p.x, p.y);
      actx.lineTo(q.x, q.y);
      actx.stroke();
    }
    if (p.node.right) {
      const q = posMap.get(p.node.right);
      actx.strokeStyle = "rgba(255,200,170,0.3)";
      actx.beginPath();
      actx.moveTo(p.x, p.y);
      actx.lineTo(q.x, q.y);
      actx.stroke();
    }
  });

  positioned.forEach((p) => {
    actx.beginPath();
    actx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    actx.fillStyle = p.node.type === "op" ? "#ffb88a" : "#ffd9c0";
    actx.fill();

    actx.fillStyle = "#2b190f";
    actx.font = "bold 12px monospace";
    actx.fillText(String(p.node.value), p.x - 7, p.y + 4);
  });
}

function compile() {
  const tokens = tokenize(exprInput.value);
  const rpn = toRPN(tokens);
  ast = buildAST(rpn);

  ir = [];
  emitIR(ast, ir, { value: 0 });
  optimized = optimizeIR(ir);

  nodeCount.textContent = String(countNodes(ast));
  irCount.textContent = String(ir.length);
  optCount.textContent = String(optimized.length);

  irOut.textContent = ir.join("\n") || "(empty)";
  optOut.textContent = optimized.join("\n") || "(empty)";
  drawAST(ast);
}

compileBtn.addEventListener("click", compile);
optBtn.addEventListener("click", () => {
  optimized = optimizeIR(ir);
  optOut.textContent = optimized.join("\n") || "(empty)";
  optCount.textContent = String(optimized.length);
});

compile();
