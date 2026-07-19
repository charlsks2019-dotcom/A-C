import React, { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import {
  Home, Target, MessageCircle, User, Plus, Heart, Send, X,
  CheckCircle2, Circle, Flame, Trophy, ChevronRight, Sparkles,
  Dumbbell, BookOpen, Briefcase, Palette, Image as ImageIcon, Lock, Trash2,
} from "lucide-react";
import * as db from "../lib/db";

const ACCENTS = ["#F4577A", "#35C6B0"];
const CATEGORIES = [
  { id: "fitness", label: "Fitness", icon: Dumbbell, color: "#F4577A" },
  { id: "work", label: "Work", icon: Briefcase, color: "#E8B84B" },
  { id: "learning", label: "Learning", icon: BookOpen, color: "#35C6B0" },
  { id: "hobby", label: "Hobby", icon: Palette, color: "#8B7FE8" },
];
const catInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
const todayKey = () => new Date().toISOString().slice(0, 10);
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function streak(log) {
  let s = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (log.includes(key)) { s++; d.setDate(d.getDate() - 1); } else break;
  }
  return s;
}

const PASSCODE = process.env.NEXT_PUBLIC_APP_PASSCODE || "";

export default function Page() {
  const [unlocked, setUnlocked] = useState(!PASSCODE);
  const [profiles, setProfiles] = useState(null);
  const [goals, setGoals] = useState([]);
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState("feed");
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showPost, setShowPost] = useState(false);

  useEffect(() => {
    if (PASSCODE) {
      const saved = typeof window !== "undefined" && localStorage.getItem("ac-unlocked");
      if (saved === "true") setUnlocked(true);
    }
    const savedUser = typeof window !== "undefined" && localStorage.getItem("ac-current-user");
    if (savedUser) setCurrentUser(savedUser);
  }, []);

  const refetch = useCallback(async () => {
    const [p, g, ps, m] = await Promise.all([db.getProfiles(), db.getGoals(), db.getPosts(), db.getMessages()]);
    setProfiles(p.length ? p : null);
    setGoals(g);
    setPosts(ps);
    setMessages(m);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    refetch();
    const unsub = db.subscribeToAll(() => refetch());
    return unsub;
  }, [unlocked, refetch]);

  const chooseUser = (name) => {
    setCurrentUser(name);
    if (name) localStorage.setItem("ac-current-user", name);
    else localStorage.removeItem("ac-current-user");
  };

  const completeOnboarding = async (nameA, nameB) => {
    await db.createProfiles([
      { name: nameA.trim(), color: ACCENTS[0] },
      { name: nameB.trim(), color: ACCENTS[1] },
    ]);
    refetch();
  };

  if (!unlocked) return <Shell><PasscodeGate correct={PASSCODE} onUnlock={() => { setUnlocked(true); localStorage.setItem("ac-unlocked", "true"); }} /></Shell>;
  if (!loaded) return <Shell><LoadingScreen /></Shell>;
  if (!profiles) return <Shell><Onboarding onSubmit={completeOnboarding} /></Shell>;
  if (!currentUser) return <Shell><WhoAreYou users={profiles} onPick={chooseUser} /></Shell>;

  const me = profiles.find((u) => u.name === currentUser) || profiles[0];
  const partner = profiles.find((u) => u.name !== currentUser) || profiles[1];

  const markGoalDone = async (goal) => {
    const key = todayKey();
    const already = goal.log.includes(key);
    await db.toggleGoalLog(goal.id, key, already);
    if (!already) {
      await db.addPost({
        author_name: currentUser, type: "checkin",
        goal_id: goal.id, goal_title: goal.title, category: goal.category, text: "",
      });
    }
    refetch();
  };

  return (
    <Shell>
      <Head>
        <title>A&C</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#12131C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="A&C" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />
      </Head>
      <div className="flex flex-col h-full">
        <TopBar me={me} partner={partner} goals={goals} onSwitch={() => chooseUser(null)} />
        <div className="flex-1 overflow-y-auto pb-2">
          {tab === "feed" && (
            <Feed
              posts={posts} users={profiles} currentUser={currentUser}
              onLike={async (id, liked) => { await db.toggleLike(id, currentUser, liked); refetch(); }}
              onComment={async (id, text) => { await db.addComment(id, currentUser, text); refetch(); }}
              onDelete={async (id) => { await db.deletePost(id); refetch(); }}
              onOpenPost={() => setShowPost(true)}
            />
          )}
          {tab === "goals" && (
            <Goals goals={goals} users={profiles} onToggle={markGoalDone} onAdd={() => setShowAddGoal(true)} />
          )}
          {tab === "chat" && (
            <Chat messages={messages} users={profiles} currentUser={currentUser}
              onSend={async (text) => { await db.sendMessage(currentUser, text); refetch(); }} />
          )}
          {tab === "profile" && <Profile users={profiles} goals={goals} posts={posts} currentUser={currentUser} />}
        </div>
        <BottomNav tab={tab} setTab={setTab} accent={me.color} />
      </div>

      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onSubmit={async (gVal) => {
            await db.addGoal({ ...gVal, owner_name: currentUser });
            setShowAddGoal(false); refetch();
          }}
        />
      )}
      {showPost && (
        <NewPostModal
          goals={goals.filter((g) => g.owner_name === currentUser)}
          onClose={() => setShowPost(false)}
          onSubmit={async (p) => {
            await db.addPost({ author_name: currentUser, type: "note", ...p });
            setShowPost(false); refetch();
          }}
        />
      )}
    </Shell>
  );
}

