// ============================================================
// Shuyi 传记访谈前端逻辑（豆包风格布局）
// ============================================================

const state = {
  projects: [],
  current: null, // { id, subject_name, pinned, session_id }
};

// ---------- 基础 ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      if (data.error) {
        detail = data.error.message || data.error.code || JSON.stringify(data.error);
      } else {
        detail = data.detail || detail;
      }
    } catch (_) { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

function el(id) {
  return document.getElementById(id);
}

// ---------- 任务栏：人物列表 ----------
async function loadProjects() {
  state.projects = await api("/api/projects");
  renderProjects();
  if (state.projects.length && !state.current) {
    await selectProject(state.projects[0].id);
  } else if (!state.projects.length) {
    state.current = null;
    el("chat-stream").innerHTML = `
      <div class="chat-empty">
        <div class="empty-title">开启一场关于生命的访谈</div>
        <div class="empty-hint">点击左侧「+ 创建新访谈」或「新对话」开始。</div>
      </div>`;
    el("project-badge").textContent = "述忆 · AI 传记访谈";
  }
}

function renderProjects() {
  const list = el("person-list");
  list.innerHTML = "";

  if (!state.projects.length) {
    const tip = document.createElement("div");
    tip.style.cssText = "font-size:12px;color:#8f959e;padding:6px 12px;";
    tip.textContent = "暂无访谈，点击上方 + 创建";
    list.appendChild(tip);
    return;
  }

  for (const p of state.projects) {
    const item = document.createElement("li");
    item.className = "person-item";
    if (state.current && state.current.id === p.id) item.classList.add("active");
    if (p.pinned) item.classList.add("pinned");

    const pinIcon = document.createElement("svg");
    if (p.pinned) {
      pinIcon.classList.add("person-pin");
      pinIcon.setAttribute("viewBox", "0 0 24 24");
      pinIcon.setAttribute("fill", "none");
      pinIcon.setAttribute("stroke", "currentColor");
      pinIcon.setAttribute("stroke-width", "2");
      pinIcon.setAttribute("stroke-linecap", "round");
      pinIcon.setAttribute("stroke-linejoin", "round");
      pinIcon.innerHTML = '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>';
    } else {
      // 占位：保持对其
      pinIcon.classList.add("person-pin-ghost");
    }
    item.appendChild(pinIcon);

    const name = document.createElement("span");
    name.className = "person-name";
    name.textContent = p.subject_name;
    name.title = p.subject_name;
    item.appendChild(name);

    const pinBtn = document.createElement("button");
    pinBtn.className = "mini-btn";
    pinBtn.innerHTML = p.pinned ? "↓" : "↑";
    pinBtn.title = p.pinned ? "取消置顶" : "置顶";
    pinBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePin(p.id); });
    item.appendChild(pinBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "mini-btn danger";
    delBtn.textContent = "×";
    delBtn.title = "删除";
    delBtn.addEventListener("click", (e) => { e.stopPropagation(); deletePerson(p); });
    item.appendChild(delBtn);

    item.addEventListener("click", () => selectProject(p.id));
    list.appendChild(item);
  }
}

async function selectProject(id) {
  const detail = await api(`/api/projects/${id}`);
  state.current = {
    id: detail.id,
    subject_name: detail.subject_name,
    pinned: detail.pinned,
    session_id: detail.session_id,
  };
  el("project-badge").textContent = detail.subject_name;
  renderProjects();
  renderChat(detail.messages);
  updateDevCurrent();
}

async function togglePin(id) {
  await api(`/api/projects/${id}/pin`, { method: "POST" });
  await loadProjects();
}

async function deletePerson(p) {
  const ok = window.confirm(`确定删除访谈项目「${p.subject_name}」吗？所有对话与记忆将一并删除。`);
  if (!ok) return;
  await api(`/api/projects/${p.id}`, { method: "DELETE" });
  if (state.current && state.current.id === p.id) {
    state.current = null;
  }
  await loadProjects();
}

