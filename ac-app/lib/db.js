import { supabase } from "./supabaseClient";

/* ---------- Profiles ---------- */
export async function getProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function createProfiles(names_colors) {
  // names_colors: [{name, color}, {name, color}]
  const { data, error } = await supabase.from("profiles").insert(names_colors).select();
  if (error) throw error;
  return data;
}

/* ---------- Goals ---------- */
export async function getGoals() {
  const { data: goals, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const { data: logs, error: logErr } = await supabase.from("goal_logs").select("*");
  if (logErr) throw logErr;
  return goals.map((g) => ({
    ...g,
    log: logs.filter((l) => l.goal_id === g.id).map((l) => l.log_date),
  }));
}

export async function addGoal({ title, category, cadence, owner_name }) {
  const { data, error } = await supabase
    .from("goals")
    .insert([{ title, category, cadence, owner_name }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function updateGoal(goalId, { title, category, cadence }) {
  const { error } = await supabase.from("goals").update({ title, category, cadence }).eq("id", goalId);
  if (error) throw error;
}

export async function deleteGoal(goalId) {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
}

export async function toggleGoalLog(goalId, dateStr, alreadyLogged) {
  if (alreadyLogged) {
    const { error } = await supabase.from("goal_logs").delete().eq("goal_id", goalId).eq("log_date", dateStr);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase.from("goal_logs").insert([{ goal_id: goalId, log_date: dateStr }]);
    if (error) throw error;
    return true;
  }
}

/* ---------- Posts / Feed ---------- */
export async function getPosts() {
  const { data: posts, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const { data: likes } = await supabase.from("likes").select("*");
  const { data: comments } = await supabase.from("comments").select("*").order("created_at");
  return posts.map((p) => ({
    ...p,
    likes: (likes || []).filter((l) => l.post_id === p.id).map((l) => l.liker_name),
    comments: (comments || []).filter((c) => c.post_id === p.id),
  }));
}

export async function addPost(post) {
  const { data, error } = await supabase.from("posts").insert([post]).select();
  if (error) throw error;
  return data[0];
}

export async function createRecapIfMissing({ author_name, recap_period, recap_period_key, recap_items }) {
  // Fails silently on conflict (recap already exists for this person+period) â€” that's expected, not an error
  const { error } = await supabase
    .from("posts")
    .insert([{ author_name, type: "recap", recap_period, recap_period_key, recap_items }]);
  if (error && error.code !== "23505") throw error; // 23505 = unique_violation, safe to ignore
}

export async function deletePost(postId) {
  // comments and likes cascade-delete automatically via the schema's foreign keys
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function toggleLike(postId, name, alreadyLiked) {
  if (alreadyLiked) {
    const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("liker_name", name);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("likes").insert([{ post_id: postId, liker_name: name }]);
    if (error) throw error;
  }
}

export async function addComment(postId, author_name, text) {
  const { error } = await supabase.from("comments").insert([{ post_id: postId, author_name, text }]);
  if (error) throw error;
}

/* ---------- Photo upload ---------- */
export async function uploadMedia(file) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}

/* ---------- Chat ---------- */
export async function getMessages() {
  const { data, error } = await supabase.from("messages").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function sendMessage(sender_name, text) {
  const { error } = await supabase.from("messages").insert([{ sender_name, text }]);
  if (error) throw error;
}

/* ---------- Presence (who's online) ---------- */
export function subscribeToPresence(userName, onChange) {
  const channel = supabase.channel("ac-online", {
    config: { presence: { key: userName } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      onChange(Object.keys(state));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

  return () => supabase.removeChannel(channel);
}

/* ---------- Realtime subscription ---------- */
export function subscribeToAll(onChange) {
  const channel = supabase
    .channel("ac-app-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "goal_logs" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