/* ---------------- Shell ---------------- */
function Shell({ children }) {
  return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh" }} className="w-full flex items-center justify-center p-3 font-body">
      <div
        className="relative w-full overflow-hidden"
        style={{ maxWidth: 460, height: "100vh", maxHeight: 900, background: "#12131C", borderRadius: 34, border: "1px solid #262838", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", color: "#EDEEF4" }}
      >
        {children}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#35C6B0", borderTopColor: "transparent" }} />
      <p style={{ color: "#8A8DA3", fontSize: 13 }}>Loading A&C…</p>
    </div>
  );
}

function PasscodeGate({ correct, onUnlock }) {
  const [val, setVal] = useState("");
  const [error, setError] = useState(false);
  const submit = () => {
    if (val === correct) onUnlock();
    else { setError(true); setVal(""); }
  };
  return (
    <div className="h-full flex flex-col justify-center px-8">
      <Lock size={26} color="#35C6B0" style={{ marginBottom: 14 }} />
      <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>Private space</h1>
      <p style={{ color: "#8A8DA3", fontSize: 13, margin: "6px 0 20px" }}>Enter the passcode to continue.</p>
      <input
        type="password" value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={inputStyle()} className="mb-3" autoFocus
      />
      {error && <p style={{ color: "#F4577A", fontSize: 12, marginBottom: 12 }}>That's not it — try again.</p>}
      <button onClick={submit} style={{ background: "linear-gradient(90deg,#F4577A,#35C6B0)", color: "#12131C", fontWeight: 600, fontSize: 15, borderRadius: 14, padding: "13px 0" }}>
        Unlock
      </button>
    </div>
  );
}

function inputStyle() {
  return { background: "#1B1D29", border: "1px solid #2E3145", borderRadius: 12, padding: "13px 14px", fontSize: 15, color: "#EDEEF4", outline: "none", width: "100%" };
}

/* ---------------- Onboarding ---------------- */
function Onboarding({ onSubmit }) {
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="h-full flex flex-col justify-center px-8">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: 10, height: 10, borderRadius: 99, background: ACCENTS[0] }} />
        <span style={{ width: 24, height: 2, background: "#2E3145" }} />
        <span style={{ width: 10, height: 10, borderRadius: 99, background: ACCENTS[1] }} />
      </div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>A&C</h1>
      <p style={{ color: "#8A8DA3", fontSize: 14, margin: "8px 0 22px" }}>A private space for the two of you to set goals, track progress, and cheer each other on.</p>
      <label style={{ fontSize: 12, color: "#8A8DA3", marginBottom: 6, display: "block" }}>First person</label>
      <input value={nameA} onChange={(e) => setNameA(e.target.value)} placeholder="e.g. Sam" style={inputStyle()} className="mb-4" />
      <label style={{ fontSize: 12, color: "#8A8DA3", marginBottom: 6, display: "block" }}>Second person</label>
      <input value={nameB} onChange={(e) => setNameB(e.target.value)} placeholder="e.g. Riley" style={inputStyle()} className="mb-8" />
      <button
        disabled={!nameA.trim() || !nameB.trim() || busy}
        onClick={async () => { setBusy(true); await onSubmit(nameA, nameB); setBusy(false); }}
        style={{
          background: !nameA.trim() || !nameB.trim() ? "#232535" : "linear-gradient(90deg,#F4577A,#35C6B0)",
          color: !nameA.trim() || !nameB.trim() ? "#5B5E70" : "#12131C", fontWeight: 600, fontSize: 15, borderRadius: 14, padding: "14px 0",
        }}
      >
        {busy ? "Creating…" : "Create our space"}
      </button>
    </div>
  );
}