// ---------- 对话流渲染 ----------
function renderChat(messages) {
  const stream = el("chat-stream");
  stream.innerHTML = "";

  if (!messages || !messages.length) {
    const ph = document.createElement("div");
    ph.className = "chat-empty";
    ph.innerHTML = `
      <div class="empty-title">开启一场关于生命的访谈</div>
      <div class="empty-hint">下面开始与 AI 对话，记录 TA 的人生。</div>`;
    stream.appendChild(ph);
    return;
  }

  for (const m of messages) {
    appendBubble(m.role, m.text, true);
  }
  scrollToBottom();
}

function appendBubble(role, text, silent) {
  const isAI = role === "interviewer";

  const msg = document.createElement("div");
  msg.className = "msg " + (isAI ? "ai" : "user");

  // avatar 位置：AI 在左，用户在右；豆包截图 AI 头像在气泡右下，这里左右都头像贴外侧
  if (isAI) {
    const av = buildAvatar("AI", "ai");
    msg.appendChild(av);
  }

  const col = document.createElement("div");
  col.className = "col";

  if (!isAI) {
    const author = document.createElement("div");
    author.className = "author";
    author.textContent = state.current ? state.current.subject_name : "讲述人";
    col.appendChild(author);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  col.appendChild(bubble);

  if (isAI) {
    const actions = buildActions(bubble, text);
    col.appendChild(actions);
  }

  msg.appendChild(col);

  if (!isAI) {
    const label = (state.current ? state.current.subject_name : "我") || "讲述人";
    const av = buildAvatar(label.slice(-1), "user");
    msg.appendChild(av);
  }

  el("chat-stream").appendChild(msg);
  if (!silent) scrollToBottom();
}

function buildAvatar(letter, kind) {
  const d = document.createElement("div");
  d.className = "avatar " + kind;
  d.textContent = letter;
  return d;
}

function buildActions(bubbleEl, text) {
  const row = document.createElement("div");
  row.className = "msg-actions";

  row.appendChild(makeActBtn(
    "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    "复制",
    () => navigator.clipboard.writeText(text).then(() => flash(row, "已复制"))
  ));
  row.appendChild(makeActBtn(
    "M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 0 1 0 14.14 M15.54 8.46a5 5 0 0 1 0 7.07",
    "朗读",
    () => speak(text)
  ));

  const t = document.createElement("span");
  t.className = "msg-time";
  const now = new Date();
  t.textContent =
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  row.appendChild(t);

  return row;
}

function makeActBtn(pathD, title, fn) {
  const btn = document.createElement("button");
  btn.className = "act-btn";
  btn.title = title;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${pathD}"/></svg>`;
  btn.addEventListener("click", fn);
  return btn;
}

function flash(container, text) {
  const t = document.createElement("span");
  t.style.cssText = "color:#3b6df6;font-size:12px;";
  t.textContent = text;
  container.appendChild(t);
  setTimeout(() => t.remove(), 1500);
}

function appendSummaryCard(title, body) {
  const card = document.createElement("div");
  card.className = "summary-card";
  const t = document.createElement("div");
  t.className = "summary-title";
  t.textContent = title;
  const b = document.createElement("div");
  b.className = "summary-body";
  b.textContent = body;
  card.appendChild(t);
  card.appendChild(b);
  el("chat-stream").appendChild(card);
  scrollToBottom();
}

function scrollToBottom() {
  const s = el("chat-stream");
  s.scrollTop = s.scrollHeight;
}

// ---------- 发送消息 ----------
async function sendMessage() {
  if (!state.current) {
    alert("请先在左侧选择或创建一位访谈人物");
    return;
  }
  const input = el("input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  autoResizeInput();
  appendBubble("storyteller", text);
  setBusy(true);

  try {
    const res = await api("/api/interview/turn", {
      method: "POST",
      body: {
        project_id: state.current.id,
        session_id: state.current.session_id,
        answer: text,
      },
    });
    appendBubble("interviewer", res.next_question);
  } catch (err) {
    appendBubble("interviewer", "（请求失败：" + err.message + "）");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  const input = el("input");
  const mic = el("voice-in-btn");
  input.disabled = busy;
  mic.disabled = busy;
  input.placeholder = busy ? "AI 正在思考…" : "发消息或按 Enter 发送…（Shift + Enter 换行）";
}

// ---------- 总结人生 ----------
async function summarize() {
  if (!state.current) {
    alert("请先选择一个访谈项目");
    return;
  }
  el("more-menu").classList.add("hidden");
  setBusy(true);
  try {
    const res = await api("/api/chapters", {
      method: "POST",
      body: {
        project_id: state.current.id,
        focus: "请用简体中文总结这位讲述人的人生经历，突出重要事件、人物和情感主线。",
      },
    });
    appendSummaryCard(res.title, res.body);
  } catch (err) {
    appendBubble("interviewer", "（暂时无法总结：" + err.message + "）");
  } finally {
    setBusy(false);
  }
}

// ---------- 语音：预留接口 ----------
function startVoiceInput() {
  // TODO：接入浏览器 SpeechRecognition 或后端 STT，把识别结果写入输入框
  alert("语音输入即将支持");
}

function speak(text) {
  // TODO：浏览器 SpeechSynthesis.speak(new SpeechSynthesisUtterance(text))，或后端 TTS
  if (!("speechSynthesis" in window)) {
    alert("当前浏览器不支持语音合成");
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (err) {
    alert("朗读失败：" + err.message);
  }
}

// ---------- 弹窗 ----------
function openModal() {
  el("modal-name").value = "";
  el("modal-chinese-name").value = "";
  el("modal-birth-year").value = "";
  el("modal-overlay").classList.remove("hidden");
  setTimeout(() => el("modal-name").focus(), 0);
}

function closeModal() {
  el("modal-overlay").classList.add("hidden");
}

async function confirmAddPerson() {
  const name = el("modal-name").value.trim();
  if (!name) return;
  const chineseName = el("modal-chinese-name").value.trim();
  const birthYear = el("modal-birth-year").value.trim();
  closeModal();
  try {
    const body = { subject_name: name };
    if (chineseName) body.chinese_name = chineseName;
    if (birthYear) body.birth_year = parseInt(birthYear, 10);
    const created = await api("/api/projects", { method: "POST", body });
    await loadProjects();
    await selectProject(created.project_id);
  } catch (err) {
    window.alert("创建失败：" + err.message);
  }
}

// ---------- 输入框自动高度 ----------
function autoResizeInput() {
  const t = el("input");
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, 220) + "px";
}

// ---------- 事件绑定 ----------
function bindEvents() {
  // 添加人物
  el("add-person-btn").addEventListener("click", openModal);
  el("new-chat-btn").addEventListener("click", openModal);
  el("modal-cancel").addEventListener("click", closeModal);
  el("modal-ok").addEventListener("click", confirmAddPerson);
  el("modal-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmAddPerson();
  });
  el("modal-overlay").addEventListener("click", (e) => {
    if (e.target === el("modal-overlay")) closeModal();
  });

  // 发送
  el("input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });
  el("input").addEventListener("input", autoResizeInput);

  // 输入栏功能
  el("more-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    el("more-menu").classList.toggle("hidden");
  });
  document.addEventListener("click", () => el("more-menu").classList.add("hidden"));
  el("summarize-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    summarize();
  });

  // 语音
  el("voice-in-btn").addEventListener("click", startVoiceInput);
  // 顶部栏：复制对话
  el("copy-session-btn").addEventListener("click", () => {
    const all = Array.from(el("chat-stream").querySelectorAll(".bubble"))
      .map(n => n.textContent).join("\n\n");
    if (!all) return;
    navigator.clipboard.writeText(all).then(
      () => alert("对话已复制到剪贴板"),
      (e) => alert("复制失败：" + e.message)
    );
  });
}

// ---------- 启动 ----------
async function init() {
  bindEvents();
  initDevPanel();
  try {
    await loadProjects();
  } catch (err) {
    el("chat-stream").innerHTML =
      `<div class="chat-empty"><div class="empty-title">无法连接后端服务</div><div class="empty-hint">${err.message}</div></div>`;
  }
}

init();

// ============================================================
// 接口测试面板
// ============================================================
let _lastFamilyId = null;

function devVal(id) {
  const node = el(id);
  return node ? node.value.trim() : "";
}

function devInt(id) {
  const v = devVal(id);
  return v === "" ? null : parseInt(v, 10);
}

// 读取 project_id：输入框留空则回退到当前选中项目
function devPid(inputId) {
  const v = devVal(inputId);
  if (v !== "") return parseInt(v, 10);
  if (state.current) return state.current.id;
  throw new Error("请先填写 project_id 或在左侧选择一个访谈人物");
}

function showDevResult(obj) {
  const body = el("dev-result-body");
  body.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function updateDevCurrent() {
  const node = el("dev-current");
  if (!node) return;
  node.textContent = state.current
    ? `当前人物 #${state.current.id} ${state.current.subject_name}`
    : "未选择人物";
}

function apiFormData(path, formData) {
  return fetch(path, { method: "POST", body: formData }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error
        ? data.error.message || data.error.code
        : data.detail || res.statusText;
      throw new Error(msg);
    }
    return data;
  });
}

