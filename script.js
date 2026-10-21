/* ---------------------------------------------------------
   Queue data structure (singly linked list, O(1) enqueue/dequeue)
   --------------------------------------------------------- */
class Node {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class Queue {
  constructor() {
    this.head = null; // FRONT: where items leave
    this.tail = null; // REAR: where items join
    this.length = 0;
  }

  enqueue(value) {
    const node = new Node(value);
    if (this.tail) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this.length++;
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const node = this.head;
    this.head = node.next;
    if (!this.head) this.tail = null;
    this.length--;
    return node.value;
  }

  peek() {
    return this.head ? this.head.value : null;
  }

  rear() {
    return this.tail ? this.tail.value : null;
  }

  isEmpty() {
    return this.length === 0;
  }

  size() {
    return this.length;
  }

  // Read-only snapshot for drawing the UI (front -> rear)
  toArray() {
    const out = [];
    for (let n = this.head; n; n = n.next) out.push(n.value);
    return out;
  }
}

/* ---------------------------------------------------------
   App state
   --------------------------------------------------------- */
const STORAGE_KEY = "queuedo.tasks.v1";
const COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff"];
const queue = new Queue();
const logEntries = [];

const $ = (id) => document.getElementById(id);
const form = $("add-form");
const input = $("task-input");
const tube = $("tube");
const list = $("task-list");
const emptyMsg = $("empty-msg");
const logEl = $("log");
const btnDequeue = $("btn-dequeue");
const btnClear = $("btn-clear");

/* ---------- persistence ---------- */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.toArray()));
  } catch (e) { /* storage may be blocked; app still works */ }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    saved.forEach((t) => queue.enqueue(t));
  } catch (e) { /* ignore corrupt data */ }
}

/* ---------- log ---------- */
function log(kind, html) {
  logEntries.unshift({ kind, html });
  if (logEntries.length > 8) logEntries.pop();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- operations (queue-only) ---------- */
function addTask(text) {
  const task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false };
  queue.enqueue(task);
  log("in", `<b>enqueue</b>("${escapeHtml(text)}") → joins the rear`);
  commit();
}

function dequeueFront() {
  const task = queue.dequeue();
  if (!task) return;
  log("out", `<b>dequeue</b>() → "${escapeHtml(task.text)}" leaves the front`);
  commit();
}

/*
  Change or remove one item using only queue operations:
  dequeue every item once, and enqueue it back (possibly modified)
  so the original order is preserved. Returning null from `fn` drops the item.
*/
function cycle(id, fn, description) {
  const n = queue.size();
  for (let i = 0; i < n; i++) {
    let task = queue.dequeue();
    if (task.id === id) task = fn(task);
    if (task) queue.enqueue(task);
  }
  log("cycle", `<b>cycle</b> ${n}× dequeue/enqueue → ${description}`);
  commit();
}

function toggleTask(id) {
  let label = "";
  cycle(id, (t) => {
    t.done = !t.done;
    label = `${t.done ? "checked" : "unchecked"} "${escapeHtml(t.text)}"`;
    return t;
  }, "");
  // replace placeholder description in the newest log entry
  logEntries[0].html = logEntries[0].html.replace("→ ", "→ " + label);
  render();
}

function removeTask(id) {
  let label = "";
  cycle(id, (t) => {
    label = `removed "${escapeHtml(t.text)}"`;
    return null;
  }, "");
  logEntries[0].html = logEntries[0].html.replace("→ ", "→ " + label);
  render();
}

function clearAll() {
  if (queue.isEmpty()) return;
  const n = queue.size();
  while (!queue.isEmpty()) queue.dequeue();
  log("out", `<b>dequeue</b>() × ${n} → queue emptied`);
  commit();
}

function commit() {
  save();
  render();
}

/* ---------- rendering ---------- */
function render() {
  const items = queue.toArray();

  // stats
  $("stat-size").textContent = queue.size();
  const front = queue.peek();
  const rear = queue.rear();
  $("stat-front").textContent = front ? front.text : "—";
  $("stat-rear").textContent = rear ? rear.text : "—";

  btnDequeue.disabled = queue.isEmpty();
  btnClear.disabled = queue.isEmpty();

  // tube visualiser
  tube.innerHTML = "";
  if (items.length === 0) {
    const p = document.createElement("span");
    p.className = "tube-empty";
    p.textContent = "[ empty queue ]";
    tube.appendChild(p);
  }
  items.forEach((t, i) => {
    const chip = document.createElement("div");
    chip.className = "chip" + (t.done ? " done" : "");
    chip.style.background = COLORS[i % COLORS.length];
    chip.title = t.text;
    if (i === 0 || i === items.length - 1) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = items.length === 1 ? "front · rear" : i === 0 ? "front" : "rear";
      chip.appendChild(tag);
    }
    chip.appendChild(document.createTextNode(t.text));
    tube.appendChild(chip);
    if (i < items.length - 1) {
      const a = document.createElement("span");
      a.className = "arrow";
      a.textContent = "←";
      tube.appendChild(a);
    }
  });

  // task list
  list.innerHTML = "";
  emptyMsg.hidden = items.length > 0;
  items.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");

    const pos = document.createElement("span");
    pos.className = "pos";
    pos.style.background = COLORS[i % COLORS.length];
    pos.textContent = i === 0 ? "FRONT" : "#" + (i + 1);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.setAttribute("aria-label", "Toggle " + t.text);
    cb.addEventListener("change", () => toggleTask(t.id));

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = t.text;

    const rm = document.createElement("button");
    rm.className = "remove";
    rm.type = "button";
    rm.textContent = "✕";
    rm.setAttribute("aria-label", "Remove " + t.text);
    rm.addEventListener("click", () => removeTask(t.id));

    li.append(pos, cb, text, rm);
    list.appendChild(li);
  });

  // log
  logEl.innerHTML = "";
  if (logEntries.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = "<b>ready</b> · add a task to see queue operations here";
    logEl.appendChild(li);
  }
  logEntries.forEach((e) => {
    const li = document.createElement("li");
    li.className = e.kind;
    li.innerHTML = e.html;
    logEl.appendChild(li);
  });
}

/* ---------- events ---------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addTask(text);
  input.value = "";
  input.focus();
});

btnDequeue.addEventListener("click", dequeueFront);
btnClear.addEventListener("click", clearAll);

load();
render();