function WhoAreYou({ users, onPick }) {
  return (
    <div className="h-full flex flex-col justify-center px-8">
      <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Who's on this device?</h2>
      <p style={{ color: "#8A8DA3", fontSize: 13, marginBottom: 24 }}>Pick your name to continue.</p>
      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <button key={u.name} onClick={() => onPick(u.name)} className="flex items-center gap-3" style={{ background: "#1B1D29", border: "1px solid #2E3145", borderRadius: 14, padding: "14px 16px" }}>
            <Avatar name={u.name} color={u.color} size={38} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>{u.name}</span>
            <ChevronRight size={18} style={{ marginLeft: "auto", color: "#5B5E70" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Avatar({ name, color, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}22`, border: `1.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.38, color, flexShrink: 0 }} className="font-display">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ---------------- Top bar ---------------- */
function TopBar({ me, partner, goals, onSwitch }) {
  const doneToday = goals.filter((g) => g.log.includes(todayKey())).length;
  const total = goals.length;
  const pct = total ? Math.round((doneToday / total) * 100) : 0;
  return (
    <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #1E2030" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} color="#35C6B0" />
          <span className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>A&C</span>
        </div>
        <button onClick={onSwitch} className="flex items-center gap-1.5">
          <Avatar name={me.name} color={me.color} size={26} />
          <span style={{ fontSize: 12, color: "#8A8DA3" }}>{me.name}</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Avatar name={me.name} color={me.color} size={30} />
        <div className="flex-1 relative" style={{ height: 4, background: "#232535", borderRadius: 99 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 99, width: `${pct}%`, background: "linear-gradient(90deg,#F4577A,#35C6B0)", transition: "width .4s ease" }} />
        </div>
        <Avatar name={partner.name} color={partner.color} size={30} />
      </div>
      <p className="font-mono" style={{ fontSize: 11, color: "#5B5E70", marginTop: 6, textAlign: "center" }}>{doneToday}/{total || 0} goals checked in today</p>
    </div>
  );
}

/* ---------------- Feed ---------------- */
function Feed({ posts, users, currentUser, onLike, onComment, onDelete, onOpenPost }) {
  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <button onClick={onOpenPost} className="flex items-center gap-2.5" style={{ background: "#1B1D29", border: "1px dashed #2E3145", borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#232535", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Plus size={15} color="#8A8DA3" />
        </div>
        <span style={{ fontSize: 13.5, color: "#8A8DA3" }}>Share an update…</span>
      </button>

      {posts.length === 0 && (
        <div className="px-2 pt-10 text-center">
          <div style={{ fontSize: 40 }}>🛤️</div>
          <p className="font-display" style={{ fontWeight: 600, fontSize: 16, marginTop: 12 }}>No trail yet</p>
          <p style={{ color: "#8A8DA3", fontSize: 13, marginTop: 4 }}>Check in on a goal, or share your first update.</p>
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} users={users} currentUser={currentUser} onLike={onLike} onComment={onComment} onDelete={onDelete} />
      ))}
    </div>
  );
}

function PostCard({ post, users, currentUser, onLike, onComment, onDelete }) {
  const [commentText, setCommentText] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const author = users.find((u) => u.name === post.author_name) || users[0];
  const liked = post.likes.includes(currentUser);
  const cat = post.category ? catInfo(post.category) : null;
  const CatIcon = cat ? cat.icon : null;
  const isMine = post.author_name === currentUser;

  return (
    <div style={{ background: "#1B1D29", border: "1px solid #232535", borderRadius: 16, padding: 14 }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Avatar name={author.name} color={author.color} size={30} />
        <div className="flex-1">
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>{author.name}</p>
          <p style={{ fontSize: 11, color: "#5B5E70" }}>{timeAgo(post.created_at)}</p>
        </div>
        {cat && (
          <span className="flex items-center gap-1" style={{ background: `${cat.color}1A`, color: cat.color, borderRadius: 99, padding: "3px 9px", fontSize: 11, fontWeight: 600 }}>
            <CatIcon size={11} /> {cat.label}
          </span>
        )}
        {isMine && !confirmingDelete && (
          <button onClick={() => setConfirmingDelete(true)} style={{ padding: 4 }}>
            <Trash2 size={15} color="#5B5E70" />
          </button>
        )}
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between mb-2.5" style={{ background: "#F4577A14", border: "1px solid #F4577A44", borderRadius: 10, padding: "8px 10px" }}>
          <span style={{ fontSize: 12, color: "#F4577A" }}>Delete this post?</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfirmingDelete(false)} style={{ fontSize: 12, color: "#8A8DA3", fontWeight: 600 }}>Cancel</button>
            <button onClick={() => onDelete(post.id)} style={{ fontSize: 12, color: "#F4577A", fontWeight: 700 }}>Delete</button>
          </div>
        </div>
      )}

      {post.type === "checkin" ? (
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: author.color, fontWeight: 600 }}>{author.name}</span> checked in on{" "}
          <span style={{ fontWeight: 600 }}>"{post.goal_title}"</span>{" "}
          <CheckCircle2 size={14} style={{ display: "inline", color: "#35C6B0", verticalAlign: -2 }} />
        </p>
      ) : (
        post.text && <p style={{ fontSize: 14, lineHeight: 1.5 }}>{post.text}</p>
      )}

      {post.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media_url} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10, maxHeight: 320, objectFit: "cover" }} />
      )}

      <div className="flex items-center gap-4 mt-3">
        <button onClick={() => onLike(post.id, liked)} className="flex items-center gap-1.5">
          <Heart size={16} fill={liked ? "#F4577A" : "none"} color={liked ? "#F4577A" : "#8A8DA3"} />
          <span style={{ fontSize: 12, color: "#8A8DA3" }}>{post.likes.length || ""}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <MessageCircle size={16} color="#8A8DA3" />
          <span style={{ fontSize: 12, color: "#8A8DA3" }}>{post.comments.length || ""}</span>
        </div>
      </div>

      {post.comments.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {post.comments.map((c) => (
            <p key={c.id} style={{ fontSize: 12.5, color: "#C7C9D9" }}>
              <span style={{ fontWeight: 600, color: "#EDEEF4" }}>{c.author_name}: </span>{c.text}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5 pt-2.5" style={{ borderTop: "1px solid #232535" }}>
        <input
          value={commentText} onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && commentText.trim()) { onComment(post.id, commentText); setCommentText(""); } }}
          placeholder="Add a comment…" style={{ flex: 1, background: "transparent", fontSize: 13, color: "#EDEEF4", outline: "none" }}
        />
        <button onClick={() => { if (commentText.trim()) { onComment(post.id, commentText); setCommentText(""); } }}>
          <Send size={15} color="#5B5E70" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Goals ---------------- */
function Goals({ goals, users, onToggle, onAdd }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? goals : goals.filter((g) => g.owner_name === filter);
  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {users.map((u) => <Chip key={u.name} active={filter === u.name} onClick={() => setFilter(u.name)} label={u.name} color={u.color} />)}
        <button onClick={onAdd} className="ml-auto flex items-center gap-1" style={{ background: "#232535", borderRadius: 99, padding: "7px 12px" }}>
          <Plus size={14} /> <span style={{ fontSize: 12.5, fontWeight: 600 }}>New</span>
        </button>
      </div>
      {filtered.length === 0 && (
        <div className="text-center pt-12">
          <Target size={30} style={{ color: "#2E3145", margin: "0 auto" }} />
          <p style={{ color: "#5B5E70", fontSize: 13, marginTop: 8 }}>No goals here yet.</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5 pb-2">
        {filtered.map((g) => <GoalRow key={g.id} goal={g} owner={users.find((u) => u.name === g.owner_name)} onToggle={onToggle} />)}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 99, background: active ? (color ? `${color}22` : "#EDEEF4") : "#1B1D29", color: active ? (color || "#12131C") : "#8A8DA3", border: active && color ? `1px solid ${color}` : "1px solid transparent" }}>
      {label}
    </button>
  );
}