function splitIds(text) {
  return text.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
}

async function runDevOp(op) {
  try {
    let result = null;
    switch (op) {
      case "family-create": {
        const name = devVal("f-name");
        if (!name) throw new Error("家庭名称必填");
        const body = { name };
        const desc = devVal("f-desc");
        if (desc) body.description = desc;
        result = await api("/api/families", { method: "POST", body });
        _lastFamilyId = result.id;
        break;
      }
      case "family-list":
        result = await api("/api/families");
        if (result.items && result.items.length) _lastFamilyId = result.items[0].id;
        break;
      case "family-tree": {
        const fid = devVal("f-tree-id") || _lastFamilyId;
        if (!fid) throw new Error("请先创建/查询家庭，或填写家庭 ID");
        result = await api(`/api/families/${fid}/tree`);
        break;
      }
      case "rel-create": {
        const fid = devInt("rel-fid");
        const from = devInt("rel-from");
        const to = devInt("rel-to");
        if (!fid || !from || !to) throw new Error("家庭 ID、from、to 均为必填");
        result = await api(`/api/families/${fid}/relationships`, {
          method: "POST",
          body: { from_project_id: from, to_project_id: to, relation_type: el("rel-type").value },
        });
        break;
      }
      case "rel-delete": {
        const rid = devInt("rel-del-id");
        if (!rid) throw new Error("relationship_id 必填");
        result = await api(`/api/relationships/${rid}`, { method: "DELETE" });
        break;
      }
      case "mem-list": {
        const pid = devPid("m-proj");
        let url = `/api/projects/${pid}/memories`;
        const status = devVal("m-status");
        if (status) url += `?status=${encodeURIComponent(status)}`;
        result = await api(url);
        break;
      }
      case "mem-confirm": {
        const mid = devInt("m-id");
        if (!mid) throw new Error("memory_id 必填");
        result = await api(`/api/memories/${mid}/confirm`, {
          method: "POST",
          body: { confirmed_by: "dev", review_note: devVal("m-note") },
        });
        break;
      }
      case "mem-reject": {
        const mid = devInt("m-id");
        if (!mid) throw new Error("memory_id 必填");
        result = await api(`/api/memories/${mid}/reject`, {
          method: "POST",
          body: { review_note: devVal("m-note") },
        });
        break;
      }
      case "mem-update": {
        const mid = devInt("m-edit-id");
        if (!mid) throw new Error("memory_id 必填");
        const body = {};
        const content = devVal("m-edit-content");
        if (content) body.content = content;
        const importance = devVal("m-edit-importance");
        if (importance !== "") body.importance = parseFloat(importance);
        result = await api(`/api/memories/${mid}`, { method: "PATCH", body });
        break;
      }
      case "mem-bulk": {
        const pid = devPid("m-bulk-proj");
        result = await api(`/api/projects/${pid}/memories/bulk-review`, {
          method: "POST",
          body: { confirm_ids: splitIds(devVal("m-bulk-confirm")), reject_ids: splitIds(devVal("m-bulk-reject")) },
        });
        break;
      }
      case "doc-generate": {
        const pid = devPid("d-proj");
        const types = devVal("d-types").split(",").map((s) => s.trim()).filter(Boolean);
        if (!types.length) throw new Error("请填写文稿类型");
        const body = { document_types: types };
        const lang = devVal("d-lang");
        if (lang) body.language = lang;
        result = await api(`/api/projects/${pid}/documents/generate`, { method: "POST", body });
        break;
      }
      case "doc-list": {
        const pid = devPid("d-list-proj");
        result = await api(`/api/projects/${pid}/documents`);
        break;
      }
      case "doc-approve": {
        const did = devInt("d-id");
        if (!did) throw new Error("document_id 必填");
        result = await api(`/api/documents/${did}/approve`, { method: "POST" });
        break;
      }
      case "doc-delete": {
        const did = devInt("d-id");
        if (!did) throw new Error("document_id 必填");
        result = await api(`/api/documents/${did}`, { method: "DELETE" });
        break;
      }
      case "archive-get":
        result = await api(`/api/projects/${devPid("a-proj")}/archive`);
        break;
      case "archive-status":
        result = await api(`/api/projects/${devPid("a-proj")}/archive/status`);
        break;
      case "archive-usage":
        result = await api(`/api/projects/${devPid("a-proj")}/usage`);
        break;
      case "img-create": {
        const prompt = devVal("img-prompt");
        if (!prompt) throw new Error("prompt 必填");
        result = await api(`/api/projects/${devPid("img-proj")}/media/images`, { method: "POST", body: { prompt } });
        break;
      }
      case "au-create": {
        const text = devVal("au-text");
        const voice = devVal("au-voice");
        if (!text || !voice) throw new Error("text 与 voice_id 必填");
        result = await api(`/api/projects/${devPid("au-proj")}/media/audio`, { method: "POST", body: { voice_id: voice, text } });
        break;
      }
      case "vi-create": {
        const prompt = devVal("vi-prompt");
        if (!prompt) throw new Error("prompt 必填");
        result = await api(`/api/projects/${devPid("vi-proj")}/media/videos`, { method: "POST", body: { prompt } });
        break;
      }
      case "job-get": {
        const jid = devInt("job-id");
        if (!jid) throw new Error("job_id 必填");
        result = await api(`/api/media/jobs/${jid}`);
        break;
      }
      case "media-list":
        result = await api(`/api/projects/${devPid("media-proj")}/media`);
        break;
      case "file-upload": {
        const fileInput = el("file-input");
        if (!fileInput.files.length) throw new Error("请选择文件");
        const form = new FormData();
        form.append("file", fileInput.files[0]);
        result = await apiFormData("/api/files", form);
        break;
      }
      case "proj-update": {
        const body = {};
        const fields = [
          ["p-display", "display_name"], ["p-chinese", "chinese_name"],
          ["p-gender", "gender"], ["p-birth", "birth_year"], ["p-place", "birth_place"],
        ];
        for (const [field, key] of fields) {
          const v = devVal(field);
          if (v !== "") body[key] = field === "p-birth" ? parseInt(v, 10) : v;
        }
        result = await api(`/api/projects/${devPid("p-proj")}`, { method: "PATCH", body });
        break;
      }
      case "proj-archive":
        result = await api(`/api/projects/${devPid("p-arch-proj")}/archive-status`, {
          method: "PATCH",
          body: { status: el("p-arch-status").value },
        });
        break;
      case "sess-list":
        result = await api(`/api/projects/${devPid("p-sess-proj")}/sessions`);
        break;
      case "sess-complete": {
        const sid = devInt("p-sess-id");
        if (!sid) throw new Error("session_id 必填");
        result = await api(`/api/sessions/${sid}/complete`, { method: "POST" });
        break;
      }
      default:
        throw new Error("未知操作：" + op);
    }
    showDevResult(result);
  } catch (err) {
    showDevResult({ error: err.message });
  }
}

function initDevPanel() {
  const openBtn = el("dev-open-btn");
  const panel = el("dev-panel");
  if (!openBtn || !panel) return;

  openBtn.addEventListener("click", () => {
    panel.classList.remove("hidden");
    updateDevCurrent();
  });
  el("dev-close").addEventListener("click", () => panel.classList.add("hidden"));
  el("dev-result-clear").addEventListener("click", () => {
    el("dev-result-body").textContent = "（暂无结果）";
  });

  panel.querySelectorAll(".dev-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      panel.querySelectorAll(".dev-tab").forEach((t) => t.classList.remove("active"));
      panel.querySelectorAll(".dev-pane").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const pane = el("pane-" + tab.dataset.tab);
      if (pane) pane.classList.add("active");
    });
  });

  panel.querySelectorAll(".dev-run").forEach((btn) => {
    btn.addEventListener("click", () => runDevOp(btn.dataset.op));
  });
}
