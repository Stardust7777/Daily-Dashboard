"use client";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

export default function Home() {
  const [todos, setTodos] = useState([]); // today's locked-in list (any status)
  const [extras, setExtras] = useState([]);
  const [discarded, setDiscarded] = useState([]);
  const [futureIdeas, setFutureIdeas] = useState([]);
  const [tomorrowTasks, setTomorrowTasks] = useState([]);

  const [newExtra, setNewExtra] = useState("");
  const [newTomorrowTask, setNewTomorrowTask] = useState("");

  const [loading, setLoading] = useState(true);
  const [decisionFor, setDecisionFor] = useState(null);
  const [customDate, setCustomDate] = useState("");

  const [showDiscarded, setShowDiscarded] = useState(false);
  const [showFutureIdeas, setShowFutureIdeas] = useState(false);

  const today = todayStr();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Today's locked-in list: anything scheduled for today, any status except
    // ones that got moved away (discarded/future_idea/rescheduled elsewhere stay visible too,
    // since they were "today's" decisions - but typically they'll show their final status)
    const { data: today_tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("scheduled_date", today)
      .in("status", ["pending", "done"])
      .eq("is_extra", false)
      .order("created_at");

    const { data: extraTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("completed_date", today)
      .eq("is_extra", true)
      .order("created_at");

    const { data: tomorrow } = await supabase
      .from("tasks")
      .select("*")
      .eq("scheduled_date", todayStr(1))
      .eq("status", "pending")
      .order("created_at");

    const { data: discardedTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "discarded")
      .order("created_at", { ascending: false });

    const { data: futureIdeaTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "future_idea")
      .order("created_at", { ascending: false });

    setTodos(today_tasks || []);
    setExtras(extraTasks || []);
    setTomorrowTasks(tomorrow || []);
    setDiscarded(discardedTasks || []);
    setFutureIdeas(futureIdeaTasks || []);
    setLoading(false);
  }

  async function addTomorrowTask() {
    if (!newTomorrowTask.trim()) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ text: newTomorrowTask.trim(), scheduled_date: todayStr(1), status: "pending" })
      .select();
    if (!error && data) {
      setTomorrowTasks((prev) => [...prev, data[0]]);
      setNewTomorrowTask("");
    }
  }

  async function addExtra() {
    if (!newExtra.trim()) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        text: newExtra.trim(),
        scheduled_date: today,
        status: "done",
        completed_date: today,
        is_extra: true,
      })
      .select();
    if (!error && data) {
      setExtras((prev) => [...prev, data[0]]);
      setNewExtra("");
    }
  }

  async function markDone(task) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completed_date: today })
      .eq("id", task.id);
    if (!error) loadData();
  }

  // Undo: in case they ticked done by mistake, click again to revert to pending
  async function markPending(task) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "pending", completed_date: null })
      .eq("id", task.id);
    if (!error) loadData();
  }

  function markNotDone(task) {
    setDecisionFor(task);
    setCustomDate("");
  }

  async function resolveDecision(action) {
    if (!decisionFor) return;
    let update = {};

    if (action === "tomorrow") {
      update = { scheduled_date: todayStr(1), status: "pending" };
    } else if (action === "reschedule") {
      if (!customDate) return;
      update = { scheduled_date: customDate, status: "pending" };
    } else if (action === "discard") {
      update = { status: "discarded" };
    } else if (action === "future_idea") {
      update = { status: "future_idea" };
    }

    const { error } = await supabase
      .from("tasks")
      .update(update)
      .eq("id", decisionFor.id);

    if (!error) {
      setDecisionFor(null);
      setCustomDate("");
      loadData();
    }
  }

  function statusLabel(task) {
    if (task.status === "done") return "✅ Done";
    if (task.status === "pending") return "⏳ Pending";
    return task.status;
  }

  if (loading) return <main className="p-6">Loading...</main>;

  return (
    <main className="max-w-2xl mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold mb-1">My Daily Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">{today}</p>

      {/* TODAY'S LOCKED-IN LIST */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">📋 Today's To-Do</h2>
        <p className="text-xs text-gray-400 mb-3">
          Decided last night — just mark each one done or not done.
        </p>

        <ul className="space-y-2">
          {todos.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between border-b pb-2"
            >
              <span className={t.status === "done" ? "text-gray-400" : ""}>
                {t.text}{" "}
                <span className="text-xs ml-1 text-gray-400">
                  ({statusLabel(t)})
                </span>
              </span>

              <div className="flex gap-2">
                {t.status !== "done" ? (
                  <>
                    <button
                      onClick={() => markDone(t)}
                      className="text-green-600 border border-green-600 rounded px-2 py-0.5 text-sm"
                    >
                      ✓ Done
                    </button>
                    <button
                      onClick={() => markNotDone(t)}
                      className="text-red-600 border border-red-600 rounded px-2 py-0.5 text-sm"
                    >
                      ✗ Not done
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => markPending(t)}
                    className="text-gray-400 border border-gray-300 rounded px-2 py-0.5 text-sm"
                  >
                    Undo
                  </button>
                )}
              </div>
            </li>
          ))}
          {todos.length === 0 && (
            <li className="text-gray-400 text-sm">
              Nothing here. (Did you skip planning yesterday?)
            </li>
          )}
        </ul>
      </section>

      {decisionFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 rounded-lg p-6 w-80 shadow-xl">
            <p className="mb-4 font-medium text-gray-900">
              "{decisionFor.text}" — what now?
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => resolveDecision("tomorrow")}
                className="border border-gray-300 text-gray-900 rounded px-3 py-2 text-left hover:bg-gray-100"
              >
                ➡️ Push to tomorrow
              </button>

              <div className="border border-gray-300 rounded px-3 py-2 flex items-center gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="flex-1 text-gray-900 bg-white"
                />
                <button
                  onClick={() => resolveDecision("reschedule")}
                  className="text-sm underline text-gray-900"
                >
                  Reschedule
                </button>
              </div>

              <button
                onClick={() => resolveDecision("discard")}
                className="border border-gray-300 text-gray-900 rounded px-3 py-2 text-left hover:bg-gray-100"
              >
                🗑️ Discard
              </button>
              <button
                onClick={() => resolveDecision("future_idea")}
                className="border border-gray-300 text-gray-900 rounded px-3 py-2 text-left hover:bg-gray-100"
              >
                💡 Future idea
              </button>
            </div>

            <button
              onClick={() => setDecisionFor(null)}
              className="mt-4 text-sm text-gray-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* TOMORROW'S LIST */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">📝 Tomorrow's To-Do</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTomorrowTask}
            onChange={(e) => setNewTomorrowTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTomorrowTask()}
            placeholder="Plan something for tomorrow..."
            className="border rounded px-3 py-1 flex-1"
          />
          <button
            onClick={addTomorrowTask}
            className="bg-black text-white px-4 py-1 rounded"
          >
            Add
          </button>
        </div>

        <ul className="space-y-1">
          {tomorrowTasks.map((t) => (
            <li key={t.id} className="text-gray-700">
              • {t.text}
            </li>
          ))}
          {tomorrowTasks.length === 0 && (
            <li className="text-gray-400 text-sm">Nothing planned yet for tomorrow.</li>
          )}
        </ul>
      </section>

      {/* EXTRA TASKS DONE */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">➕ Extra Tasks Done</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newExtra}
            onChange={(e) => setNewExtra(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExtra()}
            placeholder="Something you did, unplanned..."
            className="border rounded px-3 py-1 flex-1"
          />
          <button onClick={addExtra} className="bg-black text-white px-4 py-1 rounded">
            Log it
          </button>
        </div>
        <ul className="space-y-1">
          {extras.map((e) => (
            <li key={e.id} className="text-gray-600">
              ⭐ {e.text}
            </li>
          ))}
          {extras.length === 0 && (
            <li className="text-gray-400 text-sm">Nothing logged yet.</li>
          )}
        </ul>
      </section>

      {/* DISCARDED - collapsible */}
      <section className="mb-4 border-t pt-4">
        <button
          onClick={() => setShowDiscarded((s) => !s)}
          className="text-sm font-medium text-gray-500 flex items-center gap-1"
        >
          {showDiscarded ? "▼" : "▶"} 🗑️ Discarded ({discarded.length})
        </button>
        {showDiscarded && (
          <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {discarded.map((d) => (
              <li key={d.id} className="text-gray-400 text-sm">
                {d.text}
              </li>
            ))}
            {discarded.length === 0 && (
              <li className="text-gray-300 text-sm">Nothing discarded yet.</li>
            )}
          </ul>
        )}
      </section>

      {/* FUTURE IDEAS - collapsible */}
      <section className="mb-4">
        <button
          onClick={() => setShowFutureIdeas((s) => !s)}
          className="text-sm font-medium text-gray-500 flex items-center gap-1"
        >
          {showFutureIdeas ? "▼" : "▶"} 💡 Future Ideas ({futureIdeas.length})
        </button>
        {showFutureIdeas && (
          <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {futureIdeas.map((f) => (
              <li key={f.id} className="text-gray-500 text-sm">
                {f.text}
              </li>
            ))}
            {futureIdeas.length === 0 && (
              <li className="text-gray-300 text-sm">No future ideas yet.</li>
            )}
          </ul>
        )}
      </section>
    </main>
  );
}