function GoalRow({ goal, owner, onToggle }) {
  const cat = catInfo(goal.category);
  const Icon = cat.icon;
  const doneToday = goal.log.includes(todayKey());
  const st = streak(goal.log);
  return (
    <div style={{ background: "#1B1D29", border: "1px solid #232535", borderRadius: 14, padding: 13, display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => onToggle(goal)}>
        {doneToday ? <CheckCircle2 size={24} color="#35C6B0" /> : <Circle size={24} color="#3A3D52" />}
      </button>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14, fontWeight: 600, textDecoration: doneToday ? "line-through" : "none", color: doneToday ? "#6C6F82" : "#EDEEF4" }}>{goal.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1" style={{ color: cat.color, fontSize: 11 }}><Icon size={11} /> {cat.label}</span>
          <span style={{ color: "#5B5E70", fontSize: 11 }}>· {goal.cadence}</span>
          {owner && <span style={{ color: owner.color, fontSize: 11 }}>· {owner.name}</span>}
        </div>
      </div>
      {st > 0 && (
        <div className="flex items-center gap-1" style={{ color: "#E8B84B" }}>
          <Flame size={13} fill="#E8B84B" />
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700 }}>{st}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Modals ---------------- */
function Modal({ onClose, title, children }) {
  return (
    <div className="absolute inset-0 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.55)", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#171923", borderRadius: "20px 20px 0 0", padding: "20px 20px 26px", width: "100%", maxHeight: "82%", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose}><X size={20} color="#8A8DA3" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddGoalModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("fitness");
  const [cadence, setCadence] = useState("daily");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="New goal">
      <label style={{ fontSize: 12, color: "#8A8DA3" }}>Goal</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Run 3x this week" style={{ ...inputStyle(), margin: "6px 0 16px" }} autoFocus />
      <label style={{ fontSize: 12, color: "#8A8DA3" }}>Category</label>
      <div className="flex gap-2 mt-2 mb-4 flex-wrap">
        {CATEGORIES.map((c) => {
          const Icon = c.icon; const active = category === c.id;
          return (
            <button key={c.id} onClick={() => setCategory(c.id)} className="flex items-center gap-1.5" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: active ? `${c.color}22` : "#1B1D29", border: `1px solid ${active ? c.color : "#2E3145"}`, color: active ? c.color : "#8A8DA3" }}>
              <Icon size={13} /> {c.label}
            </button>
          );
        })}
      </div>
      <label style={{ fontSize: 12, color: "#8A8DA3" }}>Cadence</label>
      <div className="flex gap-2 mt-2 mb-6">
        {["daily", "weekly", "monthly"].map((c) => (
          <button key={c} onClick={() => setCadence(c)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 600, textTransform: "capitalize", background: cadence === c ? "#35C6B022" : "#1B1D29", border: `1px solid ${cadence === c ? "#35C6B0" : "#2E3145"}`, color: cadence === c ? "#35C6B0" : "#8A8DA3" }}>{c}</button>
        ))}
      </div>
      <button
        disabled={!title.trim() || busy}
        onClick={async () => { setBusy(true); await onSubmit({ title: title.trim(), category, cadence }); setBusy(false); }}
        style={{ width: "100%", padding: "13px 0", borderRadius: 12, fontWeight: 600, fontSize: 14.5, background: title.trim() ? "linear-gradient(90deg,#F4577A,#35C6B0)" : "#232535", color: title.trim() ? "#12131C" : "#5B5E70" }}
      >
        {busy ? "Adding…" : "Add goal"}
      </button>
    </Modal>
  );
}

