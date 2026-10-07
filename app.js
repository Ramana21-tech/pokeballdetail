// Supabase connection (the publishable key is safe to keep in website code)
const SUPABASE_URL = "https://yzuponyqhunhjktujzjm.supabase.co";
const SUPABASE_KEY = "sb_publishable_Bnx2FNxlM1WJhzlw6YmlYw_1_jUiVDc";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

// Supabase logs in with an email, so the name becomes a hidden email.
const toEmail = n => n.trim().toLowerCase().replace(/[^a-z0-9]/g, "") + "@rams-app.com";

const chips = types => `<div class="chips">${types.map(t => `<span class="chip t-${t}">${t}</span>`).join("")}</div>`;

if (document.body.dataset.page === "login") initLogin();
else initDashboard();

async function initLogin() {
  const { data } = await sb.auth.getSession();
  if (data.session) { location.href = "dashboard.html"; return; }

  const say = (text, ok) => { $("msg").textContent = text; $("msg").className = "msg" + (ok ? " ok" : ""); };

  $("form").onsubmit = async e => {          // Log in (Enter key works too)
    e.preventDefault();
    $("login").disabled = true;
    const { error } = await sb.auth.signInWithPassword({
      email: toEmail($("name").value), password: $("password").value
    });
    $("login").disabled = false;
    if (error) say("Could not log in: " + error.message);
    else location.href = "dashboard.html";
  };

  $("signup").onclick = async () => {
    const name = $("name").value.trim();
    if (!name) return say("Enter a name first.");
    if ($("password").value.length < 6) return say("Use a password with at least 6 characters.");
    $("signup").disabled = true;
    const { error } = await sb.auth.signUp({
      email: toEmail(name), password: $("password").value, options: { data: { name } }
    });
    $("signup").disabled = false;
    if (error) say(error.message);
    else say("Account created. Press Log in to continue.", true);
  };
}

async function initDashboard() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { location.href = "index.html"; return; }
  $("hello").textContent = data.session.user.user_metadata.name || "";
  $("logout").onclick = async () => { await sb.auth.signOut(); location.href = "index.html"; };

  let current = null;

  // Free API call (PokeAPI, no key needed)
  $("searchForm").onsubmit = async e => {
    e.preventDefault();
    const q = $("q").value.trim().toLowerCase();
    if (!q) return;
    $("status").textContent = "Searching...";
    $("result").innerHTML = "";
    $("search").disabled = true;
    try {
      const res = await fetch("https://pokeapi.co/api/v2/pokemon/" + encodeURIComponent(q));
      if (!res.ok) throw new Error("none");
      const p = await res.json();
      current = {
        title: p.name,
        details: {
          image: p.sprites.other["official-artwork"].front_default || p.sprites.front_default,
          types: p.types.map(t => t.type.name),
          height: p.height / 10, weight: p.weight / 10
        }
      };
      const d = current.details;
      $("status").textContent = "";
      $("result").innerHTML = `
        <article class="card">
          <div class="art t-${d.types[0]}"><img src="${d.image}" alt="${p.name}"></div>
          <div>
            <h3>${p.name}</h3>
            ${chips(d.types)}
            <div class="facts"><span>Height <b>${d.height} m</b></span><span>Weight <b>${d.weight} kg</b></span></div>
            <button id="save">Save to collection</button>
          </div>
        </article>`;
      $("save").onclick = async () => {
        $("save").disabled = true;
        const { error } = await sb.from("saved_items").insert(current);
        $("status").textContent = error ? "Could not save: " + error.message : p.name + " saved.";
        $("save").disabled = false;
        loadSaved();
      };
    } catch {
      $("status").textContent = "No Pokémon found for \"" + q + "\". Check the spelling or try its number.";
    }
    $("search").disabled = false;
  };

  // Read this user's saved rows from Supabase
  async function loadSaved() {
    const { data } = await sb.from("saved_items").select("*").order("created_at", { ascending: false });
    const items = data || [];
    $("count").textContent = items.length;
    $("empty").style.display = items.length ? "none" : "block";
    $("saved").innerHTML = items.map(i => `
      <li class="mini">
        <button class="x" onclick="removeItem(${i.id})" aria-label="Remove ${i.title}">✕</button>
        <div class="art t-${i.details.types[0]}"><img src="${i.details.image}" alt="${i.title}"></div>
        <h3>${i.title}</h3>${chips(i.details.types)}
      </li>`).join("");
  }
  window.removeItem = async id => { await sb.from("saved_items").delete().eq("id", id); loadSaved(); };
  loadSaved();
}
