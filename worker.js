export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const authHeader = request.headers.get("x-secret");
    const isApi = url.pathname.startsWith("/api/");

    if (!authHeader || authHeader !== env.PRIVATE_SECRET) {
      if (isApi) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response("Unauthorized", { status: 401 });
    }

    if (url.pathname === "/") {
      return new Response(renderPage(), {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }

    if (url.pathname === "/api/files" && request.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const list = await env.MY_BUCKET.list({ prefix });
      return new Response(JSON.stringify(list.objects || []), {
        headers: { "content-type": "application/json" }
      });
    }

    if (url.pathname === "/api/file" && request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return new Response("Missing key", { status: 400 });
      const obj = await env.MY_BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      if (obj.httpMetadata?.contentType) headers.set("content-type", obj.httpMetadata.contentType);
      headers.set("content-disposition", `attachment; filename="${decodeURIComponent(key.split('/').pop() || 'download')}"`);
      return new Response(obj.body, { headers });
    }

    if (url.pathname === "/api/upload" && (request.method === "POST" || request.method === "PUT")) {
      let key = url.searchParams.get("key");
      const contentType = request.headers.get("content-type") || "application/octet-stream";
      let body;
      let uploadKey = key;

      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file && typeof file !== "string")) {
          return new Response("No file uploaded", { status: 400 });
        }
        uploadKey = key || file.name;
        body = await file.arrayBuffer();
      } else {
        if (!key) {
          return new Response("Missing key", { status: 400 });
        }
        body = await request.arrayBuffer();
      }

      await env.MY_BUCKET.put(uploadKey, body, {
        httpMetadata: { contentType }
      });

      return new Response(JSON.stringify({ ok: true, key: uploadKey }), {
        headers: { "content-type": "application/json" }
      });
    }

    if (url.pathname === "/api/delete" && request.method === "POST") {
      const key = url.searchParams.get("key");
      if (!key) return new Response("Missing key", { status: 400 });
      await env.MY_BUCKET.delete(key);
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { "content-type": "application/json" }
      });
    }

    if (url.pathname === "/api/todos" && request.method === "GET") {
      const todos = await env.METADATA.get("todos");
      return new Response(todos || "[]", {
        headers: { "content-type": "application/json" }
      });
    }

    if (url.pathname === "/api/todos" && request.method === "POST") {
      const payload = await request.json();
      const list = Array.isArray(payload) ? payload : [payload];
      await env.METADATA.put("todos", JSON.stringify(list));
      return new Response(JSON.stringify(list), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

function renderPage() {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Statio</title>
      <style>
        :root {
          --bg: #090d16;
          --bg2: #121a2a;
          --panel: rgba(255,255,255,0.06);
          --panel-strong: rgba(255,255,255,0.09);
          --text: #edf6ff;
          --muted: #9aa8bb;
          --cyan: #64d9ff;
          --violet: #a78bfa;
          --pink: #ff7bbf;
          --border: rgba(255,255,255,0.12);
          --shadow: rgba(0,0,0,0.4);
        }

        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: Inter, system-ui, sans-serif; }
        body {
          background:
            radial-gradient(circle at 20% 20%, rgba(100, 217, 255, 0.18), transparent 18%),
            radial-gradient(circle at 75% 25%, rgba(167, 139, 250, 0.16), transparent 22%),
            radial-gradient(circle at 50% 80%, rgba(255, 123, 191, 0.12), transparent 20%),
            linear-gradient(135deg, var(--bg), var(--bg2));
        }

        .shell {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 20px 48px;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 0.9rem;
        }

        .brand-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--cyan), var(--pink));
          box-shadow: 0 0 18px rgba(100,217,255,0.9);
        }

        .badge {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--muted);
          font-size: 0.8rem;
        }

        .hero {
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 24px;
          box-shadow: 0 18px 45px var(--shadow);
          backdrop-filter: blur(14px);
        }

        .hero-main {
          padding: 28px;
        }

        h1 {
          margin: 0 0 12px;
          font-size: clamp(2.3rem, 4vw, 4rem);
          line-height: 1.02;
        }

        .subtitle {
          color: var(--muted);
          font-size: 1.04rem;
          max-width: 620px;
          margin-bottom: 20px;
        }

        .stats {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .stat {
          min-width: 110px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 14px;
        }

        .stat strong {
          display: block;
          font-size: 1.2rem;
        }

        .stat span {
          font-size: 0.72rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .hero-side {
          padding: 20px;
        }

        .panel-title {
          margin: 0 0 16px;
          font-size: 0.8rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .upload-box {
          padding: 18px;
          border: 1px dashed rgba(255,255,255,0.18);
          border-radius: 18px;
          background: rgba(255,255,255,0.02);
        }

        .upload-box input[type="file"] {
          width: 100%;
          margin: 8px 0 14px;
          color: var(--muted);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          color: var(--text);
          background: linear-gradient(135deg, var(--cyan), var(--violet));
          box-shadow: 0 10px 30px rgba(100,217,255,0.25);
          font-weight: 600;
        }

        .btn.secondary {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          box-shadow: none;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .panel {
          padding: 20px;
        }

        .list {
          display: grid;
          gap: 12px;
          margin-top: 14px;
        }

        .file-item, .todo-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
        }

        .meta {
          min-width: 0;
        }

        .meta strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .meta small {
          color: var(--muted);
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tiny {
          padding: 8px 10px;
          font-size: 0.8rem;
          border-radius: 10px;
        }

        .danger {
          background: rgba(255,123,191,0.12);
          border: 1px solid rgba(255,123,191,0.4);
          color: #ffd7eb;
        }

        .todo-input {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .todo-input input {
          flex: 1;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          color: var(--text);
          padding: 10px 12px;
        }

        @media (max-width: 900px) {
          .hero, .grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="topbar">
          <div class="brand"><span class="brand-dot"></span> Statio</div>
          <div class="badge">Private personal station</div>
        </div>

        <div class="hero">
          <div class="card hero-main">
            <h1>Your space, your way.</h1>
            <div class="subtitle">Upload files, save your list, keep music and films close at hand — all in one private home base.</div>
            <div class="stats">
              <div class="stat"><strong id="fileCount">0</strong><span>Files</span></div>
              <div class="stat"><strong id="todoCount">0</strong><span>Tasks</span></div>
              <div class="stat"><strong>∞</strong><span>Memory</span></div>
            </div>
          </div>

          <div class="card hero-side">
            <div class="panel-title">Upload</div>
            <div class="upload-box">
              <form id="uploadForm">
                <input type="file" id="fileInput" name="file" />
                <button class="btn" type="submit">Upload to vault</button>
              </form>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="card panel">
            <div class="panel-title">Archive</div>
            <div id="fileList" class="list"></div>
          </div>

          <div class="card panel">
            <div class="panel-title">Todos</div>
            <div class="todo-input">
              <input id="todoInput" type="text" placeholder="Add a task..." />
              <button class="btn tiny" id="addTodoBtn">Add</button>
            </div>
            <div id="todoList" class="list"></div>
          </div>
        </div>
      </div>

      <script>
        const SECRET = prompt("Enter your private secret:");

        async function api(path, options = {}) {
          const headers = { ...(options.headers || {}) };
          if (SECRET) headers["x-secret"] = SECRET;
          const res = await fetch(path, { ...options, headers });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || res.statusText);
          }
          const text = await res.text();
          try { return JSON.parse(text); } catch { return text; }
        }

        async function loadFiles() {
          const files = await api("/api/files");
          const list = document.getElementById("fileList");
          list.innerHTML = "";
          if (!Array.isArray(files) || files.length === 0) {
            list.innerHTML = '<div class="file-item"><div class="meta"><strong>No files yet</strong><small>Upload something to begin</small></div></div>';
            document.getElementById("fileCount").textContent = "0";
            return;
          }
          files.forEach(item => {
            const row = document.createElement("div");
            row.className = "file-item";
            row.innerHTML = `
              <div class="meta">
                <strong>${item.key}</strong>
                <small>${(item.size / 1024).toFixed(1)} KB</small>
              </div>
              <div class="actions">
                <a class="btn secondary tiny" href="/api/file?key=${encodeURIComponent(item.key)}" target="_blank" rel="noopener">Open</a>
                <button class="btn tiny danger" data-key="${item.key}">Delete</button>
              </div>
            `;
            list.appendChild(row);
          });
          document.getElementById("fileCount").textContent = String(files.length);

          list.querySelectorAll(".danger").forEach(btn => {
            btn.addEventListener("click", async () => {
              await api("/api/delete", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ key: btn.dataset.key })
              });
              loadFiles();
            });
          });
        }

        async function loadTodos() {
          const todos = await api("/api/todos");
          const list = document.getElementById("todoList");
          list.innerHTML = "";
          if (!Array.isArray(todos) || todos.length === 0) {
            list.innerHTML = '<div class="file-item"><div class="meta"><strong>No tasks yet</strong><small>Add your first to-do</small></div></div>';
            document.getElementById("todoCount").textContent = "0";
            return;
          }
          todos.forEach((todo, idx) => {
            const row = document.createElement("div");
            row.className = "todo-item";
            row.innerHTML = `
              <div class="meta"><strong>${todo}</strong><small>Task #${idx + 1}</small></div>
              <button class="btn tiny danger" data-index="${idx}">Done</button>
            `;
            list.appendChild(row);
          });
          document.getElementById("todoCount").textContent = String(todos.length);

          list.querySelectorAll(".danger").forEach(btn => {
            btn.addEventListener("click", async () => {
              const newTodos = todos.filter((_, i) => i !== Number(btn.dataset.index));
              await api("/api/todos", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(newTodos)
              });
              loadTodos();
            });
          });
        }

        document.getElementById("uploadForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const file = document.getElementById("fileInput").files[0];
          if (!file) return;
          const formData = new FormData();
          formData.append("file", file, file.name);
          await fetch("/api/upload?key=" + encodeURIComponent(file.name), {
            method: "POST",
            headers: { "x-secret": SECRET },
            body: formData
          });
          document.getElementById("uploadForm").reset();
          loadFiles();
        });

        document.getElementById("addTodoBtn").addEventListener("click", async () => {
          const value = document.getElementById("todoInput").value.trim();
          if (!value) return;
          const existing = await api("/api/todos");
          const list = Array.isArray(existing) ? existing : [];
          list.push(value);
          await api("/api/todos", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(list)
          });
          document.getElementById("todoInput").value = "";
          loadTodos();
        });

        loadFiles();
        loadTodos();
      </script>
    </body>
  </html>`;
}