function NewPostModal({ goals, onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!text.trim() && !file) return;
    setBusy(true);
    let media_url = null;
    if (file) media_url = await db.uploadMedia(file);
    const goal = goals.find((g) => g.id === goalId);
    await onSubmit({
      text: text.trim(),
      goal_id: goal ? goal.id : null,
      goal_title: goal ? goal.title : null,
      category: goal ? goal.category : null,
      media_url,
    });
    setBusy(false);
  };

  return (
    <Modal onClose={onClose} title="Share an update">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind? A win, a setback, a thought…" rows={4} autoFocus style={{ ...inputStyle(), resize: "none", marginBottom: 12 }} />

      {preview ? (
        <div className="relative mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }} />
          <button onClick={() => { setFile(null); setPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "#12131Cdd", borderRadius: "50%", padding: 5 }}>
            <X size={14} color="#EDEEF4" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 mb-4" style={{ border: "1px dashed #2E3145", borderRadius: 12, padding: "10px 12px", color: "#8A8DA3", fontSize: 13 }}>
          <ImageIcon size={16} /> Add a photo
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

      {goals.length > 0 && (
        <>
          <label style={{ fontSize: 12, color: "#8A8DA3" }}>Attach a goal (optional)</label>
          <div className="flex gap-2 mt-2 mb-6 flex-wrap">
            <button onClick={() => setGoalId("")} style={{ padding: "7px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: goalId === "" ? "#EDEEF422" : "#1B1D29", border: `1px solid ${goalId === "" ? "#8A8DA3" : "#2E3145"}`, color: goalId === "" ? "#EDEEF4" : "#8A8DA3" }}>None</button>
            {goals.map((g) => {
              const cat = catInfo(g.category); const active = goalId === g.id;
              return (
                <button key={g.id} onClick={() => setGoalId(g.id)} style={{ padding: "7px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: active ? `${cat.color}22` : "#1B1D29", border: `1px solid ${active ? cat.color : "#2E3145"}`, color: active ? cat.color : "#8A8DA3" }}>{g.title}</button>
              );
            })}
          </div>
        </>
      )}

      <button
        disabled={(!text.trim() && !file) || busy}
        onClick={submit}
        style={{ width: "100%", padding: "13px 0", borderRadius: 12, fontWeight: 600, fontSize: 14.5, background: (text.trim() || file) ? "linear-gradient(90deg,#F4577A,#35C6B0)" : "#232535", color: (text.trim() || file) ? "#12131C" : "#5B5E70" }}
      >
        {busy ? "Posting…" : "Post"}
      </button>
    </Modal>
  );
}

/* ---------------- Chat ---------------- */
function Chat({ messages, users, currentUser, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 flex flex-col gap-2">
        {messages.length === 0 && <p style={{ color: "#5B5E70", fontSize: 13, textAlign: "center", marginTop: 40 }}>Say hi 👋</p>}
        {messages.map((m) => {
          const mine = m.sender_name === currentUser;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div style={{ maxWidth: "75%", padding: "9px 13px", borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, background: mine ? "linear-gradient(120deg,#F4577A,#E8577A)" : "#1B1D29", border: mine ? "none" : "1px solid #232535" }}>
                <p style={{ fontSize: 14, color: mine ? "#12131C" : "#EDEEF4", fontWeight: mine ? 500 : 400 }}>{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 p-3" style={{ borderTop: "1px solid #1E2030" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onSend(text); setText(""); } }} placeholder="Message…" style={{ flex: 1, background: "#1B1D29", border: "1px solid #2E3145", borderRadius: 99, padding: "10px 16px", fontSize: 14, color: "#EDEEF4", outline: "none" }} />
        <button onClick={() => { if (text.trim()) { onSend(text); setText(""); } }} style={{ background: "#35C6B0", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Send size={16} color="#12131C" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Profile ---------------- */
function Profile({ users, goals, posts, currentUser }) {
  return (
    <div className="px-4 pt-4 flex flex-col gap-4">
      {users.map((u) => {
        const myGoals = goals.filter((g) => g.owner_name === u.name);
        const totalCheckins = myGoals.reduce((sum, g) => sum + g.log.length, 0);
        const bestStreak = myGoals.reduce((max, g) => Math.max(max, streak(g.log)), 0);
        const myPosts = posts.filter((p) => p.author_name === u.name);
        const isMe = u.name === currentUser;
        return (
          <div key={u.name} style={{ background: "#1B1D29", border: `1px solid ${isMe ? u.color + "55" : "#232535"}`, borderRadius: 16, padding: 16 }}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={u.name} color={u.color} size={42} />
              <div>
                <p className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>{u.name}</p>
                <p style={{ fontSize: 11.5, color: "#5B5E70" }}>{isMe ? "You" : "Partner"} · {myGoals.length} goals</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={CheckCircle2} label="Check-ins" value={totalCheckins} color={u.color} />
              <Stat icon={Flame} label="Best streak" value={bestStreak} color="#E8B84B" />
              <Stat icon={Trophy} label="Posts" value={myPosts.length} color="#8B7FE8" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: "#171923", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
      <Icon size={15} color={color} style={{ margin: "0 auto 4px" }} />
      <p className="font-mono" style={{ fontWeight: 600, fontSize: 15 }}>{value}</p>
      <p style={{ fontSize: 9.5, color: "#5B5E70", marginTop: 1 }}>{label}</p>
    </div>
  );
}

/* ---------------- Bottom nav ---------------- */
function BottomNav({ tab, setTab, accent }) {
  const items = [
    { id: "feed", icon: Home, label: "Feed" },
    { id: "goals", icon: Target, label: "Goals" },
    { id: "chat", icon: MessageCircle, label: "Chat" },
    { id: "profile", icon: User, label: "Profile" },
  ];
  return (
    <div className="flex items-center justify-around" style={{ borderTop: "1px solid #1E2030", padding: "10px 0 14px", background: "#12131C" }}>
      {items.map((it) => {
        const Icon = it.icon; const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} className="flex flex-col items-center gap-1">
            <Icon size={21} color={active ? accent : "#4B4E63"} strokeWidth={active ? 2.4 : 2} />
            <span style={{ fontSize: 9.5, color: active ? accent : "#4B4E63", fontWeight: active ? 700 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

